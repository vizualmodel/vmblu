import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import {SCHEMA_VERSION} from '../lib/version-policy.js'

test('published schema version constraints accept patches and retain format revisions', () => {
    const ajv = new Ajv2020({strict: false})
    for (const file of ['sys.schema.json', 'protocol.schema.json', 'model-test.schema.json', 'test-report.schema.json']) {
        const schema = JSON.parse(fs.readFileSync(new URL(`../context/${SCHEMA_VERSION}/${file}`, import.meta.url)))
        const validate = ajv.compile(schema.$defs?.Header?.properties.version ?? schema.properties.schemaVersion)
        for (const version of ['1.12.0', '1.12.1', '1.12.2', '1.12.99']) assert.equal(validate(version), true, `${file}: ${version}`)
        for (const version of ['1.11.9', '1.13.0', '2.12.0', 'bad', undefined]) assert.equal(validate(version), false, `${file}: ${version}`)
        if (schema.properties.$schema) {
            assert.equal(schema.properties.version.const, 1)
            const validateUri = ajv.compile(schema.properties.$schema)
            assert.equal(validateUri(`https://vmblu.dev/context/1.12.1/${file}`), true)
            assert.equal(validateUri(`https://vmblu.dev/context/1.13.0/${file}`), false)
        }
    }
})
