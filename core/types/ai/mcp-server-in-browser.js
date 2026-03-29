
// // The tool specifications example
// const ToolSpecs = [
//         {
//             type: 'function',
//             function: {
//                 name: 'place_camera',
//                 description: 'Define a camera and place it on a planet at the given coordinates.',
//                 parameters: {
//                     type: 'object',
//                     properties: {
//                         camera: { 
//                             type: 'object',
//                             properties: {
//                                 name: { type: 'string', description: 'The name of the camera. Give a meaningful name.' },
//                                 type: { type: 'string', description: 'The type of camera (e.g., perspective, orthographic).' },
//                                 fov: { type: 'number', description: 'The field of view in degrees.' },
//                                 aspect: { type: 'string', description: 'The aspect ratio (e.g., canvas, 4:3, 16:9).' },
//                                 zoom: { type: 'number', description: 'The zoom factor for the camera. Default is 1' },
//                                 far: { type: 'number', description: 'The far clipping plane. Set it at 10AU unless specifically specified' },
//                                 near: { type: 'number', description: 'The near clipping plane. Set it at 0.000001 AU, unless specifically specified.' }
//                             }
//                         },
//                         planet: { type: 'string', description: 'The planet where the camera is placed (e.g., mars).' },
//                         coordinates: { type: 'string', description: 'The coordinates on the planet as a string: 50°53\'10.7"N 3°45\'57.9"E ' },
//                     },
//                     required: ['camera', 'planet', 'coordinates'],
//                 }
//             }
//         }
//     ];

// An MCP server for a VMBlue application
export class McpServerInBrowser {
    
	constructor(tx, sx) {

		// save the transmitter
		this.tx = tx;

		// save the settings
		this.sx = sx

		// set the tools 
		this.tools = ToolSpecs; // array of MCP-compatible tool definitions
	}

	// reply to the get manifest request
	onGetManifest(msg) {

		this.tx.reply({
			jsonrpc: 2.0,
			id: msg.id,
			result: {
				name: 'In-Browser MCP Server',
				version: '1.0.0',
				description: 'Exposes browser node services via MCP'
			}
		})
	}

	// reply to the tools request
	onGetTools(msg) {

		this.tx.reply({
			jsonrpc: 2.0,
			id: msg.id,
			result: this.tools
		})		
	}

	onCallTool(msg) {

		// debugging...
		console.log('call tool', msg.method, msg.params)

		// do the actual tool call here

		// return a result
		this.tx.send('tool result', { 

		})
	}
}
