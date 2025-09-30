<script>
  import { onMount } from 'svelte';

  export let composerNode = null;
  export let listNode = null;

  let listSlot;
  let composerSlot;

  function adopt(slot, node) {
    if (!slot || !node) {
      return;
    }

    if (slot.firstChild === node) {
      return;
    }

    slot.replaceChildren(node);
    if (node instanceof HTMLElement) {
      node.style.width = '100%';
      node.style.height = '100%';
      node.style.maxWidth = '100%';
    }
  }

  $: adopt(listSlot, listNode);
  $: adopt(composerSlot, composerNode);

  onMount(() => {
    adopt(listSlot, listNode);
    adopt(composerSlot, composerNode);
  });
</script>

<section class="chat-page" aria-label="Chat application shell">
  <header class="page-header">
    <h1>Chat</h1>
    <p>Exchange messages in real time.</p>
  </header>
  <main class="surface" role="presentation">
    <div class="panel list-panel" bind:this={listSlot} aria-live="polite"></div>
    <div class="panel composer-panel" bind:this={composerSlot}></div>
  </main>
</section>

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
    min-height: 100vh;
    color: #0f172a;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 32px 16px;
    box-sizing: border-box;
  }

  :global(.chat-page-host) {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .chat-page {
    width: min(800px, 100%);
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin: 0 auto;
  }

  .page-header h1 {
    margin: 0;
    font-size: 2rem;
  }

  .page-header p {
    margin: 4px 0 0;
    color: #475569;
  }

  .surface {
    display: grid;
    grid-template-rows: minmax(0, 3fr) minmax(0, 1fr);
    gap: 16px;
    width: 100%;
    min-height: 0;
  }

  .panel {
    background: rgba(255, 255, 255, 0.96);
    border-radius: 16px;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
    padding: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .composer-panel {
    padding: 20px;
  }
</style>
