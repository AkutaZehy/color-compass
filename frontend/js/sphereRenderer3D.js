// frontend/js/sphereRenderer3D.js

// Import Three.js core and controls
import * as THREE from '../lib/three/build/three.module.js';
import { OrbitControls } from '../lib/three/examples/jsm/controls/OrbitControls.js';
import { rgbToLab } from './colorUtils.js'; // Need Lab conversion


let scene, camera, renderer, controls;
let sphereContainerElement;
let animationFrameId = null; // To keep track of the animation loop

/**
 * Sets up the 3D scene for the color sphere visualization.
 * @param {HTMLElement} container - The DOM element to render the sphere into.
 * @param {Uint8ClampedArray} pixelData - The pixel data array (R, G, B, A).
 * @param {number} imageWidth - Original image width.
 * @param {number} imageHeight - Original image height.
 * @param {number} pixelSampleFactor - Process every Nth pixel for performance.
 */
export function setupSphereScene (container, pixelData, imageWidth, imageHeight, pixelSampleFactor = 200) { // Export the function
  // Clear previous scene if it exists
  disposeScene(); // Dispose resources from previous rendering

  if (!container || !pixelData || pixelData.length === 0 || imageWidth === 0 || imageHeight === 0) {
    console.error("Cannot setup 3D scene: missing container or pixel data.");
    return;
  }

  sphereContainerElement = container;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  if (containerWidth <= 0 || containerHeight <= 0) {
    console.warn("3D container has zero dimensions. Cannot set up scene.");
    return;
  }

  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a); // Match container background

  // 2. Camera
  camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 1000);
  // Position camera to look at the center of the sphere (0,0,0)
  camera.position.set(0, 0, 250); // Example start position

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true }); // antialias for smoother edges
  renderer.setSize(containerWidth, containerHeight);
  renderer.setPixelRatio(window.devicePixelRatio); // Handle high resolution displays

  // Append renderer's canvas to the container
  // Clear container first to remove old canvas or placeholder
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.appendChild(renderer.domElement);

  // 4. Lighting (optional, but good for seeing the wireframe sphere and potentially points)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light everywhere
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Directional light
  directionalLight.position.set(0, 1, 1).normalize(); // Position it
  scene.add(directionalLight);


  // 5. Controls (Mouse interaction)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // Smooth camera movement
  controls.dampingFactor = 0.25;
  controls.screenSpacePanning = false; // Prevent panning
  controls.maxPolarAngle = Math.PI; // Allow full vertical rotation (from top to bottom)
  controls.target.set(0, 0, 0); // Orbit around the center


  // --- Create Visualizations ---

  // Lab space mapping parameters
  const sphereRadius = 100;
  // Standard Lab ranges: L*[0,100], a*[-128, 128], b*[-128, 128] approx.
  // Map these ranges to the sphere's coordinates.
  // Map L* [0, 100] to Y [-sphereRadius, sphereRadius]. L=50 should be Y=0 (equator).
  const mapLtoY = (l) => (l / 100 - 0.5) * sphereRadius * 2;

  // Map a*b* plane to XZ plane (radius from Y axis, and angle).
  // Max chroma is theoretical ~181. Use 200 as a slightly larger mapping range for a*b* magnitude.
  const labMaxChromaForMapping = 200; // Use 200 as max magnitude for a*, b*
  const maxMappedDistanceFromCenter = sphereRadius; // Map max chroma to sphereRadius


  // Helper function to map full Lab to a 3D Vector3
  const labToSphereCoords = (lab) => {
    const l = lab[0];
    const a = lab[1];
    const b = lab[2];

    // Map L* to Y coordinate
    const y = mapLtoY(l);

    // Calculate chroma (distance from L* axis in Lab space)
    const chroma = Math.sqrt(a * a + b * b);

    // Map chroma to distance from Y axis in 3D sphere. Clamp to sphereRadius.
    const distFromY = Math.min(chroma / labMaxChromaForMapping * maxMappedDistanceFromCenter, sphereRadius);

    // Calculate hue angle (angle in the a*b* plane)
    const hueAngle = Math.atan2(b, a); // Angle in radians

    // Convert polar (distance, angle) to cartesian (x, z) in the XZ plane
    const x = distFromY * Math.cos(hueAngle);
    const z = distFromY * Math.sin(hueAngle);

    // A small adjustment might be needed to ensure points are *on* the sphere surface
    // or within a small radius. A simple mapping puts them inside the sphere volume.
    // To put them on the surface based on L*, hue and chroma:
    // We can treat L as Y, and (chroma, hue) as polar coords in XZ, then normalize to sphere radius.
    // Let's keep the volume mapping for now as it shows internal distribution better.
    // A simple volume mapping is (scaled_a, scaled_L, scaled_b) -> (x,y,z)
    // But the requested visual looks like (L, chroma, hue) mapped to spherical coords.
    // Let's use the L=Y, (a,b)=XZ mapping as implemented, it creates a sphere-like volume.

    return new THREE.Vector3(x, y, z);
  }

  // --- Draw Sphere Outline and Grid ---
  // SphereGeometry(radius, widthSegments, heightSegments)
  const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 32);
  const wireframe = new THREE.WireframeGeometry(sphereGeometry);
  const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 });
  const wireframeMesh = new THREE.LineSegments(wireframe, wireframeMaterial);
  scene.add(wireframeMesh);

  // Optional: Add axes lines for L*, a*, b* direction?

  // --- Draw Pixel Points ---
  // Using THREE.Points is more performant for large numbers of points
  const pointsGeometry = new THREE.BufferGeometry();
  const positions = []; // Array to store x, y, z coordinates
  const colors = [];    // Array to store r, g, b colors (0-1 range)

  const totalPixels = imageWidth * imageHeight;
  if (totalPixels / pixelSampleFactor < 100) { // Ensure minimum number of points
    pixelSampleFactor = Math.max(1, Math.floor(totalPixels / 100));
    console.warn(`Adjusting 3D sample factor to ${pixelSampleFactor} to ensure at least 100 points.`);
  }


  // Process sampled pixel data
  for (let i = 0; i < totalPixels; i += pixelSampleFactor) {
    const dataIndex = i * 4;
    if (dataIndex >= pixelData.length) break;

    const r = pixelData[dataIndex];
    const g = pixelData[dataIndex + 1];
    const b = pixelData[dataIndex + 2];
    // Alpha channel pixelData[dataIndex + 3]

    // Store color as 0-1 for Three.js Color attribute
    colors.push(r / 255, g / 255, b / 255);

    // Calculate Lab and map to 3D coordinates
    const lab = rgbToLab(r, g, b);
    const point3D = labToSphereCoords(lab);

    positions.push(point3D.x, point3D.y, point3D.z);
  }

  // Set attributes on the geometry
  pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Create material and points mesh
  const pointsMaterial = new THREE.PointsMaterial({
    size: 1.5, // Size of each point
    vertexColors: true, // Use color attribute
    transparent: true,
    opacity: 0.6, // Make points semi-transparent
    blending: THREE.AdditiveBlending // Optional: blend colors additively for brighter look
  });

  const points = new THREE.Points(pointsGeometry, pointsMaterial);
  scene.add(points);


  // --- Animation Loop (for interactive controls) ---
  function animate () {
    // Cancel any existing animation frame before requesting a new one
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    animationFrameId = requestAnimationFrame(animate);

    // required if controls.enableDamping or controls.autoRotate are set to true
    controls.update();

    renderer.render(scene, camera);
  }

  // Start the animation loop
  animate();

  // Handle window resize - needs to be attached to the specific container's resize
  // Or ideally, listen to the window resize and update based on container client size
  const onWindowResize = () => {
    // Check if renderer and container still exist
    if (!renderer || !sphereContainerElement) return;

    const newWidth = sphereContainerElement.clientWidth;
    const newHeight = sphereContainerElement.clientHeight;

    if (newWidth > 0 && newHeight > 0) {
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      // renderer.setPixelRatio(window.devicePixelRatio); // Re-apply pixel ratio on resize
    }
  };

  // Attach resize listener
  // Remove the previous listener if it was attached to the same container
  if (sphereContainerElement && sphereContainerElement.__resizeListener) {
    window.removeEventListener('resize', sphereContainerElement.__resizeListener);
    delete sphereContainerElement.__resizeListener;
  }
  window.addEventListener('resize', onWindowResize, false);
  sphereContainerElement.__resizeListener = onWindowResize; // Store reference


  console.log(`3D Scene setup complete. Rendered ${positions.length / 3} points.`);

}

