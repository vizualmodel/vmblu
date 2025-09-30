// ------------------------------------------------------------------
// Source node: Planet
// Creation date 7/27/2024, 3:14:06 PM
// ------------------------------------------------------------------
import * as THREE from 'three'
import {julianDate, kmAU, degToRad} from './equations-and-constants'
import {orbitFunctions} from './celestial-orb-orbit'
import {celestialOrbHandlers} from './celestial-orb-handlers'
import {julianDateFromUTC} from './equations-and-constants'
import {createTextSprite, textTo3D} from '../3d/text-objects'

// The lod levels used for the spheres
const lodFactor = 10
const subdiv = 16
export const lodLevels = [
    {what:'sphere', w:subdiv*4,h:subdiv*4,  distance:0},
    {what:'sphere', w:subdiv*2,h:subdiv*2,  distance:lodFactor},
    {what:'sphere', w:subdiv,  h:subdiv,    distance:lodFactor**2},
    {what:'sprite', size: 2,                distance:lodFactor**3}
]

const axisColor = 0x8888ff

//Constructor for planet
export function CelestialOrb(tx, sx) {

	// save the tx and the sx
	this.tx = tx
	this.sx = sx

    // the group combines all meshes for the object
    this.group = null

	// the planet specs
	this.ephemeris

    // the base color used by the orb
    this.baseColor = +sx.color

    // the materials used for this orb
    this.material = {
        basic:null,
        phong:null,
        toon: null,
        points: null,
        emissive: null
    }

    // The different meshes for the planet
    this.lod = null

    // The precomputed orbit (or other values)
    this.precomputed = null

    // An arrow to show the axis of the orb
    this.axisArrow = null

    // The orb can have a label
    this.label = null

    // keep track of the julian date for animation purposes
    this.jd = 0

    // The speed of the simulation - value 1 means 1day = 1sec
    this.speedFactor = 1

    // The orb can be displayed at its actual size, or be scaled
    this.scaleFactor = 1

	// create the orb
	this.create()
}
CelestialOrb.prototype = {


// set up a sphere with the given values
async create() {
    // get the details of the planet
    this.tx.request("ephemeris", this.sx.name)
    .then( async (ephemeris) => {

        // save the settings
        this.ephemeris = ephemeris

        // initialise the common elements
        this.initialise();

        // initialise specific stuff if present
        this.initSpecific?.();

        // add the mesh to the scene
        this.tx.send('scene add', this.group);

        // add the entire object to the actor list
        this.tx.send('actor add', this);

        // setup representation and simulation parameters
        await this.getPresentation(ephemeris);
        await this.getSimulation(ephemeris);

        // Now send presentation data to whoever needs it
        this.tx.send("presentation chart and output settings",{name:ephemeris.name, type: ephemeris.type, color:this.sx.color, orbit: ephemeris.orbit})
    })
    .catch ( error => {
        console.error('Error setting up the planet:', error);
    });
},

async getPresentation(ephemeris) {
    this.tx.request('presentation get user settings', { type: ephemeris.type, name: ephemeris.name })
    .then(solsys => {

        // Check if we have to turn the labels on or of
        if (this.label) this.label.visible = solsys.labels.on;

        // check if the scale has changed
        this.setScale(solsys.magnify);
        this.scale()
    })
    .catch(error => {
        console.error('Error in getRepresentation:', error);
    });
},

async getSimulation(ephemeris) {
    
    this.tx.request('simulation get user settings', { type: ephemeris.type, name: ephemeris.name },10000)
    .then(simulate => {

        if (!simulate) {
            console.warn('No simulation settings', ephemeris.name)
            return;
        }

        // save the sped-up
        this.speedFactor = simulate.speed.current;

        // convert to julian date
        this.jd = julianDateFromUTC(simulate.start);

        // recalculate the epoch
        this.adjustEpoch(this.jd)
    })
    .catch(error => {
        console.error(`Error in getSimulation for ${ephemeris.name} \n-->${error}`);
        //console.error('Error in getSimulation:', error);
    });
},

initialise() {

    // the radius of the planet in 'world' units
    const radius = this.ephemeris.radius * kmAU

    // create the group for the planet
    this.group = new THREE.Group()

    // create all the lods for the planet
    this.lod = this.createLod( radius )

    // add the LOD to the group
    this.group.add(this.lod)

    // Add a label to identify the orb
    //this.addLabel(radius)
    this.add3DText(radius)

    // create an arrow to show the axis
    this.axisArrow = this.createAxisArrow(2 * radius, axisColor)

    // add it to the group
    this.group.add(this.axisArrow)

    // allign the axis of the meshes with the axis of the orb
    this.adjustAxis(this.group)

    // do some precomputations
    this.precomputed = this.precompute()

    // set the group at position 0
    this.group.position.set(0,0,0)
},

createMaterial() {

    // Create the materials once
    this.material.basic = new THREE.MeshBasicMaterial({color: this.baseColor, wireframe: true});
    this.material.phong = new THREE.MeshPhongMaterial({color: this.baseColor, shininess: 1});
    this.material.points = new THREE.PointsMaterial({color: this.baseColor, size: lodLevels.at(-1).size, sizeAttenuation: false})
    this.material.toon = new THREE.MeshToonMaterial({color: this.baseColor})

    // if there is a texture file, apply it
    if (this.sx.textureFile) {

        this.applyTexture(this.sx.textureFile)
    }
},

createLod(radius) {

    // create an LOD
    const lod = new THREE.LOD();

    // set up the materials
    this.createMaterial()

    // set the different levels
    for (const level of lodLevels) {

        let mesh = null

        if (level.what == 'sphere') {

            // make a sphere
            mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, level.w, level.h),this.material.phong);

            // set the poles along the z-axis
            mesh.rotation.x = Math.PI/2
        }
        else if (level.what == 'sprite') {

            // add a simple point mesh
            mesh = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]), this.material.points);
        }

        // add the level - make the activation distance dependant on the size
        lod.addLevel(mesh, level.distance * radius);
    }

    // done
    return lod
},

