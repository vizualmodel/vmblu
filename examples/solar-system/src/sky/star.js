// ------------------------------------------------------------------
// Source node: Star
// Creation date 5/9/2024, 3:14:06 PM
// ------------------------------------------------------------------
import * as THREE from 'three'
import {CelestialOrb} from './celestial-orb'
import {kmAU, julianToGregorian, julianDateFromUTC} from './equations-and-constants'

const DATE_UPDATE_INTERVAL = 1

export function Star(tx, sx) {

    // a star is a celestial orb
    CelestialOrb.call(this, tx, sx)

    // The star shines
    this.light = null

    // keep track of the date
    this.date = new Date()

    // the date update time lapse
    this.interval = {
        dateUpdate: 0
    }
}
Star.prototype = {}

const starFunctions = {

    // nothing to precompute
    precompute() {},

    // initialise the specific stuff for this 
    initSpecific() {

        // White light, intensity, dsitance
        const light = this.sx.light
        this.light = light  ? new THREE.PointLight(+light.color, light.intensity , light.distance)
                            : new THREE.PointLight(0xffffff, 5, 100); 

        // Place at the center where the sun is  
        this.light.position.set(0, 0, 0);  

        // add the light
        this.tx.send('scene add', this.light)      

        // add an emissive material for the sun
        const emit = this.sx.emissive
        this.material.emissive = emit   ? new THREE.MeshPhongMaterial({ color: this.baseColor,emissive: +emit.color, emissiveIntensity: emit.intensity})
                                        : new THREE.MeshPhongMaterial({ color: this.baseColor})

        // change the material in all lods for the sun
        for(const level of this.lod.levels) {
            level.object.material = this.material.emissive
        }
    },

    setScale(magnify) {
        this.scaleFactor = magnify.sun.on ? magnify.sun.size.current : 1
    },

    update(delta) {

        // calculate the new jd
        this.jd += delta * this.speedFactor

        this.interval.dateUpdate += delta
        if (this.interval.dateUpdate > DATE_UPDATE_INTERVAL) {

            // send the new date
            this.tx.send("current date", julianToGregorian(this.date, this.jd))

            // and reset the interval
            this.interval.dateUpdate = 0
        }
    },

    '-> presentation user change'({what, solsys}) {

        switch (what) {

            case 'label on/off':
                this.label.visible = solsys.labels.on
                break

            case 'magnify':
                
                // Magnify contains several scales (stars, planet, moons) - so we have to call the specific function for each
                this.setScale(solsys.magnify)

                // and now scale 
                this.scale()
                break
        }
    },

    '-> simulation user change'({what, simulate}) {

        switch (what) {

            case 'speed':
                this.speedFactor = simulate.speed.current
                break

            case 'start date':
                
                // calculate julian date
                this.jd = julianDateFromUTC(simulate.start)

                // recalculate the epoch
                // this.adjustEpoch(this.jd)

                // send the new date
                //this.tx.send("current date", julianToGregorian(this.date, this.jd))
                break
        }
    },
}
Object.assign(Star.prototype, CelestialOrb.prototype, starFunctions)

