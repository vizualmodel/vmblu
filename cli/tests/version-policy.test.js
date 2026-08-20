import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertCompatibleVersion,
  compatibilityFamily,
  familyRange,
  versionsAreCompatible,
} from '../lib/version-policy.js'

test('xx.yy defines compatibility and patch versions remain independent', () => {
  assert.equal(compatibilityFamily('1.10.0'), '1.10')
  assert.equal(versionsAreCompatible('1.10.1', '1.10.99'), true)
  assert.equal(versionsAreCompatible('1.10.1', '1.11.0'), false)
  assert.equal(familyRange('1.10.7'), '>=1.10.0 <1.11.0')
  assert.equal(assertCompatibleVersion('1.10.42', 'schema', '1.10.0'), '1.10')
  assert.throws(() => assertCompatibleVersion('1.9.8', 'schema', '1.10.0'), /Incompatible schema version/)
})