scale() {

    // The new scale factor has been set
    const newScale = this.scaleFactor

    // save the old scale
    const oldScale = this.lod.scale.x 

    // check
    if (oldScale === newScale) return

    // scale the group
    this.lod.scale.set(newScale, newScale, newScale)

    // adapt the LOD levels
    for (const level of this.lod.levels) level.distance *= newScale / oldScale

    // calculate the scaled radius
    const radius = this.ephemeris.radius * kmAU * newScale;

    // Update label position
    if (this.label) this.placeLabel(radius)

    // Scale the axis arrow
    if (this.axisArrow) this.axisArrow.setLength(2 * radius)
},

applyTexture(textureUrl) {
    // get a loader
    const textureLoader = new THREE.TextureLoader();

    // load the texture
    textureLoader.load(textureUrl, (texture) => {

        // and adjust the phong material
        this.material.phong.map = texture;
        this.material.phong.needsUpdate = true;

    // report error (probably file not found)
    }, undefined, (error) => {
        console.error('Error loading texture:', error);
    });
},

placeLabel(radius) {

    if (!this.label) return

    this.label.position.set(0,0,1.5*radius)
},

addLabel(radius) {
    // create a label
    this.label = createTextSprite(this.ephemeris.name)

    // Set the label just above the planet
    this.placeLabel(radius)
    //this.label.position.set(0, 0, 1.1 * radius)

    // add the label to the group
    this.group.add(this.label)
},

async add3DText(radius) {

    const size = 0.01

    this.label = await textTo3D(this.ephemeris.name, size, +this.sx.color, size/5)

    // Note that the scaleFactor might have changed
    this.placeLabel(radius*1.5*this.scaleFactor)
    //this.label.position.set(0,0,radius*1.5*this.scaleFactor)

    const rotator = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI/2)
    this.label.quaternion.multiply(rotator)

    this.group.add(this.label)
}

} // planet.prototype

Object.assign(CelestialOrb.prototype, celestialOrbHandlers, orbitFunctions)
