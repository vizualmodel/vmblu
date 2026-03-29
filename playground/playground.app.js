// ------------------------------------------------------------------
// Model: hv-layout
// Path: rubicon.app.js
// Creation date 3/22/2026, 10:02:56 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../runtime/src/scaffold.js"


//Imports
import { ApplicationLauncher } from './nodes/launcher/app-launcher.js'
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
		 TextBlockFactory,
		 DocumentSettingsFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 ConfirmBox } from '../ui-svelte/index.js'
import { Workspace } from './nodes/workspace/factory.js'
import { DocumentManager } from '../core/nodes/document-manager/document-manager.js'
import { ViewManager } from '../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../core/nodes/clipboard/clipboard.js'

//The runtime nodes
const nodeList = [
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "LBJD", 
	factory: ApplicationLauncher,
	inputs: [
		"-> run application",
		"-> size change",
		"-> show"
		],
	outputs: [
		"iframe -> ()"
		]
	},
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout", 
	uid: "mNSM", 
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (Xyuf)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "RiLG", 
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (mNSM)",
		"file.selected -> doc.selected @ document manager (zzNV)",
		"file.new -> doc.new @ document manager (zzNV)",
		"file.renamed -> doc.renamed @ document manager (zzNV)",
		"file.deleted -> doc.deleted @ document manager (zzNV)",
		"file.get name -> doc.get @ document manager (zzNV)",
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
	uid: "korn", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (RiLG)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "cyQT", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (RiLG)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page", 
	uid: "Xyuf", 
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
		"content size change -> size change @ view manager (GCqC)",
		"div -> main area @ column-main layout (mNSM)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "WdjG", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (Xyuf)",
		"tab.request to close -> tab.request to close @ document manager (zzNV)",
		"tab.request to select -> tab.request to select @ document manager (zzNV)"
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
	uid: "dkwf", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync -> sync links @ model manager (sTmW)",
		"accept changes -> accept changes @ model manager (sTmW)",
		"show settings -> show settings @ model manager (sTmW)",
		"make app -> make app @ model manager (sTmW)",
		"make lib -> make lib @ model manager (sTmW)",
		"set save point -> save point.set @ model manager (sTmW)",
		"back to save point -> save point.back @ model manager (sTmW)",
		"recalibrate -> recalibrate @ view manager (GCqC)",
		"grid on-off -> grid on-off @ view manager (GCqC)",
		"save -> model.save @ model manager (sTmW)",
		"save as -> file.save as @ document manager (zzNV)",
		"div -> menu div @ editor page (Xyuf)"
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
		        "message": "sync",
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
	uid: "zzNV", 
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
		"tab.new -> tab.new @ tab ribbon (WdjG)",
		"tab.rename -> tab.rename @ tab ribbon (WdjG)",
		"tab.select -> tab.select @ tab ribbon (WdjG)",
		"tab.remove -> tab.remove @ tab ribbon (WdjG)",
		`doc.set active -> [ 
			"top level view @ view manager (GCqC)",
			"model.set @ model manager (sTmW)" ]`,
		"file.save -> model.save @ model manager (sTmW)",
		"file.save as filename -> path @ path request (lFuG)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "GCqC", 
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
		"redox.doit -> redox.doit @ model manager (sTmW)",
		"redox.undo -> redox.undo @ model manager (sTmW)",
		"redox.redo -> redox.redo @ model manager (sTmW)",
		"canvas -> content div @ editor page (Xyuf)",
		"node settings (sx) -> json @ node settings (gLAY)",
		"runtime settings (dx) -> show @ runtime settings (KzeU)",
		"node prompt -> text @ text block (pvRg)",
		"context menu -> context menu @ context menu (rLto)",
		"name and path -> name and path @ name and path (LsAE)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (Nxyk)",
		"clipboard.set -> set @ clipboard (Nxyk)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "sTmW", 
	factory: ModelManager,
	inputs: [
		"-> sync links",
		"-> accept changes",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> reload model",
		"-> save point.set",
		"-> save point.back",
		"-> model.save",
		"-> model.set",
		"-> redox.doit",
		"-> redox.undo",
		"-> redox.redo"
		],
	outputs: [
		"save point.confirm -> show @ confirm box (kNeU)",
		"model.root -> root @ view manager (GCqC)",
		"model.header -> show @ doc settings (plkv)",
		"redox.done -> redox.done @ view manager (GCqC)",
		"pin profile -> show @ pin profile (XRgn)",
		"get path -> path @ path request (lFuG)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "Nxyk", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"-> switched",
		"=> local",
		"-> origin"
		],
	outputs: [
		"switch -> ()",
		"remote => ()"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "lFuG", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "gLAY", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "LsAE", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "XRgn", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "pvRg", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "plkv", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "rLto", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "KzeU", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "kNeU", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Xyuf)"
		]
	},
]

//The filters
const filterList = [
]

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList)

// and start the app
runtime.start()
