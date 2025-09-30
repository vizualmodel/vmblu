// ------------------------------------------------------------------
// Source node: CameraManager
// Creation date 6/20/2024, 6:00:59 PM
// ------------------------------------------------------------------
import * as THREE from 'three'
import { CameraHelper } from 'three';
import { parseCoordinates } from '../sky/equations-and-constants'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ArrowControls } from './controls-arrows'
import { TelescopeControls } from './controls-telescope'
import { SpaceshipControls } from './controls-spaceship'
import { StationaryControls} from './controls-stationary'

// this should become a parameter
const distance = 10

// two meters in AU
const twoMetersInAU = 2/149_597_870_700

// The types of cameras
/** @typedef {'perspective' | 'orthographic'} CameraType */

// The types of orbit controls
/** @typedef {'orbit | stationary | spaceship | arrows | telescope'} ControlType*/

// The parameters used to define a camera

/**
 * A camera definition that can be used to instantiate 3D views.
 * @constructor
 * @param {Object} options
 * @param {string} [options.name] - Name of the camera
 * @param {CameraType} [options.type] - Type of camera: "perspective" or "orthographic"
 * @param {number} [options.fov] - Field of view in degrees
 * @param {number|string} [options.aspect] - Aspect ratio
 * @param {number} [options.zoom] - Zoom factor
 * @param {number} [options.near] - Near clipping plane
 * @param {number} [options.far] - Far clipping plane
 */
export function CameraDefinition({name, type, fov, aspect, zoom, near, far}) {

	this.name = name ?? 'camera' 		// the name of the camera	
	this.type = type ?? 'perspective' 	// the type of camera: perspective or orthographic
	this.fov = fov ?? 45 				// the field of view in degrees			
	this.aspect = aspect ?? 'canvas' 	// the aspect ratio: canvas, 4:3, 16:9, 21:9
	this.near = near ?? 0.1 			// the near clipping plane 
	this.far = far ?? 1000 				// the far clipping plane 
	this.zoom = zoom ?? 1 				// the zoom factor for the orthographic camera
}	

export function Location() { 				// the location of the camera 
	this.position= { x: 0, y: 0, z: 0 }, 	// the position of the camera 
	this.lookAt= { x: 1, y: 0, z: 0 } 		// the point the camera is looking at 
}

// an object for the settings of a camera
/**
 * 
 * @param {CameraDefinition} definition 
 * @param {import(three).Vector3} location 
 * @param {ControlType} controls 
 */
