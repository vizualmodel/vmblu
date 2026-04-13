// ------------------------------------------------------------------
// Model: 
// Path: /c:/dev/vmblu/vscodex/webview/webview.app.js
// Creation date 4/9/2026, 10:44:53 AM
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
	uid: "YrxP", 
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
			"top level view @ view manager (hQha)",
			"model.set @ model manager (LjaH)" ]`,
		"get document -> ()",
		"reload model -> ()",
		"model.save -> model.save @ model manager (LjaH)",
		"sync links -> sync links @ model manager (LjaH)",
		"canvas resize -> size change @ view manager (hQha)",
		"clipboard.local => local @ clipboard (TvUB)",
		"clipboard.switched -> switched @ clipboard (TvUB)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "hQha", 
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
		"redox.doit -> redox.doit @ model manager (LjaH)",
		"redox.undo -> redox.undo @ model manager (LjaH)",
		"redox.redo -> redox.redo @ model manager (LjaH)",
		"canvas -> canvas @ message broker (YrxP)",
		"node settings (sx) -> json @ node settings (NPEl)",
		"runtime settings (dx) -> show @ runtime settings (WFTA)",
		"node prompt -> text @ text block (mLLt)",
		"context menu -> context menu @ context menu (cDSE)",
		"name and path -> name and path @ name and path (XELl)",
		"open model -> open document @ message broker (YrxP)",
		"open source file -> open js file @ message broker (YrxP)",
		"clipboard.get => get @ clipboard (TvUB)",
		"clipboard.set -> set @ clipboard (TvUB)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "LjaH", 
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
		"save point.confirm -> show @ confirm box (MdSu)",
		"open source file -> open js file @ message broker (YrxP)",
		"open model -> ()",
		"model.root -> root @ view manager (hQha)",
		"model.header -> show @ doc settings (GHzT)",
		`redox.done -> [ 
			"redox.done @ view manager (hQha)",
			"new edit @ message broker (YrxP)" ]`,
		"pin profile -> show @ pin profile (PIjN)",
		"get path -> path @ path request (CmUu)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "TvUB", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (YrxP)",
		"switch -> clipboard.switch @ message broker (YrxP)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "CmUu", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (YrxP)",
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "NPEl", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "XELl", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)",
		"folder.get => folder.get @ message broker (YrxP)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "PIjN", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "mLLt", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "GHzT", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "cDSE", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "WFTA", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "MdSu", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (YrxP)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "drTd", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (YrxP)",
		"sync -> sync links @ model manager (LjaH)",
		"accept changes -> accept changes @ model manager (LjaH)",
		"show settings -> show settings @ model manager (LjaH)",
		"make app -> make app @ model manager (LjaH)",
		"make lib -> make lib @ model manager (LjaH)",
		"set save point -> save point.set @ model manager (LjaH)",
		"back to save point -> save point.back @ model manager (LjaH)",
		"recalibrate -> recalibrate @ view manager (hQha)",
		"grid on-off -> grid on-off @ view manager (hQha)"
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
