import {
  App,
  HttpStream,
  type IHttpServerRequest,
} from '@microsoft/teams.apps';
import {
  ConversationReference,
  TypingActivity,
  type IActivity,
  type IMessageActivity,
  type IMessageReactionActivity,
  type IAdaptiveCardActionInvokeActivity,
  type ActivityParams,
  type Attachment,
  type MessageReactionType,
} from '@microsoft/teams.api';
import type {
  Adapter,
  ChatInstance,
  RawMessage,
  EmojiValue,
  FetchOptions,
  FetchResult,
  ThreadInfo,
  AdapterPostableMessage,
  FormattedContent,
  StreamChunk,
  StreamOptions,
  FileUpload,
} from 'chat';
import { Message, convertEmojiPlaceholders, defaultEmojiResolver } from 'chat';
import { extractCard, extractFiles, toBuffer, bufferToDataUri } from '@chat-adapter/shared';
import { TeamsFormatConverter, cardToAdaptiveCard } from '@chat-adapter/teams';

import { BridgeHttpAdapter } from './bridge-http-adapter';
import type { TeamsSDKAdapterConfig, TeamsThreadId } from './types';

// Regex to extract ;messageid=<id> from conversation IDs
const MESSAGEID_CAPTURE_PATTERN = /;messageid=(\d+)/;
const MESSAGEID_STRIP_PATTERN = /;messageid=\d+/;

/**
 * Chat SDK adapter powered by teams.ts instead of Bot Framework.
 *
 * Advantages:
 *  - Native streaming via HttpStream (not post+edit fallback)
 *  - Outbound reactions via api.reactions.add/remove
 *  - Built-in JWT validation handled by teams.ts
 */
export class TeamsSDKAdapter implements Adapter<TeamsThreadId, unknown> {
  readonly name = 'teams';
  userName!: string;
  readonly botUserId?: string;

  private app: App;
  private bridge: BridgeHttpAdapter;
  private chat!: ChatInstance;
  private formatConverter = new TeamsFormatConverter();

