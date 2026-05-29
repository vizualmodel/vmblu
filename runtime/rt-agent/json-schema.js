export function validateJsonSchema(schema, value, {path = '$'} = {}) {
    const errors = []
    validate(schema, value, path, errors)
    return {
        valid: errors.length === 0,
        errors,
    }
}

function validate(schema, value, path, errors) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return

    if (schema.oneOf) {
        const matches = schema.oneOf.filter(candidate => {
            const candidateErrors = []
            validate(candidate, value, path, candidateErrors)
            return candidateErrors.length === 0
        })
        if (matches.length !== 1) errors.push(error(path, 'oneOf', `Expected exactly one matching schema, found ${matches.length}`))
        return
    }

    if (schema.anyOf) {
        const matches = schema.anyOf.some(candidate => {
            const candidateErrors = []
            validate(candidate, value, path, candidateErrors)
            return candidateErrors.length === 0
        })
        if (!matches) errors.push(error(path, 'anyOf', 'Expected at least one matching schema'))
        return
    }

    if (schema.allOf) {
        for (const candidate of schema.allOf) validate(candidate, value, path, errors)
    }

    if (schema.const !== undefined && value !== schema.const) {
        errors.push(error(path, 'const', `Expected ${JSON.stringify(schema.const)}`))
    }

    if (Array.isArray(schema.enum) && !schema.enum.some(item => item === value)) {
        errors.push(error(path, 'enum', `Expected one of: ${schema.enum.map(item => JSON.stringify(item)).join(', ')}`))
    }

    if (schema.type && !matchesType(schema.type, value)) {
        errors.push(error(path, 'type', `Expected ${Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type}`))
        return
    }

    if (isObject(value)) validateObject(schema, value, path, errors)
    if (Array.isArray(value)) validateArray(schema, value, path, errors)
    if (typeof value === 'number') validateNumber(schema, value, path, errors)
    if (typeof value === 'string') validateString(schema, value, path, errors)
}

function validateObject(schema, value, path, errors) {
    const properties = isObject(schema.properties) ? schema.properties : {}
    const required = Array.isArray(schema.required) ? schema.required : []

    for (const key of required) {
        if (!Object.hasOwn(value, key)) errors.push(error(`${path}.${key}`, 'required', 'Missing required property'))
    }

    for (const [key, item] of Object.entries(value)) {
        if (properties[key]) {
            validate(properties[key], item, `${path}.${key}`, errors)
            continue
        }
        if (schema.additionalProperties === false) {
            errors.push(error(`${path}.${key}`, 'additionalProperties', 'Unexpected property'))
        }
        else if (isObject(schema.additionalProperties)) {
            validate(schema.additionalProperties, item, `${path}.${key}`, errors)
        }
    }
}

function validateArray(schema, value, path, errors) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
        errors.push(error(path, 'minItems', `Expected at least ${schema.minItems} items`))
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
        errors.push(error(path, 'maxItems', `Expected at most ${schema.maxItems} items`))
    }
    if (schema.items) {
        value.forEach((item, index) => validate(schema.items, item, `${path}[${index}]`, errors))
    }
}

function validateNumber(schema, value, path, errors) {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
        errors.push(error(path, 'minimum', `Expected >= ${schema.minimum}`))
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
        errors.push(error(path, 'maximum', `Expected <= ${schema.maximum}`))
    }
}

function validateString(schema, value, path, errors) {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
        errors.push(error(path, 'minLength', `Expected length >= ${schema.minLength}`))
    }
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
        errors.push(error(path, 'maxLength', `Expected length <= ${schema.maxLength}`))
    }
    if (schema.pattern) {
        try {
            if (!new RegExp(schema.pattern).test(value)) errors.push(error(path, 'pattern', `Expected to match ${schema.pattern}`))
        }
        catch {
            errors.push(error(path, 'pattern', `Invalid schema pattern ${schema.pattern}`))
        }
    }
}

function matchesType(type, value) {
    const types = Array.isArray(type) ? type : [type]
    return types.some(item => {
        if (item === 'array') return Array.isArray(value)
        if (item === 'integer') return Number.isInteger(value)
        if (item === 'number') return typeof value === 'number' && Number.isFinite(value)
        if (item === 'object') return isObject(value)
        if (item === 'null') return value === null
        return typeof value === item
    })
}

function isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
}

function error(path, keyword, message) {
    return {path, keyword, message}
}
