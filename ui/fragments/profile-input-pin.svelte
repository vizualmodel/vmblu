<script>
  import { onMount } from 'svelte';

  export let profile, open;

/* The layout of profile
  {
        "pin": "local",
        "handler": "-> local",
        "file": "C:/dev/vmblu/core/model/clipboard.js",
        "line": 154,
        "summary": "",
        "returns": "",
        "examples": [],
        "params": [
          {
            "name": "doc",
            "type": "any",
            "description": ""
          }
        ]
      }
*/

  function onKeydown(e) {
      if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
  }

</script>

<style>
  .profile {
      display: flex;
      flex-direction: column;
      margin-bottom: 0.5rem;
  }

  .handler {
      display: flex;
      flex-direction: row;
      margin-bottom: 0.3rem;
  }
  .handler p {
      font-family: var(--fFixed);
      font-size: 0.7rem;
      color: #ff8522;
      white-space: pre-wrap; /* preserve line breaks if needed */
      margin: 0 0 0 1rem;
  }

  /* clickable span now has a tiny scale animation on click */
  .clickable {
      /* text-decoration: underline; */
      cursor: pointer;
      display: inline-block;       /* needed so transform applies cleanly */
      transition: transform 0.1s ease-out;
      padding: 0.2rem;
      border: 1px solid #ff8522;
  }
  .clickable:active {
      transform: scale(0.9);
  }

  .params {
      display: flex;
      flex-direction: column;
      margin-bottom: 0.3rem;
  }
  .params p {
      font-family: var(--fFixed);
      font-size: 0.7rem;
      color: #44a3fc;
      white-space: pre-wrap; /* preserve line breaks if needed */
      margin: 0 0 0 1rem;
  }

  .prompt {
      display: flex;
      flex-direction: column;
  }
  .prompt pre {
      font-family: var(--fFixed);
      font-size: 0.7rem;
      color: #25b325;
      white-space: pre-wrap;
      margin: 0 0 0 1rem;
  }
</style>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="profile">
  {#if profile != null}
    <div class="handler">
      <p>
        <span class="clickable" on:click={() => open?.({file: profile.file, line: profile.line})} on:keydown={onKeydown}>
          {profile.handler}
        </span>
        {' '}in {profile.file} ({profile.line})
      </p>
    </div>

    <div class="params">
      {#each profile.params as { type, name, description }}
        <p>{name} ({type}) {description}</p>
      {/each}
    </div>

    <div class="prompt">
      <pre>{profile.summary}</pre>
    </div>
  {/if}
</div>