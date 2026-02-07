<script>
    import { onMount } from 'svelte';
    import PopupBox from '../fragments/popup-box.svelte';
    import InputProfile from '../fragments/profile-input-pin.svelte'
    import OutputProfile from '../fragments/profile-output-pin.svelte'
    import PinContract from '../fragments/pin-contract.svelte'

    export let tx//, sx;

    let box = {
        div: null,
        pos: null,
        title: '',
        ok: null,
        cancel: null,
    };

    onMount(() => {
        tx.send("modal div", box.div);
    });

    // save local data
    let _profile = null
    let _pin = null
    let _open = null
    let _contract = null

    export const handlers = {
        onShow({ pos, pin, contract, profile, open = null }) {

            box.title = pin.name + ' @ ' + pin.node.name + (pin.is.input ? ' (in)' : ' (out)') 
            // box.title = pin.is.left ? ((pin.is.input ? ' \u25B6 ' : ' \u25C0 ' ) + pin.name) : (pin.name + (pin.is.input ? ' \u25C0 ' : ' \u25B6 '));
            _pin = pin;
            _contract = contract;
            _profile = profile;
            _open = open
            box.show(pos);
        }
    };
</script>

<style>
.pin {
    display: flex;
    flex-direction: row;
}

.pin p {
    font-family: var(--fFixed);
    font-size: 0.8rem;
    color: #000000;
    background: rgb(201, 201, 201);
    padding:0.1rem;
    margin: 0 0 0.1 0rem;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>

<PinContract contract={_contract} />

{#if _pin?.is.input}
    {#if Array.isArray(_profile)}
        <div class="pin">
            <p>Handlers and parameters</p>
        </div>
        {#each _profile as singleProfile}
            <InputProfile profile={singleProfile} open={_open} />
        {/each}
    {:else}
       <div class="pin">
            <p>Handler and parameters</p>
        </div>
        <InputProfile profile={_profile} open={_open}/>
    {/if}
{:else}
    <div class="pin">
        <p>Send locactions </p>
    </div>
    {#if Array.isArray(_profile)}
        {#each _profile as singleProfile}
            <OutputProfile profile={singleProfile} open={_open} />
        {/each}
    {:else}
        <OutputProfile profile={_profile} open={_open}/>
    {/if}
{/if}
</PopupBox>
