<script>
    import { onMount } from 'svelte';
    import PopupBox from '../../fragments/popup-box.svelte';
    import InputProfile from '../../fragments/profile-input-pin.svelte'
    import OutputProfile from '../../fragments/profile-output-pin.svelte'
    import ProxyProfile from '../../fragments/profile-proxy-pin.svelte'
    import PinContract from '../../fragments/pin-contract.svelte'

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

            // check and just hide if repeat
            if (_pin && pin === _pin) {
                _pin = null
                box.hide()
                return
            }

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
    color: yellow;
    /* background: rgb(168, 169, 212); */
    padding:0.1rem;
    border-radius: 0.8rem;
    margin: 0 0 0.1 0rem;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>

<PinContract contract={_contract} />

{#if _pin?.is?.proxy}
    <div class="pin">
        <p>{_pin?.is.input ? '• Connected internal handlers' : '• Connected internal emitters'}</p>
    </div>
    <ProxyProfile profile={_profile} open={_open} />
{:else if _pin?.is.input}
    {#if Array.isArray(_profile)}
        <div class="pin">
            <p>&#x2022 Handlers and parameters</p>
        </div>
        {#each _profile as singleProfile}
            <InputProfile profile={singleProfile} open={_open} />
        {/each}
    {:else}
       <div class="pin">
            <p>&#x2022 Handler and parameters</p>
        </div>
        <InputProfile profile={_profile} open={_open}/>
    {/if}
{:else}
    <div class="pin">
        <p>&#x2022 Sent at</p>
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
