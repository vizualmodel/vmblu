// ------------------------------------------------------------------
// Model: hv-layout
// Path: /c:/dev/vmblu/playground/model/playground.app.js
// Creation date 6/17/2026, 9:27:26 AM
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
		 JsonInputFactory,
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
		 ToastBoxFactory } from '../../ui-svelte/index.js'
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
	uid: "Jqwy", 
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (wHve)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "kLwU", 
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (Jqwy)",
		"file.selected -> doc.selected @ document manager (VGXx)",
		"file.new -> doc.new @ document manager (VGXx)",
		"file.renamed -> doc.renamed @ document manager (VGXx)",
		"file.deleted -> doc.deleted @ document manager (VGXx)",
		"file.get name -> doc.get @ document manager (VGXx)",
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
	uid: "cPGz", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (kLwU)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page", 
	uid: "wHve", 
	factory: VerticalMenuTabsContent,
	inputs: [
		"-> menu div",
		"-> tabs div",
		"-> content div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content size change -> size change @ view manager (juAW)",
		"div -> main area @ column-main layout (Jqwy)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "KRqw", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (wHve)",
		"tab.request to close -> tab.request to close @ document manager (VGXx)",
		"tab.request to select -> tab.request to select @ document manager (VGXx)"
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
	uid: "Fazi", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (BwvZ)",
		"accept changes -> accept changes @ model manager (BwvZ)",
		"wire check -> wire check @ model manager (BwvZ)",
		"show settings -> show settings @ model manager (BwvZ)",
		"make app -> make app @ model manager (BwvZ)",
		"make lib -> make lib @ model manager (BwvZ)",
		"set save point -> save point.set @ model manager (BwvZ)",
		"back to save point -> save point.back @ model manager (BwvZ)",
		"recalibrate -> recalibrate @ view manager (juAW)",
		"grid on-off -> grid on-off @ view manager (juAW)",
		"save -> model.save @ model manager (BwvZ)",
		"save as -> file.save as @ document manager (VGXx)",
		"div -> menu div @ editor page (wHve)"
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
	uid: "VGXx", 
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
		"tab.new -> tab.new @ tab ribbon (KRqw)",
		"tab.rename -> tab.rename @ tab ribbon (KRqw)",
		"tab.select -> tab.select @ tab ribbon (KRqw)",
		"tab.remove -> tab.remove @ tab ribbon (KRqw)",
		`doc.set active -> [ 
			"model.set @ model manager (BwvZ)",
			"top level view @ view manager (juAW)" ]`,
		"file.save -> model.save @ model manager (BwvZ)",
		"file.save as filename -> path @ path request (KKyu)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "juAW", 
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
		"redox.doit -> redox.doit @ model manager (BwvZ)",
		"redox.undo -> redox.undo @ model manager (BwvZ)",
		"redox.redo -> redox.redo @ model manager (BwvZ)",
		"canvas -> content div @ editor page (wHve)",
		"node settings (sx) -> json @ node settings (ZAuz)",
		"runtime settings (dx) -> show @ runtime settings (YjFU)",
		"node prompt -> markdown @ markdown input (mFgu)",
		"context menu -> context menu @ context menu (Orxo)",
		"name and path -> name and path @ name and path (RaQr)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (OKtE)",
		"clipboard.set -> set @ clipboard (OKtE)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "BwvZ", 
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
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
		"save point.confirm -> show @ confirm box (pfDG)",
		"model.root -> root @ view manager (juAW)",
		"model.header -> show @ doc settings (pGLC)",
		"model.resolved -> ()",
		"pin prompt -> ()",
		"redox.done -> redox.done @ view manager (juAW)",
		"event settings -> show @ event settings (JtGg)",
		"tool settings -> show @ tool settings (dTqk)",
		"pin profile -> show @ pin profile (HNEE)",
		"info popup -> show @ toast box (VlhW)",
		"get path -> path @ path request (KKyu)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "OKtE", 
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
	uid: "KKyu", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)",
		"folder.get => folder.get @ workspace (kLwU)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "ZAuz", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "RaQr", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (kLwU)",
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "HNEE", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)",
		"pin prompt -> markdown @ markdown input (mFgu)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input", 
	uid: "mFgu", 
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "pGLC", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)",
		"agent settings -> show @ agent settings (Wbmy)",
		"model runtime settings -> show @ model runtime settings (aIus)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings", 
	uid: "aIus", 
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings", 
	uid: "Wbmy", 
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "Orxo", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "YjFU", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "pfDG", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "dTqk", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "JtGg", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box", 
	uid: "VlhW", 
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (wHve)"
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
