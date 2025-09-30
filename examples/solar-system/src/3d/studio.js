// import * as THREE from 'three/build/three.min.js'
import * as THREE from 'three'
import * as util from './zzzutil.js'

export function ThreeStudio(tx, sx) {

	// save the tx 
	this.tx = tx

	// save the canvas
	this.canvas = null

	// the active camera
	this.camera = null

	//the scene
	this.scene = new THREE.Scene();

	// the lights
	this.lights = []

	// set up the renderer
	this.renderer = null

	// a boolean to indicate that the loop is running
	this.rendering = false

   	// this is the timed renderloop - we do not use fTime - it's 1.5 ms stale
	// made it an arrow function to get the correct this binding.
    this.renderLoop = () => {	

        // it is good practice to ask a new frame right away
        requestAnimationFrame(this.renderLoop)

		// render
		this.renderer.render(this.scene, this.camera)
    }
}
ThreeStudio.prototype = {

	adjustToScene(d) {
		if (this.camera) {
			this.camera.position.set(d/2,d/2,d)
			this.camera.lookAt(0,0,0)
		}
		if (this.lights.point) this.lights.point.position.set( 2*d, 2*d, 2*d)
	},

	render() {

		// just render the scene
		this.renderer.render(this.scene, this.camera);
	},

	startRenderLoop() {
		this.rendering = true
		this.renderLoop()
	},

	stopRenderLoop() {

	},

	'-> canvas'(canvas) {

		// save the canvas
		this.canvas = canvas

		// the width and height of the canvas
		let W = canvas.clientWidth
		let H = canvas.clientHeight

		// add an ambient light
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
		this.scene.add(ambientLight)
		this.lights.push(ambientLight)

		// add a point light
		const pointLight = new THREE.PointLight(0xffffff, 0.9, 0, 2);
		pointLight.position.set(0,0,0)
		this.scene.add(pointLight)
		this.lights.push(pointLight)
		
		// set up the renderer
		this.renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true})
		this.renderer.setClearColor(0x000000)
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(W, H)
	},

	'-> light'({}) {

	},

	'-> camera'(camera) {

		// save
		this.camera = camera

		// if not rendering start the renderloop
		if (!this.rendering) this.startRenderLoop()
	},

	'-> scene add'(someObject) {
		this.scene.add(someObject)
	},

	'-> scene remove'(someObject) {
		this.scene.remove(someObject)
	},

	'-> scene dispose'(object) {
		this.scene.remove(object)
		util.dispose(object)
	}
	
}