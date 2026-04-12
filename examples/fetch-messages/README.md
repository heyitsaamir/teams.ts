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

## Permissions

| Context | Permission | Type |
|---------|-----------|------|
| Channel | `ChannelMessage.Read.Group` | RSC |
| Group chat | `ChatMessage.Read.Chat` | RSC |
| Personal/DM | `Chat.Read.All` | Azure AD (admin consent) |

RSC permissions cover channels and group chats. Personal/DM chats are [limited to `ChatMessageReadReceipt.Read.Chat`](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent) for RSC, so reading DM message history requires the `Chat.Read.All` Azure AD app permission with admin consent.

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
