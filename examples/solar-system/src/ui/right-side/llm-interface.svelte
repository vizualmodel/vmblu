<script>
import { onMount, afterUpdate } from 'svelte';
import SideBox from '../fragments/side-box.svelte';
import { marked } from 'marked';

// The specific mcp client linked to this interface
export let tx, sx

const box = {
    div: null,
    title: 'Chat',
    expanded: true
};

// when mounting
onMount(() => {

    // make the canvas known to the studio
    tx.send('div', box.div)
})

// The variable for the text input
let text = '';

// the div of the component
let chatDiv = null;

// The content of the chat
let chat = []

export const handlers = {

    // The mcp client has a chat and a 
    onUpdateChat(updatedChat) {

        // set the new chat
        chat = updatedChat ?? []
    }
}

// make sure to show the latest answer
afterUpdate(() => {
    if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight;
});

// signal the client to handle the key for the client (either enter or remove)
function handleKey() {

    tx.send('handle key')
}

function getPrompt() {
    
    const trimmed = text.trim();
    text = '';
    return trimmed.length === 0 ? null : trimmed;       
}

// send the prompt to the LLM and get a response
async function submit() {

    // get the prompt
    const prompt = getPrompt();

    // check
    if (!prompt) return

    // let the mcp
    tx.send('new prompt', prompt)
}

function onKeydown(e) {

    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
    } 
}
</script>

<style>
textarea {
    width: 90%;
    font-family: courier new, monospace;
    font-size: 0.8rem;
    padding: 0.5rem;
    background: var(--cGreyT,#000000aa);
    color: white;
    outline: none;
    resize: vertical;
    margin-top: 0.5rem;
    border-radius: 1rem;
}

.chat-history {
    height: 200px;
    width: 90%;
    overflow-y: auto;
    background: var(--cGreyT,#000000aa);
    padding: 0.5rem;
    font-family: courier new, monospace;
    font-size: 0.8rem;
    white-space: normal;
    color: white;
    border-radius: 1rem;
}

.user {
    color: cyan;
    margin: 0;
}

.assistant{
    color: yellow;
    margin: 0;
}

.tool-call {
    color:rgb(98, 98, 255);
    font-style: italic;
}

.chat-history::-webkit-scrollbar, textarea::-webkit-scrollbar {
    width: 8px;
}

.chat-history::-webkit-scrollbar-track, textarea::-webkit-scrollbar-track {
    background: black;
}

.chat-history::-webkit-scrollbar-thumb, textarea::-webkit-scrollbar-thumb {
    background-color: grey;
}

.button-area{
    display: flex;
    justify-content:normal;
    align-items: center;
}

button {
    width:auto;
    font-family: var(--fFamily);
    font-size: var(--fSmall);
    background-color: #000;
    color: var(--cInput, #777777);
    border: 1px solid var(--cInput, #777777);
    border-radius: 5px;
    cursor: pointer;
    margin: 0.5rem 0.5rem 0 0;
    transition: border 0.3s ease;
}

button:hover {
    border: 1px solid var(--cSelected, #ffffff);
    color: var(--cSelected, #ffffff);
}
</style>

<SideBox box={box}>
    <div class="chat-history" bind:this={chatDiv}>
        {#each chat as msg}
            <div class={msg.role} style="margin-bottom: 0.5rem;">
                {#if msg.content}
                    <div class="message-content" style="white-space: normal;">
                        {@html marked(`${msg.role}: ${msg.content}`)}
                    </div>
                {:else if msg.tool_calls}
                    <div class="tool-call">calling tools...</div>
                {/if}
            </div>
        {/each}
    </div>

    <textarea
        bind:value={text}
        name="user-input"
        spellcheck="false"
        placeholder="Type your message here..."
        rows="8"
        on:keydown={onKeydown}
    ></textarea>

    <div class="button-area">
        <!-- <button on:click={submit}>submit</button> -->
        <button on:click={handleKey}>handle key</button>   
    </div>
</SideBox>
    