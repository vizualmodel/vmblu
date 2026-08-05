import assert from 'node:assert/strict'
import test from 'node:test'

import {Runtime} from '../shared/runtime.js'
import {assertRuntimeCompatibility, runtimeCompatibilityFamily} from '../shared/release-version.js'

test('runtime accepts its compatibility family and rejects another family', () => {
    assert.equal(runtimeCompatibilityFamily(), '0.10')
    assert.equal(assertRuntimeCompatibility('0.10'), '0.10')
    assert.doesNotThrow(() => new Runtime([], {vmblu: {compatibilityFamily: '0.10'}}))
    assert.throws(
        () => new Runtime([], {vmblu: {compatibilityFamily: '0.11'}}),
        /requires compatibility family 0.11/
    )
})

