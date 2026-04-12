import { App } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common/logging';
import { applications, chats } from '@microsoft/teams.graph-endpoints';

const app = new App({
  logger: new ConsoleLogger('@examples/fetch-messages', { level: 'debug' }),
});

/**
 * /history — Fetch message history for the current chat using the Graph API.
 *
 * This requires a tenant-scoped app token because the Graph API endpoint
 * `GET /chats/{chat-id}/messages` needs app-only permissions (e.g.,
 * ChatMessage.Read.Chat via RSC) authenticated against the specific tenant.
 *
 * Using `app.graph` (the default Graph client) won't work here because it
 * acquires a token for the "common" tenant, which can't read chat messages.
 *
 * `app.getAppGraph(tenantId)` solves this by returning a Graph client with
 * a token scoped to the correct tenant.
 */
app.message('/history', async ({ send, activity }) => {
  const chatId = activity.conversation.id;
  const tenantId = activity.conversation.tenantId;

  try {
    const graph = app.getAppGraph(tenantId);
    const response = await graph.call(chats.messages.list, {
      'chat-id': chatId,
      $top: 5,
      $orderby: ['createdDateTime desc'],
    });

    const messages = response.value ?? [];
    if (messages.length === 0) {
      await send('No messages found in this chat.');
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
      'Ensure the app has **ChatMessage.Read.Chat** RSC permission. ' +
      'See README for setup instructions.'
    );
  }
});

/**
 * /history-broken — Same as /history but uses `app.graph` (no tenant scoping).
 *
 * This demonstrates the problem: `app.graph` uses a token for the "common"
 * tenant, which will fail with a 403 when trying to read chat messages.
 */
app.message('/history-broken', async ({ send, activity }) => {
  const chatId = activity.conversation.id;

  try {
    // This uses the default graph client which gets a token for "common" tenant
    const response = await app.graph.call(chats.messages.list, {
      'chat-id': chatId,
      $top: 5,
      $orderby: ['createdDateTime desc'],
    });

    const messages = response.value ?? [];
    await send(`Fetched ${messages.length} messages (this usually fails).`);
  } catch (e) {
    await send(
      `**Expected failure** using \`app.graph\` (no tenant scoping):\n\n\`${e}\`\n\n` +
      'Try `/history` instead — it uses `app.getAppGraph(tenantId)` which works.'
    );
  }
});

/**
 * /app-info — Fetch the bot's own app registration details from Azure AD.
 *
 * Uses `GET /applications/{application-id}` which requires a tenant-scoped
 * app token with Application.Read.All permission. This is another example
 * of an app-only Graph call that needs `getAppGraph(tenantId)`.
 */
app.message('/app-info', async ({ send, activity }) => {
  const tenantId = activity.conversation.tenantId;
  const appId = app.id;

  if (!appId) {
    await send('App ID not configured.');
    return;
  }

  try {
    const graph = app.getAppGraph(tenantId);
    const result = await graph.call(applications.list, {
      $filter: `appId eq '${appId}'`,
      $select: ['id', 'appId', 'displayName', 'signInAudience', 'requiredResourceAccess'],
    });

    const registration = result.value?.[0];
    if (!registration) {
      await send(`No app registration found for appId \`${appId}\`.`);
      return;
    }

    const permissions = registration.requiredResourceAccess?.flatMap(
      (r) => r.resourceAccess?.map((a) => `\`${a.id}\` (${a.type})`) ?? []
    ) ?? [];

    await send(
      `**App Registration**\n\n` +
      `- **Name:** ${registration.displayName}\n` +
      `- **App ID:** \`${registration.appId}\`\n` +
      `- **Object ID:** \`${registration.id}\`\n` +
      `- **Sign-in audience:** ${registration.signInAudience}\n` +
      `- **Permissions:** ${permissions.length > 0 ? permissions.join(', ') : 'none configured'}`
    );
  } catch (e) {
    await send(
      `Failed to fetch app details: ${e}\n\n` +
      'Ensure the app has **Application.Read.All** permission granted in Azure Portal.'
    );
  }
});

app.on('message', async ({ reply, activity }) => {
  await reply(
    `Echo: "${activity.text}"\n\n` +
    'Try `/history`, `/history-broken`, or `/app-info` to compare.'
  );
});

app.start().catch(console.error);
