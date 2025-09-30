import { Client } from '@modelcontextprotocol/sdk/client';
import LLMInterface from "./llm-interface.svelte"

export class McpClientOpenAI {

	constructor(tx, sx) {

		// save the transport 
		this.tx = tx

		// Get the open ai key from local storage
 		this.apiKey = localStorage.getItem('openai_key') ?? null;

		// Create an MCP client
		this.client = new Client({ name: 'openai-mcp' });

		// get a div
		const div = document.createElement('div');

		// create the text interface 
		const mcpClient = new LLMInterface({	target: div,
												props: {
													client: this
												}
											})

		// send the div out
		tx.send('div',div)

		// the callback upon receiving something from the server
		this.callback = null

		// Where we keep the chat history...
		this.chat = [];

		// The tools that are available
		this.tools = [];
	}

	// The transport mechanism used by the client
	send(content) {

		// send the message
		tx.send("client send", content)
	}

	// The mcp client hands us a callback function to be called when we receive a message from the mcp server
	onReceive(callback) {

		// save the callback
		mcpCallback = callback
	}

	// The handler for the only input message for this node
	onClientReceive(content) {

		// just call the callback
		this.callback?.(content)
	}

    // a function to remove or set the api key from local storage
    toggleKey() {
        if (this.apiKey) {
            if (confirm("Are you sure you want to remove your API key?")) {
                this.apiKey = null;
                localStorage.removeItem('openai_key');
            }
        } else {
            const newKey = prompt("Enter your OpenAI API key:");
            if (newKey && newKey.startsWith("sk-")) {
                this.apiKey = newKey;
                localStorage.setItem('openai_key', this.apiKey);
                alert("API key saved. It stays in your browser and is only sent to OpenAI.");
            } else {
                alert("Invalid API key.");
            }
        }
    }

	async start() {
		if (!this.apiKey) throw new Error("Missing API key");
		await this.client.connect(this.transport);
		this.tools = await this.getTools(); // now local method
	}

	reset() {
		this.chat = [];
	}

	async getTools() {
		return await this.client.getTools();
	}

	async call({ method, params }) {
		return await this.client.call({ method, params });
	}

	async newUserPrompt(prompt) {

        // add the prompt to the chat history
        this.addUserMessage({ role: 'user', content: prompt });

        // ask GPT for a response
        await this.ask()
	}

	async ask() {

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'gpt-4-turbo',
				messages: this.chat,
				tools: this.tools,
				tool_choice: 'auto'
			})
		});

		// check the response
		if (!response.ok) {
			this.chat.push({ role: 'assistant', content: response.statusText });
			return
		}

		// get the json
		const result = await response.json();
		const message = result.choices?.[0]?.message || { role: 'assistant', content: 'No response' };

		// check if tools need to be called 
		if (message.tool_calls?.length) {

			// Handle the tool calls
			await this._handleToolCalls(message.tool_calls);

			// confirm the results to the llm
			this.confirmResult();
		} else {

			// just add the message to the chat
			this.chat.push(message);
		}
	}

	async _handleToolCalls(toolCalls) {

		for (const call of toolCalls) {

			const args = JSON.parse(call.function.arguments);
			let result;

			try {
				result = await this.call({
					method: call.function.name,
					params: args
				});
			} catch (e) {
				result = { error: e.message };
			}

			this.chat.push({
				role: 'tool',
				tool_call_id: call.id,
				content: JSON.stringify(result)
			});
		}
	}

	async confirmResult() {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'gpt-4-turbo',
				messages: this.chat
			})
		});

		const result = await response.json();
		const message = result.choices?.[0]?.message || { role: 'assistant', content: 'No response' };
		this.chat.push(message);
	}
}
