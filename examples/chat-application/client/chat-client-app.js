// ------------------------------------------------------------------
// Model: ChatClient
// Path: ../client/chat-client-app.js
// Creation date 9/17/2025, 10:59:32 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from '@vizualmodel/vmblu'

//Imports
import { createChatPage } from './src/lib/nodes/chat-page.js'
import { createMessageComposer } from './src/lib/nodes/message-composer.js'
import { createMessageList } from './src/lib/nodes/message-list.js'
import { createMessageStore } from './src/lib/nodes/message-store.js'
import { createServerSync } from './src/lib/nodes/server-sync.js'

//The runtime nodes
const nodeList = [
	//____________________________________________________CHATPAGE
	{
	name: "ChatPage", 
	uid: "vhJx", 
	factory: createChatPage,
	inputs: [
		"-> ComposerDiv",
		"-> ListDiv"
		],
	outputs: []
	},
	//_____________________________________________MESSAGECOMPOSER
	{
	name: "MessageComposer", 
	uid: "ULco", 
	factory: createMessageComposer,
	inputs: [],
	outputs: [
		`submitMessage -> [ 
			"saveMessage @ MessageStore (ZjZm)",
			"publishMessage @ ServerSync (kJwA)" ]`,
		"div -> ComposerDiv @ ChatPage (vhJx)"
		]
	},
	//_________________________________________________MESSAGELIST
	{
	name: "MessageList", 
	uid: "VVMn", 
	factory: createMessageList,
	inputs: [
		"-> showMessages"
		],
	outputs: [
		"div -> ListDiv @ ChatPage (vhJx)"
		]
	},
	//________________________________________________MESSAGESTORE
	{
	name: "MessageStore", 
	uid: "ZjZm", 
	factory: createMessageStore,
	inputs: [
		"-> saveMessage",
		"-> hydrate"
		],
	outputs: [
		"messagesChanged -> showMessages @ MessageList (VVMn)",
		"loadHistory => historyLoaded @ ServerSync (kJwA)"
		]
	},
	//__________________________________________________SERVERSYNC
	{
	name: "ServerSync", 
	uid: "kJwA", 
	factory: createServerSync,
	inputs: [
		"-> publishMessage",
		"=> historyLoaded"
		],
	outputs: [
		"incomingMessage -> saveMessage @ MessageStore (ZjZm)",
		"historySnapshot -> hydrate @ MessageStore (ZjZm)"
		]
	},
]

//The filters
const filterList = [
]

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList)

// and start the app
runtime.start()
