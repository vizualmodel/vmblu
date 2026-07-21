// ------------------------------------------------------------------
// Model: 
// Path: C:/dev/vmblu/vscodex/webview/model/webview.app.js
// Creation date 21/7/2026, 16:35:36
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
		 VscodeSideMenuFactory,
		 TeamLegendFactory } from '../../../ui-svelte/index.js'



//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "WZxd", 
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
		"-> legend div",
		"=> clipboard.remote",
		"-> clipboard.switch"
		],
	outputs: [
		`set document -> [ 
			"model.set @ model manager (JVnr)",
			"top level view @ view manager (WrKn)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (JVnr)",
		"model.save -> model.save @ model manager (JVnr)",
		"sync links -> sync links @ model manager (JVnr)",
		"canvas resize -> size change @ view manager (WrKn)",
		"clipboard.local => local @ clipboard (EUAa)",
		"clipboard.switched -> switched @ clipboard (EUAa)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "WrKn", 
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
		"redox.doit -> redox.doit @ model manager (JVnr)",
		"redox.undo -> redox.undo @ model manager (JVnr)",
		"redox.redo -> redox.redo @ model manager (JVnr)",
		"team legend -> teams @ team legend (fSnx)",
		"canvas -> canvas @ message broker (WZxd)",
		"node settings (sx) -> show @ node settings (KzXt)",
		"runtime settings (dx) -> show @ runtime settings (PqvO)",
		"node prompt -> markdown @ markdown prompt (hvdZ)",
		"context menu -> context menu @ context menu (IVYN)",
		"name and path -> name and path @ name and path (msjj)",
		"open model -> open document @ message broker (WZxd)",
		"open source file -> open js file @ message broker (WZxd)",
		"clipboard.get => get @ clipboard (EUAa)",
		"clipboard.set -> set @ clipboard (EUAa)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "JVnr", 
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
		"save point.confirm -> show @ confirm box (cbGx)",
		"open source file -> open js file @ message broker (WZxd)",
		"open model -> ()",
		"model.root -> root @ view manager (WrKn)",
		"model.header -> show @ doc settings(0) (KABL)",
		"model.resolved -> model.resolved @ message broker (WZxd)",
		`redox.done -> [ 
			"redox.done @ view manager (WrKn)",
			"new edit @ message broker (WZxd)" ]`,
		"pin profile -> show @ pin profile (wUNV)",
		"get path -> path @ path request (sicL)",
		"tool settings -> show @ tool settings (uSBk)",
		"event settings -> show @ event settings (YAGL)",
		"info popup -> show @ toast box (Czpc)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "EUAa", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (WZxd)",
		"switch -> clipboard.switch @ message broker (WZxd)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "sicL", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (WZxd)",
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "KzXt", 
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "msjj", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)",
		"folder.get => folder.get @ message broker (WZxd)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "wUNV", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (hvdZ)",
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt", 
	uid: "hvdZ", 
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "IVYN", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "PqvO", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "uSBk", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "YAGL", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "cbGx", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)", 
	uid: "KABL", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)",
		"agent settings -> show @ agent settings (veOj)",
		"model runtime settings -> show @ model runtime settings (CPZM)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings", 
	uid: "CPZM", 
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings", 
	uid: "veOj", 
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "lWJF", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box", 
	uid: "Czpc", 
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WZxd)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "rwog", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (WZxd)",
		"sync model -> sync model @ model manager (JVnr)",
		"accept changes -> accept changes @ model manager (JVnr)",
		"wire check -> wire check @ model manager (JVnr)",
		"auto layout -> auto layout @ model manager (JVnr)",
		"show settings -> show settings @ model manager (JVnr)",
		"make app -> make app @ model manager (JVnr)",
		"make lib -> make lib @ model manager (JVnr)",
		"set save point -> save point.set @ model manager (JVnr)",
		"back to save point -> save point.back @ model manager (JVnr)",
		"recalibrate -> recalibrate @ view manager (WrKn)",
		"grid on-off -> grid on-off @ view manager (WrKn)"
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
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend", 
	uid: "fSnx", 
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (WZxd)"
		]
	},
]

// Runtime options
const runtimeOptions = {}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
