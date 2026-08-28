const primitiveTypes = new Set([
  'any',
  'array',
  'boolean',
  'float',
  'int',
  'integer',
  'null',
  'number',
  'object',
  'string',
])

export function validateProtocolReferences(document) {
  const errors = []
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return {ok: false, errors: ['The protocol document must be an object.']}
  }

  const interactions = Array.isArray(document.interactions) ? document.interactions : []
  const types = document.types && typeof document.types === 'object' && !Array.isArray(document.types)
    ? document.types
    : {}
  const interactionIds = new Set()

  for (const interaction of interactions) {
    const id = interaction?.id
    if (typeof id !== 'string' || !id) continue
    if (interactionIds.has(id)) errors.push(`Duplicate protocol interaction id: ${id}.`)
    else interactionIds.add(id)
  }

  const checkType = (typeName, location) => {
    if (typeof typeName !== 'string' || primitiveTypes.has(typeName) || Object.hasOwn(types, typeName)) return
    errors.push(`${location} references unknown type ${typeName}.`)
  }

  for (const interaction of interactions) {
    checkType(interaction?.type, `Interaction ${interaction?.id ?? '<unknown>'}`)
    if (!Array.isArray(interaction?.response)) continue
    for (const response of interaction.response) {
      if (typeof response?.id === 'string' && !interactionIds.has(response.id)) {
        errors.push(`Interaction ${interaction?.id ?? '<unknown>'} references unknown response ${response.id}.`)
      }
    }
  }

  for (const [typeName, definition] of Object.entries(types)) {
    for (const [fieldName, field] of Object.entries(definition?.fields ?? {})) {
      checkType(field?.vmbluType, `Type ${typeName} field ${fieldName}`)
    }
    if (definition?.items) checkType(definition.items.vmbluType, `Type ${typeName} items`)
    for (const fieldName of Array.isArray(definition?.required) ? definition.required : []) {
      if (!Object.hasOwn(definition?.fields ?? {}, fieldName)) {
        errors.push(`Type ${typeName} requires unknown field ${fieldName}.`)
      }
    }
  }

  return {ok: errors.length === 0, errors}
}
