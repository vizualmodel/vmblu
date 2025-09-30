<script>
  import { onMount } from 'svelte';

  export let profile, open;

/* The layout of profile
    {
        "pin": "local",
        "file": "C:/dev/vmblu/core/model/clipboard.js",
        "line": 154,
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

.transmit {
    display: flex;
    flex-direction: row;
    margin-bottom: 0.3rem;
}
.transmit p {
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
</style>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="profile">
  {#if profile != null}
    <div class="transmit">
      <p>
        <span class="clickable" on:click={() => open?.({file: profile.file, line: profile.line})} on:keydown={onKeydown}>
            {profile.pin}
        </span>
        {profile.file} ({profile.line})
      </p>
    </div>
  {/if}
</div>