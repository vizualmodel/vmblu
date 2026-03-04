import {convert} from '../util/index.js'

const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array', 'integer'])

export const McpHandling = {

makeMcpToolString(root) {

    const mcpSpec = this.generateMcpSpec(root)

    if (mcpSpec.tools.length === 0) return null

    const sHeader =    '// ------------------------------------------------------------------'
                    +`\n// MCP tool file for model: ${root?.name || ''}`
                    +`\n// Creation date ${new Date().toLocaleString()}`
                    +'\n// ------------------------------------------------------------------\n'
                    +'\nexport const mcpSpec = '

    const sMcpSpec = convert.objectToJsLiteral(mcpSpec)

    return sHeader + sMcpSpec
},

generateMcpSpec(root) {
    return {
        version: '1',
        model: root?.name || '',
        generatedAt: new Date().toISOString(),
        tools: this.generateToolSpecs()
    }
},

generateToolSpecs() {
    const tools = []

    if (!this.sourceMap) return tools

    for (const [node, profile] of this.sourceMap.entries()) {
        const handles = profile?.handles
        if (!handles || typeof handles.entries !== 'function') continue

        for (const [handlerName, meta] of handles.entries()) {
            if (!meta?.mcp) continue

            const binding = {
                node,
                pin: meta.pin || this.handlerToPin(handlerName),
                handler: meta.handler || handlerName
            }

            const source = {
                file: meta.file,
                line: meta.line
            }

            const config = typeof meta.mcp === 'object' ? meta.mcp : null
            const parameters = this.makeParameterSchema(config?.params, meta.params || [])
            const tool = {
                name: config?.name || meta.mcpName || binding.handler,
                description: config?.description || meta.mcpDescription || meta.summary || `Trigger ${binding.pin} on ${node}`,
                parameters,
                binding
            }

            if (source.file) tool.source = source
            if (meta.returns) tool.returns = meta.returns
            if (Array.isArray(config?.audience) && config.audience.length > 0) tool.audience = config.audience

            tools.push(tool)
        }
    }

    return tools
},

convertToOpenAITools(specOrTools) {
    const tools = Array.isArray(specOrTools)
        ? specOrTools
        : (Array.isArray(specOrTools?.tools) ? specOrTools.tools : [])

    return tools.map(tool => ({
        type: 'function',
        function: {
            name: String(tool.name || '').replace(/\s+/g, '_'),
            description: tool.description || '',
            parameters: this.normalizeParameterSchema(tool.parameters)
        }
    }))
},

handlerToPin(handlerName) {
    if (!handlerName || typeof handlerName !== 'string') return ''
    const clean = handlerName.replace(/^['"]|['"]$/g, '')
    if (!clean.startsWith('on')) return clean

    const raw = clean.slice(2)
    const words = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return ''

    const iface = words[0].toLowerCase()
    const suffix = words.slice(1).map(word => word.toLowerCase()).join('-')
    return suffix ? `${iface}.${suffix}` : iface
},

makeParameterSchema(configParams, inferredParams) {
    if (configParams && typeof configParams === 'object' && !Array.isArray(configParams)) {
        return this.makeSchemaFromConfig(configParams)
    }

    return this.makeSchemaFromInferredParams(inferredParams)
},

makeSchemaFromConfig(configParams) {
    const schema = {
        type: 'object',
        properties: {},
        required: []
    }

    for (const [name, descriptor] of Object.entries(configParams)) {
        const propSchema = this.makeConfigPropertySchema(descriptor)
        if (!propSchema) continue

        schema.properties[name] = propSchema
        if (descriptor?.required) {
            schema.required.push(name)
        }
    }

    return schema
},

makeConfigPropertySchema(descriptor) {
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
        const fallbackType = this.normalizeSchemaType(descriptor)
        return fallbackType ? {type: fallbackType} : null
    }

    const type = this.normalizeSchemaType(descriptor.type)
    const schema = {
        type: type || 'string'
    }

    if (descriptor.description) schema.description = descriptor.description
    if (Array.isArray(descriptor.enum) && descriptor.enum.length > 0) schema.enum = Array.from(new Set(descriptor.enum.map(value => String(value))))
    if (typeof descriptor.min === 'number') schema.minimum = descriptor.min
    if (typeof descriptor.max === 'number') schema.maximum = descriptor.max
    if (typeof descriptor.default !== 'undefined') schema.default = descriptor.default
    if (descriptor.unit) schema.unit = descriptor.unit

    if (schema.type === 'object' && descriptor.properties && typeof descriptor.properties === 'object') {
        const nested = this.makeSchemaFromConfig(descriptor.properties)
        schema.properties = nested.properties
        if (nested.required.length > 0) schema.required = nested.required
    }

    if (schema.type === 'array' && descriptor.items && typeof descriptor.items === 'object') {
        const itemSchema = this.makeConfigPropertySchema(descriptor.items)
        if (itemSchema) schema.items = itemSchema
    }

    return schema
},

makeSchemaFromInferredParams(params) {
    const schema = {
        type: 'object',
        properties: {},
        required: []
    }

    const paramMap = new Map()

    for (const param of params || []) {
        if (!param?.name || typeof param.name !== 'string') continue

        const normalizedType = this.normalizeSchemaType(param.type)
        const required = !param.optional

        if (param.name.startsWith('{') && param.name.endsWith('}')) {
            const raw = param.name.slice(1, -1).split(',').map(part => part.trim()).filter(Boolean)
            for (const sub of raw) {
                paramMap.set(sub, {
                    type: 'string',
                    description: ''
                })
                schema.required.push(sub)
            }
            continue
        }

        const nameParts = param.name.split('.')
        if (nameParts.length === 1) {
            if (!paramMap.has(param.name)) {
                paramMap.set(param.name, {
                    type: normalizedType || 'string',
                    description: param.description || ''
                })
            }
            if (required) schema.required.push(param.name)
            continue
        }

        const [parent, child] = nameParts
        let container = paramMap.get(parent)
        if (!container) {
            container = {
                type: 'object',
                properties: {},
                required: []
            }
            paramMap.set(parent, container)
        }

        container.properties[child] = {
            type: normalizedType || 'string',
            description: param.description || ''
        }
        if (required && !container.required.includes(child)) {
            container.required.push(child)
        }
        if (required) schema.required.push(parent)
    }

    for (const [name, propSchema] of paramMap.entries()) {
        schema.properties[name] = propSchema
    }

    schema.required = Array.from(new Set(schema.required))
    return schema
},

normalizeParameterSchema(schema) {
    if (schema?.type === 'object' && schema.properties && typeof schema.properties === 'object') {
        const properties = {}
        for (const [name, descriptor] of Object.entries(schema.properties)) {
            properties[name] = this.normalizePropertySchema(descriptor)
        }

        const normalized = {
            type: 'object',
            properties
        }

        if (Array.isArray(schema.required) && schema.required.length > 0) {
            normalized.required = Array.from(new Set(schema.required))
        }

        return normalized
    }

    return {type: 'object', properties: {}, required: []}
},

normalizePropertySchema(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') {
        return {type: 'string'}
    }

    const type = this.normalizeSchemaType(descriptor.type) || 'string'
    const normalized = {type}

    if (descriptor.description) normalized.description = descriptor.description
    if (Array.isArray(descriptor.enum) && descriptor.enum.length > 0) normalized.enum = Array.from(new Set(descriptor.enum.map(value => String(value))))
    if (typeof descriptor.minimum === 'number') normalized.minimum = descriptor.minimum
    if (typeof descriptor.maximum === 'number') normalized.maximum = descriptor.maximum
    if (typeof descriptor.default !== 'undefined') normalized.default = descriptor.default
    if (descriptor.unit) normalized.unit = descriptor.unit

    if (type === 'object' && descriptor.properties && typeof descriptor.properties === 'object') {
        normalized.properties = {}
        for (const [name, nested] of Object.entries(descriptor.properties)) {
            normalized.properties[name] = this.normalizePropertySchema(nested)
        }
        if (Array.isArray(descriptor.required) && descriptor.required.length > 0) {
            normalized.required = Array.from(new Set(descriptor.required))
        }
    }

    if (type === 'array' && descriptor.items) {
        normalized.items = this.normalizePropertySchema(descriptor.items)
    }

    return normalized
},

normalizeSchemaType(type) {
    if (!type || typeof type !== 'string') return null

    const lower = type.toLowerCase()
    if (PRIMITIVE_TYPES.has(lower)) return lower
    if (lower === 'int') return 'integer'
    if (lower === 'float') return 'number'
    if (lower.endsWith('[]')) return 'array'
    if (lower.includes('array')) return 'array'
    if (lower.includes('object')) return 'object'

    return null
}

}


