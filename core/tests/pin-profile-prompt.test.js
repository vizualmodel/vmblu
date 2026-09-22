import test from 'node:test'
import assert from 'node:assert/strict'
import {getPinPromptLine} from '../types/node/node-prompt-document.js'
import {redoxWidget} from '../nodes/model-manager/redox-widget.js'

test('pin navigation finds the exact pin in the Pins section with one-based lines', () => {
    const text = '## Node\r\n### receive\r\nNotes\r\n## Pins\r\n### receive more\r\nOther\r\n### receive\r\nPrompt'
    assert.equal(getPinPromptLine(text, 'receive'), 7)
    assert.equal(getPinPromptLine(text, 'receive more'), 5)
    assert.equal(getPinPromptLine(text, 'missing'), 1)
    assert.equal(getPinPromptLine(null, 'receive'), 1)
})

test('profile file action opens the existing file at the selected pin without rewriting it', async () => {
    const messages = []
    const arl = {get: async () => '## Node\nNotes\n## Pins\n### receive\nPrompt'}
    const node = {name: 'Worker', prompts: {repository: {arl}}}
    const pin = {name: 'receive', node, prompt: 'Prompt', is: {input: true}}
    const context = {manager: {
        model: {getContract: () => null, getInputPinProfile: () => null},
        tx: {send: (name, data) => messages.push({name, data})},
    }}
    redoxWidget.showProfile.doit.call(context, {pin, pos: {x: 0, y: 0}})
    await messages[0].data.openPrompt()
    assert.deepEqual(messages[1], {name: 'open source file', data: {arl, line: 4}})
})
