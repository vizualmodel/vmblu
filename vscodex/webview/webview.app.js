// ------------------------------------------------------------------
// Model: 
// Path: /c:/dev/vmblu/vscodex/webview/webview.app.js
// Creation date 4/22/2026, 10:22:08 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../../runtime/rt-base/scaffold.js"


//Imports
import { MessageBroker } from './message-broker.js'
import { ViewManager } from '../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../core/nodes/clipboard/clipboard.js'
import { PathRequestFactory,
		 JsonInputFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 TextBlockFactory,
		 DocumentSettingsFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 ConfirmBox,
		 VscodeSideMenuFactory } from '../../ui-svelte/index.js'

//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "KfeZ", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> open js file",
		"=> folder.get",
		"-> canvas",
		"-> floating menu",
		"-> modal div",
		"=> clipboard.remote",
		"-> clipboard.switch"
		],
	outputs: [
		`set document -> [ 
			"top level view @ view manager (ERip)",
			"model.set @ model manager (aaPU)" ]`,
		"get document -> ()",
		"reload model -> ()",
		"model.save -> model.save @ model manager (aaPU)",
		"sync links -> sync links @ model manager (aaPU)",
		"canvas resize -> size change @ view manager (ERip)",
		"clipboard.local => local @ clipboard (HHsC)",
		"clipboard.switched -> switched @ clipboard (HHsC)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "ERip", 
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> recalibrate",
		"-> top level view",
		"-> grid on-off",
		"-> size change"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (aaPU)",
		"redox.undo -> redox.undo @ model manager (aaPU)",
		"redox.redo -> redox.redo @ model manager (aaPU)",
		"canvas -> canvas @ message broker (KfeZ)",
		"node settings (sx) -> json @ node settings (zWpr)",
		"runtime settings (dx) -> show @ runtime settings (rqQG)",
		"node prompt -> text @ text block (mpyA)",
		"context menu -> context menu @ context menu (gVlR)",
		"name and path -> name and path @ name and path (ijMs)",
		"open model -> open document @ message broker (KfeZ)",
		"open source file -> open js file @ message broker (KfeZ)",
		"clipboard.get => get @ clipboard (HHsC)",
		"clipboard.set -> set @ clipboard (HHsC)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "aaPU", 
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
		"save point.confirm -> show @ confirm box (xfnG)",
		"open source file -> open js file @ message broker (KfeZ)",
		"open model -> ()",
		"model.root -> root @ view manager (ERip)",
		"model.header -> show @ doc settings (GzCM)",
		`redox.done -> [ 
			"redox.done @ view manager (ERip)",
			"new edit @ message broker (KfeZ)" ]`,
		"pin profile -> show @ pin profile (KoSl)",
		"get path -> path @ path request (HjYF)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "HHsC", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (KfeZ)",
		"switch -> clipboard.switch @ message broker (KfeZ)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "HjYF", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (KfeZ)",
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "zWpr", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "ijMs", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)",
		"folder.get => folder.get @ message broker (KfeZ)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "KoSl", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "mpyA", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "GzCM", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "gVlR", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "rqQG", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "xfnG", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KfeZ)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "iwYL", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (KfeZ)",
		"sync -> sync links @ model manager (aaPU)",
		"accept changes -> accept changes @ model manager (aaPU)",
		"show settings -> show settings @ model manager (aaPU)",
		"make app -> make app @ model manager (aaPU)",
		"make lib -> make lib @ model manager (aaPU)",
		"set save point -> save point.set @ model manager (aaPU)",
		"back to save point -> save point.back @ model manager (aaPU)",
		"recalibrate -> recalibrate @ view manager (ERip)",
		"grid on-off -> grid on-off @ view manager (ERip)"
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
]

//The filters
const filterList = [
]

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList)

// and start the app
runtime.start()