export function Camera(definition, location, controls) {

	// take the name from the definition
	this.name = definition.name

	// The camera definition
	this.definition = definition
	this.controls = controls ?? 'orbit'
	this.location = location ?? { 	position: { x: 0, y: 0, z: 0 }, // the position of the camera 
									lookAt: { x: 1, y: 0, z: 0 } 	// the point the camera is looking at 
								}
	// The actual objects
	this.device = null
	this.helper = null
	this.ctrldev = null
} 
Camera.prototype = {

	create(canvas) {

		// get the aspect ratio
		const aspectRatio =  this.aspectRatio(this.definition.aspect, canvas)

		// make a camera
		this.device = this.newDevice(aspectRatio)

		// make a helper to visualize the camera on screen
		this.helper = new CameraHelper(this.device)

		// make the controls for this camera
		this.ctrldev = this.newControls(canvas)
	},

	switchOn() {

		if (this.ctrldev) this.switchOnControls();
	},

	switchOff() {

		if (this.ctrldev) this.switchOffControls();
	},

	switchOnControls() {

		switch(this.controls) {

			case 'orbit' : 
				this.ctrldev.enabled = true;
				break;

			default:
				this.ctrldev.enable()
				break;
		}
	},

	switchOffControls() {

		switch(this.controls) {

			case 'orbit' : 
				this.ctrldev.enabled = false;
				break;

			default:
				this.ctrldev.disable()
				break;
		}
	},

	newDevice(aspectRatio) {


		const def = this.definition
		const loc = this.location	

		switch(def.type) {

			case 'perspective' : 
			default : {

				const device = new THREE.PerspectiveCamera(def.fov, aspectRatio, def.near, def.far)
				device.up.set(0,0,1)
				loc?.position ? device.position.copy(loc.position) : device.position.set(0,0,0)
				loc?.lookAt ? device.lookAt(new THREE.Vector3(loc.lookAt.x, loc.lookAt.y,loc.lookAt.z)) : device.lookAt(new THREE.Vector3(1,0,0))
				device.name = def.name
				return device
			}

			case 'orthographic' : {

				// Calculate left, right, top, bottom based on the aspect ratio and view size
				const width = distance * aspectRatio;
				const height = distance;

				// create the camera
				const device = new THREE.OrthographicCamera( -width/2, width/2, height/2, -height/2, def.near, def.far)
				device.up.set(0,0,1)
				loc.position ? device.position.copy(loc.position) : device.position.set(0,0,0)
				loc.lookAt ? device.lookAt(new THREE.Vector3(loc.lookAt.x, loc.lookAt.y,loc.lookAt.z)) : device.lookAt(new THREE.Vector3(1,0,0))
				device.name = def.name
				return device
			}
		}
	},

	// create the actual control device
	newControls(canvas) {

		const camera = this.device

		switch(this.controls) {

			case 'orbit':  {
				// set up the orbit ctrldev NOTE BAD REACTION FROM ORBITCONTROLS WHEN HEIGHT +  VH
				const ctrldev = new OrbitControls( camera, canvas )
				ctrldev.minDistance = camera.near
				ctrldev.maxDistance = camera.far
				ctrldev.maxPolarAngle = Math.PI;
				ctrldev.enabled = false
				return ctrldev
			}

			case 'stationary': {
				const ctrldev = new StationaryControls(camera, canvas)
				return ctrldev
			}

			case 'spaceship': {
				const ctrldev = new SpaceshipControls(camera, canvas)
				return ctrldev
			}

			case 'arrows' : {
				const ctrldev = new ArrowControls(camera)
				return ctrldev
			}

			case 'telescope' : {
				const ctrldev = new TelescopeControls(camera, true)
				return ctrldev				
			}

			default: return null
		}
	},

	aspectRatio(aspect, canvas) {
		// for the aspect ratio we have to translate the text to a number
		switch(aspect) {
			case 'canvas': return canvas.clientWidth / canvas.clientHeight
			case '4:3': return 4/3
			case '16:9':return 16/9
			case '21:9':return 21/9
			default: return 1
		}
	},

	perspectiveAspectChange(aspect) {
		//this.verbose.aspect = aspect
		this.device.aspect = this.aspectRatio(aspect)
	},

	orthoAspectChange(aspect) {

		// set the aspect ratio
		//this.verbose.aspect = aspect

		// notation
		const device = this.device

		// calculate the aspect ratio
		device.aspect = this.aspectRatio(aspect)

		const arOld = (device.left - device.right)/(device.top - device.bottom)
		const arNew = device.aspect

		device.left = device.left*(arNew/arOld)
		device.right = device.right*(arNew/arOld)	
	},

	// from chatGPT - to be tested !
	centerCamera( scene) {

		// Compute the bounding box of the entire scene
		const box = new THREE.Box3().setFromObject(scene);
	
		// Compute the center of the bounding box
		const center = box.getCenter(new THREE.Vector3());
	
		// Move the camera to the center of the bounding box
		const size = box.getSize(new THREE.Vector3()).length();
		const halfSizeToFitOnScreen = size * 0.5;
		const distance = halfSizeToFitOnScreen / (Math.tan(THREE.MathUtils.degToRad(camera.device.fov * 0.5)));
	
		// Adjust the position
		this.device.position.set(center.x, center.y, center.z + distance);
	
		// Make the camera look at the center
		this.device.lookAt(center);
	
		// Update the projection matrix
		this.device.updateProjectionMatrix();
	},

	// Sets the camera position relative to the center of a sphere given the coordinates
	// coordinates is a string of the form: "50°53'10.7\"N 3°45'57.9\"E"
	placeOnSphere(coordinates, radius) {
		// Get the angles from the coordinates
		const { latitude, longitude } = parseCoordinates(coordinates);

		// Convert latitude and longitude to radians
		const latRad = THREE.MathUtils.degToRad(latitude);
		const lonRad = THREE.MathUtils.degToRad(longitude);

		// Calculate the camera position in AU, relative to the planet's center
		const x = radius * Math.cos(latRad) * Math.cos(lonRad);
		const y = radius * Math.cos(latRad) * Math.sin(lonRad);
		const z = radius * Math.sin(latRad);

		// Set the camera position
		this.device.position.set(x, y, z);

		// Create the radial vector (pointing outward from the planet's center)
		const radialVector = new THREE.Vector3(x, y, z).normalize();

		// Use a quaternion to align the camera's local z-axis (view axis) with the radial vector
		const quaternion = new THREE.Quaternion();
		const cameraViewAxis = new THREE.Vector3(0, 0, -1); // Default local z-axis of the camera
		quaternion.setFromUnitVectors(cameraViewAxis, radialVector);

		// Set the quaternion to the camera
		this.device.quaternion.copy(quaternion);

		// Optional: Align the camera's "up" vector if necessary
		this.device.up.set(x, y, z).normalize();
	}

}