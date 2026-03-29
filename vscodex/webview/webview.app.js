// ------------------------------------------------------------------
// Model: 
// Path: /vscodex/webview/webview.app.js
// Creation date 3/27/2026, 10:56:44 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../../runtime/src/scaffold.js"


//Imports
import { MessageBroker } from './message-broker.js'
import { ViewManager } from '../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../core/nodes/clipboard/clipboard.js'
import { PathRequestFactory,
		 JsonInputFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 TextBlockFactory,
		 DocumentSettingsFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 ConfirmBox,
		 VscodeSideMenuFactory } from '../../ui-svelte/index.js'

//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "dnEn", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> open js file",
		"-> canvas",
		"-> floating menu",
		"-> modal div",
		"=> clipboard.remote",
		"-> clipboard.switch"
		],
	outputs: [
		`set document -> [ 
			"top level view @ view manager (pJwL)",
			"model.set @ model manager (geCz)" ]`,
		"get document -> ()",
		"reload model -> ()",
		"sync links -> sync links @ model manager (geCz)",
		"canvas resize -> size change @ view manager (pJwL)",
		"clipboard.local => local @ clipboard (PbnE)",
		"clipboard.switched -> switched @ clipboard (PbnE)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "pJwL", 
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> recalibrate",
		"-> top level view",
		"-> grid on-off",
		"-> size change"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (geCz)",
		"redox.undo -> redox.undo @ model manager (geCz)",
		"redox.redo -> redox.redo @ model manager (geCz)",
		"canvas -> canvas @ message broker (dnEn)",
		"node settings (sx) -> json @ node settings (cGCm)",
		"runtime settings (dx) -> show @ runtime settings (glFX)",
		"node prompt -> text @ text block (wKUF)",
		"context menu -> context menu @ context menu (lIYM)",
		"name and path -> name and path @ name and path (vbLi)",
		"open model -> open document @ message broker (dnEn)",
		"open source file -> open js file @ message broker (dnEn)",
		"clipboard.get => get @ clipboard (PbnE)",
		"clipboard.set -> set @ clipboard (PbnE)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "geCz", 
	factory: ModelManager,
	inputs: [
		"-> sync links",
		"-> accept changes",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> reload model",
		"-> save point.set",
		"-> save point.back",
		"-> model.save",
		"-> model.set",
		"-> redox.doit",
		"-> redox.undo",
		"-> redox.redo"
		],
	outputs: [
		"save point.confirm -> show @ confirm box (ZeXe)",
		"open source file -> open js file @ message broker (dnEn)",
		"open model -> ()",
		"model.root -> root @ view manager (pJwL)",
		"model.header -> show @ doc settings (pUUK)",
		`redox.done -> [ 
			"redox.done @ view manager (pJwL)",
			"new edit @ message broker (dnEn)" ]`,
		"pin profile -> show @ pin profile (YNfS)",
		"get path -> path @ path request (XLbp)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "PbnE", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (dnEn)",
		"switch -> clipboard.switch @ message broker (dnEn)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "XLbp", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "cGCm", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "vbLi", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "YNfS", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "wKUF", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "pUUK", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "lIYM", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "glFX", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "ZeXe", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dnEn)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "FFfM", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (dnEn)",
		"sync -> sync links @ model manager (geCz)",
		"accept changes -> accept changes @ model manager (geCz)",
		"show settings -> show settings @ model manager (geCz)",
		"make app -> make app @ model manager (geCz)",
		"make lib -> make lib @ model manager (geCz)",
		"set save point -> save point.set @ model manager (geCz)",
		"back to save point -> save point.back @ model manager (geCz)",
		"recalibrate -> recalibrate @ view manager (pJwL)",
		"grid on-off -> grid on-off @ view manager (pJwL)"
		],
	sx:	[
		    {
		        "icon": "flare",
		        "color": "#0fb2e4",
		        "message": "recalibrate",
		        "help": "Recalibrate"
		    },
		    {
		        "icon": "grid_view",
		        "color": "#0fb2e4",
		        "message": "grid on-off",
		        "help": "Grid on/off"
		    },
		    {
		        "icon": "check_box",
		        "color": "#0fb2e4",
		        "message": "accept changes",
		        "help": "Accept changes"
		    },
		    {
		        "icon": "bolt",
		        "color": "#0fb2e4",
		        "message": "sync",
		        "help": "sync model"
		    },
		    {
		        "icon": "push_pin",
		        "color": "#0fb2e4",
		        "message": "set save point",
		        "help": "set save point"
		    },
		    {
		        "icon": "reply",
		        "color": "#0fb2e4",
		        "message": "back to save point",
		        "help": "back to save point"
		    },
		    {
		        "icon": "build",
		        "color": "#0fb2e4",
		        "message": "make lib",
		        "help": "Make lib"
		    },
		    {
		        "icon": "handyman",
		        "color": "#0fb2e4",
		        "message": "make app",
		        "help": "Make app"
		    },
		    {
		        "icon": "settings",
		        "color": "#0fb2e4",
		        "message": "show settings",
		        "help": "Settings"
		    }
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
