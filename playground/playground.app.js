// ------------------------------------------------------------------
// Model: hv-layout
// Path: C:/dev/vmblu/playground/playground.app.js
// Creation date 1/29/2026, 6:26:36 PM
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
	uid: "acWd", 
	factory: WorkspaceFactory,
	inputs: [
		"-> dom add modal div",
		"-> file savedAs",
		"-> file active",
		"-> file closed"
		],
	outputs: [
		"dom workspace div -> left column @ column-main layout (YuSA)",
		"file selected -> doc selected @ document manager (iutz)",
		"file new -> doc new @ document manager (iutz)",
		"file get name -> ()",
		"file context menu -> ()",
		"file renamed -> doc renamed @ document manager (iutz)",
		"file deleted -> doc deleted @ document manager (iutz)",
		"files get list => ()",
		"files selected -> ()",
		"files deleted -> ()",
		"folder context menu -> context menu @ context menu (iIiu)",
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
	uid: "wTTX", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (acWd)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "iIiu", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (acWd)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "vkIw", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (acWd)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "kpwI", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab new",
		"-> tab rename",
		"-> tab select",
		"-> tab remove"
		],
	outputs: [
		"tab request to close -> tab request to close @ document manager (iutz)",
		"tab request to select -> tab request to select @ document manager (iutz)",
		"div -> tabs div @ vertical menu tabs content (JRaD)"
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
	uid: "mink", 
	factory: EditorFactory,
	inputs: [
		"-> reload model",
		"-> sync links",
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
		"show lib path -> path @ path request (szaZ)",
		"show app path -> path @ path request (szaZ)",
		"run -> ()",
		"runtime settings -> show @ runtime settings (WFIy)",
		"open document -> doc open @ document manager (iutz)",
		"document settings -> show @ doc settings (pVRb)",
		"save point confirm -> show @ confirm box (CNCg)",
		"show context menu -> context menu @ context menu (idsl)",
		"settings -> json @ node settings (xNnz)",
		"show filter -> name and path @ name and path (XasE)",
		"show link -> name and path @ name and path (XasE)",
		"show factory -> name and path @ name and path (XasE)",
		"open source file -> ()",
		"pin profile -> show @ pin profile (KuBN)",
		"node comment -> text @ text block (DPyA)",
		"select node -> show @ node selector (bbxs)",
		"change library -> switch library @ node library (joDN)",
		"add lib file -> ()",
		"canvas -> content div @ vertical menu tabs content (JRaD)",
		"new edit -> ()",
		"clipboard get => get @ clipboard (jgjD)",
		"clipboard set -> set @ clipboard (jgjD)"
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
	uid: "idsl", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "szaZ", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "xNnz", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "XasE", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "KuBN", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "DPyA", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//__________________________________VERTICAL MENU TABS CONTENT
	{
	name: "vertical menu tabs content", 
	uid: "JRaD", 
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
		"content size change -> size change @ editor (mink)",
		"div -> main area @ column-main layout (YuSA)"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "iutz", 
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
		"doc set active -> set document @ editor (mink)",
		"save as filename -> path @ path request (szaZ)",
		"open models -> ()",
		"tab new -> tab new @ tab ribbon (kpwI)",
		"tab rename -> tab rename @ tab ribbon (kpwI)",
		"tab select -> tab select @ tab ribbon (kpwI)",
		"tab remove -> tab remove @ tab ribbon (kpwI)"
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
	uid: "bbxs", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (mink)",
		"remove file -> remove file @ node library (joDN)",
		"add file -> add file @ node library (joDN)",
		"get path -> path @ path request (HjlQ)",
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//________________________________________________NODE LIBRARY
	{
	name: "node library", 
	uid: "joDN", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (bbxs)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "HjlQ", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "pVRb", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "jgjD", 
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
	uid: "CNCg", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "WFIy", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (JRaD)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "HXPz", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ vertical menu tabs content (JRaD)",
		"sync -> sync links @ editor (mink)",
		"grid on-off -> grid on-off @ editor (mink)",
		"accept changes -> accept changes @ editor (mink)",
		"recalibrate -> recalibrate @ editor (mink)",
		"show settings -> show settings @ editor (mink)",
		"make lib -> make lib @ editor (mink)",
		"make app -> make app @ editor (mink)",
		"set save point -> save point set @ editor (mink)",
		"back to save point -> save point back @ editor (mink)",
		"save -> save @ document manager (iutz)",
		"save as -> save as @ document manager (iutz)"
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
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "wltk", 
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
	uid: "YuSA", 
	factory: ColumnMainFactory,
	inputs: [
		"-> left column",
		"-> main area"
		],
	outputs: [
		"size change -> size change @ vertical menu tabs content (JRaD)"
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
