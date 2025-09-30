export class McpClientOpenAI {

	constructor(tx, sx) {

		// save the transport 
		this.tx = tx

        // the id counter
        this._id = 1

		// Get the open ai key from local storage
 		this.apiKey = localStorage.getItem('openai_key') || '';

		// Where we keep the chat history...
		this.chat =  [] // createChatStore()

		// The tools that are available
		this.tools = [];

        // get the manifest from the server
        this.tx.request('get manifest', this.assemble('getManifest')).then( (reply) => {

            // Get the available tools from the server
            this.tx.request('get tools', this.assemble('getTools')).then( (reply) => {

				// The tools are in a generic mcp format - change to the openAI format
				this.tools = this.convertToOpenAITools(reply.result)

				// debug
				console.log('received tools', this.tools)
            })
        })
	}

    // assemble a syntactically correct message packet
    assemble(method, params={}) {
        return {
				jsonrpc: '2.0',
				id: this._id++,
				method,
				params
			}
    }

    // a function to remove or set the api key from local storage
	// ** NEVER SAVE YOUR KEY IN THE CODE **
	async onHandleKey() {
		if (this.apiKey) {
			if (confirm("Are you sure you want to remove your API key?")) {
				this.apiKey = null;
				localStorage.removeItem('openai_key');
			}
		} else {
			const newKey = prompt("Enter your OpenAI API key:");
			if (newKey && newKey.startsWith("sk-")) {
				const isValid = await this.validateApiKey(newKey);
				if (isValid) {
					this.apiKey = newKey;
					localStorage.setItem('openai_key', this.apiKey);
					alert("API key saved. It stays in your browser and is only sent to OpenAI.");
				} else {
					alert("That key appears to be invalid or expired.");
				}
			} else {
				alert("Invalid API key format.");
			}
		}
	}

	async validateApiKey(key) {
		const testMessage = {
			model: "gpt-4-turbo",
			messages: [{ role: "user", content: "Hello" }],
			max_tokens: 1
		};

		try {
			const res = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${key}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify(testMessage)
			});

			return res.ok;
		} catch (e) {
			console.warn("API key test failed:", e);
			return false;
		}
	}

	reset() {
		this.chat.reset()
	}

	// a test function - gets the available open ai models
	getModels() {
		fetch("https://api.openai.com/v1/models", {
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
			}
		})
		.then(res => res.json())
		.then(data => console.log(data.data.map(m => m.id)))
	}

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

      // Validate primitive type
      const primitiveTypes = ['string', 'number', 'boolean', 'object', 'array', 'integer'];
      if (!primitiveTypes.includes(type)) {
        console.warn(`Skipping param '${name}' due to invalid type '${type}'`);
        continue;
      }

      const propSchema = { type, description: description || '' };

      if (type === 'object' && Array.isArray(properties)) {
        propSchema.properties = {};
        propSchema.required = required ?? [];

        for (const sub of properties) {
          // Also validate nested types
          if (!primitiveTypes.includes(sub.type)) {
            console.warn(`Skipping nested param '${sub.name}' in '${name}' due to invalid type '${sub.type}'`);
            continue;
          }
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
        name: tool.name.replace(/\s+/g, '_'), // Avoid illegal characters
        description: tool.description || '',
        parameters: schema
      }
    };
  });
}


	//async newUserPrompt(prompt) {
	async onNewPrompt(prompt) {

        // add the prompt to the chat history
        this.chat.push({ role: 'user', content: prompt });

		// update
		this.tx.send('update chat', this.chat)

const body = JSON.stringify({
				model: 'gpt-4o',
				messages: this.chat,
				tools: this.tools,
				tool_choice: 'auto'
			})
console.log(body)

		// send the chat history to the LLM
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'gpt-4o',
				messages: this.chat,
				tools: this.tools,
				tool_choice: 'auto'
			})
		});

		// check the response
		if (!response.ok) {
			this.chat.push({ role: 'assistant', content: response.statusText });
			this.tx.send('update chat', this.chat)
			return
		}

		// get the json
		const result = await response.json();
		const message = result.choices?.[0]?.message || { role: 'assistant', content: 'No response' };

		// check if tools need to be called 
		if (message.tool_calls?.length) {

			// Handle the tool calls
			this._handleToolCalls(message.tool_calls);
		} else {

			// just add the message to the chat
			//this.chat.push(message);
			this.chat.push({role: 'assistant', content: message.content});
			this.tx.send('update chat', this.chat)
		}
	}

	async _handleToolCalls(toolCalls) {

		// add the tool calls to the chat history
		this.chat.push({
			role: "assistant",
			content: null,
			tool_calls: toolCalls
		})

		for (const toolCall of toolCalls) {

			// make an object from the json 
			const args = JSON.parse(toolCall.function.arguments);

			// send a request to call the tool to the server
            this.tx.send('call tool', this.assemble(toolCall.function.name, args))

			// and also a result
			this.chat.push({
				role: 'tool',
				tool_call_id: toolCall.id,
				content: `the tool call was successful !`
			})

			// show the result
			this.tx.send('update chat', this.chat)
		}
	}

	// The server returns a tool result message
	onToolResult(result) {

		// add the result to the chat
		this.chat.push({
			role: 'tool',
			tool_call_id: toolCall.id,
			content: `the tool call was successful !`
		})

		// and confirm the result
		this.confirmResult()
	}

	async confirmResult() {

console.log("Sending messages:", JSON.stringify(this.chat, null, 2));

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'gpt-4o',
				messages: this.chat
			})
		});

		const result = await response.json();
		const message = result.choices?.[0]?.message || { role: 'assistant', content: 'No response' };
		this.chat.push(message);
	}
}