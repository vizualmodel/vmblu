import assert from 'node:assert/strict'
import test from 'node:test'
import {chatSystem, transmitter} from './fixtures.js'
import {SysbluManager} from '../nodes/sysblu-manager/sysblu-manager.js'
import {validateSystemDocument} from '../nodes/sysblu-manager/system-document.js'

test('system editor opens and saves earlier and later patches without rewriting versions', async () => {
    for (const version of ['1.12.0', '1.12.1', '1.12.2', '1.12.99']) {
        const document = chatSystem()
        document.header.version = version
        let saved
        const manager = new SysbluManager(transmitter())
        await manager.onSysbluSet({model: document, arl: {
            getPath: () => 'system/active.sys.blu',
            canWrite: () => true,
            save: async text => { saved = JSON.parse(text) },
        }})
        assert.equal(manager.document?.header.version, version)
        await manager.onSysbluSave()
        assert.equal(saved.header.version, version)
    }
})

test('system editor rejects other families and malformed versions', () => {
    for (const version of ['1.11.9', '1.13.0', '2.12.1', '', 'invalid', undefined]) {
        const document = chatSystem()
        document.header.version = version
        assert.equal(validateSystemDocument(document).ok, false, String(version))
    }
})
