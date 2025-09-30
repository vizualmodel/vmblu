import {kmAU} from './equations-and-constants'
import {CelestialOrb} from './celestial-orb'
import * as THREE from 'three'


export function Moon(tx, sx) {

    // The planet is a celestial orb
    CelestialOrb.call(this, tx, sx)

    // We also have to resize the orbit otherwise it is inside the planet !
    this.orbitFactor = 1
}
Moon.prototype = {}

const moonFunctions = {

update(delta) {

    // for one day = 1 sec
    this.jd += delta * this.speedFactor

    // calculate new planet position
    const pp = this.newPosition(this.jd)

    // The orbit 
    const Z = this.orbitFactor * kmAU

    // ...and position the moon
    this.group.position.set(pp.x * Z, pp.y * Z, pp.z * Z)
    
    // check if we have a rotation speed
    if (!this.precomputed.AngularSpeed) return;

    // Calculate the angle over which the planet has turned
    const angle = (this.precomputed.AngularSpeed * delta * this.speedFactor * 86400) % (2*Math.PI)

    // get the axis
    const axis = new THREE.Vector3(0, 0, 1); // Assuming the axis of rotation is the Y axis (vertical)

    // Create a quaternion to represent the incremental rotation
    const rotator = new THREE.Quaternion();
    rotator.setFromAxisAngle(axis, angle);

    // Apply the rotation to the planet sphere only (not the group, to avoid rotating moons)
    this.lod.quaternion.premultiply(rotator);

    // rotate the label
    this.label?.quaternion.premultiply(rotator)

},

setScale(magnify) {

    // magnify the moon
    this.scaleFactor = magnify.moon.on ? magnify.moon.size.current : 1

    // and the orbit
    this.orbitFactor = magnify.moon.orbit.on ? magnify.moon.orbit.size.current : 1
},
}

Object.assign(Moon.prototype, CelestialOrb.prototype, moonFunctions)
