// ------------------------------------------------------------------
// Model: 
// Path: solar-system-app.js
// Creation date 9/22/2025, 8:57:19 AM
// ------------------------------------------------------------------

// import the runtime code
import * as RT from "c:/dev/vmblu/runtime"


//Imports
import { ScreenLayout,
		 HelpersSettings,
		 SolarSystemSettings,
		 SimulationSettings,
		 CamerasSettings,
		 IconMenuHorizontal,
		 LLMChatWindow } from './ui/index.js'
import { HelperTools,
		 Renderer,
		 SceneManager,
		 CameraManager,
		 SpaceCurveManager } from './3d/index.js'
import { Star,
		 Planet,
		 Saturn,
		 Moon,
		 Ephemerides,
		 PlanetRouter,
		 StarSphere,
		 SelectOnEarth } from './sky/index.js'
import { PlanetaryDistance } from './chart/index.js'
import { McpClientOpenAI } from '../../../core/ai/mcp-client-in-browser.js'
import { McpServerInBrowser } from './mcp-server.js'

//The runtime nodes
const nodeList = [
	//_______________________________________________SCREEN LAYOUT
	{
	name: "screen layout", 
	uid: "PzOB", 
	factory: ScreenLayout,
	inputs: [
		"-> menu",
		"-> timeline",
		"-> modal div",
		"-> left side chart",
		"=> left side canvas",
		"-> left side toggle",
		"-> right side toggle",
		"-> right side add div"
		],
	outputs: [
		"visible start -> update start @ renderer (imdr)",
		"visible stop -> update stop @ renderer (imdr)",
		"canvas -> canvas add @ camera manager (LDdW)"
		]
	},
	//________________________________________________HELPER TOOLS
	{
	name: "helper tools", 
	uid: "whha", 
	factory: HelperTools,
	inputs: [
		"-> grid change",
		"-> axes change"
		],
	outputs: [
		"grid show -> grid set @ helper settings (zBFx)",
		"axes show -> axes set @ helper settings (zBFx)",
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)"
		],
	sx:	{
		    "grid": {
		        "x": {
		            "on": false,
		            "color": "0x773333"
		        },
		        "y": {
		            "on": false,
		            "color": "0x337733"
		        },
		        "z": {
		            "on": true,
		            "color": "0x333377"
		        },
		        "size": 50,
		        "divisions": 50
		    },
		    "axes": {
		        "on": false,
		        "size": "50"
		    }
		}
	},
	//_____________________________________________HELPER SETTINGS
	{
	name: "helper settings", 
	uid: "zBFx", 
	factory: HelpersSettings,
	inputs: [
		"-> grid set",
		"-> axes set"
		],
	outputs: [
		"div -> right side add div @ screen layout (PzOB)",
		"grid change -> grid change @ helper tools (whha)",
		"axes change -> axes change @ helper tools (whha)"
		]
	},
	//____________________________________________________RENDERER
	{
	name: "renderer", 
	uid: "imdr", 
	factory: Renderer,
	inputs: [
		"-> camera",
		"-> canvas",
		"-> scene",
		"-> actors",
		"-> update start",
		"-> update stop",
		"-> update step"
		],
	outputs: []
	},
	//_______________________________________________SCENE MANAGER
	{
	name: "scene manager", 
	uid: "tKKg", 
	factory: SceneManager,
	inputs: [
		"-> scene add",
		"-> scene remove",
		"-> scene dispose",
		"-> actor add",
		"-> actor remove"
		],
	outputs: [
		"actors -> actors @ renderer (imdr)",
		"scene -> scene @ renderer (imdr)"
		]
	},
	//_________________________________________________________SUN
	{
	name: "sun", 
	uid: "fKqO", 
	factory: Star,
	inputs: [
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)",
		"current date -> current date @ simulation settings (debw)"
		],
	sx:	{
		    "name": "Sun",
		    "color": "0xfffcac",
		    "light": {
		        "intensity": 25,
		        "distance": 100,
		        "color": "0xffeedd"
		    },
		    "emissive": {
		        "color": "0xffdcac",
		        "intensity": 1.5
		    },
		    "textureFile": "/assets/2k_sun.jpg"
		}
	},
	//_____________________________________________________MERCURY
	{
	name: "mercury", 
	uid: "YXpN", 
	factory: Planet,
	inputs: [
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> place local camera",
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)"
		],
	sx:	{
		    "name": "Mercury",
		    "color": "0xB1B1B1",
		    "textureFile": null
		}
	},
	//________________________________________________________MARS
	{
	name: "mars", 
	uid: "Dgou", 
	factory: Planet,
	inputs: [
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> place local camera",
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)"
		],
	sx:	{
		    "name": "Mars",
		    "color": "0xD14A28",
		    "textureFile": "/assets/2k_mars.jpg"
		}
	},
	//______________________________________________________SATURN
	{
	name: "saturn", 
	uid: "DWIr", 
	factory: Saturn,
	inputs: [
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> place local camera",
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)"
		],
	sx:	{
		    "name": "Saturn",
		    "color": "0xF9D71C",
		    "textureFile": null,
		    "colorRing": "0xaaaaff"
		}
	},
	//______________________________________________________URANUS
	{
	name: "uranus", 
	uid: "IKeo", 
	factory: Planet,
	inputs: [
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> place local camera",
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)"
		],
	sx:	{
		    "name": "Uranus",
		    "color": "0xA8E1E8",
		    "textureFile": null
		}
	},
	//_____________________________________________________NEPTUNE
	{
	name: "neptune", 
	uid: "pTDp", 
	factory: Planet,
	inputs: [
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> place local camera",
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)"
		],
	sx:	{
		    "name": "Neptune",
		    "color": "0x24468E",
		    "textureFile": null
		}
	},
	//_______________________________________________________VENUS
	{
	name: "venus", 
	uid: "oeFm", 
	factory: Planet,
	inputs: [
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> place local camera",
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)"
		],
	sx:	{
		    "name": "Venus",
		    "color": "0xEEDCAB",
		    "textureFile": null
		}
	},
	//_______________________________________________________EARTH
	{
	name: "earth", 
	uid: "hEXZ", 
	factory: Planet,
	inputs: [
		"-> place local camera",
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> simulation user change",
		"-> presentation user change"
		],
	outputs: [
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)",
		"simulation get user settings => simulation get @ simulation settings (debw)",
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`
		],
	sx:	{
		    "name": "Earth",
		    "color": "0x2E52B2",
		    "textureFile": "/assets/2k_earth_specular_map.jpg"
		}
	},
	//____________________________________________________THE MOON
	{
	name: "the moon", 
	uid: "xTcR", 
	factory: Moon,
	inputs: [
		"-> simulation user change",
		"-> presentation user change"
		],
	outputs: [
		"simulation get user settings => simulation get @ simulation settings (debw)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"scene add -> moon add @ earth (hEXZ)",
		"scene remove -> moon remove @ earth (hEXZ)",
		"scene dispose -> moon dispose @ earth (hEXZ)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`
		],
	sx:	{
		    "name": "Moon",
		    "color": "0xaaaaaa",
		    "textureFile": "/assets/2k_moon.jpg"
		}
	},
	//_____________________________________________________JUPITER
	{
	name: "jupiter", 
	uid: "Wzci", 
	factory: Planet,
	inputs: [
		"-> moon add",
		"-> moon remove",
		"-> moon dispose",
		"-> presentation user change",
		"-> simulation user change",
		"-> place local camera"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`,
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)"
		],
	sx:	{
		    "name": "Jupiter",
		    "color": "0xD9B382",
		    "textureFile": "/assets/jupiter.webp"
		}
	},
	//__________________________________________________________IO
	{
	name: "Io", 
	uid: "DdLG", 
	factory: Moon,
	inputs: [
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"scene add -> moon add @ jupiter (Wzci)",
		"scene remove -> moon remove @ jupiter (Wzci)",
		"scene dispose -> moon dispose @ jupiter (Wzci)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`
		],
	sx:	{
		    "name": "Io",
		    "color": "0xffffff",
		    "textureFile": null
		}
	},
	//______________________________________________________EUROPA
	{
	name: "Europa", 
	uid: "ooEx", 
	factory: Moon,
	inputs: [
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"scene add -> moon add @ jupiter (Wzci)",
		"scene remove -> moon remove @ jupiter (Wzci)",
		"scene dispose -> moon dispose @ jupiter (Wzci)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`
		],
	sx:	{
		    "name": "Europa",
		    "color": "0xffffff",
		    "textureFile": null
		}
	},
	//____________________________________________________CALLISTO
	{
	name: "Callisto", 
	uid: "aXQS", 
	factory: Moon,
	inputs: [
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"scene add -> moon add @ jupiter (Wzci)",
		"scene remove -> moon remove @ jupiter (Wzci)",
		"scene dispose -> moon dispose @ jupiter (Wzci)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`
		],
	sx:	{
		    "name": "Callisto",
		    "color": "0xffffff",
		    "textureFile": null
		}
	},
	//____________________________________________________GANYMEDE
	{
	name: "Ganymede", 
	uid: "OxiF", 
	factory: Moon,
	inputs: [
		"-> presentation user change",
		"-> simulation user change"
		],
	outputs: [
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"scene add -> moon add @ jupiter (Wzci)",
		"scene remove -> moon remove @ jupiter (Wzci)",
		"scene dispose -> moon dispose @ jupiter (Wzci)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)",
		`presentation chart and output settings -> [ 
			"setup @ planetary distance (VsgU)",
			"setup @ space curve manager (mKHX)" ]`,
		"simulation get user settings => simulation get @ simulation settings (debw)",
		"ephemeris => ephemeris @ Ephemerides(1) (ircs)",
		`orbit position -> [ 
			"position @ planetary distance (VsgU)",
			"position @ space curve manager (mKHX)" ]`
		],
	sx:	{
		    "name": "Ganymede",
		    "color": "0xffffff",
		    "textureFile": null
		}
	},
	//______________________________________________EPHEMERIDES(1)
	{
	name: "Ephemerides(1)", 
	uid: "ircs", 
	factory: Ephemerides,
	inputs: [
		"=> ephemeris"
		],
	outputs: []
	},
	//______________________________________________CAMERA MANAGER
	{
	name: "camera manager", 
	uid: "LDdW", 
	factory: CameraManager,
	inputs: [
		"-> canvas add",
		"=> get camera",
		"-> helpers show",
		"-> helpers hide",
		"-> camera select",
		"-> camera add",
		"-> camera delete",
		"-> camera update"
		],
	outputs: [
		"canvas set -> canvas @ renderer (imdr)",
		"active camera -> camera @ renderer (imdr)",
		"camera list -> list @ camera settings (gGiy)",
		"camera settings -> settings @ camera settings (gGiy)",
		"actor add -> actor add @ scene manager (tKKg)",
		"actor remove -> actor remove @ scene manager (tKKg)",
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)"
		],
	sx:	[
		    {
		        "definition": {
		            "name": "space camera",
		            "type": "perspective",
		            "near": 0.0001,
		            "far": 500,
		            "fov": 50,
		            "zoom": 1,
		            "aspect": "canvas"
		        },
		        "location": {
		            "space": true,
		            "position": {
		                "x": 0,
		                "y": -1,
		                "z": 0.5
		            },
		            "lookAt": {
		                "x": 0,
		                "y": 0,
		                "z": 0
		            }
		        },
		        "controls": "orbit"
		    },
		    {
		        "definition": {
		            "name": "spaceship camera",
		            "type": "perspective",
		            "near": 0.000001,
		            "far": 500,
		            "fov": 50,
		            "zoom": 1,
		            "aspect": "canvas"
		        },
		        "controls": "spaceship",
		        "location": {
		            "space": true,
		            "position": {
		                "x": 0,
		                "y": 2,
		                "z": 0
		            },
		            "lookAt": {
		                "x": 0,
		                "y": 0,
		                "z": 0
		            }
		        }
		    }
		]
	},
	//_______________________________________SOLAR SYSTEM SETTINGS
	{
	name: "solar system settings", 
	uid: "Yjyc", 
	factory: SolarSystemSettings,
	inputs: [
		"=> presentation get",
		"-> presentation override"
		],
	outputs: [
		"div -> right side add div @ screen layout (PzOB)",
		`presentation user change -> [ 
			"presentation user change @ planet router (KAbB)",
			"presentation user change @ star sphere (GEfc)" ]`
		],
	sx:	{
		    "labels": {
		        "on": true,
		        "size": {
		            "min": 1,
		            "max": 50,
		            "current": 24
		        }
		    },
		    "magnify": {
		        "sun": {
		            "on": true,
		            "size": {
		                "min": 1,
		                "max": 100,
		                "current": 10
		            }
		        },
		        "planet": {
		            "on": true,
		            "size": {
		                "min": 1,
		                "max": 1000,
		                "current": 200
		            }
		        },
		        "moon": {
		            "on": true,
		            "size": {
		                "min": 1,
		                "max": 1000,
		                "current": 500
		            },
		            "orbit": {
		                "on": true,
		                "size": {
		                    "min": 1,
		                    "max": 100,
		                    "current": 20
		                }
		            }
		        }
		    },
		    "stars": {
		        "on": true
		    },
		    "constellations": {
		        "on": false
		    }
		}
	},
	//_________________________________________SIMULATION SETTINGS
	{
	name: "simulation settings", 
	uid: "debw", 
	factory: SimulationSettings,
	inputs: [
		"-> current date",
		"-> simulation override",
		"=> simulation get"
		],
	outputs: [
		"div -> right side add div @ screen layout (PzOB)",
		"orbit show -> curve show @ space curve manager (mKHX)",
		"orbit hide -> curve hide @ space curve manager (mKHX)",
		"update start -> update start @ renderer (imdr)",
		"update stop -> update stop @ renderer (imdr)",
		"update step -> update step @ renderer (imdr)",
		`simulation user change -> [ 
			"simulation user change @ planet router (KAbB)",
			"user change @ planetary distance (VsgU)" ]`
		],
	sx:	{
		    "running": true,
		    "speed": {
		        "min": 0.001,
		        "max": 100,
		        "current": 1,
		        "select": {
		            "on": true,
		            "selected": "sec = day",
		            "choices": [
		                "sec = sec",
		                "sec = min",
		                "sec = hour",
		                "sec = day",
		                "sec = week",
		                "sec = month",
		                "sec = year"
		            ]
		        }
		    },
		    "start": "1/1/2024",
		    "orbit": {
		        "on": false
		    }
		}
	},
	//__________________________________________PLANETARY DISTANCE
	{
	name: "planetary distance", 
	uid: "VsgU", 
	factory: PlanetaryDistance,
	inputs: [
		"-> setup",
		"-> position",
		"-> user change"
		],
	outputs: [
		"div -> left side chart @ screen layout (PzOB)"
		],
	sx:	{
		    "planets": [
		        "Mercury",
		        "Venus",
		        "Mars"
		    ],
		    "size": 512
		}
	},
	//_________________________________________SPACE CURVE MANAGER
	{
	name: "space curve manager", 
	uid: "mKHX", 
	factory: SpaceCurveManager,
	inputs: [
		"-> setup",
		"-> position",
		"-> curve show",
		"-> curve hide"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"scene remove -> scene remove @ scene manager (tKKg)",
		"scene dispose -> scene dispose @ scene manager (tKKg)"
		]
	},
	//_____________________________________________CAMERA SETTINGS
	{
	name: "camera settings", 
	uid: "gGiy", 
	factory: CamerasSettings,
	inputs: [
		"-> list",
		"-> settings"
		],
	outputs: [
		"div -> right side add div @ screen layout (PzOB)",
		"show helpers -> helpers show @ camera manager (LDdW)",
		"hide helpers -> helpers hide @ camera manager (LDdW)",
		"user add -> camera add @ camera manager (LDdW)",
		"user delete -> camera delete @ camera manager (LDdW)",
		"user update -> camera update @ camera manager (LDdW)",
		"user select -> camera select @ camera manager (LDdW)"
		]
	},
	//_________________________________________________STAR SPHERE
	{
	name: "star sphere", 
	uid: "GEfc", 
	factory: StarSphere,
	inputs: [
		"-> presentation user change"
		],
	outputs: [
		"scene add -> scene add @ scene manager (tKKg)",
		"presentation get user settings => presentation get @ solar system settings (Yjyc)"
		],
	sx:	{
		    "starFile": "/assets/starmap_2020_8k.jpg",
		    "constellationFile": "/assets/constellations.png",
		    "radius": 200
		}
	},
	//_____________________________________________SELECT ON EARTH
	{
	name: "select on earth", 
	uid: "nflH", 
	factory: SelectOnEarth,
	inputs: [],
	outputs: [
		"place camera -> place local camera @ planet router (KAbB)",
		"add canvas => left side canvas @ screen layout (PzOB)",
		"get camera => get camera @ camera manager (LDdW)"
		],
	sx:	{
		    "earth": {
		        "color": "0x007fff",
		        "textureFile": "/assets/2k_earth_specular_map.jpg"
		    },
		    "camera": {
		        "fov": 50,
		        "near": 0.001,
		        "far": 10
		    },
		    "planetCameras": [
		        {
		            "definition": {
		                "name": "earth camera",
		                "type": "perspective",
		                "near": 1e-9,
		                "far": 200,
		                "fov": 50,
		                "zoom": 1,
		                "aspect": "canvas"
		            },
		            "controls": "telescope",
		            "location": {
		                "planet": "Earth",
		                "coordinates": "50°53'10.7\"N 3°45'57.9\"E",
		                "inclination": 90
		            }
		        }
		    ]
		}
	},
	//____________________________________________________TOP MENU
	{
	name: "top menu", 
	uid: "ZSld", 
	factory: IconMenuHorizontal,
	inputs: [],
	outputs: [
		`panels toggle -> [ 
			"right side toggle @ screen layout (PzOB)",
			"left side toggle @ screen layout (PzOB)" ]`,
		"div -> menu @ screen layout (PzOB)"
		],
	sx:	[
		    {
		        "name": "width_full",
		        "help": "show/hide panels",
		        "message": "panels.toggle"
		    }
		]
	},
	//__________________________________________________MCP CLIENT
	{
	name: "MCP Client", 
	uid: "AutD", 
	factory: McpClientOpenAI,
	inputs: [
		"-> new prompt",
		"-> handle key",
		"-> tool result"
		],
	outputs: [
		"update chat -> update chat @ LLM Chat Window (bLwZ)",
		"get manifest => get manifest @ MCP Server (NssK)",
		"get tools => get tools @ MCP Server (NssK)",
		"call tool -> call tool @ MCP Server (NssK)"
		],
	dx:	{
		    "logMessages": false,
		    "worker": {
		        "on": false,
		        "path": ""
		    }
		}
	},
	//__________________________________________________MCP SERVER
	{
	name: "MCP Server", 
	uid: "NssK", 
	factory: McpServerInBrowser,
	inputs: [
		"-> call tool",
		"=> get tools",
		"=> get manifest"
		],
	outputs: [
		"tool result -> tool result @ MCP Client (AutD)"
		],
	dx:	{
		    "logMessages": false,
		    "worker": {
		        "on": false,
		        "path": ""
		    }
		}
	},
	//_____________________________________________LLM CHAT WINDOW
	{
	name: "LLM Chat Window", 
	uid: "bLwZ", 
	factory: LLMChatWindow,
	inputs: [
		"-> update chat"
		],
	outputs: [
		"div -> right side add div @ screen layout (PzOB)",
		"new prompt -> new prompt @ MCP Client (AutD)",
		"handle key -> handle key @ MCP Client (AutD)"
		]
	},
]

