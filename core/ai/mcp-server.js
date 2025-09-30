//import { Server } from '@modelcontextprotocol/sdk/server';
import { Server } from '@modelcontextprotocol/sdk/dist/esm/server/index.js';


export class McpServer {

	constructor(tx, sx) {

		this.tx = tx

		this.callback = null

		this.server = new Server({
			manifest: {
				name: "My Application MCP Server",
				version: "1.0.0"
			},
			tools: this._getNodeToolSpecs(),
			call: this._handleCall.bind(this)
		});

		this.server.serve(this)
	}

	// The two functions used by the model server 
	send(data) {

		// just send the data to the client
		this.tx.send('server send', data)
	}

	onReceive(callback) {
		this.callback = callback
	}

	// The only handler for this node
	onServerReceive(content) {

		// just call the callback
		this.callback?.(content)
	}

	_getNodeToolSpecs() {
		// Example: declare MCP tools for your application nodes
		return [
			{
				type: "function",
				name: "camera.place",
				description: "Places a camera on a celestial body",
				parameters: {
					type: "object",
					properties: {
						location: { type: "string" },
						target: { type: "string" }
					},
					required: ["location"]
				}
			},
			{
				type: "function",
				name: "planet.set_time",
				description: "Sets the simulation time for a given planet",
				parameters: {
					type: "object",
					properties: {
						planet: { type: "string" },
						time: { type: "string" }
					},
					required: ["planet", "time"]
				}
			}
		];
	}

	async _handleCall({ method, params }) {
		// Route tool calls to your app’s messaging runtime
		// Example: "camera.place" → send a message to the camera node
		const [nodeName, action] = method.split('.');

		console.log('HANDLE CALL',nodeName, action, params )

		// return await this.runtime.send({
		// 	to: nodeName,
		// 	msg: action,
		// 	data: params
		// });
	}
}

// export class MyRuntimeTransport {
// 	constructor(runtime) {
// 		this.runtime = runtime;
// 		this._onReceive = () => {};
// 		this.runtime.on('mcp.client', (msg) => {
// 			this._onReceive(msg);
// 		});
// 	}

// 	send(message) {
// 		this.runtime.send('mcp.server', message);
// 	}

// 	onReceive(fn) {
// 		this._onReceive = fn;
// 	}
// }

/* Usage
const server = new McpServerApp(myRuntime);
const transport = new MyRuntimeTransport(myRuntime);

server.serve(transport);
*/
