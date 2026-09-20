import assert from 'node:assert/strict'
import test from 'node:test'
import {compatibilityVersionPattern, versionsAreCompatible} from '../types/model/version-policy.js'

test('schema constraints and JavaScript use the same compatibility family', () => {
    const pattern = new RegExp(compatibilityVersionPattern('1.12.2'))
    for (const version of ['1.12.0', '1.12.1', '1.12.99', '1.12.3-beta+build', '1.11.9', '1.13.0', '2.12.2']) {
        assert.equal(pattern.test(version), versionsAreCompatible(version, '1.12.2'), version)
    }
    for (const version of ['', '1.12', 'invalid', undefined]) {
        assert.throws(() => versionsAreCompatible(version, '1.12.2'), /Invalid vmblu/)
        assert.equal(pattern.test(version), false)
    }
})
