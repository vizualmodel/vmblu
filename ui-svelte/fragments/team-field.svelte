<script>
export let team
export let duplicate = false
export let update = null
export let remove = null

function updateName(e) {
    update?.({name: e.target.value})
}

function updateColor(e) {
    update?.({color: e.target.value})
}
</script>

<style>
.team-field {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) 3rem 2rem;
    gap: 0.35rem 0.5rem;
    align-items: center;
    margin-left:1rem;
}

input[type="text"] {
    min-width: 12rem;
    background: #000;
    color: #ccc;
    border: 1px solid #333;
    border-radius: 0.15rem;
    font-family: "courier new";
    font-size: 0.85rem;
    padding: 0.18rem 0.3rem;
}

input[type="text"]:disabled {
    color: #888;
    border-color: #222;
}

input.duplicate {
    color: #ff6868;
    border-color: #9b2222;
}

input[type="color"] {
    background: transparent;
    border: none;
    width: 2.4rem;
    height: 1.5rem;
    padding: 0;
}

.remove-team {
    width: 1.5rem;
    height: 1.5rem;
    background: #2a0000;
    color: #ff6868;
    border: 1px solid #8a2222;
    border-radius: 0.15rem;
    cursor: pointer;
    line-height: 1;
}

.remove-team:disabled {
    visibility: hidden;
}

.duplicate-note {
    grid-column: 1 / 4;
    color: #ff6868;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}
</style>

<div class="team-field">
    <input
        type="text"
        spellcheck="false"
        disabled={team.locked}
        class:duplicate
        value={team.name}
        on:input={updateName}
    />
    <input
        type="color"
        value={team.color}
        on:input={updateColor}
    />
    <button
        type="button"
        class="remove-team"
        disabled={team.locked}
        on:click={() => remove?.()}
        aria-label="Remove team"
    >
        x
    </button>
    {#if duplicate}
        <div class="duplicate-note">Duplicate team name. The first one is kept when saving.</div>
    {/if}
</div>
