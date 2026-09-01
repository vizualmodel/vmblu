// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.0"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:dc8341953446cbac"}}
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
		 TeamSettingsFactory,
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
	uid: "dNPH",
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> model.loaded",
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
			"top level view @ view manager (qPUB)",
			"model.set @ model manager (pagU)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (pagU)",
		"model.save -> model.save @ model manager (pagU)",
		"sync links -> sync links @ model manager (pagU)",
		"canvas resize -> size change @ view manager (qPUB)",
		"clipboard.local => local @ clipboard (rcCC)",
		"clipboard.switched -> switched @ clipboard (rcCC)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "qPUB",
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> recalibrate",
		"-> top level view",
		"-> grid on-off",
		"-> size change",
		"-> application prompt"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (pagU)",
		"redox.undo -> redox.undo @ model manager (pagU)",
		"redox.redo -> redox.redo @ model manager (pagU)",
		"team legend -> teams @ team legend (fsSc)",
		"canvas -> canvas @ message broker (dNPH)",
		"node settings (sx) -> show @ node settings (UUyJ)",
		"runtime settings (dx) -> show @ runtime settings (wflx)",
		"node prompt -> markdown @ markdown prompt (vXHh)",
		"context menu -> context menu @ context menu (iKgd)",
		"name and path -> name and path @ name and path (Ggai)",
		"open model -> open document @ message broker (dNPH)",
		"open source file -> open js file @ message broker (dNPH)",
		"clipboard.get => get @ clipboard (rcCC)",
		"clipboard.set -> set @ clipboard (rcCC)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "pagU",
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
		"save point.confirm -> show @ confirm box (zGXO)",
		"open source file -> open js file @ message broker (dNPH)",
		"open model -> ()",
		"model.root -> root @ view manager (qPUB)",
		"model.loaded -> model.loaded @ message broker (dNPH)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (ZoWx)",
		`redox.done -> [ 
			"redox.done @ view manager (qPUB)",
			"new edit @ message broker (dNPH)" ]`,
		"pin profile -> show @ pin profile (xvpn)",
		"get path -> path @ path request (mcfd)",
		"tool settings -> show @ tool settings (Zfsl)",
		"event settings -> show @ event settings (IvWT)",
		"info popup -> show @ toast box (NlrX)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "rcCC",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (dNPH)",
		"switch -> clipboard.switch @ message broker (dNPH)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "mcfd",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (dNPH)",
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "UUyJ",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "Ggai",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)",
		"folder.get => folder.get @ message broker (dNPH)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "xvpn",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (vXHh)",
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "vXHh",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "iKgd",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (zGXO)",
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "wflx",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "Zfsl",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "IvWT",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "zGXO",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "ZoWx",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)",
		"agent settings -> show @ agent settings (DKIR)",
		"model runtime settings -> show @ model runtime settings (MePQ)",
		"team settings -> show @ team settings (tUSV)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "tUSV",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "MePQ",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "DKIR",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "EoRz",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "NlrX",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (dNPH)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "HTRa",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (dNPH)",
		"sync model -> sync model @ model manager (pagU)",
		"accept changes -> accept changes @ model manager (pagU)",
		"wire check -> wire check @ model manager (pagU)",
		"show settings -> show settings @ model manager (pagU)",
		"make app -> make app @ model manager (pagU)",
		"make lib -> make lib @ model manager (pagU)",
		"set save point -> save point.set @ model manager (pagU)",
		"back to save point -> save point.back @ model manager (pagU)",
		"recalibrate -> recalibrate @ view manager (qPUB)",
		"grid on-off -> grid on-off @ view manager (qPUB)",
		"application prompt -> application prompt @ view manager (qPUB)"
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
		        "icon": "comment",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Application prompt"
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
	uid: "fsSc",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (dNPH)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.0","schemaVersion":"1.12.0"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
