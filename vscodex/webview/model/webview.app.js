// ------------------------------------------------------------------
// Model: 
// Path: /c:/dev/vmblu/vscodex/webview/model/webview.app.js
// Creation date 6/17/2026, 12:09:50 PM
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "../../../runtime/rt-base/runtime.js"


//Imports
import { MessageBroker } from '../message-broker.js'
import { ViewManager } from '../../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../../core/nodes/clipboard/clipboard.js'
import { PathRequestFactory,
		 NodeSettingsFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 PinToolFactory,
		 PinEventFactory,
		 ConfirmBox,
		 DocumentSettingsFactory,
		 ModelRuntimeSettingsFactory,
		 AgentSettingsFactory,
		 MessageBoxFactory,
		 ToastBoxFactory,
		 VscodeSideMenuFactory } from '../../../ui-svelte/index.js'



//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "BKEI", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> model.resolved",
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
			"model.set @ model manager (GSYC)",
			"top level view @ view manager (gPzt)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (GSYC)",
		"model.save -> model.save @ model manager (GSYC)",
		"sync links -> sync links @ model manager (GSYC)",
		"canvas resize -> size change @ view manager (gPzt)",
		"clipboard.local => local @ clipboard (tuYb)",
		"clipboard.switched -> switched @ clipboard (tuYb)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "gPzt", 
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
		"redox.doit -> redox.doit @ model manager (GSYC)",
		"redox.undo -> redox.undo @ model manager (GSYC)",
		"redox.redo -> redox.redo @ model manager (GSYC)",
		"canvas -> canvas @ message broker (BKEI)",
		"node settings (sx) -> show @ node settings (FQMs)",
		"runtime settings (dx) -> show @ runtime settings (Rsqj)",
		"node prompt -> markdown @ markdown prompt (Iamb)",
		"context menu -> context menu @ context menu (Akzp)",
		"name and path -> name and path @ name and path (Vkzd)",
		"open model -> open document @ message broker (BKEI)",
		"open source file -> open js file @ message broker (BKEI)",
		"clipboard.get => get @ clipboard (tuYb)",
		"clipboard.set -> set @ clipboard (tuYb)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "GSYC", 
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
		"-> auto layout",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> sync links",
		"-> save point.set",
		"-> save point.back",
		"-> model.save",
		"-> model.set",
		"-> redox.doit",
		"-> redox.undo",
		"-> redox.redo"
		],
	outputs: [
		"save point.confirm -> show @ confirm box (ZkcH)",
		"open source file -> open js file @ message broker (BKEI)",
		"open model -> ()",
		"model.root -> root @ view manager (gPzt)",
		"model.header -> show @ doc settings(0) (WVrO)",
		"model.resolved -> model.resolved @ message broker (BKEI)",
		`redox.done -> [ 
			"redox.done @ view manager (gPzt)",
			"new edit @ message broker (BKEI)" ]`,
		"pin profile -> show @ pin profile (Mtkb)",
		"get path -> path @ path request (PNCi)",
		"tool settings -> show @ tool settings (OvKh)",
		"event settings -> show @ event settings (nCkc)",
		"info popup -> show @ toast box (qzTo)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "tuYb", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (BKEI)",
		"switch -> clipboard.switch @ message broker (BKEI)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "PNCi", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (BKEI)",
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "FQMs", 
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "Vkzd", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)",
		"folder.get => folder.get @ message broker (BKEI)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "Mtkb", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)",
		"pin prompt -> markdown @ markdown prompt (Iamb)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt", 
	uid: "Iamb", 
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "Akzp", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "Rsqj", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "OvKh", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "nCkc", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "ZkcH", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)", 
	uid: "WVrO", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)",
		"agent settings -> show @ agent settings (HNIi)",
		"model runtime settings -> show @ model runtime settings (ZchE)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings", 
	uid: "ZchE", 
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings", 
	uid: "HNIi", 
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "Nege", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box", 
	uid: "qzTo", 
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BKEI)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "hTVZ", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (BKEI)",
		"sync model -> sync model @ model manager (GSYC)",
		"accept changes -> accept changes @ model manager (GSYC)",
		"wire check -> wire check @ model manager (GSYC)",
		"auto layout -> auto layout @ model manager (GSYC)",
		"show settings -> show settings @ model manager (GSYC)",
		"make app -> make app @ model manager (GSYC)",
		"make lib -> make lib @ model manager (GSYC)",
		"set save point -> save point.set @ model manager (GSYC)",
		"back to save point -> save point.back @ model manager (GSYC)",
		"recalibrate -> recalibrate @ view manager (gPzt)",
		"grid on-off -> grid on-off @ view manager (gPzt)"
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
		        "icon": "cable",
		        "color": "#0fb2e4",
		        "message": "wire check",
		        "help": "Wire check"
		    },
		    {
		        "icon": "account_tree",
		        "color": "#0fb2e4",
		        "message": "auto layout",
		        "help": "Auto layout"
		    },
		    {
		        "icon": "bolt",
		        "color": "#0fb2e4",
		        "message": "sync model",
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

// Runtime options
const runtimeOptions = {}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
