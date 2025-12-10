// ------------------------------------------------------------------
// Model: hv-layout
// Path: playground.js
// Creation date 12/5/2025, 10:01:14 AM
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
	uid: "HTvl", 
	factory: WorkspaceFactory,
	inputs: [
		"-> dom add modal div",
		"-> file savedAs",
		"-> file active",
		"-> file closed"
		],
	outputs: [
		"dom workspace div -> left column @ column-main layout (hJZm)",
		"file selected -> doc selected @ document manager (OZOv)",
		"file new -> doc new @ document manager (OZOv)",
		"file get name -> ()",
		"file context menu -> ()",
		"file renamed -> doc renamed @ document manager (OZOv)",
		"file deleted -> doc deleted @ document manager (OZOv)",
		"files get list => ()",
		"files selected -> ()",
		"files deleted -> ()",
		"folder context menu -> context menu @ context menu (Ibyq)",
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
	uid: "iETN", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (HTvl)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "Ibyq", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (HTvl)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "GpGM", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (HTvl)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "xIik", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab new",
		"-> tab rename",
		"-> tab select",
		"-> tab remove"
		],
	outputs: [
		"tab request to close -> tab request to close @ document manager (OZOv)",
		"tab request to select -> tab request to select @ document manager (OZOv)",
		"div -> tabs div @ vertical menu tabs content (bDhC)"
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
	uid: "WKrH", 
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
		"show lib path -> path @ path request (dNrl)",
		"show app path -> path @ path request (dNrl)",
		"run -> ()",
		"runtime settings -> show @ runtime settings (tHAO)",
		"open document -> doc open @ document manager (OZOv)",
		"document settings -> show @ doc settings (lQmu)",
		"save point confirm -> show @ confirm box (OUuy)",
		"show context menu -> context menu @ context menu (dnjx)",
		"settings -> json @ node settings (GXzC)",
		"show link -> name and path @ name and path (Qtip)",
		"show filter -> name and path @ name and path (Qtip)",
		"show factory -> name and path @ name and path (Qtip)",
		"show interface link -> ()",
		"open source file -> ()",
		"pin profile -> show @ pin profile (sEMC)",
		"node comment -> text @ text block (kBxa)",
		"select node -> show @ node selector (FHjI)",
		"change library -> switch library @ node library (aVRy)",
		"add lib file -> ()",
		"canvas -> content div @ vertical menu tabs content (bDhC)",
		"new edit -> ()",
		"clipboard get => get @ clipboard (hANA)",
		"clipboard set -> set @ clipboard (hANA)"
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
	uid: "dnjx", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "dNrl", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "GXzC", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "Qtip", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "sEMC", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "kBxa", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//__________________________________VERTICAL MENU TABS CONTENT
	{
	name: "vertical menu tabs content", 
	uid: "bDhC", 
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
		"content size change -> size change @ editor (WKrH)",
		"div -> main area @ column-main layout (hJZm)"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "OZOv", 
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
		"doc set active -> set document @ editor (WKrH)",
		"save as filename -> path @ path request (dNrl)",
		"open models -> ()",
		"tab new -> tab new @ tab ribbon (xIik)",
		"tab rename -> tab rename @ tab ribbon (xIik)",
		"tab select -> tab select @ tab ribbon (xIik)",
		"tab remove -> tab remove @ tab ribbon (xIik)"
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
	uid: "FHjI", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (WKrH)",
		"remove file -> remove file @ node library (aVRy)",
		"add file -> add file @ node library (aVRy)",
		"get path -> path @ path request (zvtb)",
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//________________________________________________NODE LIBRARY
	{
	name: "node library", 
	uid: "aVRy", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (FHjI)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "zvtb", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "lQmu", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "hANA", 
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
	uid: "OUuy", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "tHAO", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (bDhC)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "cebA", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ vertical menu tabs content (bDhC)",
		"sync -> sync model @ editor (WKrH)",
		"grid on-off -> grid on-off @ editor (WKrH)",
		"accept changes -> accept changes @ editor (WKrH)",
		"recalibrate -> recalibrate @ editor (WKrH)",
		"show settings -> show settings @ editor (WKrH)",
		"make lib -> make lib @ editor (WKrH)",
		"make app -> make app @ editor (WKrH)",
		"set save point -> save point set @ editor (WKrH)",
		"back to save point -> save point back @ editor (WKrH)"
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
	uid: "geAM", 
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
	uid: "hJZm", 
	factory: ColumnMainFactory,
	inputs: [
		"-> left column",
		"-> main area"
		],
	outputs: [
		"size change -> size change @ vertical menu tabs content (bDhC)"
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
