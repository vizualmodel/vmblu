// ------------------------------------------------------------------
// Model: hv-layout
// Path: C:/dev/vmblu/playground/model/playground.app.js
// Creation date 28/7/2026, 09:52:11
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-browser-agent"


//Imports
import { ColumnMainFactory,
		 SingleTextFieldFactory,
		 VerticalMenuTabsContent,
		 TabRibbonFactory,
		 VscodeSideMenuFactory,
		 PathRequestFactory,
		 NodeSettingsFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 DocumentSettingsFactory,
		 ModelRuntimeSettingsFactory,
		 AgentSettingsFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 ConfirmBox,
		 PinToolFactory,
		 PinEventFactory,
		 ToastBoxFactory,
		 TeamLegendFactory } from '../../ui-svelte/index.js'
import { Workspace } from '../nodes/workspace/factory.js'
import { DocumentManager } from '../../core/nodes/document-manager/document-manager.js'
import { ViewManager } from '../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../core/nodes/clipboard/clipboard.js'

// Runtime sidecars
import capabilities from './playground.cap.json' with { type: 'json' }
import agent from './playground.agent.json' with { type: 'json' }

//The runtime nodes
const nodeList = [
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout",
	uid: "atMF",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (tWeo)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "yowV",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (atMF)",
		"file.selected -> doc.selected @ document manager (LEhy)",
		"file.new -> doc.new @ document manager (LEhy)",
		"file.renamed -> doc.renamed @ document manager (LEhy)",
		"file.deleted -> doc.deleted @ document manager (LEhy)",
		"file.get name -> doc.get @ document manager (LEhy)",
		"file.context menu -> ()",
		"files.get list => ()",
		"files.selected -> ()",
		"files.deleted -> ()",
		"folder.context menu -> ()",
		"folder.renamed -> ()",
		"folder.deleted -> ()"
		],
	sx:	{
		    "name": "examples",
		    "files": [],
		    "folders": [
		        {
		            "name": "tutorial",
		            "files": [
		                {
		                    "name": "chat-client.mod.blu"
		                },
		                {
		                    "name": "chat-server.mod.blu"
		                }
		            ]
		        }
		    ]
		}
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "fCZM",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (yowV)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "tWeo",
	factory: VerticalMenuTabsContent,
	inputs: [
		"-> legend div",
		"-> menu div",
		"-> tabs div",
		"-> content div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content size change -> size change @ view manager (tSqb)",
		"div -> main area @ column-main layout (atMF)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "Fazl",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (tWeo)",
		"tab.request to close -> tab.request to close @ document manager (LEhy)",
		"tab.request to select -> tab.request to select @ document manager (LEhy)"
		],
	sx:	{
		    "a": 7,
		    "b": 8,
		    "c": "dit is een filename",
		    "d": {
		        "e": "nee",
		        "dxdy": 254
		    }
		}
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu",
	uid: "biBu",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (fmKf)",
		"accept changes -> accept changes @ model manager (fmKf)",
		"wire check -> wire check @ model manager (fmKf)",
		"auto layout -> auto layout @ model manager (fmKf)",
		"show settings -> show settings @ model manager (fmKf)",
		"make app -> make app @ model manager (fmKf)",
		"make lib -> make lib @ model manager (fmKf)",
		"set save point -> save point.set @ model manager (fmKf)",
		"back to save point -> save point.back @ model manager (fmKf)",
		"recalibrate -> recalibrate @ view manager (tSqb)",
		"grid on-off -> grid on-off @ view manager (tSqb)",
		"save -> model.save @ model manager (fmKf)",
		"save as -> file.save as @ document manager (LEhy)",
		"div -> menu div @ editor page (tWeo)"
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
		    },
		    {
		        "icon": "save",
		        "color": "#0fb2e4",
		        "message": "save",
		        "help": "save"
		    },
		    {
		        "icon": "save_as",
		        "color": "#0fb2e4",
		        "message": "save as",
		        "help": "save as ..."
		    }
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager",
	uid: "LEhy",
	factory: DocumentManager,
	inputs: [
		"-> tab.request to close",
		"-> tab.request to select",
		"-> doc.selected",
		"-> doc.new",
		"-> doc.renamed",
		"-> doc.deleted",
		"-> doc.get",
		"-> doc.open",
		"-> file.save as"
		],
	outputs: [
		"tab.new -> tab.new @ tab ribbon (Fazl)",
		"tab.rename -> tab.rename @ tab ribbon (Fazl)",
		"tab.select -> tab.select @ tab ribbon (Fazl)",
		"tab.remove -> tab.remove @ tab ribbon (Fazl)",
		`doc.set active -> [ 
			"model.set @ model manager (fmKf)",
			"top level view @ view manager (tSqb)" ]`,
		"file.save -> model.save @ model manager (fmKf)",
		"file.save as filename -> path @ path request (uOnq)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "tSqb",
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> top level view",
		"-> recalibrate",
		"-> grid on-off",
		"-> size change"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (fmKf)",
		"redox.undo -> redox.undo @ model manager (fmKf)",
		"redox.redo -> redox.redo @ model manager (fmKf)",
		"team legend -> teams @ team legend (Mvbc)",
		"canvas -> content div @ editor page (tWeo)",
		"node settings (sx) -> show @ node settings (JqzX)",
		"runtime settings (dx) -> show @ runtime settings (ktxp)",
		"node prompt -> markdown @ markdown input (nrBF)",
		"context menu -> context menu @ context menu (bVIl)",
		"name and path -> name and path @ name and path (yMnR)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (aCeI)",
		"clipboard.set -> set @ clipboard (aCeI)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "fmKf",
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
		"save point.confirm -> show @ confirm box (phBB)",
		"model.root -> root @ view manager (tSqb)",
		"model.header -> show @ doc settings (JfFD)",
		"model.resolved -> ()",
		"redox.done -> redox.done @ view manager (tSqb)",
		"event settings -> show @ event settings (ibzb)",
		"tool settings -> show @ tool settings (oevX)",
		"pin profile -> show @ pin profile (Yxwa)",
		"info popup -> show @ toast box (LZEu)",
		"get path -> path @ path request (uOnq)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "aCeI",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"-> switched",
		"=> local"
		],
	outputs: [
		"switch -> ()",
		"remote => ()"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "uOnq",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)",
		"folder.get => folder.get @ workspace (yowV)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "JqzX",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "yMnR",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (yowV)",
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "Yxwa",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (nrBF)",
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "nrBF",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "JfFD",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)",
		"agent settings -> show @ agent settings (PYnL)",
		"model runtime settings -> show @ model runtime settings (cprb)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "cprb",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "PYnL",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "bVIl",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "ktxp",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "phBB",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "oevX",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "ibzb",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "LZEu",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (tWeo)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "Mvbc",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ editor page (tWeo)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
