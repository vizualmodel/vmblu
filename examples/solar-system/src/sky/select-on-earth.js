import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { parseCoordinates } from '../sky/equations-and-constants'

export function SelectOnEarth(canvas, sx) {

    this.sx = sx

    // The screen area
    this.canvas = canvas

    // The THREE stuff
    this.camera = null
    this.renderer = null
    this.clock = null
    this.scene = null
    this.light = null

    // The orbit controls
    this.controls = null

    // state
    this.is = {
        running : false
    }

    // content 
    this.radius = 1
    this.earth = null
    this.material = {
        phong: null
    }

    // To show where the camera is
    this.cone = null

    // we will need a raycaster for mouse clicks
    this.raycaster = null

    // set up the object
    this.setUp()
}
SelectOnEarth.prototype = {

    setUp() {

        // we need a canvas
        const canvas = this.canvas

        // get a renderer for teh canvas
		this.renderer = this.getRenderer(canvas) 

        // get a camera for the selector (this is ** not ** the planet camera !)
        this.camera = this.getCamera(this.canvas)

        //the scene
        this.scene = new THREE.Scene();

        // the light
        this.light = new THREE.AmbientLight(0xffffff, 0.8)
        this.scene.add( this.light); 

        // make earth
        this.earth = this.makeEarth(this.sx.earth)
        this.scene.add(this.earth)

        // make a cone, but do not show it yet
        this.cone = this.makeCone()
        this.earth.add(this.cone)

        // get a raycaster for intersections
        this.raycaster = new THREE.Raycaster();

        // set the controls
        this.controls = this.getControls(this.camera, this.canvas)

        // get the clock
        this.clock = new THREE.Clock();

        // run the animation
        this.is.running = true
        this.animate()
    },

    getRenderer(canvas) {
		const renderer = new THREE.WebGLRenderer({
			canvas, 
			antialias: true,
            alpha: true
		})
		renderer.setClearColor(0x000000, 0)
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(canvas.clientWidth, canvas.clientHeight)
        return renderer
    },

    // the camera that looks at the planet ( **not** the camera on the planet !)
    getCamera(canvas) {

        const spec = {
            fov: this.sx.camera.fov,
            near: this.sx.camera.near,
            far: this.sx.camera.far,
            aspect: canvas.clientWidth / canvas.clientHeight
        }

        const camera = new THREE.PerspectiveCamera(spec.fov, spec.aspect , spec.near, spec.far)
        camera.up.set(0,1,0)
        camera.position.set(0,0,3*this.radius)
        camera.lookAt(new THREE.Vector3(0,0,0))
        return camera
    },

    getControls(camera, canvas) {
        const controls = new OrbitControls( camera, canvas )
        controls.minDistance = camera.near
        controls.maxDistance = camera.far
        controls.maxPolarAngle = Math.PI;
        controls.enabled = true
        return controls
    },

    makeEarth(spec){

        // create the material
        this.material.phong = new THREE.MeshPhongMaterial({color: +spec.color, shininess: 10});
        this.applyTexture(spec.textureFile, this.material.phong)

        // create the geometry
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32)

        // and finally the mesh
        const mesh = new THREE.Mesh(geometry,this.material.phong)

        // const axes = new THREE.AxesHelper(1.1)
        // mesh.add(axes)

        const arrow = this.makeArrow(2.5 * this.radius)
        mesh.add(arrow)

        return mesh;
    },

    makeCone() {
        const L = 0.1
        const coneGeometry = new THREE.ConeGeometry(L/3, L, 6, 1, true);
        coneGeometry.translate(0, -L/2, 0)
        const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true});
        //const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5 });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        return cone
    },

    makeArrow(length) {
        const direction = new THREE.Vector3(0,1,0)
        const from = new THREE.Vector3(0, -length/2, 0)
        const color = 0x00ffff
        const arrow = new THREE.ArrowHelper(direction, from, length, color)
        arrow.setLength (length, 0.1, 0.1)
        return arrow
    },

    applyTexture(url, material) {

        // check
        if (! url) return

        // get a loader
        const textureLoader = new THREE.TextureLoader();
    
        // load the texture
        textureLoader.load(url, (texture) => {
    
            // and adjust the phong material
            material.map = texture;
            material.needsUpdate = true;
    
        // report error (probably file not found)
        }, undefined, (error) => {
            console.error('Error loading texture:', error);
        });
    },

    animate() {

		// immediately request a new animation frame
        requestAnimationFrame(() => this.animate());

		// do the required periodic updates
        if (this.is.running) {

			// time passed since last frame
			const delta = this.clock.getDelta();
			
			// update all actors
			this.update(delta);
		}

		// and render the scene
        this.renderer.render(this.scene, this.camera);
    },

    update(delta) {

        // Calculate the angle over which the planet has turned
        const angle = delta*0.05

        // get the axis
        const axis = new THREE.Vector3(0, 1, 0); // Assuming the axis of rotation is the Y axis (vertical)

        // Create a quaternion to represent the incremental rotation
        const rotator = new THREE.Quaternion();
        rotator.setFromAxisAngle(axis, angle);

        // Apply the rotation to the earth
        this.earth.quaternion.premultiply(rotator);
    },

    mouseIntersection(mouseX, mouseY) {

        // Convert mouse coordinates to normalized device coordinates (-1 to +1 range)
        const rect = this.canvas.getBoundingClientRect();
        const ndcX = ((mouseX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((mouseY - rect.top) / rect.height) * 2 + 1;
    
        // Update the raycaster with the camera and mouse position
        this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    
        // Check for intersections with the Earth sphere
        const intersects = this.raycaster.intersectObject(this.earth);
    
        // If there is an intersection, return the world coordinates
        if (intersects.length > 0) {

                // get the two intersections
                const A = intersects[0].point; 
                const B = intersects[1].point;

                // check if not degenerate
                return (A.y != 0 && A.z != 0) ? A : B
        }
    
        // If no intersection, return null
        return null;
    },

    // if the earth is turning we need to counterrotate the point
    counterRotate(point) {
        point.applyMatrix4(new THREE.Matrix4().copy(this.earth.matrixWorld).invert())
    },

    // place the cone on the earth at the given coordinates
	placeOnEarth(latitude, longitude) {

		// Convert latitude and longitude to radians 
		const latRad = THREE.MathUtils.degToRad(latitude) ;
		const lonRad = THREE.MathUtils.degToRad(longitude);

        // notation
        const radius = this.radius;

        // In our axes system x,y,z become
        // we have to change the sign of z because of the orientation of the axes (see below)
        const x = radius * Math.cos(latRad) * Math.cos(lonRad);
        const y = radius * Math.sin(latRad);
        const z = -radius * Math.cos(latRad) * Math.sin(lonRad);

        // place the cone at the requested position
        this.cone.position.set(x,y,z)

		// Create a quaternion to make sure the cone points up
		const quaternion = new THREE.Quaternion();
		const coneUp = new THREE.Vector3(0, 1, 0); // Assuming y-axis is north
		const earthNormal = new THREE.Vector3(-x, -y,-z).normalize();
		quaternion.setFromUnitVectors(coneUp, earthNormal);
        this.cone.setRotationFromQuaternion(quaternion);
	},

    vectorToCoordinates(intersectionPoint) {

        // Deconstruct the intersection point
        const { x, y, z } = intersectionPoint;
    
        // Calculate the radius (distance from the center of the sphere)
        const radius = Math.sqrt(x * x + y * y + z * z);
    
        // Calculate latitude in radians
        const latitudeRad = Math.asin(y / radius);
    
        // Calculate longitude in radians - because of the orientation of the axes we have to use -z
        // long > 0 = east = neg z and long < 0 = west = pos z !
        const longitudeRad = Math.atan2(-z, x);
    
        // Convert to degrees
        const latitude = THREE.MathUtils.radToDeg(latitudeRad);
        const longitude = THREE.MathUtils.radToDeg(longitudeRad);
    
        // Return as an object
        return { latitude, longitude };
    },    
    
}