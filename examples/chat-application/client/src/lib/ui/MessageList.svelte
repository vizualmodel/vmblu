<script>
  import { onMount } from 'svelte';

  export let messages = [];
  export let onReady = () => {};

  let root;
  let scrollContainer;

  const isOutgoing = (message) => message?.direction === 'outgoing';
  const isIncoming = (message) => message?.direction === 'incoming';

  function displayAuthor(message) {
    if (isOutgoing(message)) {
      return 'You';
    }
    return message?.author ?? 'Unknown';
  }

  function formatTimestamp(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return '';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  onMount(() => {
    onReady(root);
  });

  $: {
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }
</script>

<div class="message-list" bind:this={root}>
  {#if !messages || messages.length === 0}
    <p class="empty" role="status">No messages yet. Say hello!</p>
  {:else}
    <ul bind:this={scrollContainer}>
      {#each messages as message, index (message?.id ?? `${index}-${message?.createdAt ?? ''}`)}
        <li class:outgoing={isOutgoing(message)} class:incoming={isIncoming(message)}>
          <div class="meta">
            <span class="author">{displayAuthor(message)}</span>
            {#if message?.createdAt}
              <span class="time">{formatTimestamp(message.createdAt)}</span>
            {/if}
          </div>
          <p class="text">{message?.text ?? ''}</p>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .message-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    padding-right: 4px;
  }

  li {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
    align-self: flex-start;
    max-width: 90%;
  }

  li.outgoing {
    background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%);
    align-self: flex-end;
  }

  li.incoming {
    background: linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%);
    border: 1px solid #86efac;
  }

  .meta {
    display: flex;
    gap: 8px;
    align-items: baseline;
    color: #475569;
    font-size: 0.875rem;
  }

  .author {
    font-weight: 600;
    color: #1e293b;
  }

  .text {
    margin: 8px 0 0;
    color: #0f172a;
    white-space: pre-wrap;
  }

  .empty {
    margin: auto;
    color: #64748b;
  }
</style>
