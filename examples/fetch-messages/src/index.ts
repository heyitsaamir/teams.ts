import { App } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common/logging';
import { chats, teams } from '@microsoft/teams.graph-endpoints';

const app = new App({
  logger: new ConsoleLogger('@examples/fetch-messages', { level: 'debug' }),
});

/**
 * Resolve the Graph API chat ID from a Bot Framework activity.
 *
 * The Bot Framework conversation ID differs from the Graph API chat ID:
 * - Channel: use /teams/{aadGroupId}/channels/{channelId}/messages
 * - Group chat: conversationId (19:...@thread.v2) works directly
 * - Personal/DM: construct 19:{userAadId}_{botAppId}@unq.gbl.spaces
 */
function resolveGraphChatId(activity: { conversation: any; from: any }): string {
  const conversationId = activity.conversation.id;
  if (activity.conversation.conversationType === 'personal' && activity.from.aadObjectId && app.id) {
    return `19:${activity.from.aadObjectId}_${app.id}@unq.gbl.spaces`;
  }
  return conversationId;
}

/**
 * Fetch message history for the current conversation using the Graph API.
 *
 * Requires `app.getAppGraph(tenantId)` for a tenant-scoped app token.
 * Works with RSC permissions only — no Azure AD app permissions needed:
 * - ChannelMessage.Read.Group (channels)
 * - ChatMessage.Read.Chat (group chats and DMs)
 */
app.message(/history/i, async ({ send, activity }) => {
  const tenantId = activity.conversation.tenantId;
  const channelData = activity.channelData as {
    team?: { aadGroupId?: string };
    channel?: { id?: string };
  } | undefined;
  const aadGroupId = channelData?.team?.aadGroupId;
  const channelId = channelData?.channel?.id;
  const isChannel = activity.conversation.conversationType === 'channel';
  const chatId = resolveGraphChatId(activity);

  try {
    const graph = app.getAppGraph(tenantId);
    let messages: { from?: any; body?: any }[];

    if (isChannel && aadGroupId && channelId) {
      const response = await graph.call(teams.channels.messages.list, {
        'team-id': aadGroupId,
        'channel-id': channelId,
        $top: 5,
      });
      messages = response.value ?? [];
    } else {
      const response = await graph.call(chats.messages.list, {
        'chat-id': chatId,
        $top: 5,
        $orderby: ['createdDateTime desc'],
      });
      messages = response.value ?? [];
    }

    if (messages.length === 0) {
      await send('No messages found.');
      return;
    }

    const formatted = messages.map((msg, i) => {
      const author = msg.from?.user?.displayName ?? msg.from?.application?.displayName ?? 'Unknown';
      const text = msg.body?.contentType === 'text'
        ? msg.body.content ?? ''
        : '[rich content]';
      return `**${i + 1}.** ${author}: ${text}`;
    }).join('\n\n');

    await send(`**Last ${messages.length} messages:**\n\n${formatted}`);
  } catch (e) {
    await send(
      `Failed to fetch messages: ${e}\n\n` +
      'Ensure the app has RSC permissions. See README for setup.'
    );
  }
});

app.on('message', async ({ reply }) => {
  await reply('Send `history` to fetch message history for this conversation.');
});

app.start().catch(console.error);
