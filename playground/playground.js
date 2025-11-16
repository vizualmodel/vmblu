// ------------------------------------------------------------------
// Model: hv-layout
// Path: playground.js
// Creation date 11/14/2025, 8:33:09 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../runtime/src/scaffold.js"


//Imports
import { WorkspaceFactory } from './workspace/index.js'
import { SingleTextFieldFactory,
		 ContextMenuFactory,
		 MessageBoxFactory,
		 TabRibbonFactory,
		 PathRequestFactory,
		 JsonInputFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 TextBlockFactory,
		 VerticalMenuTabsContent,
		 NodeSelectorFactory,
		 DocumentSettingsFactory,
		 ConfirmBox,
		 RuntimeSettingsFactory,
		 VscodeSideMenuFactory,
		 ColumnMainFactory } from '../ui/index.js'
import { EditorFactory,
		 DocumentManager,
		 LibraryManager,
		 Clipboard } from '../core/index.js'
import { ApplicationLauncher } from './launcher/app-launcher.js'

//The runtime nodes
const nodeList = [
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "tbvB", 
	factory: WorkspaceFactory,
	inputs: [
		"-> dom add modal div",
		"-> file savedAs",
		"-> file active",
		"-> file closed"
		],
	outputs: [
		"dom workspace div -> left column @ column-main layout (lHKr)",
		"file selected -> doc selected @ document manager (aXkx)",
		"file new -> doc new @ document manager (aXkx)",
		"file get name -> ()",
		"file context menu -> ()",
		"file renamed -> doc renamed @ document manager (aXkx)",
		"file deleted -> doc deleted @ document manager (aXkx)",
		"files get list => ()",
		"files selected -> ()",
		"files deleted -> ()",
		"folder context menu -> context menu @ context menu (QNIy)",
		"folder renamed -> ()",
		"folder deleted -> ()",
		"drawer get location -> ()"
		],
	sx:	{
		    "name": "examples",
		    "files": [],
		    "folders": [
		        {
		            "name": "tutorial",
		            "files": [
		                {
		                    "name": "chat-client.vmblu"
		                },
		                {
		                    "name": "chat-server.vmblu"
		                }
		            ]
		        }
		    ]
		}
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field", 
	uid: "GPqX", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (tbvB)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "QNIy", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (tbvB)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "jsOb", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (tbvB)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "TWJF", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab new",
		"-> tab rename",
		"-> tab select",
		"-> tab remove"
		],
	outputs: [
		"div -> tabs div @ vertical menu tabs content (mOrg)",
		"tab request to close -> tab request to close @ document manager (aXkx)",
		"tab request to select -> tab request to select @ document manager (aXkx)"
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
	//______________________________________________________EDITOR
	{
	name: "editor", 
	uid: "NREV", 
	factory: EditorFactory,
	inputs: [
		"-> sync model",
		"-> grid on-off",
		"-> accept changes",
		"-> recalibrate",
		"-> show settings",
		"-> make lib",
		"-> make app",
		"-> run app",
		"-> run app in iframe",
		"-> set document",
		"-> save point set",
		"-> save point back",
		"-> selected node",
		"-> size change"
		],
	outputs: [
		"show lib path -> path @ path request (kWLQ)",
		"show app path -> path @ path request (kWLQ)",
		"run -> ()",
		"runtime settings -> show @ runtime settings (uQfg)",
		"open document -> doc open @ document manager (aXkx)",
		"document settings -> show @ doc settings (yugd)",
		"save point confirm -> show @ confirm box (IwRp)",
		"show context menu -> context menu @ context menu (fnKV)",
		"settings -> json @ node settings (gBrM)",
		"show link -> name and path @ name and path (qluS)",
		"show filter -> name and path @ name and path (qluS)",
		"show factory -> name and path @ name and path (qluS)",
		"open source file -> ()",
		"pin profile -> show @ pin profile (ZGxL)",
		"node comment -> text @ text block (gLsX)",
		"select node -> show @ node selector (WRDh)",
		"change library -> switch library @ node library (LBtK)",
		"add lib file -> ()",
		"canvas -> content div @ vertical menu tabs content (mOrg)",
		"new edit -> ()",
		"clipboard get => get @ clipboard (umgQ)",
		"clipboard set -> set @ clipboard (umgQ)"
		],
	sx:	{
		    "a": 7,
		    "b": 8,
		    "c": 9
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "fnKV", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "kWLQ", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "gBrM", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "qluS", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "ZGxL", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "gLsX", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//__________________________________VERTICAL MENU TABS CONTENT
	{
	name: "vertical menu tabs content", 
	uid: "mOrg", 
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
		"content size change -> size change @ editor (NREV)",
		"div -> main area @ column-main layout (lHKr)"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "aXkx", 
	factory: DocumentManager,
	inputs: [
		"-> doc selected",
		"-> doc new",
		"-> doc renamed",
		"-> doc deleted",
		"-> doc get",
		"-> doc open",
		"-> save",
		"-> save as",
		"-> save all",
		"-> get open models",
		"-> tab request to close",
		"-> tab request to select"
		],
	outputs: [
		"doc set active -> set document @ editor (NREV)",
		"save as filename -> path @ path request (kWLQ)",
		"open models -> ()",
		"tab new -> tab new @ tab ribbon (TWJF)",
		"tab rename -> tab rename @ tab ribbon (TWJF)",
		"tab select -> tab select @ tab ribbon (TWJF)",
		"tab remove -> tab remove @ tab ribbon (TWJF)"
		],
	dx:	{
		    "logMessages": false,
		    "worker": {
		        "on": false,
		        "path": ""
		    }
		}
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "WRDh", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (NREV)",
		"remove file -> remove file @ node library (LBtK)",
		"add file -> add file @ node library (LBtK)",
		"get path -> path @ path request (oVjH)",
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//________________________________________________NODE LIBRARY
	{
	name: "node library", 
	uid: "LBtK", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (WRDh)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "oVjH", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "yugd", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "umgQ", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"=> get",
		"-> set"
		],
	outputs: [
		"switch -> ()",
		"remote => ()"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "IwRp", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "uQfg", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (mOrg)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "osSD", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ vertical menu tabs content (mOrg)",
		"sync -> sync model @ editor (NREV)",
		"grid on-off -> grid on-off @ editor (NREV)",
		"accept changes -> accept changes @ editor (NREV)",
		"recalibrate -> recalibrate @ editor (NREV)",
		"show settings -> show settings @ editor (NREV)",
		"make lib -> make lib @ editor (NREV)",
		"make app -> make app @ editor (NREV)",
		"set save point -> save point set @ editor (NREV)",
		"back to save point -> save point back @ editor (NREV)"
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
		    }
		]
	},
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "XUOo", 
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
	uid: "lHKr", 
	factory: ColumnMainFactory,
	inputs: [
		"-> left column",
		"-> main area"
		],
	outputs: [
		"size change -> size change @ vertical menu tabs content (mOrg)"
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
