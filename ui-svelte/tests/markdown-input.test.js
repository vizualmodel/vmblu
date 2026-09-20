import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'

// Exercise the component's actual event handlers with a lightweight popup host.
async function fixture() {
    const source = await fs.readFile(new URL('../nodes/markdown-input/markdown-input.svelte', import.meta.url), 'utf8')
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*$/gm, '').replace(/export /g, '')
    const scope = {onMount() {}}
    vm.runInNewContext(script + `
        sx = {openPromptFile: true};
        box.div = {style: {display: 'none'}, querySelector: () => ({focus: () => focused++})};
        let focused = 0;
        box.show = () => {box.div.style.display = 'block'};
        globalThis.api = {handlers, box, edit: value => newText = value,
            preview: () => showPreview = true,
            state: () => ({text: newText, preview: showPreview, error: openError, focused})};
    `, scope)
    return scope.api
}

test('reopening the same prompt focuses it without replacing draft or preview', async () => {
    const ui = await fixture()
    ui.handlers.onMarkdown({promptKey: '/a:root', text: 'Saved text'})
    ui.edit('Unsaved text')
    ui.preview()
    ui.handlers.onMarkdown({promptKey: '/a:root', text: 'Saved text'})
    assert.equal(ui.state().text, 'Unsaved text')
    assert.equal(ui.state().preview, true)
    assert.equal(ui.state().focused, 1)
    ui.handlers.onMarkdown({promptKey: '/b:root', text: 'Another model'})
    assert.equal(ui.state().text, 'Another model')
})

test('closing then reopening loads fresh text and releases draft tracking', async () => {
    const ui = await fixture()
    let reader
    const request = {promptKey: '/a:node', text: 'Saved', draft: value => reader = value}
    ui.handlers.onMarkdown(request)
    ui.edit('Draft')
    assert.equal(reader(), 'Draft')
    ui.box.cancel()
    assert.equal(reader, null)
    ui.handlers.onMarkdown(request)
    assert.equal(ui.state().text, 'Saved')
})

test('file action receives current text; failure preserves the popup draft', async () => {
    const ui = await fixture()
    let received
    ui.handlers.onMarkdown({promptKey: '/a:root', open: async text => {received = text; throw new Error('Denied')}})
    ui.edit('New prompt')
    await ui.box.open()
    assert.equal(received, 'New prompt')
    assert.equal(ui.state().text, 'New prompt')
    assert.equal(ui.state().error, 'Denied')
    assert.equal(ui.box.div.style.display, 'block')
})
