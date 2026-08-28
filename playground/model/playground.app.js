// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.11","schemaVersion":"1.11.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.11.0"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:8a1096da1d3e3ed4"}}
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
		 PathRequestFactory,
		 NodeSettingsFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 DocumentSettingsFactory,
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
	uid: "Bpqr",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (CSck)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "bram",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (Bpqr)",
		"file.selected -> file.selected @ document manager (Sgck)",
		"file.new -> file.new @ document manager (Sgck)",
		"file.renamed -> file.renamed @ document manager (Sgck)",
		"file.deleted -> file.deleted @ document manager (Sgck)",
		"file.get name -> file.get @ document manager (Sgck)",
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
	uid: "sYxX",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"text.failed -> text.failed @ document manager (Sgck)",
		"text.loaded -> text.loaded @ document manager (Sgck)",
		"content div -> content.div @ editor page (CSck)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "fOhX",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (bram)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "RlPM",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (CSck)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "CSck",
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
		"div -> main area @ column-main layout (Bpqr)",
		`content.size change -> [ 
			"size change @ view manager (BjzB)",
			"size change @ sysblu view (Wkig)" ]`
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "YlZi",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (CSck)",
		"tab.request to close -> tab.request to close @ document manager (Sgck)",
		"tab.request to select -> tab.request to select @ document manager (Sgck)"
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
	uid: "FdRb",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (wZNT)",
		"accept changes -> accept changes @ model manager (wZNT)",
		"wire check -> wire check @ model manager (wZNT)",
		"show settings -> show settings @ model manager (wZNT)",
		"make app -> make app @ model manager (wZNT)",
		"make lib -> make lib @ model manager (wZNT)",
		"set save point -> save point.set @ model manager (wZNT)",
		"back to save point -> save point.back @ model manager (wZNT)",
		"recalibrate -> recalibrate @ view manager (BjzB)",
		"grid on-off -> grid on-off @ view manager (BjzB)",
		"application prompt -> application prompt @ view manager (BjzB)",
		`save -> [ 
			"model.save @ model manager (wZNT)",
			"file.save active @ document manager (Sgck)" ]`,
		"save as -> file.save as @ document manager (Sgck)",
		"div -> menu div @ model pane (RlPM)"
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
	uid: "Sgck",
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
		"tab.new -> tab.new @ tab ribbon (YlZi)",
		"tab.rename -> tab.rename @ tab ribbon (YlZi)",
		"tab.select -> tab.select @ tab ribbon (YlZi)",
		"tab.remove -> tab.remove @ tab ribbon (YlZi)",
		"file.save as filename -> path @ path request (vzTT)",
		"file.save all -> ()",
		"file.loading -> content.loading @ editor page (CSck)",
		"file.loaded -> content.loaded @ editor page (CSck)",
		"file.failed -> content.failed @ editor page (CSck)",
		`model.set active -> [ 
			"top level view @ view manager (BjzB)",
			"model.set @ model manager (wZNT)" ]`,
		"model.save -> model.save @ model manager (wZNT)",
		"sysblu.save -> sysblu.save @ sysblu manager (aTtz)",
		"sysblu.set active -> sysblu.set @ sysblu manager (aTtz)",
		"text.save -> text.save @ text editor (sYxX)",
		"text.set active -> text.set active @ text editor (sYxX)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "BjzB",
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
		"redox.doit -> redox.doit @ model manager (wZNT)",
		"redox.undo -> redox.undo @ model manager (wZNT)",
		"redox.redo -> redox.redo @ model manager (wZNT)",
		"team legend -> teams @ team legend (CjJa)",
		"canvas -> canvas @ model pane (RlPM)",
		"node settings (sx) -> show @ node settings (PkMY)",
		"runtime settings (dx) -> show @ runtime settings (EtCl)",
		"node prompt -> markdown @ markdown input (HZgM)",
		"context menu -> context menu @ context menu (njVQ)",
		"name and path -> name and path @ name and path (iRwH)",
		"open source file -> file.open @ document manager (Sgck)",
		"open model -> file.open @ document manager (Sgck)",
		"clipboard.get => get @ clipboard (IFfX)",
		"clipboard.set -> set @ clipboard (IFfX)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "wZNT",
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
		"-> auto layout",
		"-> show settings",
		"-> make app",
		"-> make lib",
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
		"save point.confirm -> show @ confirm box (sEep)",
		"model.root -> root @ view manager (BjzB)",
		"model.header -> show @ doc settings (OTsw)",
		"model.loaded -> model.loaded @ document manager (Sgck)",
		"model.failed -> model.failed @ document manager (Sgck)",
		"redox.done -> redox.done @ view manager (BjzB)",
		"event settings -> show @ event settings (UYSc)",
		"tool settings -> show @ tool settings (PAno)",
		"pin profile -> show @ pin profile (DZQw)",
		"info popup -> show @ toast box (jyOI)",
		"get path -> path @ path request (vzTT)",
		"open source file -> file.open @ document manager (Sgck)",
		"open model -> file.open @ document manager (Sgck)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "IFfX",
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
	uid: "Wkig",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ sysblu pane (uQnT)",
		"application settings -> application settings @ application inspector (NUIY)",
		"endpoint settings -> endpoint settings @ endpoint inspector (kQCd)",
		"connection settings -> connection settings @ connection inspector (njWX)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (aTtz)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (aTtz)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (aTtz)",
		"open reference -> file.open @ document manager (Sgck)",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "aTtz",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ document manager (Sgck)",
		"sysblu.failed -> sysblu.failed @ document manager (Sgck)",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (Wkig)",
		"sysmod.done -> sysmod.done @ sysblu view (Wkig)"
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "NUIY",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "kQCd",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "njWX",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "vzTT",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)",
		"folder.get => folder.get @ workspace (bram)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "PkMY",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "iRwH",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (bram)",
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "DZQw",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (HZgM)",
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "HZgM",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "OTsw",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)",
		"agent settings -> show @ agent settings (QZuW)",
		"model runtime settings -> show @ model runtime settings (pRtu)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "pRtu",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "QZuW",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "njVQ",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (sEep)",
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "EtCl",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "sEep",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "PAno",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "UYSc",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "jyOI",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (CSck)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "CjJa",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (RlPM)"
		]
	},
	//_________________________________________________SYSBLU PANE
	{
	name: "sysblu pane",
	uid: "uQnT",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (CSck)"
		]
	},
	//_________________________________________________SYSBLU MENU
	{
	name: "sysblu menu",
	uid: "mshi",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ sysblu pane (uQnT)",
		"save -> file.save active @ document manager (Sgck)",
		"application prompt -> application prompt @ sysblu view (Wkig)",
		"add application -> add application @ sysblu view (Wkig)"
		],
	sx:	[
		    {
		        "icon": "add_box",
		        "color": "#0fb2e4",
		        "message": "add application",
		        "help": "Add application"
		    },
		    {
		        "icon": "comment",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Application prompt"
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
    vmblu: {"compatibilityFamily":"1.11","generatorVersion":"1.11.0","schemaVersion":"1.11.0"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
