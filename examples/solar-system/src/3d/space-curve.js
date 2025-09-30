import * as THREE from 'three'

let r=0
// A single space curve
function SpaceCurve(name, color, size) {

    this.name = name
    this.color = '#' + color.toString(16).slice(2)
    this.points = []
    this.max = size
    this.recent = 0
    this.lineMesh = null
    
    // Geometry and material placeholders
    this.geometry = new THREE.BufferGeometry()
    this.material = new THREE.LineBasicMaterial({ color: this.color })
    this.lineMesh = new THREE.Line(this.geometry, this.material)

}
SpaceCurve.prototype = {

    newPosition(time, pos) {


        // we only add a new position per day
        if (time - this.recent < 1) return;

        // We do some check - for example based on the size of the points array or something else
        if (this.points.length >= this.max) return;

        // add the new position
        this.points.push(new THREE.Vector3(pos.x, pos.y, pos.z))

        // update the time
        this.recent = time

        // update the mesh
        this.updateLineMesh()
    },

    isComplete(time, pos) {
        return (this.points.length < this.max) ? false : true
    },

    updateLineMesh() {
        // update the geometry with the new points
        this.geometry.setFromPoints(this.points)
    }

}

// The space curve manager
export function SpaceCurveManager(tx, sx) {

    this.tx = tx
    this.sx = sx
    this.curves = new Map()
}
SpaceCurveManager.prototype = {

    // Here we receive the objects to track
    '-> setup'({ name, color, orbit}) {

        //check
        if (!name || !color || !orbit) return;

        //check if we have the curve already
        if (this.curves.has(name)) return;

        // create a new curve
        const curve = new SpaceCurve(name, color, Math.ceil(orbit.orbital_period))

        // add the curve to the map
        this.curves.set(name, curve)

        // create the 3D curve line, color ...
        curve.updateLineMesh()
    },

    // time is the julian time !
    '-> position'({ name, time, pos }) {

        // get the curve
        const curve = this.curves.get(name)

        // store the new position for the curve
        curve?.newPosition(time, pos)
    },

    '-> curve show'(name) {
        if (name == "all") {
            for( const curve of this.curves.values()) this.tx.send('scene add', curve.lineMesh)
        }
    },

    '-> curve hide'(name) {
        if (name == "all") {
            for( const curve of this.curves.values()) this.tx.send('scene.remove', curve.lineMesh)
        }
    },

    // test function to draw a circle
    drawCircle(radius) {

        const points = []
        const segments = 64
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2
            points.push(new THREE.Vector3(radius * Math.cos(theta), radius * Math.sin(theta), 0))
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 })
        const circle = new THREE.Line(geometry, material)

        // add the circle to the scene
        this.tx.send('scene add', circle)
    }

}
