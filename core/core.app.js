// ------------------------------------------------------------------
// Model: node-editor
// Path: C:/dev/new-vmblu/core/core.app.js
// Creation date 3/13/2026, 10:58:46 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "./runtime.js"


//Imports
import { LibraryManager } from './nodes/library-manager/library-manager.js'
import { DocumentManager } from './nodes/document-manager/document-manager.js'
import { Clipboard } from './nodes/clipboard/clipboard.js'
import { NodeSelectorFactory,
		 PathRequestFactory } from '../ui-svelte/index.js'
import { ViewManager } from './nodes/view-manager/view-manager.js'
import { ModelManager } from './nodes/model-manager/model-manager.js'

//The runtime nodes
const nodeList = [
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "TxKB", 
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
	uid: "Khrc", 
	factory: DocumentManager,
	inputs: [
		"-> doc selected",
		"-> doc new",
		"-> doc renamed",
		"-> doc deleted",
		"-> doc get",
		"-> doc open",
		"-> save",
		"-> save as",
		"-> save all",
		"-> tab request to close",
		"-> tab request to select"
		],
	outputs: [
		"doc set active -> ()",
		"save as filename -> ()",
		"tab select -> ()",
		"tab remove -> ()",
		"tab new -> ()",
		"tab rename -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "RqOl", 
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
	uid: "MAbv", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> ()",
		"remove file -> remove file @ library manager (NgKg)",
		"add file -> add file @ library manager (NgKg)",
		"get path -> path @ path request (Antk)",
		"modal div -> ()"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "NgKg", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (MAbv)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "Antk", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "BiNc", 
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
	uid: "nkzH", 
	factory: ModelManager,
	inputs: [
		"-> accept changes",
		"-> reload model",
		"-> sync links",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> model.set",
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
		"get path -> ()",
		"redox.done -> ()",
		"open source file -> ()",
		"open model -> ()"
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
