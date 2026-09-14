// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.2","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.2"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:1d14ad02e13f02b0"}}
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
	uid: "Arto",
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
			"top level view @ view manager (SRHG)",
			"model.set @ model manager (niRp)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (niRp)",
		"model.save -> model.save @ model manager (niRp)",
		"sync links -> sync links @ model manager (niRp)",
		"canvas resize -> size change @ view manager (SRHG)",
		"clipboard.local => local @ clipboard (BxYf)",
		"clipboard.switched -> switched @ clipboard (BxYf)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "SRHG",
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
		"redox.doit -> redox.doit @ model manager (niRp)",
		"redox.undo -> redox.undo @ model manager (niRp)",
		"redox.redo -> redox.redo @ model manager (niRp)",
		"team legend -> teams @ team legend (HAKe)",
		"canvas -> canvas @ message broker (Arto)",
		"node settings (sx) -> show @ node settings (qXXF)",
		"runtime settings (dx) -> show @ runtime settings (uWDI)",
		"node prompt -> markdown @ markdown prompt (vTQV)",
		"context menu -> context menu @ context menu (mHEF)",
		"name and path -> name and path @ name and path (tLhi)",
		"open model -> open document @ message broker (Arto)",
		"open source file -> open js file @ message broker (Arto)",
		"clipboard.get => get @ clipboard (BxYf)",
		"clipboard.set -> set @ clipboard (BxYf)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "niRp",
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
		"save point.confirm -> show @ confirm box (vQjL)",
		"open source file -> open js file @ message broker (Arto)",
		"open model -> ()",
		"model.root -> root @ view manager (SRHG)",
		"model.loaded -> model.loaded @ message broker (Arto)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (wdCt)",
		`redox.done -> [ 
			"redox.done @ view manager (SRHG)",
			"new edit @ message broker (Arto)" ]`,
		"pin profile -> show @ pin profile (ULDO)",
		"get path -> path @ path request (mjyq)",
		"tool settings -> show @ tool settings (EQHG)",
		"event settings -> show @ event settings (qFkw)",
		"info popup -> show @ toast box (yVnk)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "BxYf",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (Arto)",
		"switch -> clipboard.switch @ message broker (Arto)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "mjyq",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (Arto)",
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "qXXF",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "tLhi",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)",
		"folder.get => folder.get @ message broker (Arto)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "ULDO",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (vTQV)",
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "vTQV",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "mHEF",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (vQjL)",
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "uWDI",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "EQHG",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "qFkw",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "vQjL",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "wdCt",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)",
		"agent settings -> show @ agent settings (BMeU)",
		"model runtime settings -> show @ model runtime settings (CJXq)",
		"team settings -> show @ team settings (MpQJ)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "MpQJ",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "CJXq",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "BMeU",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "wZXZ",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "yVnk",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Arto)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "wEhz",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (Arto)",
		"sync model -> sync model @ model manager (niRp)",
		"accept changes -> accept changes @ model manager (niRp)",
		"wire check -> wire check @ model manager (niRp)",
		"show settings -> show settings @ model manager (niRp)",
		"make app -> make app @ model manager (niRp)",
		"make lib -> make lib @ model manager (niRp)",
		"set save point -> save point.set @ model manager (niRp)",
		"back to save point -> save point.back @ model manager (niRp)",
		"recalibrate -> recalibrate @ view manager (SRHG)",
		"grid on-off -> grid on-off @ view manager (SRHG)",
		"application prompt -> application prompt @ view manager (SRHG)"
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
	uid: "HAKe",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (Arto)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.2","schemaVersion":"1.12.2"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
