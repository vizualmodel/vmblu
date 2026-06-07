<script>
import {onMount} from 'svelte'

export let tx

let div = null
let title = ''
let message = ''
let visible = false
let hideTimer = null

onMount(() => {
    tx.send('modal div', div)
})

export const handlers = {
    '-> show'({title: nextTitle = '', message: nextMessage = '', duration = 2000} = {}) {

        if (hideTimer) clearTimeout(hideTimer)

        title = nextTitle
        message = nextMessage
        visible = true

        hideTimer = setTimeout(() => {
            visible = false
            hideTimer = null
        }, duration)
    },
}
</script>

<style>
.toast {
    position: fixed;
    left: 50%;
    top: 1.5rem;
    transform: translateX(-50%);
    z-index: 10000;
    min-width: 12rem;
    max-width: 24rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid #666;
    border-radius: 2px;
    background: #000000cc;
    color: #d0d0d0;
    font-family: var(--fFixed);
    font-size: var(--fSmall);
    pointer-events: none;
}

.title {
    margin-bottom: 0.25rem;
    color: #f0f0f0;
    font-weight: bold;
}

.message {
    color: grey;
}
</style>

<div bind:this={div}>
    {#if visible}
        <div class="toast">
            {#if title}
                <div class="title">{title}</div>
            {/if}
            <div class="message">{message}</div>
        </div>
    {/if}
</div>
