import test from 'node:test'
import assert from 'node:assert/strict'

import {ModelPane} from '../nodes/model-pane/model-pane.js'

function element() {
    return {
        children: [],
        style: {},
        parent: null,
        append(child) {
            child.remove()
            child.parent = this
            this.children.push(child)
        },
        prepend(child) {
            child.remove()
            child.parent = this
            this.children.unshift(child)
        },
        remove() {
            if (!this.parent) return
            this.parent.children = this.parent.children.filter((child) => child !== this)
            this.parent = null
        }
    }
}

test('model pane owns the canvas and its overlays as one content element', () => {
    const originalDocument = globalThis.document
    globalThis.document = {createElement: () => element()}

    try {
        const sent = []
        const pane = ModelPane({send: (pin, value) => sent.push({pin, value})})
        const menu = element()
        const legend = element()
        const canvas = element()

        pane.onMenuDiv(menu)
        pane.onLegendDiv(legend)
        pane.onCanvas(canvas)

        assert.equal(sent.length, 1)
        assert.equal(sent[0].pin, 'content div')
        assert.deepEqual(sent[0].value.children, [canvas, menu, legend])
    }
    finally {
        globalThis.document = originalDocument
    }
})

test('replacing the canvas keeps the model overlays attached', () => {
    const originalDocument = globalThis.document
    globalThis.document = {createElement: () => element()}

    try {
        const roots = []
        const pane = ModelPane({send: (_pin, value) => roots.push(value)})
        const menu = element()
        const legend = element()
        const firstCanvas = element()
        const secondCanvas = element()

        pane.onMenuDiv(menu)
        pane.onLegendDiv(legend)
        pane.onCanvas(firstCanvas)
        pane.onCanvas(secondCanvas)

        assert.equal(roots[0], roots[1])
        assert.deepEqual(roots[1].children, [secondCanvas, menu, legend])
        assert.equal(firstCanvas.parent, null)
    }
    finally {
        globalThis.document = originalDocument
    }
})
