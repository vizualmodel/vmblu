import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

import {RawHandling} from '../types/model/blueprint-raw.js'

test('0.10.0 visualization schema uses the canonical interface key', async () => {
    const schemaUrl = new URL('../../cli/context/0.10.0/viz.schema.json', import.meta.url)
    const schema = JSON.parse(await readFile(schemaUrl, 'utf8'))
    const interfaceSchema = schema.$defs.Interface

    assert.deepEqual(interfaceSchema.required, ['interface'])
    assert.ok(interfaceSchema.properties.interface)
    assert.equal(interfaceSchema.properties.name, undefined)
})

test('visual interface serialization writes interface and never name', () => {
    const split = RawHandling.splitInterfaces([
        {
            interface: 'control',
            wid: 7,
            pins: [
                {
                    name: 'control.in',
                    kind: 'input',
                    wid: 8,
                    left: true,
                },
            ],
        },
    ])

    assert.deepEqual(split.viz, [
        {
            interface: '(7) control',
            pins: ['(8 L)control.in'],
        },
    ])
    assert.equal(split.viz[0].name, undefined)
})

test('visual interface loading accepts legacy name input', () => {
    const bluNode = {
        interfaces: [
            {
                interface: 'control',
                pins: [
                    {
                        name: 'control.in',
                        kind: 'input',
                    },
                ],
            },
        ],
    }
    const vizNode = {
        interfaces: [
            {
                name: '(7) control',
                pins: ['(8 L)control.in'],
            },
        ],
    }

    RawHandling.joinInterfaces(bluNode, vizNode)

    assert.equal(bluNode.interfaces[0].pins[0].wid, 8)
    assert.equal(bluNode.interfaces[0].pins[0].left, true)
})
