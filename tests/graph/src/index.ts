import { App } from '@microsoft/teams.apps';
import * as endpoints from '@microsoft/teams.graph-endpoints';

const app = new App({
  oauth: { 
    defaultConnectionName: 'graph'
  }
});

app.message('/signin', async ({ send, signin, isSignedIn }) => {
  if (isSignedIn) {
    send('you are already signed in!');
  } else {
    await signin();
  }
});

app.event('signin', async ({ send, token }) => {
  await send(`Signed in using OAuth connection ${token.connectionName}. Please type **/whoami** to see your profile or **/signout** to sign out.`);
});

app.message('/whoami', async ({ send, userGraph, isSignedIn}) => {
  if (!isSignedIn) {
    await send('you are not signed in! please type **/signin** to sign in.');
    return;
  }
  const me = await userGraph.call(endpoints.me.get);
  await send(`you are signed in as "${me.displayName}" and your email is "${me.mail || me.userPrincipalName}"`);
});

app.message('/signout', async ({ send, signout, isSignedIn }) => {
  if (!isSignedIn) {
    await send('you are not signed in! please type **/signin** to sign in.');
    return;
  }
  await signout(); // call signout for your auth connection...
  await send('you have been signed out!');
});

app.on('message', async ({ send, activity, isSignedIn }) => {
  if (isSignedIn) {
    await send(`You said: "${activity.text}". Please type **/whoami** to see your profile or **/signout** to sign out.`);
  } else {
    await send(`You said: "${activity.text}". Please type **/signin** to sign in.`);
  }
});

await app.start();
