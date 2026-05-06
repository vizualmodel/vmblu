<script>
    import { onMount } from 'svelte';
    import PopupBox from '../../fragments/popup-box.svelte';

    export let tx//, sx;

    let box = {
        div: null,
        pos: null,
        title: '',
        ok: null,
        cancel: () => _pin = null,
    };

    onMount(() => {
        tx.send("modal div", box.div);
    });

    // save local data
    let _profile = null
    let _pin = null
    let _open = null
    let _contract = null

    // small helper
    const closeBox = () => {
        _pin = null
        box.hide()        
    }

    export const handlers = {
        onShow({ pos, pin, contract, profile, open = null }) {

            // check and just hide if repeat
            if (_pin && pin === _pin) return closeBox();

            box.title = pin.name + ' @ ' + pin.node.name + (pin.is.input ? ' (in)' : ' (out)')
            _pin = pin;
            _contract = contract;
            _profile = profile;
            _open = open
            box.show(pos);
        }
    };

    function onProfileKeydown(e) {
        if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
    }

    function asArray(value) {
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
    }

    function partText(parts, kind) {
        return parts?.find(part => part.kind === kind)?.text ?? '';
    }

    function cleanKind(text) {
        return String(text ?? '').replace(/[()]/g, '').trim();
    }

    function cleanSummary(text) {
        return String(text ?? '').replace(/^\s*-\s*/, '').trim();
    }

    function contractRow(line) {
        const parts = line.parts ?? [];
        const header = partText(parts, 'header');
        const field = partText(parts, 'field');
        const type = partText(parts, 'type');
        const kind = cleanKind(partText(parts, 'kind'));
        const summary = cleanSummary(partText(parts, 'summary'));

        if (header) return { kind: 'header', key: header };
        if (field) return { kind: 'field', key: field, type, summary };
        return { kind: 'type', type, typeKind: kind, summary };
    }
</script>

<style>
.profile {
    display: grid;
    gap: 0.45rem;
    min-width: 24rem;
    max-width: 34rem;
}

.section {
    display: grid;
    gap: 0.3rem;
}

.section-title {
    color: #ddd;
    font-family: var(--fBase);
    font-size: 0.78rem;
    margin: 0;
}

.lines {
    display: grid;
    gap: 0.25rem;
}

.line {
    color: #44a3fc;
    font-family: var(--fFixed);
    font-size: 0.7rem;
    margin: 0;
    white-space: pre-wrap;
}

.box {
    box-sizing: border-box;
    width: 100%;
    background: #1f1f1f;
    border: 1px solid #555;
    border-radius: 0.15rem;
    padding: 0.35rem 0.45rem;
}

.contract {
    display: grid;
    gap: 0.16rem;
}

.contract-line {
    padding-left: calc(var(--indent, 0) * 1rem);
}

.brace,
.field,
.endpoint,
.summary, 
.contract-key{
    color: #ddd;
}

.type, 
.meta, 
.kind, 
.status-ok,
.punct {
    color: #44a3fc;
}

.status-warning {
    color: #d08a00;
}

.empty {
    color: #999;
}

.clickable {
    background: #272727;
    border: 1px solid #555;
    border-radius: 0.15rem;
    color: #44a3fc;
    cursor: pointer;
    display: inline-block;
    padding: 0.12rem 0.3rem;
    transition: transform 0.1s ease-out, border-color 0.1s ease-out;
}

.clickable:hover {
    border-color: #888;
}

