// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.1","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.1"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:701f9978b3040a26"}}
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
	uid: "ZALI",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (MHrK)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "zqmm",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (ZALI)",
		"file.selected -> file.selected @ document manager (kkOo)",
		"file.new -> file.new @ document manager (kkOo)",
		"file.renamed -> file.renamed @ document manager (kkOo)",
		"file.deleted -> file.deleted @ document manager (kkOo)",
		"file.get name -> file.get @ document manager (kkOo)",
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
		        "repository": "vmblu-examples",
		        "ref": "main",
		        "label": "Examples",
		        "readOnly": true
		    }
		}
	},
	//_________________________________________________TEXT EDITOR
	{
	name: "text editor",
	uid: "lQBO",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"text.failed -> text.failed @ document manager (kkOo)",
		"text.loaded -> text.loaded @ document manager (kkOo)",
		"content div -> content.div @ editor page (MHrK)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "XGFl",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (zqmm)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "rOVx",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (MHrK)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "MHrK",
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
		"div -> main area @ column-main layout (ZALI)",
		`content.size change -> [ 
			"size change @ view manager (kQwu)",
			"size change @ sysblu view (GrAs)" ]`
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "mcTR",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (MHrK)",
		"tab.request to close -> tab.request to close @ document manager (kkOo)",
		"tab.request to select -> tab.request to select @ document manager (kkOo)"
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
	uid: "EBmh",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (BEPE)",
		"accept changes -> accept changes @ model manager (BEPE)",
		"wire check -> wire check @ model manager (BEPE)",
		"show settings -> show settings @ model manager (BEPE)",
		"make app -> make app @ model manager (BEPE)",
		"make lib -> make lib @ model manager (BEPE)",
		"set save point -> save point.set @ model manager (BEPE)",
		"back to save point -> save point.back @ model manager (BEPE)",
		"recalibrate -> recalibrate @ view manager (kQwu)",
		"grid on-off -> grid on-off @ view manager (kQwu)",
		"application prompt -> application prompt @ view manager (kQwu)",
		`save -> [ 
			"model.save @ model manager (BEPE)",
			"file.save active @ document manager (kkOo)" ]`,
		"save as -> file.save as @ document manager (kkOo)",
		"div -> menu div @ model pane (rOVx)"
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
	uid: "kkOo",
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
		"tab.new -> tab.new @ tab ribbon (mcTR)",
		"tab.rename -> tab.rename @ tab ribbon (mcTR)",
		"tab.select -> tab.select @ tab ribbon (mcTR)",
		"tab.remove -> tab.remove @ tab ribbon (mcTR)",
		"file.save as filename -> path @ path request (hKZU)",
		"file.save all -> ()",
		"file.loading -> content.loading @ editor page (MHrK)",
		"file.loaded -> content.loaded @ editor page (MHrK)",
		"file.failed -> content.failed @ editor page (MHrK)",
		`model.set active -> [ 
			"top level view @ view manager (kQwu)",
			"model.set @ model manager (BEPE)" ]`,
		"model.save -> model.save @ model manager (BEPE)",
		"sysblu.save -> sysblu.save @ sysblu manager (PDMH)",
		"sysblu.set active -> sysblu.set @ sysblu manager (PDMH)",
		"text.save -> text.save @ text editor (lQBO)",
		"text.set active -> text.set active @ text editor (lQBO)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "kQwu",
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
		"redox.doit -> redox.doit @ model manager (BEPE)",
		"redox.undo -> redox.undo @ model manager (BEPE)",
		"redox.redo -> redox.redo @ model manager (BEPE)",
		"team legend -> teams @ team legend (ChjH)",
		"canvas -> canvas @ model pane (rOVx)",
		"node settings (sx) -> show @ node settings (tasM)",
		"runtime settings (dx) -> show @ runtime settings (lfrm)",
		"node prompt -> markdown @ markdown input (UyER)",
		"context menu -> context menu @ context menu (KKTo)",
		"name and path -> name and path @ name and path (esGA)",
		"open source file -> file.open @ document manager (kkOo)",
		"open model -> file.open @ document manager (kkOo)",
		"clipboard.get => get @ clipboard (DuMl)",
		"clipboard.set -> set @ clipboard (DuMl)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "BEPE",
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
		"save point.confirm -> show @ confirm box (Rkeh)",
		"model.root -> root @ view manager (kQwu)",
		"model.header -> show @ doc settings (PYiS)",
		"model.loaded -> model.loaded @ document manager (kkOo)",
		"model.failed -> model.failed @ document manager (kkOo)",
		"redox.done -> redox.done @ view manager (kQwu)",
		"event settings -> show @ event settings (UVVZ)",
		"tool settings -> show @ tool settings (VFQv)",
		"pin profile -> show @ pin profile (OogC)",
		"info popup -> show @ toast box (hFTo)",
		"get path -> path @ path request (hKZU)",
		"open source file -> file.open @ document manager (kkOo)",
		"open model -> file.open @ document manager (kkOo)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "DuMl",
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
	uid: "GrAs",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ sysblu pane (ygoe)",
		"application settings -> application settings @ application inspector (eswU)",
		"endpoint settings -> endpoint settings @ endpoint inspector (jJbx)",
		"connection settings -> connection settings @ connection inspector (eVCT)",
		"project references -> project references @ project references (slBi)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (PDMH)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (PDMH)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (PDMH)",
		"open reference -> file.open @ document manager (kkOo)",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "PDMH",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ document manager (kkOo)",
		"sysblu.failed -> sysblu.failed @ document manager (kkOo)",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (GrAs)",
		"sysmod.done -> sysmod.done @ sysblu view (GrAs)"
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "eswU",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "jJbx",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "eVCT",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "slBi",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "hKZU",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)",
		"folder.get => folder.get @ workspace (zqmm)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "tasM",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "esGA",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (zqmm)",
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "OogC",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (UyER)",
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "UyER",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "PYiS",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)",
		"team settings -> show @ team settings (TuaF)",
		"agent settings -> show @ agent settings (QbBO)",
		"model runtime settings -> show @ model runtime settings (wDHp)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "TuaF",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "wDHp",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "QbBO",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "KKTo",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (Rkeh)",
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "lfrm",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "Rkeh",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "VFQv",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "UVVZ",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "hFTo",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (MHrK)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "ChjH",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (rOVx)"
		]
	},
	//_________________________________________________SYSBLU PANE
	{
	name: "sysblu pane",
	uid: "ygoe",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (MHrK)"
		]
	},
	//_________________________________________________SYSBLU MENU
	{
	name: "sysblu menu",
	uid: "KBIX",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ sysblu pane (ygoe)",
		"save -> file.save active @ document manager (kkOo)",
		"application prompt -> application prompt @ sysblu view (GrAs)",
		"add application -> add application @ sysblu view (GrAs)"
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
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.1","schemaVersion":"1.12.1"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
