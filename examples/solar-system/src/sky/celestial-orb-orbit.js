import {solveKeplerEquation, degToRad} from './equations-and-constants'
import * as THREE from 'three'

export const orbitFunctions = {
    
    precompute() {

        // check
        if (! this.ephemeris?.orbit) return
    
        // notation
        const orbit = this.ephemeris.orbit
    
        // Precompute constants that remain the same for a given planet
        const i = degToRad(orbit.inclination);  // inclination in radians
        const omega = degToRad(orbit.argument_of_periapsis);  // argument of periapsis in radians
        const Omega = degToRad(orbit.longitude_of_ascending_node);  // longitude of ascending node in radians
        const M0 = degToRad(orbit.mean_anomaly);  // mean anomaly at epoch in radians
        const n = 2 * Math.PI / orbit.orbital_period;  // mean motion (radians per day)
        
        // Return precomputed values for reuse
        return {
            i: i,
            omega: omega,
            Omega: Omega,
            M0: M0,
            n: n,
            a: orbit.semi_major_axis, 
            e: orbit.eccentricity, 
            epoch: orbit.epoch ,     
            AngularSpeed: this.ephemeris.rotation_axis.rotation_period ? (2*Math.PI)/this.ephemeris.rotation_axis.rotation_period : 0,
        };
    },
    
    adjustEpoch(newEpoch) {
        // check
        if (! this.precomputed) return
    
        // notation
        const pre = this.precomputed
    
        // Calculate new mean anomaly at the new epoch
        pre.M0 = pre.M0 + pre.n * (newEpoch - pre.epoch);

        // adjust epoch
        pre.epoch = newEpoch

        // set the correct starting rotation angle for orbs that have rotation (Earth !)
        this.setInitialRotation?.(newEpoch)
    },
    
    newPosition(time) {
    
        const { i, omega, Omega, M0, n, a, e, epoch } = this.precomputed;
        
        // Calculate mean anomaly at the given time
        const M = M0 + n * (time - epoch);  // mean anomaly at given time (radians)
        
        // Solve Kepler's equation to get eccentric anomaly E
        const E = solveKeplerEquation(M, e);
        
        // Calculate the true anomaly (nu)
        const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
        
        // Calculate heliocentric distance (r)
        const r = a * (1 - e * Math.cos(E));
        
        // Heliocentric coordinates in the plane of the orbit
        const xPrime = r * Math.cos(nu);
        const yPrime = r * Math.sin(nu);
        const zPrime = 0;  // In the orbital plane, z' is 0
        
        // Rotation to 3D space
        // 1. Rotate by omega (argument of periapsis)
        const x1 = xPrime * Math.cos(omega) - yPrime * Math.sin(omega);
        const y1 = xPrime * Math.sin(omega) + yPrime * Math.cos(omega);
        
        // 2. Rotate by inclination (i)
        const x2 = x1;
        const y2 = y1 * Math.cos(i);
        const z2 = y1 * Math.sin(i);
        
        // 3. Rotate by Omega (longitude of ascending node)
        const x = x2 * Math.cos(Omega) - y2 * Math.sin(Omega);
        const y = x2 * Math.sin(Omega) + y2 * Math.cos(Omega);
        const z = z2;
        
        return { x: x, y: y, z: z };
    },

    adjustAxis(orb) {
        // Check if rotation axis data is available
        if (!this.ephemeris?.rotation_axis || !this.ephemeris?.orbit) return;
    
        // Notation
        const axis = this.ephemeris.rotation_axis;
        const orbit = this.ephemeris.orbit; // Contains orbital elements
    
        // Convert angles to radians
        const axialTilt = degToRad(axis.axial_tilt);
        const inclination = degToRad(orbit.inclination || 0);
        const ascendingNode = degToRad(orbit.longitude_of_ascending_node || 0);
    
        // Step 1: Define the rotational axis in ecliptic coordinates
        let rotationalAxis = new THREE.Vector3(0, 0, 1); // Points along positive Z-axis
    
        // Step 2: Apply the axial tilt around the X-axis
        const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            axialTilt
        );
        rotationalAxis.applyQuaternion(tiltQuaternion);
    
        // Step 3: Apply the rotation due to inclination and ascending node
        // Rotate around the Z-axis by the longitude of the ascending node (Ω)
        const ascendingNodeQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1), // Rotation around Z-axis
            ascendingNode
        );
        rotationalAxis.applyQuaternion(ascendingNodeQuaternion);
    
        // Rotate around the X-axis by the inclination (i)
        const inclinationQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), // Rotation around X-axis
            inclination
        );
        rotationalAxis.applyQuaternion(inclinationQuaternion);
    
        // Step 4: Apply an additional 180-degree rotation around the Z-axis if the axis is inverted
        const correctionQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1), // Rotation around Z-axis
            Math.PI // 180 degrees in radians
        );
        rotationalAxis.applyQuaternion(correctionQuaternion);
    
        // Step 5: Normalize the rotational axis vector
        rotationalAxis.normalize();
    
        // Step 6: Create a quaternion to align the object's Z-axis with the rotational axis
        const zAxis = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(zAxis, rotationalAxis);
    
        // Apply the quaternion rotation to the Object3D
        orb.setRotationFromQuaternion(quaternion);
    },
       
    // Function to get the final axis vector of the mesh in world coordinates
    getAxisVector() {
    
        // The pole-axis of the mesh in its local coordinate system
        const poleAxis = new THREE.Vector3(0, 0, 1);
    
        // Apply the mesh's transformation matrix to get the world-space direction
        const worldZAxis = poleAxis.applyMatrix4(this.group.matrixWorld);
    
        // done
        return worldZAxis;
    },

    // Function to create and draw an axis using THREE.ArrowHelper
    createAxisArrow(length, color) {

        // get the axis of the group 
        const axisVector = this.getAxisVector()

        // Create an ArrowHelper to represent the axis
        const arrow = new THREE.ArrowHelper(
            //new THREE.Vector3(0,1,0), // Direction of the arrow
            axisVector,
            //new THREE.Vector3(0, -2*radius, 0), // Start point (center of the planet)
            new THREE.Vector3(0, 0, 0), // Start point (center of the planet)
            length, // Length of the arrow
            color // Color of the arrow
        );

        arrow.visible = true;
        
        // done
        return arrow
    },
}