/**
 * Disposes Three.js resources to prevent memory leaks.
 * Should be called before setting up a new scene.
 */
export function disposeScene () { // <-- Add export here
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (renderer) {
    renderer.dispose(); // Dispose renderer and its WebGL resources
    // Remove canvas from DOM
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  if (scene) {
    // Traverse and dispose geometry, materials, textures etc. in the scene
    scene.traverse(object => {
      // Dispose geometry if it exists
      if (object.geometry) {
        object.geometry.dispose();
        // console.log(`Disposed geometry for ${object.type}`); // Debugging
      }

      // Dispose material(s) if it exists
      if (object.material) {
        // If it's an array of materials
        if (Array.isArray(object.material)) {
          for (const material of object.material) {
            if (material.map) material.map.dispose(); // Dispose textures
            material.dispose();
            // console.log(`Disposed material array item for ${object.type}`); // Debugging
          }
        } else {
          if (object.material.map) object.material.map.dispose(); // Dispose textures
          object.material.dispose();
          // console.log(`Disposed material for ${object.type}`); // Debugging
        }
      }
    });
    // Nullify the scene
    scene = null;
  }

  if (controls) {
    controls.dispose(); // Dispose controls listeners
  }

  // Remove window resize listener if it exists
  if (sphereContainerElement && sphereContainerElement.__resizeListener) {
    window.removeEventListener('resize', sphereContainerElement.__resizeListener);
    delete sphereContainerElement.__resizeListener; // Clean up stored reference
  }

  // Nullify other global references
  camera = null;
  renderer = null;
  controls = null;
  sphereContainerElement = null; // Clear container reference

  console.log("Previous 3D scene disposed.");
}