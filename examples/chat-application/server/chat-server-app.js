// ------------------------------------------------------------------
// Model: ChatServer
// Path: ../server/chat-server-app.js
// Creation date 9/18/2025, 4:56:32 PM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from '@vizualmodel/vmblu'

//Imports
import { createHttpGateway } from './src/nodes/http-gateway.js'
import { createMessageBroker } from './src/nodes/message-broker.js'
import { createPersistence } from './src/nodes/persistence.js'

//The runtime nodes
const nodeList = [
	//_________________________________________________HTTPGATEWAY
	{
	name: "HttpGateway", 
	uid: "btWz", 
	factory: createHttpGateway,
	inputs: [
		"-> broadcast"
		],
	outputs: [
		"newMessage -> acceptMessage @ MessageBroker (kJUI)",
		"historyRequest => historyQuery @ Persistence (XeiG)"
		]
	},
	//_______________________________________________MESSAGEBROKER
	{
	name: "MessageBroker", 
	uid: "kJUI", 
	factory: createMessageBroker,
	inputs: [
		"-> acceptMessage"
		],
	outputs: [
		`fanOut -> [ 
			"broadcast @ HttpGateway (btWz)",
			"store @ Persistence (XeiG)" ]`
		]
	},
	//_________________________________________________PERSISTENCE
	{
	name: "Persistence", 
	uid: "XeiG", 
	factory: createPersistence,
	inputs: [
		"-> store",
		"=> historyQuery"
		],
	outputs: []
	},
]

//The filters
const filterList = [
]

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList)

// and start the app
runtime.start()
