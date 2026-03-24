/** @jsxImportSource chat */
import {
  Chat, emoji,
  Card, CardText, Divider, Fields, Field, Table,
  Actions, Button, LinkButton, Section, Image,
} from 'chat';
import { createTeamsSDKAdapter } from './adapter';
import { createMemoryState } from '@chat-adapter/state-memory';
import { createServer } from 'node:http';

const bot = new Chat({
  userName: 'Dialogs-tester',
  adapters: {
    teams: createTeamsSDKAdapter(),
  },
  state: createMemoryState(),
  logger: 'debug',
  streamingUpdateIntervalMs: 500,
  fallbackStreamingPlaceholderText: '...',
});

// ---------------------------------------------------------------------------
// 1. New Mention -- entry point for @mentions in unsubscribed threads
// ---------------------------------------------------------------------------
bot.onNewMention(async (thread, message) => {
  console.log('[onNewMention] text:', JSON.stringify(message.text));
  console.log('[onNewMention] isMention:', message.isMention);
  console.log('[onNewMention] author:', message.author?.fullName);
  await routeCommand(thread, message);
});

async function routeCommand(thread: any, message: any) {
  const text = message.text.trim().toLowerCase();

  // Check for inbound attachments
  if (message.attachments?.length > 0) {
    const atts = message.attachments.map((a: any) => `- **${a.name ?? 'unnamed'}** (${a.type}, ${a.mimeType})`);
    await thread.post(
      `**Received ${message.attachments.length} attachment(s):**\n\n${atts.join('\n')}`
    );
    return;
  }

  if (text.includes('card')) {
    await demoCard(thread);
  } else if (text.includes('edit')) {
    await demoEditDelete(thread);
  } else if (text.includes('stream')) {
    await demoStreaming(thread);
  } else if (text.includes('subscribe')) {
    await demoSubscribe(thread, message);
  } else if (text.includes('dm')) {
    await demoDM(thread, message);
  } else if (text.includes('thread state')) {
    await demoThreadState(thread);
  } else if (text.includes('typing')) {
    await demoTyping(thread);
  } else if (text.includes('markdown')) {
    await demoMarkdown(thread);
  } else if (text.includes('channel')) {
    await demoChannel(thread);
  } else if (text.includes('history')) {
    await demoMessageHistory(thread);
  } else if (text.includes('files')) {
    await demoFiles(thread);
  } else {
    await showHelp(thread);
  }
}

// ---------------------------------------------------------------------------
// 2. Subscribed Message -- fires for every message in a subscribed thread
// ---------------------------------------------------------------------------
bot.onSubscribedMessage(async (thread, message) => {
  if (message.text.trim().toLowerCase() === 'unsubscribe') {
    await thread.unsubscribe();
    await thread.post('Unsubscribed from this thread. Goodbye!');
    return;
  }
  await thread.post(`[Subscribed] You said: "${message.text}"`);
});

// ---------------------------------------------------------------------------
// 3. Pattern Matching -- fires for unsubscribed threads matching regex
// ---------------------------------------------------------------------------
bot.onNewMessage(/^help$/i, async (thread) => {
  await showHelp(thread);
});

// ---------------------------------------------------------------------------
// 4. Direct Messages
// ---------------------------------------------------------------------------
bot.onDirectMessage(async (thread, message) => {
  await routeCommand(thread, message);
});

// ---------------------------------------------------------------------------
// 5. Reactions -- receive reaction events
// ---------------------------------------------------------------------------
bot.onReaction(async (event) => {
  const action = event.added ? 'added' : 'removed';
  const user = event.user.fullName ?? event.user.userName;
  console.log(`Reaction: ${user} ${action} ${event.emoji.name}`);

  if (event.added && event.thread) {
    await event.thread.post(`${user} reacted with ${event.emoji} on a message!`);
  }
});

// ---------------------------------------------------------------------------
// 6. Card Actions -- button clicks from Adaptive Cards
// ---------------------------------------------------------------------------
bot.onAction('approve', async (event) => {
  if (event.thread) {
    await event.thread.post(`Approved by ${event.user.fullName}! Value: ${event.value}`);
  }
});

