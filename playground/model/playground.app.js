// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.2","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.2"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:7241b78702f73dca"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-browser-agent"


//Imports
import { ColumnMainFactory,
		 SingleTextFieldFactory,
		 VerticalMenuTabsContent,
		 TabRibbonFactory,
		 VscodeSideMenuFactory,
		 ApplicationInspectorFactory,
		 EndpointInspectorFactory,
		 ConnectionInspectorFactory,
		 ProjectReferencesFactory,
		 PathRequestFactory,
		 NodeSettingsFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 DocumentSettingsFactory,
		 TeamSettingsFactory,
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
import { TextEditor } from '../nodes/text-editor/text-editor.js'
import { ModelPane } from '../nodes/model-pane/model-pane.js'
import { DocumentManager } from '../../core/nodes/document-manager/document-manager.js'
import { ViewManager } from '../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../core/nodes/clipboard/clipboard.js'
import { SysbluView } from '../../sysblu/nodes/sysblu-view/sysblu-view.js'
import { SysbluManager } from '../../sysblu/nodes/sysblu-manager/sysblu-manager.js'

// Runtime sidecars
import capabilities from './playground.cap.json' with { type: 'json' }
import agent from './playground.agent.json' with { type: 'json' }

//The runtime nodes
const nodeList = [
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout",
	uid: "QBOL",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (QceR)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "uwus",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (QBOL)",
		"file.selected -> file.selected @ document manager (NRQG)",
		"file.new -> file.new @ document manager (NRQG)",
		"file.renamed -> file.renamed @ document manager (NRQG)",
		"file.deleted -> file.deleted @ document manager (NRQG)",
		"file.get name -> file.get @ document manager (NRQG)",
		"file.context menu -> ()",
		"files.get list => ()",
		"files.selected -> ()",
		"files.deleted -> ()",
		"folder.context menu -> ()",
		"folder.renamed -> ()",
		"folder.deleted -> ()"
		],
	sx:	{
		    "remote": {
		        "kind": "github",
		        "owner": "vizualmodel",
		        "repository": "vmblu-tutorials",
		        "ref": "main",
		        "label": "Tutorials",
		        "readOnly": true
		    }
		}
	},
	//_________________________________________________TEXT EDITOR
	{
	name: "text editor",
	uid: "TXiA",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"text.failed -> text.failed @ document manager (NRQG)",
		"text.loaded -> text.loaded @ document manager (NRQG)",
		"content div -> content.div @ editor page (QceR)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "yPNi",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (uwus)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "DVHJ",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (QceR)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "QceR",
	factory: VerticalMenuTabsContent,
	inputs: [
		"-> tabs div",
		"-> modal div",
		"-> size change",
		"-> show",
		"-> content.div",
		"-> content.failed",
		"-> content.loaded",
		"-> content.loading"
		],
	outputs: [
		"div -> main area @ column-main layout (QBOL)",
		`content.size change -> [ 
			"size change @ view manager (kzin)",
			"size change @ sysblu view (majG)" ]`
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "lZDs",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (QceR)",
		"tab.request to close -> tab.request to close @ document manager (NRQG)",
		"tab.request to select -> tab.request to select @ document manager (NRQG)"
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
	uid: "ZOII",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (ZDjq)",
		"accept changes -> accept changes @ model manager (ZDjq)",
		"wire check -> wire check @ model manager (ZDjq)",
		"show settings -> show settings @ model manager (ZDjq)",
		"make app -> make app @ model manager (ZDjq)",
		"make lib -> make lib @ model manager (ZDjq)",
		"set save point -> save point.set @ model manager (ZDjq)",
		"back to save point -> save point.back @ model manager (ZDjq)",
		"recalibrate -> recalibrate @ view manager (kzin)",
		"grid on-off -> grid on-off @ view manager (kzin)",
		"application prompt -> application prompt @ view manager (kzin)",
		`save -> [ 
			"model.save @ model manager (ZDjq)",
			"file.save active @ document manager (NRQG)" ]`,
		"save as -> file.save as @ document manager (NRQG)",
		"div -> menu div @ model pane (DVHJ)"
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
	uid: "NRQG",
	factory: DocumentManager,
	inputs: [
		"-> tab.request to close",
		"-> tab.request to select",
		"-> file.selected",
		"-> file.new",
		"-> file.renamed",
		"-> file.deleted",
		"-> file.get",
		"-> file.open",
		"-> file.save active",
		"-> file.save as",
		"-> model.loaded",
		"-> model.failed",
		"-> sysblu.loaded",
		"-> sysblu.failed",
		"-> text.loaded",
		"-> text.failed"
		],
	outputs: [
		"tab.new -> tab.new @ tab ribbon (lZDs)",
		"tab.rename -> tab.rename @ tab ribbon (lZDs)",
		"tab.select -> tab.select @ tab ribbon (lZDs)",
		"tab.remove -> tab.remove @ tab ribbon (lZDs)",
		"file.save as filename -> path @ path request (SuLX)",
		"file.save all -> ()",
		"file.loading -> content.loading @ editor page (QceR)",
		"file.loaded -> content.loaded @ editor page (QceR)",
		"file.failed -> content.failed @ editor page (QceR)",
		`model.set active -> [ 
			"top level view @ view manager (kzin)",
			"model.set @ model manager (ZDjq)" ]`,
		"model.save -> model.save @ model manager (ZDjq)",
		"sysblu.save -> sysblu.save @ sysblu manager (wSGc)",
		"sysblu.set active -> sysblu.set @ sysblu manager (wSGc)",
		"text.save -> text.save @ text editor (TXiA)",
		"text.set active -> text.set active @ text editor (TXiA)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "kzin",
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> top level view",
		"-> recalibrate",
		"-> grid on-off",
		"-> application prompt",
		"-> size change"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (ZDjq)",
		"redox.undo -> redox.undo @ model manager (ZDjq)",
		"redox.redo -> redox.redo @ model manager (ZDjq)",
		"team legend -> teams @ team legend (wzzU)",
		"canvas -> canvas @ model pane (DVHJ)",
		"node settings (sx) -> show @ node settings (qOns)",
		"runtime settings (dx) -> show @ runtime settings (hJJK)",
		"node prompt -> markdown @ markdown input (mTQU)",
		"context menu -> context menu @ context menu (bcVx)",
		"name and path -> name and path @ name and path (IMpt)",
		"open source file -> file.open @ document manager (NRQG)",
		"open model -> file.open @ document manager (NRQG)",
		"clipboard.get => get @ clipboard (sbbq)",
		"clipboard.set -> set @ clipboard (sbbq)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "ZDjq",
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> auto layout",
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
		"save point.confirm -> show @ confirm box (fZnQ)",
		"model.root -> root @ view manager (kzin)",
		"model.header -> show @ doc settings (EbMk)",
		"model.loaded -> model.loaded @ document manager (NRQG)",
		"model.failed -> model.failed @ document manager (NRQG)",
		"redox.done -> redox.done @ view manager (kzin)",
		"event settings -> show @ event settings (lceO)",
		"tool settings -> show @ tool settings (yAwB)",
		"pin profile -> show @ pin profile (tSdq)",
		"info popup -> show @ toast box (iHsS)",
		"get path -> path @ path request (SuLX)",
		"open source file -> file.open @ document manager (NRQG)",
		"open model -> file.open @ document manager (NRQG)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "sbbq",
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
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "majG",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ sysblu pane (pJyV)",
		"application settings -> application settings @ application inspector (OgwI)",
		"endpoint settings -> endpoint settings @ endpoint inspector (Qjvb)",
		"connection settings -> connection settings @ connection inspector (zyTT)",
		"project references -> project references @ project references (RdAU)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (wSGc)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (wSGc)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (wSGc)",
		"open reference -> file.open @ document manager (NRQG)",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "wSGc",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ document manager (NRQG)",
		"sysblu.failed -> sysblu.failed @ document manager (NRQG)",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (majG)",
		"sysmod.done -> sysmod.done @ sysblu view (majG)"
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "OgwI",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "Qjvb",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "zyTT",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "RdAU",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "SuLX",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)",
		"folder.get => folder.get @ workspace (uwus)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "qOns",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "IMpt",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (uwus)",
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "tSdq",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (mTQU)",
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "mTQU",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "EbMk",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)",
		"team settings -> show @ team settings (HZuy)",
		"agent settings -> show @ agent settings (KUpi)",
		"model runtime settings -> show @ model runtime settings (NQji)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "HZuy",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "NQji",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "KUpi",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "bcVx",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (fZnQ)",
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "hJJK",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "fZnQ",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "yAwB",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "lceO",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "iHsS",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (QceR)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "wzzU",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (DVHJ)"
		]
	},
	//_________________________________________________SYSBLU PANE
	{
	name: "sysblu pane",
	uid: "pJyV",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (QceR)"
		]
	},
	//_________________________________________________SYSBLU MENU
	{
	name: "sysblu menu",
	uid: "xmRQ",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ sysblu pane (pJyV)",
		"save -> file.save active @ document manager (NRQG)",
		"application prompt -> application prompt @ sysblu view (majG)",
		"add application -> add application @ sysblu view (majG)"
		],
	sx:	[
		    {
		        "icon": "add_box",
		        "color": "#0fb2e4",
		        "message": "add application",
		        "help": "Add application"
		    },
		    {
		        "icon": "folder_open",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Project references"
		    },
		    {
		        "icon": "save",
		        "color": "#0fb2e4",
		        "message": "save",
		        "help": "Save system"
		    }
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.2","schemaVersion":"1.12.2"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
