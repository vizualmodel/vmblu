<script>
  import { onMount } from 'svelte';

  export let onSubmit = () => {};
  export let onReady = () => {};

  let draft = '';
  let root;
  let textField;

  function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }

    onSubmit(text);
    draft = '';
    textField?.focus();
  }

  function onKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      submit(event);
    }
  }

  onMount(() => {
    onReady(root);
    textField?.focus();
  });
</script>

<div class="composer" bind:this={root}>
  <form class="form" on:submit={submit}>
    <label class="sr-only" for="composer-text">Message</label>
    <textarea
      id="composer-text"
      class="input"
      bind:this={textField}
      bind:value={draft}
      rows="4"
      placeholder="Type your message..."
      on:keydown={onKeyDown}
    ></textarea>
    <div class="actions">
      <span class="hint">Press Ctrl+Enter to send</span>
      <button type="submit" class="send">Send</button>
    </div>
  </form>
</div>

<style>
  .composer {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: visible;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }

  .input {
    resize: none;
    flex: 1;
    min-height: 120px;
    border-radius: 12px;
    border: 1px solid #cbd5f5;
    padding: 12px 16px;
    font-size: 1rem;
    font-family: inherit;
    color: #0f172a;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
    width: 100%;
    box-sizing: border-box;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hint {
    font-size: 0.875rem;
    color: #64748b;
  }

  .send {
    padding: 10px 24px;
    border-radius: 999px;
    border: none;
    background: #2563eb;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease-in-out, transform 120ms ease-in-out;
  }

  .send:hover {
    background: #1d4ed8;
  }

  .send:active {
    transform: translateY(1px);
  }

  .sr-only {
    border: 0;
    clip: rect(0 0 0 0);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    width: 1px;
  }
</style>
