<script>
  export let contract = null;
</script>

<style>
  .contract {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5rem;
    --c-field: #f0fc44;
    --c-type: #44a3fc;
    --c-summary: #9bb3c7;
    --c-kind: #7cc8ff;
    --c-header: #f0fc44;
    --c-punct: #6f8191;
  }

  .role {
    display: flex;
    flex-direction: row;
    margin-bottom: 0.3rem;
  }
  .role p {
    font-family: var(--fFixed);
    font-size: 0.8rem;
    color: #000000;
    background: rgb(201, 201, 201);
    /* padding: 0.3 0 0.2 0rem; */
    padding:0.1rem;
    margin: 0 0 0 0rem;
  }

  .text {
    font-family: var(--fFixed);
    font-size: 0.7rem;
    color: #44a3fc;
    white-space: pre-wrap;
    margin: 0 0 0 1rem;
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    font-family: var(--fFixed);
    font-size: 0.7rem;
    white-space: pre-wrap;
    margin: 0 0 0.1rem 0;
    padding-left: calc(var(--indent, 0) * 1rem);
  }
  .line.header {
    color: var(--c-header);
    margin-top: 0.2rem;
  }
  .part.field { color: var(--c-field); }
  .part.type { color: var(--c-type); }
  .part.summary { color: var(--c-summary); }
  .part.kind { color: var(--c-kind); }
  .part.punct { color: var(--c-punct); }
</style>

{#if contract}
  <div class="contract">
    <div class="role">
      <p>Contract ({contract.role ?? 'follower'})</p>
    </div>
    {#if contract.tokens}
      {#each contract.tokens as line}
        <div class="line {line.parts?.[0]?.kind === 'header' ? 'header' : ''}" style={`--indent:${line.indent}`}>
          {#each line.parts as part}
            <span class="part {part.kind}">{part.text}</span>
          {/each}
        </div>
      {/each}
    {:else if contract.text}
      <pre class="text">{contract.text}</pre>
    {/if}
  </div>
{/if}
