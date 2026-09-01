import fs from 'node:fs'

import Ajv2020 from 'ajv/dist/2020.js'

export function validateWithSchema(value, schemaFile, label='artifact') {
    const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'))
    const ajv = new Ajv2020({strict: false, validateFormats: false})
    const validate = ajv.compile(schema)
    if (validate(value)) return value

    const details = (validate.errors ?? [])
        .map(error => `${error.instancePath || '/'} ${error.message}`)
        .join('; ')
    throw new Error(`Invalid ${label}: ${details}`)
}
