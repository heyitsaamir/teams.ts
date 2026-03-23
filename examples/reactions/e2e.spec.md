# Reactions Bot

## Setup
- start: `../../e2e-test/start.sh reactions`
- stop: `../../e2e-test/stop.sh`

## Assertions

### 1. Default echo
- **act**: Send `hello` in the chat
- **assert**: Bot responds with a message containing `You said: "hello"`

### 2. Add like reaction
- **act**: Send `add like` in the chat
- **assert**: Bot responds with a message containing `Added a like reaction to your message!`

### 3. Remove like reaction (from cached message)
- **act**: Send `remove like` in the chat
- **assert**: Bot responds with a message containing `Removed the like reaction from the last reacted message!`
