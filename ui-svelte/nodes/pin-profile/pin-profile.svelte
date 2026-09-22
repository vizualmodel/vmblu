<script>
    import {onMount} from 'svelte';
    import PopupBox from '../../fragments/popup-box.svelte';
    export let tx;
    let pin = null, contract = null, profile = null;
    let openSource = null, editPrompt = null, openPrompt = null;
    let promptText = '', promptError = '', opening = false;
    let expanded = {};
    let box = {div: null, pos: null, title: '', ok: close, cancel: close};
    onMount(() => tx.send('modal div', box.div));

    function savePrompt() {
        if (pin && promptText !== (pin.prompt ?? '')) editPrompt?.({pin, prompt: promptText});
    }
    function close() {
        savePrompt();
        pin = null;
        box.hide();
    }
    export const handlers = {
        onShow(args) {
            if (pin && pin === args.pin) return close();
            savePrompt();
            ({pin, contract, profile} = args);
            openSource = args.open;
            editPrompt = args.editPrompt;
            openPrompt = args.openPrompt;
            promptText = pin.prompt ?? '';
            promptError = '';
            expanded = {};
            box.title = `${pin.name} @ ${pin.node.name} (${pin.is.input ? 'in' : 'out'})`;
            box.show(args.pos);
        }
    };
    function keydown(event) {
        if (event.key !== 'Escape') event.stopPropagation();
    }
    function promptKeydown(event) {
        event.stopPropagation();
        if (event.key === 'Escape') {
            promptText = pin?.prompt ?? '';
            event.target.blur();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.target.blur();
        }
    }
    async function openPromptFile() {
        if (opening || !openPrompt) return;
        savePrompt();
        const currentPin = pin;
        opening = true;
        promptError = '';
        try { await openPrompt(); }
        catch (error) { if (pin === currentPin) promptError = error?.message ?? String(error); }
        finally { opening = false; }
    }
    const asArray = value => value ? (Array.isArray(value) ? value : [value]) : [];
    const part = (line, kind) => line?.parts?.find(part => part.kind === kind)?.text ?? '';
    const summary = line => part(line, 'summary').replace(/^\s*-\s*/, '').trim();
    const kind = line => part(line, 'kind').replace(/[()]/g, '').trim();
    function overview(value) {
        if (!value) return [];
        return value.request || value.reply ? ['request', 'reply'].map(key => ({
            key, type: value[key]?.type ?? value.payload?.[key] ?? 'any',
            kind: value[key]?.kind ?? 'primitive', summary: value[key]?.summary ?? ''
        })) : [{key: 'payload', type: value.type ?? value.payload ?? 'any',
            kind: value.kind ?? 'primitive', summary: value.summary ?? ''}];
    }
    function fields(key) {
        let section = 'payload';
        const tokens = (contract?.tokens ?? []).filter(line => {
            const header = part(line, 'header');
            if (header) { section = header; return false; }
            return section === key;
        });
        const baseIndent = key === 'payload' ? 1 : 2;
        return tokens.flatMap((line, index) => {
            const name = part(line, 'field');
            if (!name) return [];
            const child = tokens[index + 1];
            const hasChildType = part(child, 'type') && !part(child, 'field');
            return [{name, type: part(line, 'type'),
                kind: hasChildType ? kind(child) || part(line, 'type') : part(line, 'type'),
                summary: summary(line) || (hasChildType ? summary(child) : ''),
                indent: Math.max(0, line.indent - baseIndent)}];
        });
    }
    $: status = !profile?.handler ? 'missing' : profile.typeErrors?.length ? 'warning' : 'ok';
    $: statusText = status === 'ok' ? 'Handler parameters match the contract'
        : status === 'warning' ? 'Handler parameters do not match the contract' : 'No handler found';
</script>

