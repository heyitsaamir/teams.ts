# Fetch Messages Example

Demonstrates fetching chat message history using the Graph API with `app.getAppGraph(tenantId)`.

## Why `getAppGraph(tenantId)`?

The Graph API requires an app-only token scoped to the conversation's tenant. `app.getAppGraph(tenantId)` returns a Graph client with the correct token:

```typescript
const graph = app.getAppGraph(activity.conversation.tenantId);
```

## Permissions

| Context | RSC | Azure AD | RSC side effect |
|---------|-----|----------|-----------------|
| Channel | `ChannelMessage.Read.Group` | `ChannelMessage.Read.All` | Receives all channel messages without @mention |
| Group chat | `ChatMessage.Read.Chat` | `Chat.Read.All` | Receives all messages without @mention |
| DM | — | `Chat.Read.All` | Bot always receives DMs |

RSC permissions don't require admin consent — chat/team members grant them on install. [DMs are limited to `ChatMessageReadReceipt.Read.Chat`](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent) for RSC, so reading DM history requires `Chat.Read.All` (Azure AD, admin consent).

## Fetching messages

### Channel

Uses `/teams/{aadGroupId}/channels/{channelId}/messages`. The `aadGroupId` comes from `activity.channelData.team.aadGroupId`:

```typescript
const graph = app.getAppGraph(activity.conversation.tenantId);
const response = await graph.call(teams.channels.messages.list, {
  'team-id': activity.channelData.team.aadGroupId,
  'channel-id': activity.channelData.channel.id,
  $top: 5,
});
```

### Group chat

Uses `/chats/{chat-id}/messages`. The `conversationId` works directly:

```typescript
const graph = app.getAppGraph(activity.conversation.tenantId);
const response = await graph.call(chats.messages.list, {
  'chat-id': activity.conversation.id,
  $top: 5,
  $orderby: ['createdDateTime desc'],
});
```

### Personal/DM

Uses `/chats/{chat-id}/messages`. The Bot Framework conversation ID (`a:...`) doesn't work — construct the Graph chat ID from the user and bot AAD IDs:

```typescript
const chatId = `19:${activity.from.aadObjectId}_${app.id}@unq.gbl.spaces`;
const graph = app.getAppGraph(activity.conversation.tenantId);
const response = await graph.call(chats.messages.list, {
  'chat-id': chatId,
  $top: 5,
  $orderby: ['createdDateTime desc'],
});
```

## Setup

Install the [Teams CLI](https://github.com/heyitsaamir/teamscli):

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
```

Create and configure the app:

```bash
teams login

teams app create \
  --name "Fetch Messages Bot" \
  --endpoint "https://YOUR-TUNNEL-URL/api/messages" \
  --env .env

# RSC: receive all messages + read history in channels
teams app rsc add <appId> ChannelMessage.Read.Group --type Application

# RSC: receive all messages + read history in group chats
teams app rsc add <appId> ChatMessage.Read.Chat --type Application
```

For DM message history, RSC is not sufficient. Add the `Chat.Read.All` Azure AD app permission and grant admin consent:

```bash
# Chat.Read.All (6b7d71aa-...) on Microsoft Graph (00000003-...)
az ad app permission add \
  --id <appId> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions 6b7d71aa-70aa-4810-a8d9-5d9fb2830017=Role

az ad app permission admin-consent --id <appId>
```

## Run

```bash
pnpm dev
```

Send `history` in any conversation (DM, group chat, or @mention in a channel).
