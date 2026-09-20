// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.3","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.3"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:a8afe52d622666d3"}}
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
	uid: "oMof",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (fEnI)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "OGpW",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (oMof)",
		"file.selected -> file.selected @ document manager (TCRX)",
		"file.new -> file.new @ document manager (TCRX)",
		"file.renamed -> file.renamed @ document manager (TCRX)",
		"file.deleted -> file.deleted @ document manager (TCRX)",
		"file.get name -> file.get @ document manager (TCRX)",
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
	uid: "asZe",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"text.failed -> text.failed @ document manager (TCRX)",
		"text.loaded -> text.loaded @ document manager (TCRX)",
		"content div -> content.div @ editor page (fEnI)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "unpO",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (OGpW)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "jkWv",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (fEnI)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "fEnI",
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
		"div -> main area @ column-main layout (oMof)",
		`content.size change -> [ 
			"size change @ view manager (XXIl)",
			"size change @ sysblu view (FjpF)" ]`
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "Dyok",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (fEnI)",
		"tab.request to close -> tab.request to close @ document manager (TCRX)",
		"tab.request to select -> tab.request to select @ document manager (TCRX)"
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
	uid: "yGUm",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (JPLH)",
		"accept changes -> accept changes @ model manager (JPLH)",
		"wire check -> wire check @ model manager (JPLH)",
		"show settings -> show settings @ model manager (JPLH)",
		"make app -> make app @ model manager (JPLH)",
		"make lib -> make lib @ model manager (JPLH)",
		"set save point -> save point.set @ model manager (JPLH)",
		"back to save point -> save point.back @ model manager (JPLH)",
		"recalibrate -> recalibrate @ view manager (XXIl)",
		"grid on-off -> grid on-off @ view manager (XXIl)",
		"application prompt -> application prompt @ view manager (XXIl)",
		`save -> [ 
			"model.save @ model manager (JPLH)",
			"file.save active @ document manager (TCRX)" ]`,
		"save as -> file.save as @ document manager (TCRX)",
		"div -> menu div @ model pane (jkWv)"
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
	uid: "TCRX",
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
		"tab.new -> tab.new @ tab ribbon (Dyok)",
		"tab.rename -> tab.rename @ tab ribbon (Dyok)",
		"tab.select -> tab.select @ tab ribbon (Dyok)",
		"tab.remove -> tab.remove @ tab ribbon (Dyok)",
		"file.save as filename -> path @ path request (GMiJ)",
		"file.save all -> ()",
		"file.loading -> content.loading @ editor page (fEnI)",
		"file.loaded -> content.loaded @ editor page (fEnI)",
		"file.failed -> content.failed @ editor page (fEnI)",
		`model.set active -> [ 
			"top level view @ view manager (XXIl)",
			"model.set @ model manager (JPLH)" ]`,
		"model.save -> model.save @ model manager (JPLH)",
		"sysblu.save -> sysblu.save @ sysblu manager (TQls)",
		"sysblu.set active -> sysblu.set @ sysblu manager (TQls)",
		"text.save -> text.save @ text editor (asZe)",
		"text.set active -> text.set active @ text editor (asZe)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "XXIl",
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
		"redox.doit -> redox.doit @ model manager (JPLH)",
		"redox.undo -> redox.undo @ model manager (JPLH)",
		"redox.redo -> redox.redo @ model manager (JPLH)",
		"team legend -> teams @ team legend (dexe)",
		"canvas -> canvas @ model pane (jkWv)",
		"node settings (sx) -> show @ node settings (wXmk)",
		"runtime settings (dx) -> show @ runtime settings (RDJb)",
		"node prompt -> markdown @ markdown input (sUwq)",
		"context menu -> context menu @ context menu (mXFd)",
		"name and path -> name and path @ name and path (vZej)",
		"open source file -> file.open @ document manager (TCRX)",
		"open model -> file.open @ document manager (TCRX)",
		"clipboard.get => get @ clipboard (RCCZ)",
		"clipboard.set -> set @ clipboard (RCCZ)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "JPLH",
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
		"save point.confirm -> show @ confirm box (GNnh)",
		"model.root -> root @ view manager (XXIl)",
		"model.header -> show @ doc settings (Zpnj)",
		"model.loaded -> model.loaded @ document manager (TCRX)",
		"model.failed -> model.failed @ document manager (TCRX)",
		"redox.done -> redox.done @ view manager (XXIl)",
		"event settings -> show @ event settings (JOhg)",
		"tool settings -> show @ tool settings (NAPU)",
		"pin profile -> show @ pin profile (nLrz)",
		"info popup -> show @ toast box (WhYv)",
		"get path -> path @ path request (GMiJ)",
		"open source file -> file.open @ document manager (TCRX)",
		"open model -> file.open @ document manager (TCRX)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "RCCZ",
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
	uid: "FjpF",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ sysblu pane (MIzc)",
		"application settings -> application settings @ application inspector (mOTM)",
		"endpoint settings -> endpoint settings @ endpoint inspector (qVFG)",
		"connection settings -> connection settings @ connection inspector (EfHv)",
		"project references -> project references @ project references (hiWw)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (TQls)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (TQls)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (TQls)",
		"open reference -> file.open @ document manager (TCRX)",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "TQls",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ document manager (TCRX)",
		"sysblu.failed -> sysblu.failed @ document manager (TCRX)",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (FjpF)",
		"sysmod.done -> sysmod.done @ sysblu view (FjpF)"
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "mOTM",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "qVFG",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "EfHv",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "hiWw",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "GMiJ",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)",
		"folder.get => folder.get @ workspace (OGpW)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "wXmk",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "vZej",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (OGpW)",
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "nLrz",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (sUwq)",
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "sUwq",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "Zpnj",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)",
		"team settings -> show @ team settings (SLBL)",
		"agent settings -> show @ agent settings (rvxj)",
		"model runtime settings -> show @ model runtime settings (YGvM)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "SLBL",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "YGvM",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "rvxj",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "mXFd",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (GNnh)",
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "RDJb",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "GNnh",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "NAPU",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "JOhg",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "WhYv",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (fEnI)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "dexe",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (jkWv)"
		]
	},
	//_________________________________________________SYSBLU PANE
	{
	name: "sysblu pane",
	uid: "MIzc",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (fEnI)"
		]
	},
	//_________________________________________________SYSBLU MENU
	{
	name: "sysblu menu",
	uid: "TAgk",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ sysblu pane (MIzc)",
		"save -> file.save active @ document manager (TCRX)",
		"application prompt -> application prompt @ sysblu view (FjpF)",
		"add application -> add application @ sysblu view (FjpF)"
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
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.3","schemaVersion":"1.12.3"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
