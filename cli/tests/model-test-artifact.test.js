import test from 'node:test'
import assert from 'node:assert/strict'

import {
    createNodeTestArtifact,
    normalizeTestSpecification,
    parseTestScenarios,
} from '../lib/model-test-artifact.js'

test('normalizes a dedicated test specification', () => {
    assert.equal(normalizeTestSpecification('\r\n# Counter tests\r\n'), '# Counter tests')
    assert.equal(normalizeTestSpecification('  '), null)
})

test('translates readable test scenarios into formal actions and expectations', () => {
    const scenarios = parseTestScenarios(`# Counter tests

## Counts values
- Purpose: Verify accumulation.
- When: \`2\` and then \`3\` are sent to \`add\`.
- Then: the node sends \`5\` on \`total\`.
`)

    assert.deepEqual(scenarios, [{
        id: 'counts-values',
        title: 'Counts values',
        purpose: 'Verify accumulation.',
        actions: [
            {kind: 'send', pin: 'add', message: 2},
            {kind: 'send', pin: 'add', message: 3},
        ],
        expect: [{kind: 'send', pin: 'total', message: 5}],
    }])
})

test('does not create an artifact for an absent or empty test specification', () => {
    assert.equal(createNodeTestArtifact({testsText: null}), null)
    assert.equal(normalizeTestSpecification(''), null)
})

test('rejects scenario pin names outside the compiled node contract', () => {
    const context = {
        testsText: '## Wrong pin\n- Send: `missing` = `1`\n- Expect send: `out` = `1`',
        parts: ['Node'],
        specHash: 'fnv1a64:0000000000000000',
        contractHash: 'fnv1a64:0000000000000000',
        relativeModel: 'model/app.mod.blu',
        specPath: 'tests/nodes/Node.md',
        node: {
            is: {source: true},
            rxTable: [{pin: {name: 'in'}}],
            txTable: [{pin: {name: 'out'}}],
        },
    }

    assert.throws(() => createNodeTestArtifact(context), /unknown input pin 'missing'/)
})
