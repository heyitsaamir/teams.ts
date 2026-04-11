# Fetch Messages Example

Demonstrates fetching chat message history using the Graph API with `app.getAppGraph(tenantId)`.

## Why `getAppGraph(tenantId)`?

The Graph API endpoint `GET /chats/{chat-id}/messages` requires an app-only token scoped to the specific tenant. The default `app.graph` client acquires a token for the `common` tenant, which fails with 403 when reading chat messages.

`app.getAppGraph(tenantId)` returns a Graph client with a token scoped to the correct tenant:

```typescript
// Fails — token for "common" tenant
const response = await app.graph.call(chats.messages.list, { 'chat-id': chatId });

// Works — token scoped to the conversation's tenant
const graph = app.getAppGraph(tenantId);
const response = await graph.call(chats.messages.list, { 'chat-id': chatId });
```

## Commands

| Command | Description |
|---------|-------------|
| `/history` | Fetch last 5 messages using `app.getAppGraph(tenantId)` |
| `/history-broken` | Attempt the same with `app.graph` (demonstrates the failure) |
| Any message | Echo + usage hint |

## Setup

Install the [Teams CLI](https://github.com/heyitsaamir/teamscli):

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
```

Create and configure the app:

```bash
# Log in to Microsoft 365
teams login

# Create the app with bot and credentials
teams app create \
  --name "Fetch Messages Bot" \
  --endpoint "https://YOUR-TUNNEL-URL/api/messages" \
  --env .env

# Add RSC permissions so the bot can read chat messages
teams app rsc add <appId> ChannelMessage.Read.Group --type Application
teams app rsc add <appId> ChatMessage.Read.Chat --type Application
```

The `teams app create` command outputs an installation link — use it to install the app in Teams.

## Run

```bash
pnpm dev
```

Then message the bot in Teams:
1. Send `/history` — fetches messages using a tenant-scoped token (works)
2. Send `/history-broken` — attempts with the default "common" token (fails with 403)
