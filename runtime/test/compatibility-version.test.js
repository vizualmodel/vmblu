import assert from 'node:assert/strict'
import test from 'node:test'

import {Runtime} from '../shared/runtime.js'
import {assertRuntimeCompatibility, runtimeCompatibilityFamily} from '../shared/release-version.js'

test('runtime accepts its compatibility family and rejects another family', () => {
    assert.equal(runtimeCompatibilityFamily(), '1.12')
    for (const version of ['1.12.0', '1.12.1', '1.12.99']) {
        assert.equal(runtimeCompatibilityFamily(version), '1.12')
    }
    assert.equal(assertRuntimeCompatibility('1.12'), '1.12')
    assert.doesNotThrow(() => new Runtime([], {vmblu: {compatibilityFamily: '1.12'}}))
    assert.throws(
        () => new Runtime([], {vmblu: {compatibilityFamily: '1.10'}}),
        /requires compatibility family 1.10/
    )
})
