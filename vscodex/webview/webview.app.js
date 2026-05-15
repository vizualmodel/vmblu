// ------------------------------------------------------------------
// Model: 
// Path: /vscodex/webview/webview.app.js
// Creation date 5/15/2026, 4:42:42 PM
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
	uid: "gNsS", 
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
			"top level view @ view manager (rzWE)",
			"model.set @ model manager (eYPZ)" ]`,
		"get document -> ()",
		"reload model -> ()",
		"model.save -> model.save @ model manager (eYPZ)",
		"sync links -> sync links @ model manager (eYPZ)",
		"canvas resize -> size change @ view manager (rzWE)",
		"clipboard.local => local @ clipboard (lSVg)",
		"clipboard.switched -> switched @ clipboard (lSVg)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "rzWE", 
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
		"redox.doit -> redox.doit @ model manager (eYPZ)",
		"redox.undo -> redox.undo @ model manager (eYPZ)",
		"redox.redo -> redox.redo @ model manager (eYPZ)",
		"canvas -> canvas @ message broker (gNsS)",
		"node settings (sx) -> json @ node settings (LAQx)",
		"runtime settings (dx) -> show @ runtime settings (LHbd)",
		"node prompt -> text @ text block (SqZD)",
		"context menu -> context menu @ context menu (DVht)",
		"name and path -> name and path @ name and path (twCl)",
		"open model -> open document @ message broker (gNsS)",
		"open source file -> open js file @ message broker (gNsS)",
		"clipboard.get => get @ clipboard (lSVg)",
		"clipboard.set -> set @ clipboard (lSVg)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "eYPZ", 
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
		"save point.confirm -> show @ confirm box (aFnE)",
		"open source file -> open js file @ message broker (gNsS)",
		"open model -> ()",
		"model.root -> root @ view manager (rzWE)",
		"model.header -> show @ doc settings (obLq)",
		`redox.done -> [ 
			"redox.done @ view manager (rzWE)",
			"new edit @ message broker (gNsS)" ]`,
		"pin profile -> show @ pin profile (UHao)",
		"get path -> path @ path request (gcbp)",
		"tool settings -> ()",
		"event settings -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "lSVg", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (gNsS)",
		"switch -> clipboard.switch @ message broker (gNsS)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "gcbp", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (gNsS)",
		"modal div -> ()"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "LAQx", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "twCl", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)",
		"folder.get => folder.get @ message broker (gNsS)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "UHao", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "SqZD", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "obLq", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "DVht", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "LHbd", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "aFnE", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gNsS)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "vKkN", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (gNsS)",
		"sync -> sync links @ model manager (eYPZ)",
		"accept changes -> accept changes @ model manager (eYPZ)",
		"show settings -> show settings @ model manager (eYPZ)",
		"make app -> make app @ model manager (eYPZ)",
		"make lib -> make lib @ model manager (eYPZ)",
		"set save point -> save point.set @ model manager (eYPZ)",
		"back to save point -> save point.back @ model manager (eYPZ)",
		"recalibrate -> recalibrate @ view manager (rzWE)",
		"grid on-off -> grid on-off @ view manager (rzWE)"
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

const agentRuntimeOptions = {}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, [], agentRuntimeOptions)

// and start the app
runtime.start()
