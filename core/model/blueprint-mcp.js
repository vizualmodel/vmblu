import {Path} from '../arl/index.js'
import {convert} from '../util/index.js'
export const McpHandling = {

makeMcpToolString(root) {

    // first get the tools
    const mcpTools = this.generateToolSpecs();

    // check
    if (mcpTools.length == 0) return null

    // make a header
    const today = new Date()
    const sHeader =    '// ------------------------------------------------------------------'
                    +`\n// MCP tool file for model: ${root.name}`
                    +`\n// Creation date ${today.toLocaleString()}`
                    +'\n// ------------------------------------------------------------------\n'
                    +'\nexport const mcpTools = '

    // stringify the tools array to a js literal
    const sMcpTools = convert.objectToJsLiteral(mcpTools)

    // append
    return sHeader + sMcpTools
},

/**
 * Generate MCP-compatible tool specs in an LLM-neutral format.
 * Only handlers with `mcp: true` will be included.
 *
 * @param {Map<string, Map<string, object>>} nodeMap - Output from parseSourceMap
 * @returns {Array<object>} - Abstract tool specs
 */
generateToolSpecs() {
  const tools = [];

  // check
  if (!this.sourceMap) return [];

  for (const [node, pins] of this.sourceMap.entries()) {
    for (const [pin, meta] of pins.entries()) {
      if (!meta.mcp) continue;

      const paramMap = new Map();

      for (const param of meta.params || []) {
        if (!param.name || typeof param.name !== 'string') continue;

        // handle nested destructured names that were not flattened properly
        if (param.name.startsWith('{') && param.name.endsWith('}')) {
          const raw = param.name.slice(1, -1).split(',').map(p => p.trim());
          for (const sub of raw) {
            paramMap.set(sub, {
              name: sub,
              type: 'string', // fallback type if not known
              description: ''
            });
          }
          continue;
        }

        const nameParts = param.name.split('.');
        if (nameParts.length === 1) {
          // top-level parameter
          if (!paramMap.has(param.name)) paramMap.set(param.name, { ...param });
        } else {
          const [parent, child] = nameParts;
          let container = paramMap.get(parent);
          if (!container) {
            container = {
              name: parent,
              type: 'object',
              description: '',
              properties: [],
              required: []
            };
            paramMap.set(parent, container);
          }
          container.properties.push({
            name: child,
            type: param.type,
            description: param.description || ''
          });
          if (!container.required.includes(child)) {
            container.required.push(child);
          }
        }
      }

      const tool = {
        name: meta.mcpName || `${pin} @ ${node}`,
        description: meta.mcpDescription || meta.summary || `Trigger ${pin} on ${node}`,
        parameters: Array.from(paramMap.values()),
        returns: meta.returns || '',
        node,
        pin,
        handler: meta.handler,
        file: meta.file,
        line: meta.line
      };

      tools.push(tool);
    }
  }

  return tools;
},

/**
 * Convert an abstract MCP toolspec to OpenAI-compatible format.
 *
 * @param {Array<object>} tools - Output from generateToolSpecs()
 * @returns {Array<object>} - OpenAI tool spec array
 */
convertToOpenAITools(tools) {
  return tools.map(tool => {
    const schema = {
      type: 'object',
      properties: {},
      required: []
    };

    for (const param of tool.parameters) {
      const { name, type, description, properties, required } = param;

      if (!name || !type) continue;

      const propSchema = { type, description: description || '' };

      if (type === 'object' && properties) {
        propSchema.properties = {};
        propSchema.required = required || [];

        for (const sub of properties) {
          propSchema.properties[sub.name] = {
            type: sub.type,
            description: sub.description || ''
          };
        }
      }

      schema.properties[name] = propSchema;
      schema.required.push(name);
    }

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: schema
      }
    };
  });
}





}