  constructor(config: TeamsSDKAdapterConfig = {}) {
    // Create the bridge adapter that captures route handlers
    this.bridge = new BridgeHttpAdapter();

    // Create the teams.ts App with bridge adapter
    // App resolves CLIENT_ID / CLIENT_SECRET / TENANT_ID from env if not provided
    this.app = new App({
      ...config,
      httpServerAdapter: this.bridge,
    });
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    this.userName = chat.getUserName();

    // Register event handlers on the app
    this.registerEventHandlers();

    // Initialize the app (registers routes on bridge, prepares auth)
    await this.app.initialize();
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private registerEventHandlers(): void {
    // Handle all incoming activities
    this.app.on('message', async (ctx) => {
      const activity = ctx.activity;

      // Check for Action.Submit sent as message (value.actionId)
      const actionValue = (activity as IMessageActivity).value;
      if (actionValue?.actionId) {
        this.handleMessageAction(activity);
        return;
      }

      // Regular message
      const threadId = this.encodeThreadId({
        conversationId: activity.conversation?.id ?? '',
        serviceUrl: activity.serviceUrl ?? '',
        replyToId: activity.replyToId,
      });

      // Cache user serviceUrl and tenantId for DM support
      this.cacheUserContext(activity);

      this.chat.processMessage(
        this,
        threadId,
        this.parseTeamsMessage(activity, threadId),
      );
    });

    this.app.on('messageReaction', async (ctx) => {
      const activity = ctx.activity as IMessageReactionActivity;
      this.cacheUserContext(activity);
      this.handleReactionActivity(activity);
    });

    this.app.on('invoke', async (ctx) => {
      const activity = ctx.activity;
      if (activity.name === 'adaptiveCard/action') {
        this.handleAdaptiveCardAction(activity as IAdaptiveCardActionInvokeActivity);
      }
    });

    // Handle conversationUpdate for caching
    this.app.on('conversationUpdate', async (ctx) => {
      this.cacheUserContext(ctx.activity);
    });

    // Handle installationUpdate for caching
    this.app.on('installationUpdate', async (ctx) => {
      this.cacheUserContext(ctx.activity);
    });
  }

  // ---------------------------------------------------------------------------
  // Webhook handling
  // ---------------------------------------------------------------------------

  async handleWebhook(request: Request): Promise<Response> {
    const bodyStr = await request.text();
    let body: unknown;
    try {
      body = JSON.parse(bodyStr);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // Build headers map for IHttpServerRequest
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const serverRequest: IHttpServerRequest = { body, headers };

    try {
      const response = await this.bridge.dispatch('POST', '/api/messages', serverRequest);
      return new Response(
        response.body ? JSON.stringify(response.body) : '{}',
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Bridge dispatch error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Outbound: postMessage
  // ---------------------------------------------------------------------------

  async postMessage(threadId: string, message: AdapterPostableMessage): Promise<RawMessage<unknown>> {
    const { conversationId } = this.decodeThreadId(threadId);
    const files = extractFiles(message);
    const fileAttachments = files.length > 0 ? await this.filesToAttachments(files) : [];
    const card = extractCard(message);

    let activity: ActivityParams;
    if (card) {
      const adaptiveCard = cardToAdaptiveCard(card);
      activity = {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: adaptiveCard,
          },
          ...fileAttachments,
        ],
      };
    } else {
      const text = convertEmojiPlaceholders(
        this.formatConverter.renderPostable(message),
        'teams',
      );
      activity = {
        type: 'message',
        text,
        textFormat: 'markdown',
        attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
      };
    }

    const res = await this.app.send(conversationId, activity);
    return {
      id: res.id ?? '',
      threadId,
      raw: activity,
    };
  }

  // ---------------------------------------------------------------------------
  // Outbound: editMessage
  // ---------------------------------------------------------------------------

  async editMessage(threadId: string, messageId: string, message: AdapterPostableMessage): Promise<RawMessage<unknown>> {
    const { conversationId } = this.decodeThreadId(threadId);
    const card = extractCard(message);

    let activity: ActivityParams;
    if (card) {
      const adaptiveCard = cardToAdaptiveCard(card);
      activity = {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: adaptiveCard,
          },
        ],
      };
    } else {
      const text = convertEmojiPlaceholders(
        this.formatConverter.renderPostable(message),
        'teams',
      );
      activity = {
        type: 'message',
        text,
        textFormat: 'markdown',
      };
    }

    await this.app.api.conversations
      .activities(conversationId)
      .update(messageId, activity);

    return { id: messageId, threadId, raw: activity };
  }

  // ---------------------------------------------------------------------------
  // Outbound: deleteMessage
  // ---------------------------------------------------------------------------

  async deleteMessage(threadId: string, messageId: string): Promise<void> {
    const { conversationId } = this.decodeThreadId(threadId);
    await this.app.api.conversations
      .activities(conversationId)
      .delete(messageId);
  }

  // ---------------------------------------------------------------------------
  // Outbound: reactions (teams.ts supports this; BF adapter throws)
  // ---------------------------------------------------------------------------

  async addReaction(threadId: string, messageId: string, emoji: EmojiValue | string): Promise<void> {
    const { conversationId } = this.decodeThreadId(threadId);
    const reactionType = typeof emoji === 'string' ? emoji : emoji.name;
    await this.app.api.reactions.add(conversationId, messageId, reactionType as MessageReactionType);
  }

  async removeReaction(threadId: string, messageId: string, emoji: EmojiValue | string): Promise<void> {
    const { conversationId } = this.decodeThreadId(threadId);
    const reactionType = typeof emoji === 'string' ? emoji : emoji.name;
    await this.app.api.reactions.remove(conversationId, messageId, reactionType as MessageReactionType);
  }

  // ---------------------------------------------------------------------------
  // Outbound: typing indicator
  // ---------------------------------------------------------------------------

  async startTyping(threadId: string): Promise<void> {
    const { conversationId } = this.decodeThreadId(threadId);
    await this.app.send(conversationId, new TypingActivity());
  }

  // ---------------------------------------------------------------------------
  // Outbound: stream (native HttpStream for 1:1, post+edit for group)
  // ---------------------------------------------------------------------------

  async stream(
    threadId: string,
    textStream: AsyncIterable<string | StreamChunk>,
    _options?: StreamOptions,
  ): Promise<RawMessage<unknown>> {
    const decoded = this.decodeThreadId(threadId);
    const isDM = this.isDM(threadId);

    if (isDM) {
      return this.streamNative(decoded, threadId, textStream);
    }
    return this.streamPostEdit(decoded, threadId, textStream);
  }

  /**
   * Native streaming for 1:1 chats using HttpStream.
   * Emits typing activities with streamUpdate channelData so Teams
   * displays progressive text updates.
   */
  private async streamNative(
    decoded: TeamsThreadId,
    threadId: string,
    textStream: AsyncIterable<string | StreamChunk>,
  ): Promise<RawMessage<unknown>> {
    const ref: ConversationReference = {
      channelId: 'msteams',
      serviceUrl: this.app.api.serviceUrl,
      bot: {
        id: this.app.id!,
        name: this.userName || this.app.id!,
        role: 'bot',
      },
      conversation: {
        id: decoded.conversationId,
        conversationType: 'personal',
      },
    };

    const stream = new HttpStream(this.app.api, ref);

    for await (const chunk of textStream) {
      const text = typeof chunk === 'string' ? chunk : chunk.type === 'markdown_text' ? chunk.text : '';
      if (text) {
        stream.emit(text);
      }
    }

    const result = await stream.close();
    const messageId = result?.id ?? '';

    return { id: messageId, threadId, raw: result };
  }

  /**
   * Post+edit fallback for group chats where native streaming isn't supported.
   * Posts an initial message, then edits it as more text arrives.
   */
  private async streamPostEdit(
    decoded: TeamsThreadId,
    threadId: string,
    textStream: AsyncIterable<string | StreamChunk>,
  ): Promise<RawMessage<unknown>> {
    let accumulated = '';
    let messageId: string | undefined;

    for await (const chunk of textStream) {
      const text = typeof chunk === 'string' ? chunk : chunk.type === 'markdown_text' ? chunk.text : '';
      if (!text) continue;

      accumulated += text;

      if (!messageId) {
        // Post initial message
        const res = await this.app.send(decoded.conversationId, {
          type: 'message',
          text: accumulated,
          textFormat: 'markdown',
        });
        messageId = res.id ?? '';
      } else {
        // Edit with accumulated text
        await this.app.api.conversations
          .activities(decoded.conversationId)
          .update(messageId, {
            type: 'message',
            text: accumulated,
            textFormat: 'markdown',
          });
      }
    }

    // Final edit with complete text
    if (messageId && accumulated) {
      await this.app.api.conversations
        .activities(decoded.conversationId)
        .update(messageId, {
          type: 'message',
          text: accumulated,
          textFormat: 'markdown',
        });
    }

    return { id: messageId ?? '', threadId, raw: { text: accumulated } };
  }

  // ---------------------------------------------------------------------------
  // Outbound: openDM
  // ---------------------------------------------------------------------------

  async openDM(userId: string): Promise<string> {
    const cachedTenantId = await this.chat?.getState().get<string>(`teams:tenantId:${userId}`);
    const serviceUrl = this.app.api.serviceUrl;
    const tenantId: string | undefined = cachedTenantId || this.app.credentials?.tenantId;

    if (!tenantId) {
      throw new Error(
        'Cannot open DM: tenant ID not found. User must interact with the bot first.',
      );
    }

    const res = await this.app.api.conversations.create({
      isGroup: false,
      bot: { id: this.app.id!, name: this.userName, role: 'bot' },
      members: [{ id: userId, name: '', role: 'user' }],
      tenantId,
      channelData: { tenant: { id: tenantId } },
    });

    const conversationId = res.id ?? '';
    if (!conversationId) {
      throw new Error('Failed to create 1:1 conversation - no ID returned');
    }

    return this.encodeThreadId({ conversationId, serviceUrl });
  }

  // ---------------------------------------------------------------------------
  // Fetch messages (Graph API — same approach as existing adapter)
  // ---------------------------------------------------------------------------

  async fetchMessages(_threadId: string, _options?: FetchOptions): Promise<FetchResult<unknown>> {
    // Graph API message history requires additional setup (ChatMessage.Read.Chat permissions).
    // The teams.ts GraphClient uses endpoint functions, not raw URL access.
    // For a full implementation, add @microsoft/microsoft-graph-client or use
    // the teams.ts graph endpoints when chat message endpoints are available.
    throw new Error(
      'fetchMessages requires Microsoft Graph API setup (ChatMessage.Read.Chat permission). ' +
      'Not yet implemented in the teams.ts adapter.',
    );
  }

  // ---------------------------------------------------------------------------
  // fetchThread
  // ---------------------------------------------------------------------------

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const { conversationId } = this.decodeThreadId(threadId);
    return {
      id: threadId,
      channelId: this.channelIdFromThreadId(threadId),
      isDM: this.isDM(threadId),
      metadata: { conversationId },
    };
  }

