# The project

This is an application to demonstrate the possibilities and features of working with the vmblu file format.

The vmblu file format is described in the file */docs/vmblu-v08.schema.json*. The annex */docs/vmblu-v08-annex.md* gives some extra clarifications about the schema.

For this project we are going to develop a **chat application**. The chat application consists of two parts: a client side and a server side. The client side runs at the user and allows him to see incoming chats and type reponses. The server side receives chats from users and sends them to the correct receiver(s). The server also stores chats for later reference.

The client side will make use of *svelte* for the user interface and *vite* for the dev environment. Use *fastify* for the server. Before deciding on other frameworks always ask first.

To start with the project set up the directory structure for the client and the server and initialise the package.json file for the project and its subprojects client and server. Then you can make the vmblu model file for the client and the vmblu model file for the sever.

# Acceptance criteria

- Running `npm install` at the root succeeds.
- `client/` has a Vite + Svelte scaffold and `npm run dev` works.
- `server/` has a Node scaffold and `npm start` prints a placeholder message.
- `models/chat-client.vmblu` and `models/chat-server.vmblu` are made.

# How to make nodes with svelte

The way that I make nodes with svelte is as follows: I create a standard svelte component and then I encapsulate it in a generator function :

```js
import svelteComponent from 'component-file.svelte'
function makeComponent (tx, sx) {
    const component = new svelteComponent({
        target: document.createElement('div'),
        props: {
            tx, sx, handlers:null
        }
    })
    return component.handlers
}
```
The target div is just to have an hook to hang it from, normally the component will send the actual outer div so that a receiving page can attach it.
The generator must return the handlers for the node so that the runtime can call the handlers when messages are received.