// import * as THREE from 'three/build/three.min.js'
import * as THREE from 'three'

export function SceneManager(tx, sx) {

	// save the tx 
	this.tx = tx

	//the scene
	this.scene = new THREE.Scene();

	// the list with updatable objects
	this.actors = []

	// send the scene
	tx.send('scene',this.scene)

	// send the list of actors
	tx.send('actors', this.actors)

	this.scene.add( new THREE.AmbientLight(0xffffff, 0.25)); 
}
SceneManager.prototype = {

	// adding 3D objects to the scene list

	'-> scene add'(someObject) {
		this.scene.add(someObject)
	},

	'-> scene remove'(someObject) {
		this.scene.remove(someObject)
	},

	'-> scene dispose'(someObject) {
		this.scene.remove(someObject)
		this.dispose(someObject)
	},

	// adding objects to the actors list
	'-> actor add'(actor) {

		// we only add an actor if it has an update function
		if (typeof actor?.update === 'function') this.actors.push(actor)
	},

	'-> actor remove'(actor) {

		// eject the actor from the array
		const L = this.actors.length
		for(let i=0; i<L; i++) {
			if (actors[i] !== actor) continue
			for(j=i; j<L-1;j++) this.actors[j] = this.actors[j+1]
			this.actors.pop()
			break;
		}
	},

	// dispose of an object
	dispose(object) {
		
		// Dispose of geometry
		if (object.geometry) {
			object.geometry.dispose();
		}

		// Dispose of materials
		if (object.material) {
			if (Array.isArray(object.material)) {
				object.material.forEach(material => this.disposeMaterial(material));
			} else {
				this.disposeMaterial(object.material);
			}
		}

		// Dispose of child objects recursively
		if (object.children && object.children.length > 0) {
			object.children.forEach(child => this.dispose(child));
		}
	},

	// dispose of a material
	disposeMaterial(material) {
		// Dispose of material
		if (material.dispose) {
			material.dispose();
		}

		// Check for and dispose of textures used by the material
		const textureProperties = [
			'map',
			'lightMap',
			'aoMap',
			'emissiveMap',
			'bumpMap',
			'normalMap',
			'displacementMap',
			'roughnessMap',
			'metalnessMap',
			'alphaMap',
			'envMap',
			'clearcoatMap',
			'clearcoatRoughnessMap',
			'clearcoatNormalMap',
			'sheenColorMap',
			'sheenRoughnessMap',
			'transmissionMap',
			'thicknessMap'
		];

		textureProperties.forEach(prop => {
			if (material[prop]) {
				material[prop].dispose();
			}
		});
	}
}