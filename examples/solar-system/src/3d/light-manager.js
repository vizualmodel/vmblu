// ------------------------------------------------------------------
// Source node: Lights
// Creation date 6/6/2024, 9:10:50 AM
// ------------------------------------------------------------------
import * as THREE from 'three'


//Constructor for lights
export function LightManager(tx, sx) {

	this.tx = tx
	this.sx = sx

	// add an ambient light
	this.ambient = new THREE.AmbientLight(0xffffff, 0.01); 
	tx.send('scene add', this.ambient )

}

LightManager.prototype = {

	// Output pins of the node

	sends: [
		'list',
		'add',
		'remove'
	],

	// Input pins and handlers of the node

} // lights.prototype