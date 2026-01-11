// ------------------------------------------------------------------
// Model: hv-layout
// Path: playground.js
// Creation date 12/12/2025, 10:57:52 AM
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
	uid: "CyUX", 
	factory: WorkspaceFactory,
	inputs: [
		"-> dom add modal div",
		"-> file savedAs",
		"-> file active",
		"-> file closed"
		],
	outputs: [
		"dom workspace div -> left column @ column-main layout (hCIa)",
		"file selected -> doc selected @ document manager (boaB)",
		"file new -> doc new @ document manager (boaB)",
		"file get name -> ()",
		"file context menu -> ()",
		"file renamed -> doc renamed @ document manager (boaB)",
		"file deleted -> doc deleted @ document manager (boaB)",
		"files get list => ()",
		"files selected -> ()",
		"files deleted -> ()",
		"folder context menu -> context menu @ context menu (SlxZ)",
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
	uid: "TOwd", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (CyUX)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "SlxZ", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (CyUX)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "VXFB", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (CyUX)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "pZkU", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab new",
		"-> tab rename",
		"-> tab select",
		"-> tab remove"
		],
	outputs: [
		"tab request to close -> tab request to close @ document manager (boaB)",
		"tab request to select -> tab request to select @ document manager (boaB)",
		"div -> tabs div @ vertical menu tabs content (WcXX)"
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
	uid: "JUfI", 
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
		"show lib path -> path @ path request (eUAC)",
		"show app path -> path @ path request (eUAC)",
		"run -> ()",
		"runtime settings -> show @ runtime settings (vsOX)",
		"open document -> doc open @ document manager (boaB)",
		"document settings -> show @ doc settings (fIor)",
		"save point confirm -> show @ confirm box (Vimv)",
		"show context menu -> context menu @ context menu (whob)",
		"settings -> json @ node settings (zQNk)",
		"show link -> name and path @ name and path (qCkB)",
		"show filter -> name and path @ name and path (qCkB)",
		"show factory -> name and path @ name and path (qCkB)",
		"open source file -> ()",
		"pin profile -> show @ pin profile (LfmT)",
		"node comment -> text @ text block (Hpef)",
		"select node -> show @ node selector (gvGa)",
		"change library -> switch library @ node library (DZCu)",
		"add lib file -> ()",
		"canvas -> content div @ vertical menu tabs content (WcXX)",
		"new edit -> ()",
		"clipboard get => get @ clipboard (DdNx)",
		"clipboard set -> set @ clipboard (DdNx)"
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
	uid: "whob", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "eUAC", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "zQNk", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "qCkB", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "LfmT", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "Hpef", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//__________________________________VERTICAL MENU TABS CONTENT
	{
	name: "vertical menu tabs content", 
	uid: "WcXX", 
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
		"content size change -> size change @ editor (JUfI)",
		"div -> main area @ column-main layout (hCIa)"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "boaB", 
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
		"doc set active -> set document @ editor (JUfI)",
		"save as filename -> path @ path request (eUAC)",
		"open models -> ()",
		"tab new -> tab new @ tab ribbon (pZkU)",
		"tab rename -> tab rename @ tab ribbon (pZkU)",
		"tab select -> tab select @ tab ribbon (pZkU)",
		"tab remove -> tab remove @ tab ribbon (pZkU)"
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
	uid: "gvGa", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (JUfI)",
		"remove file -> remove file @ node library (DZCu)",
		"add file -> add file @ node library (DZCu)",
		"get path -> path @ path request (xqVh)",
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//________________________________________________NODE LIBRARY
	{
	name: "node library", 
	uid: "DZCu", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (gvGa)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "xqVh", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "fIor", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "DdNx", 
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
	uid: "Vimv", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "vsOX", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ vertical menu tabs content (WcXX)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "Xnvn", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ vertical menu tabs content (WcXX)",
		"sync -> sync model @ editor (JUfI)",
		"grid on-off -> grid on-off @ editor (JUfI)",
		"accept changes -> accept changes @ editor (JUfI)",
		"recalibrate -> recalibrate @ editor (JUfI)",
		"show settings -> show settings @ editor (JUfI)",
		"make lib -> make lib @ editor (JUfI)",
		"make app -> make app @ editor (JUfI)",
		"set save point -> save point set @ editor (JUfI)",
		"back to save point -> save point back @ editor (JUfI)",
		"save -> save @ document manager (boaB)",
		"save as -> save as @ document manager (boaB)"
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
	uid: "DbDQ", 
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
	uid: "hCIa", 
	factory: ColumnMainFactory,
	inputs: [
		"-> left column",
		"-> main area"
		],
	outputs: [
		"size change -> size change @ vertical menu tabs content (WcXX)"
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