//The filters
const filterList = [
	//________________________________________PLANET ROUTER FILTER
	{
	name: "planet router", 
	uid: "KAbB", 
	filter: PlanetRouter,
	table: [
		`place local camera : [
			"place local camera @ earth (hEXZ)",
			"place local camera @ mercury (YXpN)",
			"place local camera @ uranus (IKeo)",
			"place local camera @ neptune (pTDp)",
			"place local camera @ saturn (DWIr)",
			"place local camera @ mars (Dgou)",
			"place local camera @ venus (oeFm)" ]`,
		`presentation user change : [
			"presentation user change @ mercury (YXpN)",
			"presentation user change @ earth (hEXZ)",
			"presentation user change @ the moon (xTcR)",
			"presentation user change @ uranus (IKeo)",
			"presentation user change @ sun (fKqO)",
			"presentation user change @ venus (oeFm)",
			"presentation user change @ mars (Dgou)",
			"presentation user change @ saturn (DWIr)",
			"presentation user change @ neptune (pTDp)",
			"presentation user change @ Io (DdLG)",
			"presentation user change @ Europa (ooEx)",
			"presentation user change @ Ganymede (OxiF)",
			"presentation user change @ Callisto (aXQS)",
			"presentation user change @ jupiter (Wzci)" ]`,
		`simulation user change : [
			"simulation user change @ uranus (IKeo)",
			"simulation user change @ mercury (YXpN)",
			"simulation user change @ earth (hEXZ)",
			"simulation user change @ the moon (xTcR)",
			"simulation user change @ sun (fKqO)",
			"simulation user change @ venus (oeFm)",
			"simulation user change @ mars (Dgou)",
			"simulation user change @ saturn (DWIr)",
			"simulation user change @ neptune (pTDp)",
			"simulation user change @ Io (DdLG)",
			"simulation user change @ Europa (ooEx)",
			"simulation user change @ Ganymede (OxiF)",
			"simulation user change @ Callisto (aXQS)",
			"simulation user change @ jupiter (Wzci)" ]`,]
	},
]

// prepare the runtime
const runtime = RT.scaffold(nodeList, filterList)

// and start the app
runtime.start()
