<script>
import MarkdownIt from 'markdown-it'

export let text = ''
export let cols = 50
export let rows = 10

// Parent drives this via bind:showPreview; default is true for reading-first flow
export let showPreview = true

// only the escape key can go to the box
function onKeydown(e) {
    if (e.key !== "Escape" && e.key !== "Esc") e.stopPropagation()
}

const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
})

const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noreferrer noopener')
    return defaultLinkOpen(tokens, idx, options, env, self)
}

$: previewHtml = md.render(text ?? '')
$: fieldWidth = `${Number(cols) || 50}ch`
$: fieldHeight = `${((Number(rows) || 10) * 1.35) + 1}em`
$: fieldStyle = `width:${fieldWidth}; min-height:${fieldHeight};`
</script>
<style>
:global(:root) {
    --md-bg: #000;
    --md-fg: #fff;
    --md-border: #333;
    --md-link: #7fc7ff;
    --md-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --md-editor-font: "Cascadia Code", Consolas, "Courier New", monospace;
}

.wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.preview,
textarea {
    box-sizing: border-box;
    font-size: 0.9rem;
    padding: 0.5rem;
    background: var(--md-bg);
    color: var(--md-fg);
    outline: none;
    border: 1px solid var(--md-border);
    border-radius: 4px;
}

.preview {
    font-family: var(--md-font);
    line-height: 1.35;
    overflow: auto;
    white-space: normal;
}

.preview :global(a) {
    color: var(--md-link);
}

.preview :global(p) {
    margin: 0 0 0.7rem;
}

.preview :global(p:last-child) {
    margin-bottom: 0;
}

.preview :global(pre) {
    overflow: auto;
    margin: 0.5rem 0;
    padding: 0.5rem;
    border: 1px solid var(--md-border);
}

.preview :global(code) {
    color: inherit;
}

textarea {
    font-family: var(--md-editor-font);
    line-height: 1.35;
    resize: vertical;
}
</style>

<div class="wrapper">
    {#if showPreview}
        <div class="preview" style={fieldStyle} aria-label="Markdown preview" tabindex="0">
            {@html previewHtml}
        </div>
    {:else}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <textarea style={fieldStyle} bind:value={text} name="txt-name" spellcheck="false" rows={rows} cols={cols} on:keydown={onKeydown}></textarea>
    {/if}
</div>
