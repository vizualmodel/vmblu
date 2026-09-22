// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.4","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.4"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:fc53ffc5b702167a"}}
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
	uid: "LbRq",
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
			"top level view @ view manager (jEkT)",
			"model.set @ model manager (WcaE)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (WcaE)",
		"model.save -> model.save @ model manager (WcaE)",
		"sync links -> sync links @ model manager (WcaE)",
		"canvas resize -> size change @ view manager (jEkT)",
		"clipboard.local => local @ clipboard (DadD)",
		"clipboard.switched -> switched @ clipboard (DadD)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "jEkT",
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
		"redox.doit -> redox.doit @ model manager (WcaE)",
		"redox.undo -> redox.undo @ model manager (WcaE)",
		"redox.redo -> redox.redo @ model manager (WcaE)",
		"team legend -> teams @ team legend (QmKJ)",
		"canvas -> canvas @ message broker (LbRq)",
		"node settings (sx) -> show @ node settings (MfPg)",
		"runtime settings (dx) -> show @ runtime settings (YRSc)",
		"node prompt -> markdown @ markdown prompt (bhJe)",
		"context menu -> context menu @ context menu (pnLj)",
		"name and path -> name and path @ name and path (IQXp)",
		"open model -> open document @ message broker (LbRq)",
		"open source file -> open js file @ message broker (LbRq)",
		"clipboard.get => get @ clipboard (DadD)",
		"clipboard.set -> set @ clipboard (DadD)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "WcaE",
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
		"save point.confirm -> show @ confirm box (VwoQ)",
		"open source file -> open js file @ message broker (LbRq)",
		"open model -> ()",
		"model.root -> root @ view manager (jEkT)",
		"model.loaded -> model.loaded @ message broker (LbRq)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (utMh)",
		`redox.done -> [ 
			"redox.done @ view manager (jEkT)",
			"new edit @ message broker (LbRq)" ]`,
		"pin profile -> show @ pin profile (YPrJ)",
		"get path -> path @ path request (SNUL)",
		"tool settings -> show @ tool settings (AgIO)",
		"event settings -> show @ event settings (yjvv)",
		"info popup -> show @ toast box (UClG)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "DadD",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (LbRq)",
		"switch -> clipboard.switch @ message broker (LbRq)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "SNUL",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (LbRq)",
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "MfPg",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "IQXp",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)",
		"folder.get => folder.get @ message broker (LbRq)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "YPrJ",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (bhJe)",
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "bhJe",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "pnLj",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (VwoQ)",
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "YRSc",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "AgIO",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "yjvv",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "VwoQ",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "utMh",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)",
		"agent settings -> show @ agent settings (qdMT)",
		"model runtime settings -> show @ model runtime settings (kbEZ)",
		"team settings -> show @ team settings (CFNM)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "CFNM",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "kbEZ",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "qdMT",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "ZwkB",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "UClG",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (LbRq)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "lCKl",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (LbRq)",
		"sync model -> sync model @ model manager (WcaE)",
		"accept changes -> accept changes @ model manager (WcaE)",
		"wire check -> wire check @ model manager (WcaE)",
		"show settings -> show settings @ model manager (WcaE)",
		"make app -> make app @ model manager (WcaE)",
		"make lib -> make lib @ model manager (WcaE)",
		"set save point -> save point.set @ model manager (WcaE)",
		"back to save point -> save point.back @ model manager (WcaE)",
		"recalibrate -> recalibrate @ view manager (jEkT)",
		"grid on-off -> grid on-off @ view manager (jEkT)",
		"application prompt -> application prompt @ view manager (jEkT)"
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
	uid: "QmKJ",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (LbRq)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.4","schemaVersion":"1.12.4"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