  // ---------------------------------------------------------------------------
  // Thread ID encoding/decoding — compatible with @chat-adapter/teams
  // ---------------------------------------------------------------------------

  encodeThreadId(platformData: TeamsThreadId): string {
    const convEncoded = Buffer.from(platformData.conversationId).toString('base64url');
    const svcEncoded = Buffer.from(platformData.serviceUrl).toString('base64url');
    return `teams:${convEncoded}:${svcEncoded}`;
  }

  decodeThreadId(threadId: string): TeamsThreadId {
    const parts = threadId.split(':');
    if (parts.length < 3 || parts[0] !== 'teams') {
      throw new Error(`Invalid Teams thread ID: ${threadId}`);
    }
    // Rejoin parts 1..n-1 and last part in case base64 contains ':'
    // Actually base64url doesn't contain ':', so parts[1] and parts[2] are correct
    const conversationId = Buffer.from(parts[1], 'base64url').toString();
    const serviceUrl = Buffer.from(parts[2], 'base64url').toString();
    return { conversationId, serviceUrl };
  }

  channelIdFromThreadId(threadId: string): string {
    const { conversationId } = this.decodeThreadId(threadId);
    return conversationId.replace(MESSAGEID_STRIP_PATTERN, '');
  }

  isDM(threadId: string): boolean {
    const { conversationId } = this.decodeThreadId(threadId);
    return !conversationId.startsWith('19:');
  }

