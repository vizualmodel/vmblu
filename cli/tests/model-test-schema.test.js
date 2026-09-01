import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import {validateWithSchema} from '../lib/schema-validation.js'

const modelSchema = new URL('../context/1.12.0/model-test.schema.json', import.meta.url)
const reportSchema = new URL('../context/1.12.0/test-report.schema.json', import.meta.url)
const blueprintSchema = new URL('../context/1.12.0/blu.schema.json', import.meta.url)
const securityEventSchema = new URL('../context/1.12.0/security-event.schema.json', import.meta.url)

test('unified model test schema accepts node, group, model, and browser operations', () => {
    for (const [scope, path] of [['node', ['Adder']], ['group', ['Math']], ['model', []]]) {
        validateWithSchema({
            $schema: 'https://vmblu.dev/context/1.12.0/model-test.schema.json',
            kind: 'vmblu.model-test', version: 1, schemaVersion: '1.12.0', host: 'browser',
            source: {
                model: 'model/app.mod.blu', spec: 'tests/nodes/test.md',
                specHash: 'fnv1a64:0000000000000000', contractHash: 'fnv1a64:0000000000000000',
            },
            target: {scope, name: scope === 'model' ? 'App' : path.at(-1), path},
            scenarios: [{
                id: 'ui-action', title: 'UI action', purpose: 'Exercise browser host',
                actions: [
                    {kind: 'mount', pin: 'ui.get-view'},
                    {kind: 'click', locator: {role: 'button', name: 'Save'}},
                ],
                expect: [{kind: 'view', locator: {css: '.status'}, text: 'Saved'}],
            }],
        }, modelSchema)
    }
})

test('model test report schema accepts a node result', () => {
    validateWithSchema({
        $schema: 'https://vmblu.dev/context/1.12.0/test-report.schema.json',
        kind: 'vmblu.test-report', version: 1, schemaVersion: '1.12.0',
        test: 'tests/nodes/Adder.test.json', artifactHash: 'fnv1a64:0000000000000000',
        target: {scope: 'node', name: 'Adder', path: ['Adder']},
        startedAt: new Date().toISOString(), durationMs: 0, status: 'passed',
        summary: {total: 1, passed: 1, failed: 0, skipped: 0, error: 0},
        scenarios: [{
            id: 'adds', title: 'Adds', purpose: 'Check addition', status: 'passed', durationMs: 0,
            actions: [{kind: 'send', pin: 'add', message: 2}],
            expect: [{kind: 'send', pin: 'total', message: 2}],
            observations: [{kind: 'send', pin: 'total', message: 2, atMs: 0}], failures: [],
        }],
    }, reportSchema)
})

test('schema files advertise their 1.12 identifiers', () => {
    const model = JSON.parse(fs.readFileSync(modelSchema, 'utf8'))
    const report = JSON.parse(fs.readFileSync(reportSchema, 'utf8'))
    assert.equal(model.$id, 'https://vmblu.dev/context/1.12.0/model-test.schema.json')
    assert.equal(report.$id, 'https://vmblu.dev/context/1.12.0/test-report.schema.json')
})

test('blueprint schema permits testRepo on definitions and rejects it on docks', () => {
    const base = {
        header: {version: '1.12.0'},
        root: {kind: 'group', name: 'App', nodes: []},
    }
    base.root.testRepo = {arl: '../tests/app/application.md', pathKind: 2}
    validateWithSchema(base, blueprintSchema)

    const dockModel = structuredClone(base)
    dockModel.root.nodes.push({
        kind: 'dock', name: 'Imported', link: {path: './library.mod.blu', node: 'Library'},
        testRepo: {arl: '../tests/nodes/Imported.md', pathKind: 2},
    })
    assert.throws(() => validateWithSchema(dockModel, blueprintSchema), /boolean schema is false/i)
})

test('blueprint schema accepts canonical application security and rejects ambiguous scopes', () => {
    const model = {
        header: {
            version: '1.12.0',
            runtime: '@vizualmodel/vmblu-runtime/rt-als',
            runtimeSettings: {security: {
                enabled: false,
                fs: {read: {mode: 'deny'}, write: {mode: 'allow', roots: ['./out']}, delete: {mode: 'deny'}},
                net: {egress: {mode: 'warn', all: true}},
                process: {exec: {mode: 'deny'}},
            }},
        },
        root: {kind: 'group', name: 'App', nodes: []},
    }
    validateWithSchema(model, blueprintSchema)

    const ambiguous = structuredClone(model)
    ambiguous.header.runtimeSettings.security.fs.write.all = true
    assert.throws(() => validateWithSchema(ambiguous, blueprintSchema), /must match exactly one schema/i)

    const misspelled = structuredClone(model)
    misspelled.header.runtimeSettings.security.fs.remove = {mode: 'allow', all: true}
    assert.throws(() => validateWithSchema(misspelled, blueprintSchema), /additional properties/i)

    const audited = structuredClone(model)
    audited.header.runtimeSettings.security.audit = {allowed: true}
    assert.throws(() => validateWithSchema(audited, blueprintSchema), /additional properties/i)
})

test('security event schema validates warning and denial events', () => {
    const event = {
        schemaVersion: 1,
        ts: Date.now(),
        node: 'ImageExporter',
        operation: 'fs.write',
        cap: 'fs:write',
        detail: {path: './out/image.png'},
        policy: {decision: 'warning', area: 'fs', action: 'write', mode: 'warn'},
    }
    validateWithSchema(event, securityEventSchema)
    validateWithSchema({...event, policy: {...event.policy, decision: 'denied', mode: 'deny', reason: 'fs_root_not_allowed'}}, securityEventSchema)
    assert.throws(() => validateWithSchema({...event, policy: {...event.policy, decision: 'allowed', mode: 'allow'}}, securityEventSchema), /allowed values/i)
})
