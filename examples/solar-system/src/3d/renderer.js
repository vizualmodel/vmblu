// import * as THREE from 'three/build/three.min.js'
import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
let r = 0
export function Renderer(tx, sx) {

	// save the tx 
	this.tx = tx

	// the state of the renderer
	this.state = {
		update: true
	}

	// save the canvas
	this.canvas = null

	// the active camera
	this.camera = null

	//the scene
	this.scene = null

	// set up the renderer
	this.renderer = null

	// the animation frame request (a number)
	this.frameRequest = 0n

	// The clock
	this.clock = new THREE.Clock(),

	// the updatable objects in the scene
	this.actors = []
}
Renderer.prototype = {

	adjustToScene(d) {
		if (this.camera) {
			this.camera.position.set(d/2,d/2,d)
			this.camera.lookAt(0,0,0)
		}
		if (this.lights.point) this.lights.point.position.set( 2*d, 2*d, 2*d)
	},

	setup() {
		
		const canvas = this.canvas

		// set up the renderer
		const renderer = new THREE.WebGLRenderer({
			canvas, 
			antialias: true,
			logarithmicDepthBuffer: true  // Enable logarithmic depth buffer
		})
		renderer.setClearColor(0x000000)
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(canvas.clientWidth, canvas.clientHeight)
		this.renderer = renderer
    },

	startIfReady() {

		// if the renderer is running nothing to do
		if (this.frameRequest) return

		// check that we have everything we need
		if ( !this.canvas || !this.camera || !this.scene) return

		// set up the renderer
		this.setup()

		// start the clock
		this.clock.start()

		// and start the renderloop if not running yet
		this.animate()
	},

    animate() {

		// immediately request a new animation frame
        this.frameRequest = requestAnimationFrame(() => this.animate());

		// do the required periodic updates
        if (this.state.update) {

			// time passed since last frame
			const delta = this.clock.getDelta();
			
			// update all actors
			for (const actor of this.actors) actor.update(delta);
		}

		// and render the scene
        this.renderer.render(this.scene, this.camera);
    },

    '-> scene'(scene) {

		this.scene = scene
		this.startIfReady()
    },

	// this renderer uses just one canvas
	'-> canvas'(canvas) {

		this.canvas = canvas
		this.startIfReady()
	},

	// The camera received here is the actual device !
	'-> camera'(camera) {

		this.camera = camera
		this.startIfReady()
	},	

	// the updatable objects in the scene
	// checked by the scene manager that they have an update function
	'-> actors'(actors) {

		// check that actors is an array
		if (Array.isArray(actors)) this.actors = actors
	},

	// start / stop / frequency ...
	'-> update start'() {
		this.state.update = true
		this.clock.start()
	},

	'-> update stop'() {
		this.state.update = false
		this.clock.stop()
	},

	'-> update step'() {

		// if running, not necessary to do the step
		if (this.state.update) return

		// time passed since last frame
		const delta = this.clock.getDelta();
		
		// update all actors
		for (const actor of this.actors) actor.update(delta);

		// and render the scene
        this.renderer.render(this.scene, this.camera);
	}

}