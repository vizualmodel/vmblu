import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertCompatibleVersion,
  compatibilityFamily,
  familyRange,
  versionsAreCompatible,
} from '../lib/version-policy.js'

test('xx.yy defines compatibility and patch versions remain independent', () => {
  assert.equal(compatibilityFamily('0.10.0'), '0.10')
  assert.equal(versionsAreCompatible('0.10.1', '0.10.99'), true)
  assert.equal(versionsAreCompatible('0.10.1', '0.11.0'), false)
  assert.equal(familyRange('0.10.7'), '>=0.10.0 <0.11.0')
  assert.equal(assertCompatibleVersion('0.10.42', 'schema', '0.10.0'), '0.10')
  assert.throws(() => assertCompatibleVersion('0.9.8', 'schema', '0.10.0'), /Incompatible schema version/)
})

