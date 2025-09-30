import {CelestialOrb, lodLevels} from './celestial-orb'
import {kmAU, MAX_SPEED_FOR_ROTATION, getAngularOffset} from './equations-and-constants'

import * as THREE from 'three'

export function Planet(tx, sx) {

    // The planet is a celestial orb
    CelestialOrb.call(this, tx, sx)

    // A planet can have a rotational offset (earth !)
    this.rotationOffset = 0
}
Planet.prototype = {}

const planetFunctions = {

    '-> moon add'(moon) {
        this.group?.add(moon)
    },

    // not used actually...
    '-> moon dispose'(moon) {},
    '-> moon remove'(moon) {},

    setScale(magnify) {
        this.scaleFactor = magnify.planet.on ? magnify.planet.size.current : 1
    },

    // the planet update function
    update(delta) {

        // if the jd is still zero, we are not initialised yet
        if (!this.jd) return;

        // calculate the new jd - The reference speed is 1 sec = 1 earth day
        this.jd += delta * this.speedFactor

        // calculate new planet position - is in km
        const pp = this.newPosition(this.jd)

        // to au
        pp.x *= kmAU
        pp.y *= kmAU
        pp.z *= kmAU

        // ...and position the planet
        this.group.position.set(pp.x, pp.y, pp.z)

        // send out the new position
        this.tx.send('orbit position',{name: this.sx.name, time: this.jd, pos: pp})

        const pre = this.precomputed

        // Check if we want to do a rotation as well...
        if ( (this.speedFactor > MAX_SPEED_FOR_ROTATION) || !pre.AngularSpeed) return;

        // rotational angle
        const angle = (pre.AngularSpeed * delta * this.speedFactor * 86400) % (2*Math.PI)

        // check if we have a rotation speed
        this.rotateAroundAxis(angle)
    },

    rotateAroundAxis(angle) {

        // Calculate the angle over which the planet has turned
        // const angle = (this.precomputed.AngularSpeed * delta * this.speedFactor * 86400) % (2*Math.PI)

        // get the axis
        const axis = new THREE.Vector3(0, 0, 1); // Assuming the axis of rotation is the Y axis (vertical)

        // Create a quaternion to represent the incremental rotation
        const rotator = new THREE.Quaternion();
        rotator.setFromAxisAngle(axis, angle);

        // Apply the rotation to the planet sphere only (not the group, to avoid rotating moons)
        this.lod.quaternion.premultiply(rotator);

        // rotate the label if any
        this.label?.quaternion.premultiply(rotator)
    },

    // sets the correct rotation for a planet (Earth ! actually) given a date
    setInitialRotation(jd) {

        this.lod.quaternion.identity()

        const angle = getAngularOffset(jd)

        if (! angle) return;

        this.rotateAroundAxis(angle)
    },

    '-> place local camera'({coordinates, camera}) {

        // reschedule if we have not yet received the ephemerides
        if (!this.ephemeris) return this.tx.reschedule()

        // The radius of the planet in AU
        const radius = this.ephemeris.radius * kmAU

        // put the camera on the planet at the required coordinates
        camera.placeOnSphere(coordinates,  radius)

        // if the camera has not been added yet, add it
        if (!this.lod.children.includes(camera.device)) this.lod.add(camera.device);

        // make it visible
        camera.helper.visible = true
    }
}
Object.assign(Planet.prototype, CelestialOrb.prototype, planetFunctions)
