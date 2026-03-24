# Vercel Chat SDK -- Teams Feature Demo

Comprehensive demo of the [Vercel Chat SDK](https://chat-sdk.dev) running on Microsoft Teams via `@chat-adapter/teams`.

## Setup

```bash
cp .env.example .env   # fill in TEAMS_APP_ID, TEAMS_APP_PASSWORD, TEAMS_APP_TENANT_ID
npm install
npm run dev
```

Set your bot's messaging endpoint to `https://<your-domain>/api/messages`.

## Features Tested

@mention the bot with a keyword to trigger each demo:

| Keyword | Feature | What It Tests |
|---------|---------|---------------|
| **card** | Adaptive Cards (JSX) | `<Card>`, `<Fields>`, `<Table>`, `<Button>`, `<LinkButton>`, `<Divider>` |
| **edit** | Edit & Delete | `thread.post()` → `sent.edit()` → `sent.delete()` |
| **stream** | Streaming (post+edit) | `thread.post(asyncIterable)` with simulated token-by-token output |
| **subscribe** | Thread subscription | `thread.subscribe()` / `thread.unsubscribe()` / `onSubscribedMessage` |
| **dm** | Direct messages | `bot.openDM(author)` → proactive DM |
| **thread state** | State persistence | `thread.setState()` / `thread.state` with visit counter |
| **typing** | Typing indicator | `thread.startTyping()` |
| **markdown** | Rich formatting | Bold, italic, strikethrough, code blocks, lists, blockquotes, links |
| **channel** | Channel-level posts | `channel.post()` (top-level, not threaded) |
| **history** | Message history | `thread.messages` async iterator (requires Graph API permissions) |
| **files** | File attachments | `thread.post({ files: [...] })` with inline data |
| **help** | Help menu | Shows all available commands |

### Event Handlers Demonstrated

| Handler | Trigger |
|---------|---------|
| `bot.onNewMention()` | @mention in an unsubscribed thread |
| `bot.onSubscribedMessage()` | Any message in a subscribed thread |
| `bot.onNewMessage(/regex/)` | Pattern match in unsubscribed threads |
| `bot.onDirectMessage()` | DM to the bot |
| `bot.onReaction()` | User adds/removes emoji reaction |
| `bot.onAction(id)` | Button click in Adaptive Card |

### Teams Adapter Support Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Post / edit / delete messages | Supported | |
| Adaptive Cards (JSX) | Supported | Renders as Adaptive Cards v1.4 |
| Streaming | Post+Edit fallback | No native streaming; SDK handles post→edit loop |
| Thread subscription | Supported | |
| Direct messages | Supported | Requires prior user interaction for cached context |
| Thread state | Supported | 30-day TTL |
| Typing indicator | Limited | Teams may not always display bot typing |
| Markdown (GFM) | Supported | Bold, italic, strikethrough, code, lists, tables, links |
| File attachments | Supported | Converted to inline data URIs |
| Receive reactions | Supported | like, heart, laugh, surprised, sad, angry |
| Send reactions | Not supported | Bot Framework limitation |
| Message history | Requires Graph API | Set `TEAMS_APP_TENANT_ID` + Graph permissions |
| Channel posts | Supported | |
| Select menus in cards | Not supported | |
| Modals | Not supported | |
| Slash commands | Not supported | Teams doesn't have slash commands |
| Ephemeral messages | DM fallback only | No native ephemeral in Teams |
| Scheduled messages | Not supported | |