bot.onAction('reject', async (event) => {
  if (event.thread) {
    await event.thread.post(`Rejected by ${event.user.fullName}! Value: ${event.value}`);
  }
});

bot.onAction('echo_action', async (event) => {
  if (event.thread) {
    await event.thread.post(`Action received! ID: ${event.actionId}, Value: ${JSON.stringify(event.value)}`);
  }
});

// ---------------------------------------------------------------------------
// Demo Functions
// ---------------------------------------------------------------------------

async function showHelp(thread: any) {
  await thread.post(
    `**Vercel Chat SDK -- Teams Feature Demo**\n\n` +
    `Mention me with one of these keywords:\n\n` +
    `- **card** -- Adaptive Card with buttons, fields, and images\n` +
    `- **edit** -- Post, edit, then delete a message\n` +
    `- **stream** -- Simulated streaming response (post+edit)\n` +
    `- **subscribe** -- Subscribe to thread for follow-up messages\n` +
    `- **dm** -- Send you a direct message\n` +
    `- **thread state** -- Set and read thread state\n` +
    `- **typing** -- Send typing indicator\n` +
    `- **markdown** -- Rich markdown formatting\n` +
    `- **channel** -- Post a channel-level message\n` +
    `- **history** -- Fetch message history (requires Graph)\n` +
    `- **files** -- Send a file attachment\n` +
    `- **help** -- Show this menu`
  );
}

// --- Card Demo ---
async function demoCard(thread: any) {
  await thread.post(
    <Card title="Order #12345" subtitle="Pending Review">
      <CardText>Please review this order and take action.</CardText>
      <Divider />
      <Fields>
        <Field label="Customer" value="Alice Johnson" />
        <Field label="Total" value="$149.99" />
        <Field label="Status" value="Pending" />
        <Field label="Priority" value="High" />
      </Fields>
      <Divider />
      <CardText>Items ordered:</CardText>
      <Table
        headers={['Item', 'Qty', 'Price']}
        rows={[
          ['Widget Pro', '2', '$49.99'],
          ['Gadget X', '1', '$50.01'],
        ]}
      />
      <Actions>
        <Button id="approve" style="primary" value="order-12345">Approve</Button>
        <Button id="reject" style="danger" value="order-12345">Reject</Button>
        <LinkButton url="https://example.com/orders/12345">View Details</LinkButton>
      </Actions>
    </Card>
  );
}

// --- Edit/Delete Demo ---
async function demoEditDelete(thread: any) {
  const sent = await thread.post('Original message -- I will edit this in 2 seconds...');

  await delay(2000);
  await sent.edit('This message has been **edited**! I will delete it in 3 seconds...');

  await delay(3000);
  await sent.delete();
  await thread.post('The previous message was deleted.');
}

// --- Streaming Demo ---
async function demoStreaming(thread: any) {
  const stream = (async function* () {
    const words = 'This is a simulated streaming response. Each word appears with a small delay, demonstrating the post+edit fallback that Teams uses for streaming. The Chat SDK handles all the complexity of posting an initial message and editing it as new content arrives.'.split(' ');
    for (const word of words) {
      yield word + ' ';
      await delay(100);
    }
  })();

  await thread.post(stream);
}

// --- Subscribe Demo ---
async function demoSubscribe(thread: any, message: any) {
  await thread.subscribe();
  await thread.post(
    `Subscribed to this thread! Every message you send here will get a response.\n\n` +
    `Say **unsubscribe** to stop.`
  );
}

// --- DM Demo ---
async function demoDM(thread: any, message: any) {
  try {
    const dm = await bot.openDM(message.author);
    await dm.post('Hello! This is a direct message from the bot.');
    await thread.post('Sent you a DM! Check your chat.');
  } catch (err: any) {
    await thread.post(`Failed to send DM: ${err.message}`);
  }
}

