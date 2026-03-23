# Cards Bot

## Assertions

### 1. Help / usage card
- **act**: Send `hello` in the chat (any unrecognized command)
- **assert**: Bot responds with an adaptive card listing available commands (should contain `!basic`, `!form`, `!json`, `!actions`, `!profile`)

### 2. Basic card with toggle
- **act**: Send `!basic` in the chat
- **assert**: Bot responds with an adaptive card containing "Hello world" and a toggle input

### 3. Submit basic card
- **act**: Toggle the "Notify me" switch on the basic card, then click `Submit`
- **assert**: Bot responds with a message containing `Notification preference set to`

### 4. Form card
- **act**: Send `!form` in the chat
- **assert**: Bot responds with an adaptive card containing input fields for Name, Comments, and Favorite Color

### 5. Submit form card
- **act**: Fill in Name (`Test User`), Comments (`Great bot`), leave Color as default (`blue`), then click `Submit Form`
- **assert**: Bot responds with a message containing `Form submitted!` and `Name: Test User` and `Color: blue`

### 6. Profile card
- **act**: Send `!profile` in the chat
- **assert**: Bot responds with an adaptive card containing pre-filled Name (`John Doe`) and Email (`john@contoso.com`) fields

### 7. Submit profile card
- **act**: Click `Save` on the profile card (using the pre-filled values)
- **assert**: Bot responds with a message containing `Profile saved!` and `Name: John Doe` and `Email: john@contoso.com`
