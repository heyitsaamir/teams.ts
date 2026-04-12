# Fetch Messages Example

Demonstrates fetching chat message history using the Graph API with `app.getAppGraph(tenantId)`.

## Why `getAppGraph(tenantId)`?

The Graph API requires an app-only token scoped to the conversation's tenant. `app.getAppGraph(tenantId)` returns a Graph client with the correct token:

```typescript
const graph = app.getAppGraph(activity.conversation.tenantId);
const response = await graph.call(chats.messages.list, {
  'chat-id': chatId,
  $top: 5,
});
```

## Chat ID mapping

The Bot Framework conversation ID differs from the Graph API chat ID:

| Context | Graph endpoint | Chat ID |
|---------|---------------|---------|
| Channel | `/teams/{aadGroupId}/channels/{channelId}/messages` | From `channelData.team.aadGroupId` |
| Group chat | `/chats/{chat-id}/messages` | `conversationId` works directly |
| Personal/DM | `/chats/{chat-id}/messages` | Construct `19:{userAadId}_{botAppId}@unq.gbl.spaces` |

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

# Receive all messages + read history in channels
teams app rsc add <appId> ChannelMessage.Read.Group --type Application

# Receive all messages + read history in chats/DMs
teams app rsc add <appId> ChatMessage.Read.Chat --type Application
```

## Run

```bash
pnpm dev
```

Send `history` in any conversation (DM, group chat, or @mention in a channel).
