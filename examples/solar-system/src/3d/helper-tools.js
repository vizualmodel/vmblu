// ------------------------------------------------------------------
// Source node: AxisHelper
// Creation date 6/6/2024, 9:13:28 AM
// ------------------------------------------------------------------
import * as THREE from 'three'

function Grid(color, rotation) {

	this.obj = null
	this.color = color,
	this.rotation = rotation
}
Grid.prototype = {

	update(tx, on, size, divisions) {

		if (on) {
			// If this exists and the size or divisions have changed, remove it
			if (this.obj && (this.obj.size !== size || this.obj.divisions !== divisions)) {

				// remove and dispose of the object
				tx.send('scene dispose', this.obj);
				this.obj = null;
			}

			// If this does not exist, create a new one
			if (!this.obj) {
				this.obj = new THREE.GridHelper(size, divisions, this.color, this.color);
				this.obj.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z); // Set rotation if needed
			}

			// Add the grid to the scene
			tx.send('scene add', this.obj);
		}
		else if (this.obj) tx.send('scene remove', this.obj)
	}	
}

// Constructor for the helpers
export function HelperTools(tx, sx) {

	// The transmitter
	this.tx = tx

	// The settings
	this.sx = sx

	// notation
	const grid = sx.grid

	// x grid means perpendicular to x
	this.grid = {
		x : new Grid( +grid.x.color, { x: 0, y: 0, z: Math.PI/2 }),			
		y : new Grid( +grid.y.color, { x: 0, y: 0, z: 0 }),
		z : new Grid( +grid.z.color, { x: Math.PI / 2, y: 0, z: 0}),
	}

	// initial settings
	this.grid.x.update(tx, grid.x.on, grid.size, grid.divisions)
	this.grid.y.update(tx, grid.y.on, grid.size, grid.divisions)
	this.grid.z.update(tx, grid.z.on, grid.size, grid.divisions)

	// The axes
	this.axes = new THREE.AxesHelper(sx.axes.size)

	tx.send('grid show',{x:grid.x.on, y:grid.y.on, z:grid.z.on, size: grid.size, divisions: grid.divisions})
	tx.send('axes show',{on: sx.axes.on, size: sx.axes.size})
}

HelperTools.prototype = {

	// x, y and z are three booleans to signal if the grid is on or off
	// size determines the size of the grids
	// divisions determines the number of divisions in the grid

	"-> grid change"({x, y, z, size, divisions}) {

		// update the three grids as required
		this.grid.x.update(this.tx, x, size, divisions)
		this.grid.y.update(this.tx, y, size, divisions)
		this.grid.z.update(this.tx, z, size, divisions)
	},

	"-> axes change"({on, size}) {

		if (on) {
			if (!this.axes) 
				this.axes = new THREE.AxesHelper(size);
			else if (this.axes.size != size) {
				this.tx.send('scene remove', this.axes);
				this.axes = new THREE.AxesHelper(size);
			}
			// send the axes
			this.tx.send('scene add', this.axes);
				
		// remove the grid from the scene
		} else if (this.axes) this.tx.send('scene remove', this.axes);
	}
}
