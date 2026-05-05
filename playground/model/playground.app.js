// ------------------------------------------------------------------
// Model: hv-layout
// Path: C:/dev/vmblu/playground/model/playground.app.js
// Creation date 5/4/2026, 10:40:08 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "@vizualmodel/vmblu-runtime/rt-agent"

//Imports
import { ApplicationLauncher } from '../nodes/launcher/app-launcher.js'
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
		 ConfirmBox,
		 PinToolFactory,
		 PinEventFactory } from '../../ui-svelte/index.js'
import { Workspace } from '../nodes/workspace/factory.js'
import { DocumentManager } from '../../core/nodes/document-manager/document-manager.js'
import { ViewManager } from '../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../core/nodes/clipboard/clipboard.js'

//The runtime nodes
const nodeList = [
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "UefM", 
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
	uid: "myNZ", 
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (Vgge)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "nySn", 
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (myNZ)",
		"file.selected -> doc.selected @ document manager (XQQJ)",
		"file.new -> doc.new @ document manager (XQQJ)",
		"file.renamed -> doc.renamed @ document manager (XQQJ)",
		"file.deleted -> doc.deleted @ document manager (XQQJ)",
		"file.get name -> doc.get @ document manager (XQQJ)",
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
	uid: "PnrW", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (nySn)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "Mvmu", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (nySn)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page", 
	uid: "Vgge", 
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
		"content size change -> size change @ view manager (upjX)",
		"div -> main area @ column-main layout (myNZ)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "RjOk", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (Vgge)",
		"tab.request to close -> tab.request to close @ document manager (XQQJ)",
		"tab.request to select -> tab.request to select @ document manager (XQQJ)"
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
	uid: "sCSe", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync -> sync links @ model manager (xyDU)",
		"accept changes -> accept changes @ model manager (xyDU)",
		"show settings -> show settings @ model manager (xyDU)",
		"make app -> make app @ model manager (xyDU)",
		"make lib -> make lib @ model manager (xyDU)",
		"set save point -> save point.set @ model manager (xyDU)",
		"back to save point -> save point.back @ model manager (xyDU)",
		"recalibrate -> recalibrate @ view manager (upjX)",
		"grid on-off -> grid on-off @ view manager (upjX)",
		"save -> model.save @ model manager (xyDU)",
		"save as -> file.save as @ document manager (XQQJ)",
		"div -> menu div @ editor page (Vgge)"
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
	uid: "XQQJ", 
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
		"tab.new -> tab.new @ tab ribbon (RjOk)",
		"tab.rename -> tab.rename @ tab ribbon (RjOk)",
		"tab.select -> tab.select @ tab ribbon (RjOk)",
		"tab.remove -> tab.remove @ tab ribbon (RjOk)",
		`doc.set active -> [ 
			"top level view @ view manager (upjX)",
			"model.set @ model manager (xyDU)" ]`,
		"file.save -> model.save @ model manager (xyDU)",
		"file.save as filename -> path @ path request (nfLN)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "upjX", 
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
		"redox.doit -> redox.doit @ model manager (xyDU)",
		"redox.undo -> redox.undo @ model manager (xyDU)",
		"redox.redo -> redox.redo @ model manager (xyDU)",
		"canvas -> content div @ editor page (Vgge)",
		"node settings (sx) -> json @ node settings (KbNu)",
		"runtime settings (dx) -> show @ runtime settings (ckuq)",
		"node prompt -> text @ text block (ywpC)",
		"context menu -> context menu @ context menu (PxQh)",
		"name and path -> name and path @ name and path (SZzb)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (qKcm)",
		"clipboard.set -> set @ clipboard (qKcm)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "xyDU", 
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
		"save point.confirm -> show @ confirm box (KABe)",
		"model.root -> root @ view manager (upjX)",
		"model.header -> show @ doc settings (xxhH)",
		"redox.done -> redox.done @ view manager (upjX)",
		"event settings -> show @ event settings (sHmf)",
		"tool settings -> show @ tool settings (nDbw)",
		"pin profile -> show @ pin profile (pSFT)",
		"get path -> path @ path request (nfLN)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "qKcm", 
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
	uid: "nfLN", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (nySn)",
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "KbNu", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "SZzb", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)",
		"folder.get => folder.get @ workspace (nySn)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "pSFT", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "ywpC", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "xxhH", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "PxQh", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "ckuq", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "KABe", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "nDbw", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "sHmf", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (Vgge)"
		]
	},
]

//The filters
const filterList = [
]

// Agent runtime options
const agentRuntimeOptions = {
    "capabilities": {
        "schema": "https://vmblu.dev/schemas/capabilities.v1.json",
        "version": 1,
        "application": {
            "id": "hv-layout",
            "title": "hv-layout",
            "description": "hv-layout application."
        },
        "tools": [],
        "probes": [],
        "events": [],
        "policies": {
            "defaultApproval": "never"
        },
        "usageGuidance": {
            "principles": [
                "Use tools to change application state.",
                "Use probes to verify effects.",
                "Use events for asynchronous observations.",
                "Do not assume that a tool call succeeded unless a result, probe, or event confirms it."
            ]
        }
    }
}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList, agentRuntimeOptions)

// and start the app
runtime.start()