  // ---------------------------------------------------------------------------
  // parseMessage / renderFormatted
  // ---------------------------------------------------------------------------

  parseMessage(raw: unknown): Message<unknown> {
    const activity = raw as IActivity;
    const threadId = this.encodeThreadId({
      conversationId: activity.conversation?.id ?? '',
      serviceUrl: activity.serviceUrl ?? '',
    });
    return this.parseTeamsMessage(activity, threadId);
  }

  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private parseTeamsMessage(activity: IActivity, threadId: string): Message {
    const messageActivity = activity as IActivity & Partial<IMessageActivity>;
    const text = this.normalizeMentions(messageActivity.text || '', activity);
    const isMe = this.isMessageFromSelf(activity);

    return new Message({
      id: activity.id || '',
      threadId,
      text: this.formatConverter.extractPlainText?.(text) ?? text,
      formatted: this.formatConverter.toAst(text),
      raw: activity,
      author: {
        userId: activity.from?.id || 'unknown',
        userName: activity.from?.name || 'unknown',
        fullName: activity.from?.name || 'unknown',
        isBot: activity.from?.role === 'bot',
        isMe,
      },
      metadata: {
        dateSent: activity.timestamp ? new Date(activity.timestamp) : new Date(),
        edited: false,
      },
      attachments: (messageActivity.attachments || [])
        .filter((att: Attachment) =>
          att.contentType !== 'application/vnd.microsoft.card.adaptive' &&
          !(att.contentType === 'text/html' && !att.contentUrl)
        )
        .map((att: Attachment) => ({
          id: att.contentUrl || att.name || '',
          name: att.name || 'attachment',
          type: 'file' as const,
          mimeType: att.contentType || 'application/octet-stream',
          url: att.contentUrl,
          size: undefined,
        })),
    });
  }

  private normalizeMentions(text: string, activity: IActivity): string {
    if (!activity.entities) return text;
    let normalized = text;
    for (const entity of activity.entities) {
      if (entity.type === 'mention' && entity.mentioned) {
        const atPattern = `<at>${entity.mentioned.name}</at>`;
        normalized = normalized.replace(atPattern, `@${entity.mentioned.name}`);
      }
    }
    return normalized.trim();
  }

  private isMessageFromSelf(activity: IActivity): boolean {
    const fromId = activity.from?.id || '';
    const appId = this.app.id || '';
    if (!appId) return false;
    return fromId === appId || fromId.endsWith(`:${appId}`);
  }

