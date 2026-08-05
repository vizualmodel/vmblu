// ------------------------------------------------------------------
// Model: hv-layout
// Path: /c:/dev/vmblu/playground/model/playground.app.js
// Creation date 8/5/2026, 12:20:36 PM
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
	uid: "mwSq",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (wiRx)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "dzUv",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (mwSq)",
		"file.selected -> doc.selected @ document manager (unoL)",
		"file.new -> doc.new @ document manager (unoL)",
		"file.renamed -> doc.renamed @ document manager (unoL)",
		"file.deleted -> doc.deleted @ document manager (unoL)",
		"file.get name -> doc.get @ document manager (unoL)",
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
	uid: "IMah",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (dzUv)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "wiRx",
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
		"content size change -> size change @ view manager (teli)",
		"div -> main area @ column-main layout (mwSq)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "uNHD",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (wiRx)",
		"tab.request to close -> tab.request to close @ document manager (unoL)",
		"tab.request to select -> tab.request to select @ document manager (unoL)"
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
	uid: "ixbc",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (GtxM)",
		"accept changes -> accept changes @ model manager (GtxM)",
		"wire check -> wire check @ model manager (GtxM)",
		"show settings -> show settings @ model manager (GtxM)",
		"make app -> make app @ model manager (GtxM)",
		"make lib -> make lib @ model manager (GtxM)",
		"set save point -> save point.set @ model manager (GtxM)",
		"back to save point -> save point.back @ model manager (GtxM)",
		"recalibrate -> recalibrate @ view manager (teli)",
		"grid on-off -> grid on-off @ view manager (teli)",
		"application prompt -> application prompt @ view manager (teli)",
		"save -> model.save @ model manager (GtxM)",
		"save as -> file.save as @ document manager (unoL)",
		"div -> menu div @ editor page (wiRx)"
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
	uid: "unoL",
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
		"tab.new -> tab.new @ tab ribbon (uNHD)",
		"tab.rename -> tab.rename @ tab ribbon (uNHD)",
		"tab.select -> tab.select @ tab ribbon (uNHD)",
		"tab.remove -> tab.remove @ tab ribbon (uNHD)",
		`doc.set active -> [ 
			"model.set @ model manager (GtxM)",
			"top level view @ view manager (teli)" ]`,
		"file.save -> model.save @ model manager (GtxM)",
		"file.save as filename -> path @ path request (OlLC)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "teli",
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> top level view",
		"-> recalibrate",
		"-> grid on-off",
		"-> size change",
		"-> application prompt"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (GtxM)",
		"redox.undo -> redox.undo @ model manager (GtxM)",
		"redox.redo -> redox.redo @ model manager (GtxM)",
		"team legend -> teams @ team legend (lDMy)",
		"canvas -> content div @ editor page (wiRx)",
		"node settings (sx) -> show @ node settings (tjQI)",
		"runtime settings (dx) -> show @ runtime settings (Oval)",
		"node prompt -> markdown @ markdown input (OQsl)",
		"context menu -> context menu @ context menu (DCKL)",
		"name and path -> name and path @ name and path (OMbV)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (GLiK)",
		"clipboard.set -> set @ clipboard (GLiK)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "GtxM",
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
		"save point.confirm -> show @ confirm box (yxPR)",
		"model.root -> root @ view manager (teli)",
		"model.header -> show @ doc settings (hoOP)",
		"model.resolved -> ()",
		"redox.done -> redox.done @ view manager (teli)",
		"event settings -> show @ event settings (IjcB)",
		"tool settings -> show @ tool settings (EZkX)",
		"pin profile -> show @ pin profile (fCUV)",
		"info popup -> show @ toast box (qdqC)",
		"get path -> path @ path request (OlLC)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "GLiK",
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
	uid: "OlLC",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)",
		"folder.get => folder.get @ workspace (dzUv)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "tjQI",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "OMbV",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (dzUv)",
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "fCUV",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (OQsl)",
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "OQsl",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "hoOP",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)",
		"agent settings -> show @ agent settings (oApb)",
		"model runtime settings -> show @ model runtime settings (eLhU)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "eLhU",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "oApb",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "DCKL",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (yxPR)",
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "Oval",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "yxPR",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "EZkX",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "IjcB",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "qdqC",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wiRx)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "lDMy",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ editor page (wiRx)"
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
