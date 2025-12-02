<script>
export let text = ''
export let cols = 50
export let rows = 10

// Parent drives this via bind:showPreview; default is true for reading-first flow
export let showPreview = true

// only the escape key can go to the box
function onKeydown(e) {
    if (e.key !== "Escape" && e.key !== "Esc") e.stopPropagation()
}

const escapeHtml = (str) =>
    (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = (str) => escapeHtml(str).replace(/"/g, '&quot;')

const isSafeUrl = (url) => /^(https?:|mailto:|tel:|\/)/i.test(url.trim())

function renderMarkdown(str) {
    let html = escapeHtml(str ?? '')

    // inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
    // bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    // links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
        const safeHref = isSafeUrl(url) ? escapeAttr(url) : '#'
        return `<a href="${safeHref}" rel="noreferrer noopener" target="_blank">${label}</a>`
    })

    // line breaks
    html = html.replace(/\n/g, '<br>')
    return html
}

$: previewHtml = renderMarkdown(text)
</script>
<style>
:global(:root) {
    --md-bg: #000;
    --md-fg: #fff;
    --md-border: #333;
    --md-link: #7fc7ff;
}

.wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.preview,
textarea {
    font-family: courier new, monospace;
    font-size: 0.9rem;
    padding: 0.5rem;
    background: var(--md-bg);
    color: var(--md-fg);
    outline: none;
    border: 1px solid var(--md-border);
    border-radius: 4px;
}

.preview {
    min-height: 6rem;
    line-height: 1.35;
    overflow: auto;
}

.preview a {
    color: var(--md-link);
}

textarea {
    resize: vertical;
}
</style>

<div class="wrapper">
    {#if showPreview}
        <div class="preview" aria-label="Markdown preview" tabindex="0">
            {@html previewHtml}
        </div>
    {:else}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <textarea bind:value={text} name="txt-name" spellcheck="false" rows={rows} cols={cols} on:keydown={onKeydown}></textarea>
    {/if}
</div>
