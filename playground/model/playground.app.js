// ------------------------------------------------------------------
// Model: hv-layout
// Path: C:/dev/vmblu/playground/model/playground.app.js
// Creation date 6/1/2026, 6:24:02 PM
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-browser-agent"


//Imports
import { ColumnMainFactory,
		 SingleTextFieldFactory,
		 MessageBoxFactory,
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
		 PinEventFactory } from '../../ui-svelte/index.js'
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
	uid: "iYNi", 
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (yfXM)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "fCQu", 
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (iYNi)",
		"file.selected -> doc.selected @ document manager (Stkq)",
		"file.new -> doc.new @ document manager (Stkq)",
		"file.renamed -> doc.renamed @ document manager (Stkq)",
		"file.deleted -> doc.deleted @ document manager (Stkq)",
		"file.get name -> doc.get @ document manager (Stkq)",
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
	uid: "sopA", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (fCQu)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "KLkL", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (fCQu)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page", 
	uid: "yfXM", 
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
		"content size change -> size change @ view manager (iIBA)",
		"div -> main area @ column-main layout (iYNi)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "XWeo", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (yfXM)",
		"tab.request to close -> tab.request to close @ document manager (Stkq)",
		"tab.request to select -> tab.request to select @ document manager (Stkq)"
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
	uid: "mrTx", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (YjOb)",
		"accept changes -> accept changes @ model manager (YjOb)",
		"show settings -> show settings @ model manager (YjOb)",
		"make app -> make app @ model manager (YjOb)",
		"make lib -> make lib @ model manager (YjOb)",
		"set save point -> save point.set @ model manager (YjOb)",
		"back to save point -> save point.back @ model manager (YjOb)",
		"recalibrate -> recalibrate @ view manager (iIBA)",
		"grid on-off -> grid on-off @ view manager (iIBA)",
		"save -> model.save @ model manager (YjOb)",
		"save as -> file.save as @ document manager (Stkq)",
		"div -> menu div @ editor page (yfXM)"
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
	uid: "Stkq", 
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
		"tab.new -> tab.new @ tab ribbon (XWeo)",
		"tab.rename -> tab.rename @ tab ribbon (XWeo)",
		"tab.select -> tab.select @ tab ribbon (XWeo)",
		"tab.remove -> tab.remove @ tab ribbon (XWeo)",
		`doc.set active -> [ 
			"model.set @ model manager (YjOb)",
			"top level view @ view manager (iIBA)" ]`,
		"file.save -> model.save @ model manager (YjOb)",
		"file.save as filename -> path @ path request (pHME)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "iIBA", 
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
		"redox.doit -> redox.doit @ model manager (YjOb)",
		"redox.undo -> redox.undo @ model manager (YjOb)",
		"redox.redo -> redox.redo @ model manager (YjOb)",
		"canvas -> content div @ editor page (yfXM)",
		"node settings (sx) -> json @ node settings (yatb)",
		"runtime settings (dx) -> show @ runtime settings (anaZ)",
		"node prompt -> markdown @ markdown input (eadL)",
		"context menu -> context menu @ context menu (oFxF)",
		"name and path -> name and path @ name and path (HeIQ)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (bkKq)",
		"clipboard.set -> set @ clipboard (bkKq)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "YjOb", 
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
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
		"save point.confirm -> show @ confirm box (mdvd)",
		"model.root -> root @ view manager (iIBA)",
		"model.header -> show @ doc settings (pftX)",
		"model.resolved -> ()",
		"redox.done -> redox.done @ view manager (iIBA)",
		"event settings -> show @ event settings (wjbJ)",
		"tool settings -> show @ tool settings (OKPK)",
		"pin profile -> show @ pin profile (kWvj)",
		"get path -> path @ path request (pHME)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "bkKq", 
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
	uid: "pHME", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)",
		"folder.get => folder.get @ workspace (fCQu)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "yatb", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "HeIQ", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (fCQu)",
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "kWvj", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input", 
	uid: "eadL", 
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "pftX", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)",
		"agent settings -> show @ agent settings (opDn)",
		"model runtime settings -> show @ model runtime settings (DvCX)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings", 
	uid: "DvCX", 
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings", 
	uid: "opDn", 
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "oFxF", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "anaZ", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "mdvd", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "OKPK", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "wjbJ", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (yfXM)"
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