<style>
.profile { display: grid; gap: 1rem; width: 32rem; max-width: calc(100vw - 3rem); color: #ddd; }
.section { display: grid; gap: 0.4rem; min-width: 0; }
.section-header { display: flex; align-items: center; gap: 0.45rem; }
.section-title { font: 600 0.8rem var(--fBase, sans-serif); margin: 0; }
.kind, .empty { color: #999; }
.role { display: inline-flex; align-items: center; justify-content: center; width: 1rem; height: 1rem; box-sizing: border-box; border: 1px solid currentColor; border-radius: 50%; color: #c0c022; font: 0.7rem/1 var(--fBase, sans-serif); }
.lines { display: grid; gap: 0.35rem; }
.line { margin: 0; font: 0.75rem/1.55 var(--fFixed, monospace); overflow-wrap: anywhere; }
.summary { color: #ccc; }
.type, .source-link { color: #70b6ef; }
button { font: inherit; }
.file-button { display: inline-flex; background: transparent; border: 0; padding: 0.15rem; color: #c0c022; cursor: pointer; }
.file-button .material-icons-outlined, .status { font-size: 1rem; }
.file-button:hover { color: #ffff00; }
.file-button:disabled { opacity: 0.4; cursor: default; }
textarea { box-sizing: border-box; width: 100%; min-height: 4.4rem; max-height: 18rem; resize: vertical; border: 0; border-radius: 0.2rem; padding: 0.45rem; background: #ffffff09; color: #ddd; font: 0.78rem/1.55 var(--fBase, sans-serif); }
textarea:hover { background: #ffffff0e; }
textarea:focus { background: #ffffff12; }
textarea::placeholder { font-style: italic; }
button:focus-visible, textarea:focus-visible { outline: 1px solid #70b6ef; outline-offset: 2px; }
.contract-row { display: block; width: 100%; text-align: left; background: transparent; border: 0; padding: 0.15rem 0; color: inherit; cursor: pointer; }
.contract-row:hover, .source-link:hover { background: #ffffff0c; }
.chevron { display: inline-block; vertical-align: middle; font-size: 1rem; color: #999; }
.contract-fields { display: grid; gap: 0.25rem; padding: 0.25rem 0 0.1rem 1.25rem; }
.contract-field { padding-left: calc(var(--indent, 0) * 0.65rem); }
.source-link { background: transparent; border: 0; padding: 0; cursor: pointer; text-align: left; overflow-wrap: anywhere; }
.source-link:hover { text-decoration: underline; }
.status-ok { color: #71c58a; }
.status-warning { color: #e5b65d; }
.status-missing { color: #c0c022; }
</style>

<PopupBox box={box}>
<div class="profile">
{#if pin}
    <section class="section" aria-label="Prompt">
        <div class="section-header">
            <h2 class="section-title">Prompt</h2>
            <button class="file-button" type="button" title="Open node prompt file at this pin" aria-label="Open node prompt file at this pin" disabled={!openPrompt || opening} on:click={openPromptFile} on:keydown={keydown}>
                <span class="material-icons-outlined" aria-hidden="true">description</span>
            </button>
        </div>
        <textarea aria-label="Pin prompt" placeholder="add prompt here" bind:value={promptText} rows={Math.min(10, Math.max(3, promptText.split('\n').length))} on:blur={savePrompt} on:keydown={promptKeydown}></textarea>
        {#if promptError}<p class="line status-warning" role="alert">{promptError}</p>{/if}
    </section>
{/if}
{#if contract}
    <section class="section" aria-label="Contract">
        <div class="section-header">
            <h2 class="section-title">Contract</h2>
            <span class="role" role="img" aria-label={contract.role === 'owner' ? 'Owner' : 'Follower'} title={contract.role === 'owner' ? 'Owner' : 'Follower'}>{contract.role === 'owner' ? '1' : '2'}</span>
        </div>
        <div class="lines">
        {#each overview(contract) as item}
            {@const details = fields(item.key)}
            {#if details.length}
                <button class="contract-row line" type="button" aria-expanded={!!expanded[item.key]} on:click={() => expanded = {...expanded, [item.key]: !expanded[item.key]}} on:keydown={keydown}>
                    <span class="material-icons-outlined chevron" aria-hidden="true">{expanded[item.key] ? 'expand_more' : 'chevron_right'}</span>
                    {#if item.key !== 'payload'}<span class="empty">{item.key}: </span>{/if}<span class="type">{item.type}</span> <span class="kind">({item.kind})</span> <span class="summary">{item.summary}</span>
                </button>
            {:else}
                <p class="line">{#if item.key !== 'payload'}<span class="empty">{item.key}: </span>{/if}<span class="type">{item.type}</span> <span class="kind">({item.kind})</span> <span class="summary">{item.summary}</span></p>
            {/if}
            {#if expanded[item.key] && details.length}
                <div class="contract-fields">
                    {#each details as field}
                        <p class="line contract-field" style={`--indent:${field.indent}`} title={field.type}><span>{field.name}</span> <span class="kind">({field.kind})</span> <span class="summary">{field.summary}</span></p>
                    {/each}
                </div>
            {/if}
        {/each}
        </div>
    </section>
{/if}
{#if pin?.is?.proxy}
    <section class="section" aria-label="Internal connections">
        <h2 class="section-title">{pin.is.input ? 'Connected internal handlers' : 'Connected internal emitters'}</h2>
        {#each profile?.targets ?? [] as target}
            <div class="lines">
                <p class="line">{target.pin} @ {target.node}</p>
                {#each asArray(target.profile) as item}
                    {#if item?.file}<p class="line"><button class="source-link" on:click={() => openSource?.({file: item.file, line: item.line})} on:keydown={keydown}>{item.file} ({item.line})</button></p>{/if}
                {:else}<p class="line empty">No source profile entry for this internal pin.</p>{/each}
            </div>
        {:else}<p class="line empty">No internal pins are currently resolved behind this proxy.</p>{/each}
    </section>
{:else if pin?.is.input}
    <section class="section" aria-label="Handler">
        <div class="section-header">
            <h2 class="section-title">Handler</h2>
            <span class={`material-icons-outlined status status-${status}`} role="img" aria-label={statusText} title={statusText}>{status === 'ok' ? 'check_circle' : status === 'warning' ? 'warning_amber' : 'help_outline'}</span>
        </div>
        {#if profile?.handler}
            <p class="line"><span>{profile.handler}</span> <button class="source-link" on:click={() => openSource?.({file: profile.file, line: profile.line})} on:keydown={keydown}>{profile.file} ({profile.line})</button></p>
            {#each profile.typeErrors ?? [] as message}<p class="line status-warning">{message}</p>{/each}
        {:else}<p class="line empty">No handler found.</p>{/if}
    </section>
{:else if pin}
    <section class="section" aria-label="Sent at">
        <h2 class="section-title">Sent at</h2>
        {#each asArray(profile).filter(Boolean) as item}
            <p class="line"><button class="source-link" on:click={() => openSource?.({file: item.file, line: item.line})} on:keydown={keydown}>{item.file} ({item.line})</button></p>
        {:else}<p class="line empty">No tx locations.</p>{/each}
    </section>
{/if}
</div>
</PopupBox>
