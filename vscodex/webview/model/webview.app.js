// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.3","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.3"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:f8d7f558bea5ae8f"}}
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
	uid: "Owym",
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
			"top level view @ view manager (QgJs)",
			"model.set @ model manager (GEce)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (GEce)",
		"model.save -> model.save @ model manager (GEce)",
		"sync links -> sync links @ model manager (GEce)",
		"canvas resize -> size change @ view manager (QgJs)",
		"clipboard.local => local @ clipboard (zpbk)",
		"clipboard.switched -> switched @ clipboard (zpbk)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "QgJs",
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
		"redox.doit -> redox.doit @ model manager (GEce)",
		"redox.undo -> redox.undo @ model manager (GEce)",
		"redox.redo -> redox.redo @ model manager (GEce)",
		"team legend -> teams @ team legend (eeAg)",
		"canvas -> canvas @ message broker (Owym)",
		"node settings (sx) -> show @ node settings (KnnE)",
		"runtime settings (dx) -> show @ runtime settings (eZEy)",
		"node prompt -> markdown @ markdown prompt (pRaE)",
		"context menu -> context menu @ context menu (SjEc)",
		"name and path -> name and path @ name and path (woBd)",
		"open model -> open document @ message broker (Owym)",
		"open source file -> open js file @ message broker (Owym)",
		"clipboard.get => get @ clipboard (zpbk)",
		"clipboard.set -> set @ clipboard (zpbk)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "GEce",
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
		"save point.confirm -> show @ confirm box (JXVF)",
		"open source file -> open js file @ message broker (Owym)",
		"open model -> ()",
		"model.root -> root @ view manager (QgJs)",
		"model.loaded -> model.loaded @ message broker (Owym)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (Fihe)",
		`redox.done -> [ 
			"redox.done @ view manager (QgJs)",
			"new edit @ message broker (Owym)" ]`,
		"pin profile -> show @ pin profile (BnZH)",
		"get path -> path @ path request (qIUh)",
		"tool settings -> show @ tool settings (AvOM)",
		"event settings -> show @ event settings (nBML)",
		"info popup -> show @ toast box (UVrL)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "zpbk",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (Owym)",
		"switch -> clipboard.switch @ message broker (Owym)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "qIUh",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (Owym)",
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "KnnE",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "woBd",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)",
		"folder.get => folder.get @ message broker (Owym)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "BnZH",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (pRaE)",
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "pRaE",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "SjEc",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (JXVF)",
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "eZEy",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "AvOM",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "nBML",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "JXVF",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "Fihe",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)",
		"agent settings -> show @ agent settings (DLdQ)",
		"model runtime settings -> show @ model runtime settings (EZrN)",
		"team settings -> show @ team settings (FuOw)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "FuOw",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "EZrN",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "DLdQ",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "UDnT",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "UVrL",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Owym)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "UKPN",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (Owym)",
		"sync model -> sync model @ model manager (GEce)",
		"accept changes -> accept changes @ model manager (GEce)",
		"wire check -> wire check @ model manager (GEce)",
		"show settings -> show settings @ model manager (GEce)",
		"make app -> make app @ model manager (GEce)",
		"make lib -> make lib @ model manager (GEce)",
		"set save point -> save point.set @ model manager (GEce)",
		"back to save point -> save point.back @ model manager (GEce)",
		"recalibrate -> recalibrate @ view manager (QgJs)",
		"grid on-off -> grid on-off @ view manager (QgJs)",
		"application prompt -> application prompt @ view manager (QgJs)"
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
	uid: "eeAg",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (Owym)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.3","schemaVersion":"1.12.3"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
