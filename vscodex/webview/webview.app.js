// ------------------------------------------------------------------
// Model: 
// Path: C:/dev/vmblu/vscodex/webview/webview.app.js
// Creation date 5/4/2026, 10:50:24 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../../runtime/rt-base/scaffold.js"


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
	uid: "uchO", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> open js file",
		"=> folder.get",
		"-> canvas",
		"-> floating menu",
		"-> modal div",
		"=> clipboard.remote",
		"-> clipboard.switch"
		],
	outputs: [
		`set document -> [ 
			"top level view @ view manager (kXmY)",
			"model.set @ model manager (DKNK)" ]`,
		"get document -> ()",
		"reload model -> ()",
		"model.save -> model.save @ model manager (DKNK)",
		"sync links -> sync links @ model manager (DKNK)",
		"canvas resize -> size change @ view manager (kXmY)",
		"clipboard.local => local @ clipboard (Yjry)",
		"clipboard.switched -> switched @ clipboard (Yjry)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "kXmY", 
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
		"redox.doit -> redox.doit @ model manager (DKNK)",
		"redox.undo -> redox.undo @ model manager (DKNK)",
		"redox.redo -> redox.redo @ model manager (DKNK)",
		"canvas -> canvas @ message broker (uchO)",
		"node settings (sx) -> json @ node settings (lDAU)",
		"runtime settings (dx) -> show @ runtime settings (RHrh)",
		"node prompt -> text @ text block (FgKR)",
		"context menu -> context menu @ context menu (RyrE)",
		"name and path -> name and path @ name and path (Sqbh)",
		"open model -> open document @ message broker (uchO)",
		"open source file -> open js file @ message broker (uchO)",
		"clipboard.get => get @ clipboard (Yjry)",
		"clipboard.set -> set @ clipboard (Yjry)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "DKNK", 
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
		"save point.confirm -> show @ confirm box (KgBf)",
		"open source file -> open js file @ message broker (uchO)",
		"open model -> ()",
		"model.root -> root @ view manager (kXmY)",
		"model.header -> show @ doc settings (zTuV)",
		`redox.done -> [ 
			"redox.done @ view manager (kXmY)",
			"new edit @ message broker (uchO)" ]`,
		"pin profile -> show @ pin profile (OVll)",
		"get path -> path @ path request (DNmC)",
		"tool settings -> ()",
		"event settings -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "Yjry", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (uchO)",
		"switch -> clipboard.switch @ message broker (uchO)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "DNmC", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (uchO)",
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "lDAU", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "Sqbh", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)",
		"folder.get => folder.get @ message broker (uchO)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "OVll", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "FgKR", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "zTuV", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "RyrE", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "RHrh", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "KgBf", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (uchO)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "ZHIU", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (uchO)",
		"sync -> sync links @ model manager (DKNK)",
		"accept changes -> accept changes @ model manager (DKNK)",
		"show settings -> show settings @ model manager (DKNK)",
		"make app -> make app @ model manager (DKNK)",
		"make lib -> make lib @ model manager (DKNK)",
		"set save point -> save point.set @ model manager (DKNK)",
		"back to save point -> save point.back @ model manager (DKNK)",
		"recalibrate -> recalibrate @ view manager (kXmY)",
		"grid on-off -> grid on-off @ view manager (kXmY)"
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

const agentRuntimeOptions = {}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList, agentRuntimeOptions)

// and start the app
runtime.start()
