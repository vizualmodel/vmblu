// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.1","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.1"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:27e8dd75e27cd34d"}}
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
	uid: "WvBU",
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
			"top level view @ view manager (BqeF)",
			"model.set @ model manager (aMxs)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (aMxs)",
		"model.save -> model.save @ model manager (aMxs)",
		"sync links -> sync links @ model manager (aMxs)",
		"canvas resize -> size change @ view manager (BqeF)",
		"clipboard.local => local @ clipboard (UpZS)",
		"clipboard.switched -> switched @ clipboard (UpZS)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "BqeF",
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
		"redox.doit -> redox.doit @ model manager (aMxs)",
		"redox.undo -> redox.undo @ model manager (aMxs)",
		"redox.redo -> redox.redo @ model manager (aMxs)",
		"team legend -> teams @ team legend (DWYK)",
		"canvas -> canvas @ message broker (WvBU)",
		"node settings (sx) -> show @ node settings (oUrl)",
		"runtime settings (dx) -> show @ runtime settings (ZJro)",
		"node prompt -> markdown @ markdown prompt (bwtu)",
		"context menu -> context menu @ context menu (jClf)",
		"name and path -> name and path @ name and path (whel)",
		"open model -> open document @ message broker (WvBU)",
		"open source file -> open js file @ message broker (WvBU)",
		"clipboard.get => get @ clipboard (UpZS)",
		"clipboard.set -> set @ clipboard (UpZS)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "aMxs",
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
		"save point.confirm -> show @ confirm box (ELzB)",
		"open source file -> open js file @ message broker (WvBU)",
		"open model -> ()",
		"model.root -> root @ view manager (BqeF)",
		"model.loaded -> model.loaded @ message broker (WvBU)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (OFhi)",
		`redox.done -> [ 
			"redox.done @ view manager (BqeF)",
			"new edit @ message broker (WvBU)" ]`,
		"pin profile -> show @ pin profile (ImnL)",
		"get path -> path @ path request (fEUG)",
		"tool settings -> show @ tool settings (LeES)",
		"event settings -> show @ event settings (hlmV)",
		"info popup -> show @ toast box (pTja)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "UpZS",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (WvBU)",
		"switch -> clipboard.switch @ message broker (WvBU)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "fEUG",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (WvBU)",
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "oUrl",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "whel",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)",
		"folder.get => folder.get @ message broker (WvBU)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "ImnL",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (bwtu)",
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "bwtu",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "jClf",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (ELzB)",
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "ZJro",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "LeES",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "hlmV",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "ELzB",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "OFhi",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)",
		"agent settings -> show @ agent settings (BlRR)",
		"model runtime settings -> show @ model runtime settings (vcST)",
		"team settings -> show @ team settings (fnvB)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "fnvB",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "vcST",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "BlRR",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "CzCK",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "pTja",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (WvBU)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "Bqwj",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (WvBU)",
		"sync model -> sync model @ model manager (aMxs)",
		"accept changes -> accept changes @ model manager (aMxs)",
		"wire check -> wire check @ model manager (aMxs)",
		"show settings -> show settings @ model manager (aMxs)",
		"make app -> make app @ model manager (aMxs)",
		"make lib -> make lib @ model manager (aMxs)",
		"set save point -> save point.set @ model manager (aMxs)",
		"back to save point -> save point.back @ model manager (aMxs)",
		"recalibrate -> recalibrate @ view manager (BqeF)",
		"grid on-off -> grid on-off @ view manager (BqeF)",
		"application prompt -> application prompt @ view manager (BqeF)"
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
	uid: "DWYK",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (WvBU)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.1","schemaVersion":"1.12.1"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
