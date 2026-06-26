<script>
import {onMount} from 'svelte'

export let tx

let div
let teams = []

onMount(() => {
    tx.send('div', div)
})

export const handlers = {
    onTeams(list) {
        teams = Array.isArray(list) ? list : []
    }
}
</script>

<style>
.team-legend {
    position: absolute;
    z-index: 1;
    top: 0;
    left: 0;
    right: 0;
    height: 20px;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 0.5rem;
    box-sizing: border-box;
    overflow: hidden;
    background: rgba(0, 0, 0, 0);
    color: #ccc;
    font-family: Tahoma, Arial, sans-serif;
    font-size: 0.7rem;
    white-space: nowrap;
    pointer-events: none;
}

.team {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
}

.bullet {
    width: 0.6rem;
    height: 0.6rem;
    flex: 0 0 auto;
    border-radius: 50%;
}

.name {
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>

<div bind:this={div} class="team-legend">
    {#each teams as team}
        <span class="team" title={team.name}>
            <span class="bullet" style={`background:${team.color};`}></span>
            <span class="name">{team.name}</span>
        </span>
    {/each}
</div>
