import test from 'node:test'
import assert from 'node:assert/strict'

import {ModelManager} from '../nodes/model-manager/model-manager.js'

function makeManager() {
    const canonicalBlu = {path: 'model.mod.blu'}
    const canonicalViz = {path: 'model.mod.viz'}
    const backupBlu = {path: '.vmblu-backup-1.mod.blu'}
    const backupViz = {path: '.vmblu-backup-1.mod.viz'}
    const observations = {}

    const model = {
        blu: {arl: canonicalBlu},
        viz: {arl: canonicalViz},
        changeArl(path) {
            observations.changedTo = path
            this.blu.arl = backupBlu
            this.viz.arl = backupViz
            return true
        },
        setRaw(raw) {
            observations.raw = raw
        },
        saveRaw() {
            observations.savedBlu = this.blu.arl
            observations.savedViz = this.viz.arl
        },
    }

    const manager = Object.create(ModelManager.prototype)
    manager.model = model
    manager.modcom = {
        reset() {},
        encode() {
            observations.encodedBlu = model.blu.arl
            observations.encodedViz = model.viz.arl
            return {root: {}}
        },
    }
    manager.getNodeToSave = () => ({})

    return {manager, model, observations, canonicalBlu, canonicalViz, backupBlu, backupViz}
}

test('temporary model save restores the canonical target', () => {
    const fixture = makeManager()

    fixture.manager.onModelSave({path: '.vmblu-backup-1.mod.blu', preserveTarget: true})

    assert.equal(fixture.observations.encodedBlu, fixture.canonicalBlu)
    assert.equal(fixture.observations.encodedViz, fixture.canonicalViz)
    assert.equal(fixture.observations.savedBlu, fixture.backupBlu)
    assert.equal(fixture.observations.savedViz, fixture.backupViz)
    assert.equal(fixture.model.blu.arl, fixture.canonicalBlu)
    assert.equal(fixture.model.viz.arl, fixture.canonicalViz)
})

test('regular Save As keeps the new model target', () => {
    const fixture = makeManager()

    fixture.manager.onModelSave({path: 'renamed.mod.blu'})

    assert.equal(fixture.observations.encodedBlu, fixture.backupBlu)
    assert.equal(fixture.observations.encodedViz, fixture.backupViz)
    assert.equal(fixture.model.blu.arl, fixture.backupBlu)
    assert.equal(fixture.model.viz.arl, fixture.backupViz)
})
