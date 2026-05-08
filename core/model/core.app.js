// ------------------------------------------------------------------
// Model: node-editor
// Path: C:/dev/vmblu/core/model/core.app.js
// Creation date 5/4/2026, 11:15:15 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "@vizualmodel/vmblu-runtime/rt-base"


//Imports
import { LibraryManager } from '../nodes/library-manager/library-manager.js'
import { DocumentManager } from '../nodes/document-manager/document-manager.js'
import { Clipboard } from '../nodes/clipboard/clipboard.js'
import { NodeSelectorFactory,
		 PathRequestFactory } from '../../ui-svelte/index.js'
import { ViewManager } from '../nodes/view-manager/view-manager.js'
import { ModelManager } from '../nodes/model-manager/model-manager.js'

//The runtime nodes
const nodeList = [
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "Kcps", 
	factory: LibraryManager,
	inputs: [
		"-> add file",
		"-> remove file",
		"-> switch library"
		],
	outputs: [
		"build table -> ()"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "avwn", 
	factory: DocumentManager,
	inputs: [
		"-> doc.selected",
		"-> doc.new",
		"-> doc.renamed",
		"-> doc.deleted",
		"-> doc.get",
		"-> doc.open",
		"-> file.save as",
		"-> tab.request to close",
		"-> tab.request to select"
		],
	outputs: [
		"doc.set active -> ()",
		"file.save -> ()",
		"file.save as filename -> ()",
		"file.save all -> ()",
		"tab.select -> ()",
		"tab.remove -> ()",
		"tab.new -> ()",
		"tab.rename -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "IoMS", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"-> set",
		"=> get"
		],
	outputs: [
		"switch -> ()",
		"remote => ()"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "SukQ", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> ()",
		"remove file -> remove file @ library manager (baUK)",
		"add file -> add file @ library manager (baUK)",
		"get path -> path @ path request (PDRO)",
		"modal div -> ()"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "baUK", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (SukQ)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "PDRO", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => ()",
		"modal div -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "rxby", 
	factory: ViewManager,
	inputs: [
		"-> size change",
		"-> top level view",
		"-> root",
		"-> recalibrate",
		"-> grid on-off",
		"-> redox.done"
		],
	outputs: [
		"canvas -> ()",
		"clipboard.get => ()",
		"clipboard.set -> ()",
		"name and path -> ()",
		"context menu -> ()",
		"node prompt -> ()",
		"runtime settings (dx) -> ()",
		"node settings (sx) -> ()",
		"open source file -> ()",
		"open model -> ()",
		"redox.doit -> ()",
		"redox.undo -> ()",
		"redox.redo -> ()"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "Ydvc", 
	factory: ModelManager,
	inputs: [
		"-> accept changes",
		"-> reload model",
		"-> sync links",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> model.set",
		"-> model.save",
		"-> save point.set",
		"-> save point.back",
		"-> redox.doit",
		"-> redox.undo",
		"-> redox.redo"
		],
	outputs: [
		"model.header -> ()",
		"model.root -> ()",
		"save point.confirm -> ()",
		"pin profile -> ()",
		"tool settings -> ()",
		"event settings -> ()",
		"get path -> ()",
		"redox.done -> ()",
		"open source file -> ()",
		"open model -> ()"
		]
	},
]

const agentRuntimeOptions = {}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, [], agentRuntimeOptions)

// and start the app
runtime.start()