.clickable:active {
    transform: scale(0.96);
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>
<div class="profile">

{#if _contract}
    <div class="section">
        <p class="section-title">Contract</p>
        <div class="box contract">
            {#if _contract.tokens}
                <p class="line brace">{'{'}</p>
                <p class="line contract-line" style="--indent:1">
                    <span class="contract-key">role</span><span class="punct">: </span><span class="type">{_contract.role ?? 'follower'}</span>
                </p>
                {#each _contract.tokens as line}
                    {@const row = contractRow(line)}
                    {#if row.kind === 'header'}
                        <p class="line contract-line" style={`--indent:${line.indent + 1}`}>
                            <span class="contract-key">{row.key}</span><span class="punct">:</span>
                        </p>
                    {:else if row.kind === 'field'}
                        <p class="line contract-line" style={`--indent:${line.indent + 1}`}>
                            <span class="field">{row.key}</span><span class="punct">: </span><span class="type">{row.type}</span>
                        </p>
                        {#if row.summary}
                            <p class="line contract-line" style={`--indent:${line.indent + 2}`}>
                                <span class="contract-key">summary</span><span class="punct">: </span><span class="summary">{row.summary}</span>
                            </p>
                        {/if}
                    {:else}
                        <p class="line contract-line" style={`--indent:${line.indent + 1}`}>
                            <span class="contract-key">type</span><span class="punct">: </span><span class="type">{row.type}</span>
                        </p>
                        {#if row.typeKind}
                            <p class="line contract-line" style={`--indent:${line.indent + 1}`}>
                                <span class="contract-key">kind</span><span class="punct">: </span><span class="kind">{row.typeKind}</span>
                            </p>
                        {/if}
                        {#if row.summary}
                            <p class="line contract-line" style={`--indent:${line.indent + 1}`}>
                                <span class="contract-key">summary</span><span class="punct">: </span><span class="summary">{row.summary}</span>
                            </p>
                        {/if}
                    {/if}
                {/each}
                <p class="line brace">{'}'}</p>
            {:else if _contract.text}
                <pre class="line">{_contract.text}</pre>
            {/if}
        </div>
    </div>
{/if}

{#if _pin?.is?.proxy}
    <div class="section">
        <p class="section-title">{_pin?.is.input ? 'Connected internal handlers' : 'Connected internal emitters'}</p>
        <div class="box lines">
            {#if _profile?.targets?.length}
                {#each _profile.targets as target}
                    <p class="line endpoint">{target.pin + ' @ ' + target.node}</p>

                    {#if asArray(target.profile).length}
                        {#each asArray(target.profile) as item}
                            {#if item?.handler}
                                <p class="line meta">
                                    <span class="clickable" on:click={() => _open?.({file: item.file, line: item.line})} on:keydown={onProfileKeydown}>
                                        {item.file} ({item.line})
                                    </span>
                                </p>
                            {:else if item?.file}
                                <p class="line meta">
                                    <span class="clickable" on:click={() => _open?.({file: item.file, line: item.line})} on:keydown={onProfileKeydown}>
                                        {item.file} ({item.line})
                                    </span>
                                </p>
                            {/if}
                        {/each}
                    {:else}
                        <p class="line empty">No source profile entry for this internal pin.</p>
                    {/if}
                {/each}
            {:else}
                <p class="line empty">No internal pins are currently resolved behind this proxy.</p>
            {/if}
        </div>
    </div>
{:else if _pin?.is.input}
    <div class="section">
        <p class="section-title">Handler</p>
    </div>
    {#if _profile != null}
        <div class="box">
            <div class="lines">
                <p class="line">
                    {_profile.handler + ' '}
                    <span class="clickable" on:click={() => _open?.({file: _profile.file, line: _profile.line})} on:keydown={onProfileKeydown}>
                        {_profile.file} ({_profile.line})
                    </span>
                </p>
                {#if _profile.typeErrors?.length}
                    {#each _profile.typeErrors as msg}
                        <p class="line status-warning">{msg}</p>
                    {/each}
                {:else}
                    <p class="line status-ok">&#x2714 contract match</p>
                {/if}
            </div>
        </div>
        {#if _profile.summary}
            <div class="section">
                <p class="section-title">Description</p>
                <div class="box">
                    <pre class="line summary">{_profile.summary}</pre>
                </div>
            </div>
        {/if}
    {/if}
{:else}
    <div class="section">
        <p class="section-title">Sent at</p>
    </div>
    {#if Array.isArray(_profile)}
        <div class="box">
            <div class="lines">
                {#each _profile as singleProfile}
                    {#if singleProfile != null}
                        <p class="line">
                            <span class="clickable" on:click={() => _open?.({file: singleProfile.file, line: singleProfile.line})} on:keydown={onProfileKeydown}>
                                {singleProfile.file} ({singleProfile.line})
                            </span>
                        </p>
                    {/if}
                {/each}
            </div>
        </div>
    {:else}
        {#if _profile != null}
            <div class="box">
                <div class="lines">
                    <p class="line">
                        <span class="clickable" on:click={() => _open?.({file: _profile.file, line: _profile.line})} on:keydown={onProfileKeydown}>
                            {_profile.file} ({_profile.line})
                        </span>
                    </p>
                </div>
            </div>
        {/if}
    {/if}
{/if}
</div>
</PopupBox>
