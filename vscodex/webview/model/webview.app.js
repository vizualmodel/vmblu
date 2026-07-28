// ------------------------------------------------------------------
// Model: 
// Path: C:/dev/vmblu/vscodex/webview/model/webview.app.js
// Creation date 28/7/2026, 09:52:12
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
	uid: "vliS",
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> model.resolved",
		"-> open js file",
		"=> folder.get",
		"-> canvas",
		"-> legend div",
		"-> floating menu",
		"-> modal div",
		"=> clipboard.remote",
		"-> clipboard.switch"
		],
	outputs: [
		`set document -> [ 
			"model.set @ model manager (NHBJ)",
			"top level view @ view manager (ZHru)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (NHBJ)",
		"model.save -> model.save @ model manager (NHBJ)",
		"sync links -> sync links @ model manager (NHBJ)",
		"canvas resize -> size change @ view manager (ZHru)",
		"clipboard.local => local @ clipboard (WMbC)",
		"clipboard.switched -> switched @ clipboard (WMbC)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "ZHru",
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
		"redox.doit -> redox.doit @ model manager (NHBJ)",
		"redox.undo -> redox.undo @ model manager (NHBJ)",
		"redox.redo -> redox.redo @ model manager (NHBJ)",
		"team legend -> teams @ team legend (IIFS)",
		"canvas -> canvas @ message broker (vliS)",
		"node settings (sx) -> show @ node settings (iTZW)",
		"runtime settings (dx) -> show @ runtime settings (SiSb)",
		"node prompt -> markdown @ markdown prompt (QCIi)",
		"context menu -> context menu @ context menu (sWlF)",
		"name and path -> name and path @ name and path (MAfv)",
		"open model -> open document @ message broker (vliS)",
		"open source file -> open js file @ message broker (vliS)",
		"clipboard.get => get @ clipboard (WMbC)",
		"clipboard.set -> set @ clipboard (WMbC)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "NHBJ",
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
		"save point.confirm -> show @ confirm box (pokT)",
		"open source file -> open js file @ message broker (vliS)",
		"open model -> ()",
		"model.root -> root @ view manager (ZHru)",
		"model.header -> show @ doc settings(0) (bmqD)",
		"model.resolved -> model.resolved @ message broker (vliS)",
		`redox.done -> [ 
			"redox.done @ view manager (ZHru)",
			"new edit @ message broker (vliS)" ]`,
		"pin profile -> show @ pin profile (dxnJ)",
		"get path -> path @ path request (prcn)",
		"tool settings -> show @ tool settings (zhBI)",
		"event settings -> show @ event settings (IZbA)",
		"info popup -> show @ toast box (pPpg)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "WMbC",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (vliS)",
		"switch -> clipboard.switch @ message broker (vliS)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "prcn",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (vliS)",
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "iTZW",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "MAfv",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)",
		"folder.get => folder.get @ message broker (vliS)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "dxnJ",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (QCIi)",
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "QCIi",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "sWlF",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "SiSb",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "zhBI",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "IZbA",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "pokT",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "bmqD",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)",
		"agent settings -> show @ agent settings (zgte)",
		"model runtime settings -> show @ model runtime settings (bMoQ)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "bMoQ",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "zgte",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "IdMc",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "pPpg",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (vliS)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "SRYc",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (vliS)",
		"sync model -> sync model @ model manager (NHBJ)",
		"accept changes -> accept changes @ model manager (NHBJ)",
		"wire check -> wire check @ model manager (NHBJ)",
		"auto layout -> auto layout @ model manager (NHBJ)",
		"show settings -> show settings @ model manager (NHBJ)",
		"make app -> make app @ model manager (NHBJ)",
		"make lib -> make lib @ model manager (NHBJ)",
		"set save point -> save point.set @ model manager (NHBJ)",
		"back to save point -> save point.back @ model manager (NHBJ)",
		"recalibrate -> recalibrate @ view manager (ZHru)",
		"grid on-off -> grid on-off @ view manager (ZHru)"
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
	uid: "IIFS",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (vliS)"
		]
	},
]

// Runtime options
const runtimeOptions = {}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
