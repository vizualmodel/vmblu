// ------------------------------------------------------------------
// Source node: CameraManager
// Creation date 6/20/2024, 6:00:59 PM
// ------------------------------------------------------------------
import {Camera, CameraDefinition} from './camera.js'
import * as THREE from 'three'


// The list of all the cameras
/**
 * @node camera manager
 * @param {object} tx - transmitter
 * @param {object} sx - settings
 */
export function CameraManager(tx, sx) {

	// save tx and sx
	this.tx = tx
	this.sx = sx

	// the default camera list
	this.cameras = []

	// the active camera
	this.active = null

	// The canvas for the cameras
	this.canvas = null
}
CameraManager.prototype = {

	// Input pins and handlers of the node
	switch(camera) {

		// check
		if (!camera?.device) return

		// switch the current camera off
		if (this.active) this.active.switchOff()

		// change the camera
		this.active = camera

		// switch on
		this.active.switchOn()

		// send the active camera to the studio
		this.tx.send('active camera', this.active.device)
	},

	// make the cameras that are given as parameters
	makeCameras() {

		// put the predefined cameras in a list
		for(const settings of this.sx) {

			// make a camera
			const camera = new Camera(settings.definition, settings.location, settings.controls)

			// and create the device
			camera.create(this.canvas)

			// if the camera control needs updating add it as an actor
			if (camera.ctrldev?.update) this.tx.send('actor add', camera.ctrldev)

			// add the camera to the camera list
			this.cameras.push(camera)
		}

		// update the list of cameras
		const list = this.cameras.map(camera => camera.name)

		// send the updated list
		this.tx.send('camera list', list)

		// set the selected or first camera as the active camera
		this.switch(this.cameras[0])
	},

	addNewCamera(definition, location, controls) {

		// the camera values have been checked by the input system - place the values in a camera object !!
		const camera = new Camera(definition, location, controls)

		// create a new camera and controls
		camera.create(this.canvas)

		// check
		if (!camera.device) return null

		// set the zoom
		camera.device.zoom = definition.zoom

		// update the project matrix
		camera.device.updateProjectionMatrix()

		// add to the cameras
		this.cameras.push(camera)		
		// done
		return camera
	},
    /**
     * @prompt sets the canvas
	 * @pin canvas add @ camera manager
	 */
	onCanvasAdd(canvas) {

		// save the canvas
		this.canvas = canvas

		// send the canvas to the renderer
		this.tx.send('canvas set', canvas)

		// now we can create the predefined camera devices
		this.makeCameras()
	},

	/**
     * @prompt selects a camera
	 * @pin camera select @ camera manager
	 */
	onCameraSelect(selected) {

		// find the camera
		const camera = this.cameras.find( camera => camera.name == selected)

		// check
		if (!camera) {
			console.log('No such camera', selected)
			return
		}

		// send the settings to the ui
		this.tx.send("camera settings", {definition: camera.definition, controls: camera.controls})
		
		// if there is no device yet, make it
		if (! camera.device) camera.create()

		// and switch camera
		this.switch(camera)
	},
    /**
	 * @mcp
     * @prompt Adds a new camera to the list of cameras.
	 * @pin camera add @ camera manager
     * @param {string} name - the name of the camera.
     * @param {CameraType} type - perspective or orthographic
     * @param {number} near - New near clipping plane distance.
     * @param {number} far - New far clipping plane distance.
     * @param {number} fov - New field of view angle.
     * @param {number} zoom - New zoom factor.
     * @param {number} aspect - New aspect ratio.
	 * @param {import(three).Vector3} position - position of the camera
	 * @param {import(three).Vector3} lookAt - point that the camera looks at
     */
	onCameraAdd ({name, type, near, far, fov, zoom, aspect, position, lookAt}) {

		// make a camera definition
		const definition = new CameraDefinition({name, type, near, far, fov, zoom, aspect})

		// make a location object
		const location = {
			position: position ? new THREE.Vector3(position.x, position.y, position.z) : new THREE.Vector3(1,1,1), 
			lookAt: lookAt ? new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z) : new THREE.Vector3(0,0,0)
		}

		const camera = this.addNewCamera(definition, location, controls='orbit')

		// check
		if (!camera) return

		// update the list
		const list = this.cameras.map(camera => camera.definition.name)

		// send the updated list
		this.tx.send('camera list', list)
	},

	onCameraDelete({}) {
	},

    /**
	 * @mcp
     * @prompt Updates the active camera's parameters.
	 * @pin camera update @ camera manager
     * @param {number} near - New near clipping plane distance.
     * @param {number} far - New far clipping plane distance.
     * @param {number} fov - New field of view angle.
     * @param {number} zoom - New zoom factor.
     * @param {number} aspect - New aspect ratio.
     */
	onCameraUpdate({near, far, fov, zoom, aspect}) {

		const camera = this.active

		// notation
		const def = camera.definition

		// set the new values
		def.fov = fov
		def.near = near
		def.far = far
		def.zoom = zoom

		// check
		if (!camera?.device) return

		// set the new values
		camera.device.fov = fov
		camera.device.near = near
		camera.device.far = far
		camera.device.zoom = zoom

		// set the aspect ratio
		if (aspect != def.aspect) {
			if (camera.device.isPerspectiveCamera) camera.perspectiveAspectChange(aspect)
			else if (camera.device.isOrthographicCamera) camera.orthoAspectChange(aspect)
		}

		// for an orthographic camera adjust the far plane...

		//console.log('Updating camera: near =', near, 'far =', far, 'fov =', fov, 'zoom =', zoom, 'aspect =', aspect, camera.aspect);


		// update the projection matrix
		camera.device.updateProjectionMatrix()
	},

	"-> helpers show"() {

		for(const camera of this.cameras) {
			if (!camera.helper) continue
			console.log('show helper=',camera.helper)
			this.tx.send("scene add",camera.helper)
		}
	},

	"-> helpers hide"() {

		for(const camera of this.cameras) {
			if (!camera.helper) continue
			this.tx.send("scene remove",camera.helper)
		}
	},

    /**
	 * @mcp 
     * @prompt Returns a new camera with specified specs and updates the camera list.
	 * @pin get camera @ camera manager
     * @param {CameraDefinition} definition - Definition of the camera.
	 * @param {string} definition.name - Name of the camera.
	 * @param {string} definition.type - Camera type (e.g., 'perspective').
	 * @param {number} definition.near - Near clipping plane.
	 * @param {number} definition.far - Far clipping plane.
	 * @param {number} definition.fov - Field of view in degrees.
	 * @param {number} definition.zoom - Zoom factor.
	 * @param {number} definition.aspect - Aspect ratio.
     * @param {Object} location - Location with position and lookAt vectors.
	 * @param {import(three).Vector3} location.position - Position vector of the camera.
	 * @param {import(three).Vector3} location.lookAt - LookAt vector of the camera.
     * @param {ControlType} controls - Controls type for the camera.
     * @returns {Camera|null}
     */
	onGetCamera({definition, location, controls}) {

		// check the input data !
		// const definition = new CameraDefinition({name, type, near, far, fov, zoom, aspect})

		// get a camera with teh given spec
		const camera = this.addNewCamera(definition, location, controls)

		if (!camera) return
		
		// update the list
		const list = this.cameras.map(camera => camera.name)

		// send the updated list
		this.tx.send('camera list', list)

		// return the result
		this.tx.reply(camera)
	},


} // cameras.prototype