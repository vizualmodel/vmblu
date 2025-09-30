// Import Three.js dependencies
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// Do not releoad the font each time...
let cachedFont = null;

export async function textTo3D(text, height, color, depth) {

  return new Promise((resolve, reject) => {
    if (cachedFont) {
      createTextGeometry(cachedFont);
    } else {
      const loader = new FontLoader();
      loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        cachedFont = font;
        createTextGeometry(font);
      }, undefined, (err) => {
        reject(err);
      });
    }

    function createTextGeometry(font) {
      const textGeometry = new TextGeometry(text, {
        font: font,
        size: height,
        depth: depth,
        curveSegments: 12,
        bevelEnabled: false,
      });

      const material = new THREE.MeshPhongMaterial({color: color, shininess: 10});

      //const material = new THREE.MeshBasicMaterial({ color: color });
      const text3D = new THREE.Mesh(textGeometry, material);
      resolve(text3D);
    }
  });
}

// creates a sprite with text
export function createTextSprite(text) {

  // Create a canvas for the text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // Set the canvas size
  canvas.width = 256; // Width for the text label
  canvas.height = 64; // Increase the height for better aspect ratio

  // Set font and alignment
  const fontSize = 32; // Increase the font size for better readability
  context.font = `${fontSize}px Arial`;
  context.fillStyle = '#5555ff'; // Text color

  // Draw the text in the center of the canvas
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create a texture from the canvas
  const texture = new THREE.CanvasTexture(canvas);

  // Create sprite material
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });

  // Create sprite and set initial position
  const sprite = new THREE.Sprite(spriteMaterial);

  // Calculate the aspect ratio
  const aspectRatio = canvas.width / canvas.height;

  // Scale the sprite using the aspect ratio to prevent stretching
  const spriteHeight = 0.1;  // Base height of the sprite (adjust as needed)

  // Set the sprite's scale W x H
  sprite.scale.set(spriteHeight * aspectRatio, spriteHeight, 1);

  return sprite
}


// a texture to map on the planet surface
export function createTextTexture(text, w, h) {

  // Create a canvas element
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // Set canvas size based on planet diameter
  const size = 512; // Base size for high-resolution texture
  canvas.width = size;
  canvas.height = size;

  // Fill background (optional, you can skip this for transparency)
  //context.fillStyle = 'black'; // Set to 'black' or any other color for a visible background
  //context.fillRect(0, 0, size, size);

  // Set text properties dynamically based on diameter
  const fontSize = Math.round(16); // Scale text size based on diameter
  context.font = `${fontSize}px Arial`; // Font size and family
  context.fillStyle = 'white'; // Text color
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  // Draw the text on the canvas
  context.fillText(text, size / 2, size / 2);

  // Create a texture from the canvas
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true; // Update the texture after creating it

  return texture;
}