  private handleMessageAction(activity: IActivity): void {
    if (!this.chat) return;
    const actionValue = (activity as IMessageActivity).value;
    if (!actionValue?.actionId) return;

    const threadId = this.encodeThreadId({
      conversationId: activity.conversation?.id || '',
      serviceUrl: activity.serviceUrl || '',
    });

    this.chat.processAction({
      actionId: actionValue.actionId,
      value: actionValue.value,
      user: {
        userId: activity.from?.id || 'unknown',
        userName: activity.from?.name || 'unknown',
        fullName: activity.from?.name || 'unknown',
        isBot: false,
        isMe: false,
      },
      messageId: activity.replyToId || activity.id || '',
      threadId,
      adapter: this,
      raw: activity,
    });
  }

  private handleAdaptiveCardAction(activity: IAdaptiveCardActionInvokeActivity): void {
    if (!this.chat) return;

    const actionData = activity.value?.action?.data;
    if (!actionData?.actionId) return;

    const threadId = this.encodeThreadId({
      conversationId: activity.conversation?.id || '',
      serviceUrl: activity.serviceUrl || '',
    });

    this.chat.processAction({
      actionId: actionData.actionId,
      value: actionData.value,
      user: {
        userId: activity.from?.id || 'unknown',
        userName: activity.from?.name || 'unknown',
        fullName: activity.from?.name || 'unknown',
        isBot: false,
        isMe: false,
      },
      messageId: activity.replyToId || activity.id || '',
      threadId,
      adapter: this,
      raw: activity,
    });
  }

  private handleReactionActivity(activity: IMessageReactionActivity): void {
    if (!this.chat) return;

    const conversationId = activity.conversation?.id || '';
    const messageIdMatch = conversationId.match(MESSAGEID_CAPTURE_PATTERN);
    const messageId = messageIdMatch?.[1] || activity.replyToId || '';

    const threadId = this.encodeThreadId({
      conversationId,
      serviceUrl: activity.serviceUrl || '',
    });

    const user = {
      userId: activity.from?.id || 'unknown',
      userName: activity.from?.name || 'unknown',
      fullName: activity.from?.name || 'unknown',
      isBot: false,
      isMe: this.isMessageFromSelf(activity),
    };

    for (const reaction of activity.reactionsAdded || []) {
      const rawEmoji = reaction.type || '';
      const emojiValue = defaultEmojiResolver.fromTeams(rawEmoji);

      this.chat.processReaction({
        emoji: emojiValue,
        rawEmoji,
        added: true,
        user,
        messageId,
        threadId,
        raw: activity,
        adapter: this,
      });
    }

    for (const reaction of activity.reactionsRemoved || []) {
      const rawEmoji = reaction.type || '';
      const emojiValue = defaultEmojiResolver.fromTeams(rawEmoji);

      this.chat.processReaction({
        emoji: emojiValue,
        rawEmoji,
        added: false,
        user,
        messageId,
        threadId,
        raw: activity,
        adapter: this,
      });
    }
  }

  private async filesToAttachments(files: FileUpload[]): Promise<Attachment[]> {
    const attachments: Attachment[] = [];
    for (const file of files) {
      const buffer = await toBuffer(file.data, {
        platform: 'teams',
        throwOnUnsupported: false,
      });
      if (!buffer) continue;
      const mimeType = file.mimeType || 'application/octet-stream';
      const dataUri = bufferToDataUri(buffer, mimeType);
      attachments.push({
        contentType: mimeType,
        contentUrl: dataUri,
        name: file.filename,
      });
    }
    return attachments;
  }

  private cacheUserContext(activity: IActivity): void {
    if (!this.chat || !activity.from?.id) return;

    const userId = activity.from.id;
    const ttl = 30 * 24 * 60 * 60 * 1000; // 30 days

    const tenantId = activity.channelData?.tenant?.id;
    if (tenantId) {
      this.chat.getState().set(`teams:tenantId:${userId}`, tenantId, ttl).catch(() => {});
    }

    // Cache channel context for Graph API
    const team = activity.channelData?.team;
    const teamAadGroupId = team?.aadGroupId;
    const conversationId = activity.conversation?.id || '';
    const baseChannelId = conversationId.replace(MESSAGEID_STRIP_PATTERN, '');

    if (teamAadGroupId && activity.channelData?.channel?.id && tenantId) {
      const context = {
        teamId: teamAadGroupId,
        channelId: activity.channelData.channel.id,
        tenantId,
      };
      this.chat.getState().set(
        `teams:channelContext:${baseChannelId}`,
        JSON.stringify(context),
        ttl,
      ).catch(() => {});
    }
  }
}
