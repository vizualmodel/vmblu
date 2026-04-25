export class McpClientOpenAI {

	constructor(tx, sx) {

		this.tx = tx;
		this.sx = sx ?? {};
		this._id = 1;
		this.chat = [];
		this.tools = [];
		this.mcpTools = [];
		this.model = this.sx.model || 'gpt-4o';
		this.bridgeBaseUrl = this.normalizeBridgeBaseUrl(this.sx.bridgeBaseUrl || 'http://127.0.0.1:8080/v1');
		this.bridgeHealthUrl = this.getBridgeHealthUrl(this.bridgeBaseUrl);
		this.connection = this.createStatus('checking', `Checking local bridge at ${this.bridgeBaseUrl}`);

		this.pushStatus();
		this.initialize();
	}

	async initialize() {
		await this.refreshBridgeStatus();
		await this.loadTools();
	}

	assemble(method, params = {}) {
		return {
			jsonrpc: '2.0',
			id: this._id++,
			method,
			params
		};
	}

	createStatus(state, reason, extra = {}) {
		return {
			state,
			ready: state === 'connected',
			reason,
			baseUrl: this.bridgeBaseUrl,
			healthUrl: this.bridgeHealthUrl,
			...extra
		};
	}

	normalizeBridgeBaseUrl(url) {
		return String(url || 'http://127.0.0.1:8080/v1').replace(/\/+$/, '');
	}

	getBridgeHealthUrl(baseUrl) {
		return `${baseUrl.replace(/\/v1$/, '')}/health`;
	}

	pushStatus() {
		this.tx.send('update status', this.connection);
	}

	pushTools() {
		this.tx.send('update tools', this.mcpTools);
	}

	async refreshBridgeStatus() {
		this.connection = this.createStatus('checking', `Checking local bridge at ${this.bridgeBaseUrl}`);
		this.pushStatus();

		try {
			const response = await fetch(this.bridgeHealthUrl, {
				method: 'GET',
				headers: {
					Accept: 'application/json'
				}
			});

			let payload = {};
			try {
				payload = await response.json();
			} catch (_error) {
				payload = {};
			}

			if (!response.ok) {
				this.connection = this.createStatus(
					'error',
					payload.reason || `Bridge health check failed with HTTP ${response.status}.`,
					payload
				);
				this.pushStatus();
				return this.connection;
			}

			if (payload.apiKeyConfigured) {
				this.connection = this.createStatus(
					'connected',
					payload.reason || 'Connected to the local LLM bridge.',
					payload
				);
			} else {
				this.connection = this.createStatus(
					'no-key',
					payload.reason || 'The local bridge is running but OPENAI_API_KEY is not configured.',
					payload
				);
			}
		} catch (_error) {
			this.connection = this.createStatus(
				'no-bridge',
				`No local LLM bridge is reachable at ${this.bridgeBaseUrl}. Start it with "npm run llm-bridge".`
			);
		}

		this.pushStatus();
		return this.connection;
	}

	async loadTools() {
		try {
			await this.tx.request('get manifest', this.assemble('getManifest'));
			const reply = await this.tx.request('get tools', this.assemble('getTools'));
			this.mcpTools = Array.isArray(reply?.result) ? reply.result : [];
			this.tools = this.convertToOpenAITools(this.mcpTools);
			this.pushTools();
		} catch (error) {
			console.warn('Unable to load MCP tools:', error);
			this.mcpTools = [];
			this.tools = [];
			this.pushTools();
		}
	}

	async onHandleKey() {
		const status = await this.refreshBridgeStatus();
		if (!status.ready) {
			alert(status.reason);
		}
	}

	reset() {
		this.chat = [];
		this.tx.send('update chat', this.chat);
	}

	getModels() {
		return fetch(`${this.bridgeBaseUrl}/models`)
			.then((res) => res.json())
			.then((data) => console.log(data.data?.map((m) => m.id) || []));
	}

	convertToOpenAITools(specOrTools) {
		const tools = Array.isArray(specOrTools)
			? specOrTools
			: (Array.isArray(specOrTools?.tools) ? specOrTools.tools : []);

		return tools.map((tool) => {
			if (tool?.parameters?.type === 'object' && tool.parameters.properties) {
				return {
					type: 'function',
					function: {
						name: String(tool.name || '').replace(/\s+/g, '_'),
						description: tool.description || '',
						parameters: tool.parameters
					}
				};
			}

			const schema = {
				type: 'object',
				properties: {},
				required: []
			};

			for (const param of tool.parameters || []) {
				const { name, type, description, properties, required } = param;
				if (!name || !type) continue;

				const primitiveTypes = ['string', 'number', 'boolean', 'object', 'array', 'integer'];
				if (!primitiveTypes.includes(type)) {
					console.warn(`Skipping param "${name}" due to invalid type "${type}"`);
					continue;
				}

				const propSchema = { type, description: description || '' };

				if (type === 'object' && Array.isArray(properties)) {
					propSchema.properties = {};
					propSchema.required = required ?? [];

					for (const sub of properties) {
						if (!primitiveTypes.includes(sub.type)) {
							console.warn(`Skipping nested param "${sub.name}" in "${name}" due to invalid type "${sub.type}"`);
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
					name: String(tool.name || '').replace(/\s+/g, '_'),
					description: tool.description || '',
					parameters: schema
				}
			};
		});
	}

	async ensureBridgeReady() {
		const status = await this.refreshBridgeStatus();
		if (status.ready) return true;

		this.chat.push({ role: 'assistant', content: status.reason });
		this.tx.send('update chat', this.chat);
		return false;
	}

	async onNewPrompt(prompt) {
		this.chat.push({ role: 'user', content: prompt });
		this.tx.send('update chat', this.chat);

		if (!(await this.ensureBridgeReady())) {
			return;
		}

		try {
			const response = await fetch(`${this.bridgeBaseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: this.model,
					messages: this.chat,
					tools: this.tools,
					tool_choice: 'auto'
				})
			});

			if (!response.ok) {
				const detail = await this.readErrorDetail(response);
				this.chat.push({ role: 'assistant', content: detail });
				this.tx.send('update chat', this.chat);
				await this.refreshBridgeStatus();
				return;
			}

			const result = await response.json();
			const message = result.choices?.[0]?.message || { role: 'assistant', content: 'No response' };

			if (message.tool_calls?.length) {
				this._handleToolCalls(message.tool_calls);
				return;
			}

			this.chat.push({ role: 'assistant', content: message.content });
			this.tx.send('update chat', this.chat);
		} catch (error) {
			this.chat.push({
				role: 'assistant',
				content: `Bridge request failed: ${error.message}`
			});
			this.tx.send('update chat', this.chat);
			await this.refreshBridgeStatus();
		}
	}

	async readErrorDetail(response) {
		try {
			const payload = await response.json();
			return payload.detail || payload.error?.message || payload.error || response.statusText;
		} catch (_error) {
			return response.statusText || `HTTP ${response.status}`;
		}
	}

	async _handleToolCalls(toolCalls) {
		this.chat.push({
			role: 'assistant',
			content: null,
			tool_calls: toolCalls
		});

		for (const toolCall of toolCalls) {
			const args = JSON.parse(toolCall.function.arguments);
			this.tx.send('call tool', this.assemble(toolCall.function.name, args));
			this.chat.push({
				role: 'tool',
				tool_call_id: toolCall.id,
				content: 'The tool call was sent to the MCP server.'
			});
			this.tx.send('update chat', this.chat);
		}
	}

	onToolResult(result) {
		this.chat.push({
			role: 'tool',
			content: result?.content || 'Tool result received.'
		});
		this.tx.send('update chat', this.chat);
	}
}