// --- Thread State Demo ---
async function demoThreadState(thread: any) {
  const currentState = await thread.state;
  const count = (currentState?.visitCount ?? 0) + 1;

  await thread.setState({ visitCount: count, lastVisit: new Date().toISOString() });

  await thread.post(
    `**Thread State Demo**\n\n` +
    `- Visit count: **${count}**\n` +
    `- Last visit: ${new Date().toISOString()}\n\n` +
    `Say "thread state" again to see the count increment.`
  );
}

// --- Typing Demo ---
async function demoTyping(thread: any) {
  await thread.startTyping();
  await delay(2000);
  await thread.post('I was typing for 2 seconds! (Note: typing indicators have limited support in Teams)');
}

// --- Markdown Demo ---
async function demoMarkdown(thread: any) {
  await thread.post(
    `**Markdown Formatting Demo**\n\n` +
    `**Bold text** and _italic text_ and ~~strikethrough~~\n\n` +
    `Inline \`code\` example\n\n` +
    `\`\`\`typescript\n` +
    `function hello(name: string): string {\n` +
    `  return \`Hello, \${name}!\`;\n` +
    `}\n` +
    `\`\`\`\n\n` +
    `> This is a blockquote\n\n` +
    `- Bullet point 1\n` +
    `- Bullet point 2\n` +
    `- Bullet point 3\n\n` +
    `1. Numbered item 1\n` +
    `2. Numbered item 2\n` +
    `3. Numbered item 3\n\n` +
    `[Link to example](https://example.com)`
  );
}

// --- Channel Demo ---
async function demoChannel(thread: any) {
  try {
    const channel = thread.channel;
    if (channel) {
      await channel.post('This is a channel-level message (not in a thread).');
      await thread.post('Posted a message at the channel level!');
    } else {
      await thread.post('Could not access channel context.');
    }
  } catch (err: any) {
    await thread.post(`Channel post failed: ${err.message}`);
  }
}

// --- Message History Demo ---
async function demoMessageHistory(thread: any) {
  try {
    let count = 0;
    const messages: string[] = [];
    for await (const msg of thread.messages) {
      messages.push(`- **${msg.author.fullName ?? msg.author.userName}**: ${msg.text.slice(0, 50)}...`);
      count++;
      if (count >= 5) break;
    }
    if (messages.length === 0) {
      await thread.post('No message history available. (Requires Graph API permissions: `ChatMessage.Read.Chat`)');
    } else {
      await thread.post(`**Last ${messages.length} messages:**\n\n${messages.join('\n')}`);
    }
  } catch (err: any) {
    await thread.post(`Failed to fetch history: ${err.message}\n\n(Requires Graph API permissions)`);
  }
}

// --- Files Demo ---
async function demoFiles(thread: any) {
  const content = 'Hello from Vercel Chat SDK!\nThis is a text file attachment.';
  await thread.post({
    markdown: 'Here is a file attachment:',
    files: [
      {
        data: Buffer.from(content),
        filename: 'hello.txt',
        mimeType: 'text/plain',
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
const port = Number(process.env.PORT || 3978);

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/messages') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    console.log('[webhook] Received POST /api/messages');
    const bodyStr = body.toString('utf-8');
    try {
      const activity = JSON.parse(bodyStr);
      console.log('[webhook] Activity type:', activity.type);
      console.log('[webhook] Activity text:', activity.text);
      console.log('[webhook] Activity from:', activity.from?.name);
      console.log('[webhook] Entities:', JSON.stringify(activity.entities));
      console.log('[webhook] Conversation:', JSON.stringify(activity.conversation));
    } catch {}

    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: 'POST',
      headers,
      body: bodyStr,
    });

    const response = await bot.webhooks.teams(request);
    console.log('[webhook] Response status:', response.status);
    res.writeHead(response.status);
    res.end(await response.text());
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Pre-initialize the Chat instance before listening
bot.initialize().then(() => {
  console.log('Chat SDK initialized');
  server.listen(port, () => {
    console.log(`Vercel Chat SDK - Teams Feature Demo`);
    console.log(`Bot listening on http://localhost:${port}`);
    console.log(`Teams webhook: http://localhost:${port}/api/messages`);
  });
}).catch(console.error);
