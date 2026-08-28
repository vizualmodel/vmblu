// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.11","schemaVersion":"1.11.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.11.0"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:6b77c4e2eda615fe"}}
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
	uid: "CdUC",
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
			"top level view @ view manager (sRFD)",
			"model.set @ model manager (LCIF)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (LCIF)",
		"model.save -> model.save @ model manager (LCIF)",
		"sync links -> sync links @ model manager (LCIF)",
		"canvas resize -> size change @ view manager (sRFD)",
		"clipboard.local => local @ clipboard (nfHE)",
		"clipboard.switched -> switched @ clipboard (nfHE)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "sRFD",
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
		"redox.doit -> redox.doit @ model manager (LCIF)",
		"redox.undo -> redox.undo @ model manager (LCIF)",
		"redox.redo -> redox.redo @ model manager (LCIF)",
		"team legend -> teams @ team legend (ZOFv)",
		"canvas -> canvas @ message broker (CdUC)",
		"node settings (sx) -> show @ node settings (qtdD)",
		"runtime settings (dx) -> show @ runtime settings (DlNJ)",
		"node prompt -> markdown @ markdown prompt (knBW)",
		"context menu -> context menu @ context menu (yPgP)",
		"name and path -> name and path @ name and path (CLIz)",
		"open model -> open document @ message broker (CdUC)",
		"open source file -> open js file @ message broker (CdUC)",
		"clipboard.get => get @ clipboard (nfHE)",
		"clipboard.set -> set @ clipboard (nfHE)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "LCIF",
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
		"save point.confirm -> show @ confirm box (OfCF)",
		"open source file -> open js file @ message broker (CdUC)",
		"open model -> ()",
		"model.root -> root @ view manager (sRFD)",
		"model.loaded -> model.loaded @ message broker (CdUC)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (rCpR)",
		`redox.done -> [ 
			"redox.done @ view manager (sRFD)",
			"new edit @ message broker (CdUC)" ]`,
		"pin profile -> show @ pin profile (InFZ)",
		"get path -> path @ path request (CeNu)",
		"tool settings -> show @ tool settings (FlaL)",
		"event settings -> show @ event settings (QrWJ)",
		"info popup -> show @ toast box (vTzs)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "nfHE",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (CdUC)",
		"switch -> clipboard.switch @ message broker (CdUC)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "CeNu",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (CdUC)",
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "qtdD",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "CLIz",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)",
		"folder.get => folder.get @ message broker (CdUC)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "InFZ",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (knBW)",
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "knBW",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "yPgP",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (OfCF)",
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "DlNJ",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "FlaL",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "QrWJ",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "OfCF",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "rCpR",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)",
		"agent settings -> show @ agent settings (Rdrc)",
		"model runtime settings -> show @ model runtime settings (nwWx)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "nwWx",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "Rdrc",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "gorC",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "vTzs",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (CdUC)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "ioYj",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (CdUC)",
		"sync model -> sync model @ model manager (LCIF)",
		"accept changes -> accept changes @ model manager (LCIF)",
		"wire check -> wire check @ model manager (LCIF)",
		"show settings -> show settings @ model manager (LCIF)",
		"make app -> make app @ model manager (LCIF)",
		"make lib -> make lib @ model manager (LCIF)",
		"set save point -> save point.set @ model manager (LCIF)",
		"back to save point -> save point.back @ model manager (LCIF)",
		"recalibrate -> recalibrate @ view manager (sRFD)",
		"grid on-off -> grid on-off @ view manager (sRFD)",
		"application prompt -> application prompt @ view manager (sRFD)"
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
	uid: "ZOFv",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (CdUC)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.11","generatorVersion":"1.11.0","schemaVersion":"1.11.0"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
