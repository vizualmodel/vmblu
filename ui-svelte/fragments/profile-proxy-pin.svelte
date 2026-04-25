<script>
  export let profile, open;

  function onKeydown(e) {
      if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
  }

  function asArray(value) {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
  }
</script>

<style>
  .proxy {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
  }

  .target {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-left: 1rem;
  }

  .target p {
      font-family: var(--fFixed);
      font-size: 0.7rem;
      white-space: pre-wrap;
      margin: 0;
  }

  .endpoint {
      color: #ff8522;
  }

  .meta {
      color: #44a3fc;
  }

  .empty {
      color: #999;
  }

  .clickable {
      cursor: pointer;
      display: inline-block;
      transition: transform 0.1s ease-out;
      padding: 0.2rem;
      border: 1px solid #ff8522;
  }

  .clickable:active {
      transform: scale(0.9);
  }
</style>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="proxy">
  {#if profile?.targets?.length}
    {#each profile.targets as target}
      <div class="target">
        <p class="endpoint">{target.pin + ' @ ' + target.node + '(' + target.io + ')'}</p>

        {#if asArray(target.profile).length}
          {#each asArray(target.profile) as item}
            {#if item?.handler}
              <p class="meta">
                <span class="clickable" on:click={() => open?.({file: item.file, line: item.line})} on:keydown={onKeydown}>
                  {item.handler}
                </span>
                {' '}in {item.file} ({item.line})
              </p>
            {:else if item?.file}
              <p class="meta">
                <span class="clickable" on:click={() => open?.({file: item.file, line: item.line})} on:keydown={onKeydown}>
                  {item.pin}
                </span>
                {' '}{item.file} ({item.line})
              </p>
            {/if}
          {/each}
        {:else}
          <p class="empty">No source profile entry for this internal pin.</p>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="target">
      <p class="empty">No internal pins are currently resolved behind this proxy.</p>
    </div>
  {/if}
</div>
