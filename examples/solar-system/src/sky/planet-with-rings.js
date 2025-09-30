import {Planet} from './planet'
import {lodLevels} from './celestial-orb'
import * as THREE from 'three'

export function Saturn(tx, sx) {
    Planet.call(this, tx, sx)
}
Saturn.prototype = {}

// specific saturn functions
const saturnFunctions = {

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

                // get the rings
                const [innerRing, outerRing] = this.createRings(radius, +this.sx.colorRing ?? 0xffffff, level.w)

                // Group the mesh and rings together
                const planetGroup = new THREE.Group();
                planetGroup.add(mesh);
                planetGroup.add(innerRing);
                planetGroup.add(outerRing);

                // Add the group to the LOD
                lod.addLevel(planetGroup, level.distance * radius);

            }
            else if (level.what == 'sprite') {
    
                // add a simple point mesh
                mesh = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]), this.material.points);

                // add the level - make the activation distance dependant on the size
                lod.addLevel(mesh, level.distance * radius);
            }
        }
    
        // done
        return lod
    },

    createRings(radius, color, subdiv=64) {

        // Define the inner and outer radii for the two ring sections
        const innerRingInnerRadius = radius * 1.2;
        const innerRingOuterRadius = radius * 2.0; // Inner part of the rings
        const outerRingInnerRadius = radius * 2.1; // Start after the Cassini Division
        const outerRingOuterRadius = radius * 2.5; // Outer part of the rings
    
        // Create the geometry for the inner ring
        const innerRingGeometry = new THREE.RingGeometry(innerRingInnerRadius, innerRingOuterRadius, subdiv);
        //innerRingGeometry.rotateX(Math.PI / 2); // Align to Saturn's equatorial plane
    
        // Create the geometry for the outer ring
        const outerRingGeometry = new THREE.RingGeometry(outerRingInnerRadius, outerRingOuterRadius, subdiv);
        //outerRingGeometry.rotateX(Math.PI / 2);
    
        // Create a shared material for both rings
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9, // Adjust for a realistic appearance
        });
    
        // Create the meshes for the inner and outer rings
        const innerRing = new THREE.Mesh(innerRingGeometry, ringMaterial);
        const outerRing = new THREE.Mesh(outerRingGeometry, ringMaterial);
    
        return [innerRing, outerRing]
    }
}
Object.assign(Saturn.prototype, Planet.prototype, saturnFunctions)
