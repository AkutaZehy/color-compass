// frontend/js/sphereRenderer3D.js

// Import Three.js core and controls
import * as THREE from '../lib/three/build/three.module.js';
import { OrbitControls } from '../lib/three/examples/jsm/controls/OrbitControls.js';
import { rgbToLab } from './colorUtils.js'; // Need Lab conversion
import { t } from './i18n.js'; // Import i18n module


let scene, camera, renderer, controls;
let sphereContainerElement;
let animationFrameId = null; // To keep track of the animation loop

// Helper mapping functions (defined outside setupScene but used within its scope)
// They were part of setupScene before, moved here for slightly better organization
const sphereRadius = 100;
// Standard Lab ranges: L*[0,100], a*[-128, 128], b*[-128, 128] approx.
// Map these ranges to the sphere's coordinates.
// Map L* [0, 100] to Y [-sphereRadius, sphereRadius]. L=50 should be Y=0 (equator).
const mapLtoY = (l) => (l / 100 - 0.5) * sphereRadius * 2;

// Map a*b* plane to XZ plane (radius from Y axis, and angle).
// Max chroma is theoretical ~181. Use 200 as a slightly larger mapping range for a*b* magnitude.
const labMaxChromaForMapping = 200; // Use 200 as max magnitude for a*, b*
const maxMappedDistanceFromCenter = sphereRadius; // Map max chroma to sphereRadius


// Helper function to map Lab (a, b) to a 2D vector in XZ plane
const mapABtoXZ = (a, b) => {
  const chroma = Math.sqrt(a * a + b * b);

  // Map chroma to distance from Y axis, clamped by sphereRadius
  const distFromY = Math.min(chroma / labMaxChromaForMapping * maxMappedDistanceFromCenter, sphereRadius);

  // Calculate hue angle (angle in the a*b* plane)
  const hueAngle = Math.atan2(b, a); // Angle in radians (Note: Lab b* is Y-axis in a*b* plot)

  // Convert polar (distance, angle) to cartesian (x, z) in the XZ plane
  const x = distFromY * Math.cos(hueAngle);
  const z = distFromY * Math.sin(hueAngle);
  return new THREE.Vector3(x, 0, z); // Return as a 3D vector in the XZ plane
};

// Helper function to map full Lab to a 3D Vector3 coordinate
const labToSphereCoords = (lab) => {
  const l = lab[0];
  const a = lab[1];
  const b = lab[2];

  // Map L* to Y coordinate
  const y = mapLtoY(l);

  // Map a*b* to XZ coordinates
  const xzVector = mapABtoXZ(a, b);

  // Combine to get the final 3D point (x, y, z)
  return new THREE.Vector3(xzVector.x, y, xzVector.z);
};


/**
 * Sets up the 3D scene for the color sphere visualization.
 * @param {HTMLElement} container - The DOM element to render the sphere into.
 * @param {Uint8ClampedArray} pixelData - The pixel data array (R, G, B, A).
 * @param {number} imageWidth - Original image width.
 * @param {number} imageHeight - Original image height.
 * @param {number} pixelSampleFactor - Process every Nth pixel for performance.
 * @returns {{renderer: THREE.WebGLRenderer, controls: OrbitControls, scene: THREE.Scene, camera: THREE.PerspectiveCamera}|null} Object containing renderer, controls, scene, camera, or null on error.
 */
export function setupSphereScene (container, pixelData, imageWidth, imageHeight, pixelSampleFactor = 100000) {
  // Dispose previous scene to free resources
  disposeScene();

  if (!container || !pixelData || pixelData.length === 0 || imageWidth === 0 || imageHeight === 0) {
    console.error("Cannot setup 3D scene: missing container or pixel data.");
    // Hide export buttons if setup fails
    const sphereExportButtons = container ? container.parentElement.querySelector('.export-buttons') : null;
    if (sphereExportButtons) {
      sphereExportButtons.style.display = 'none';
    }
    return null; // Return null on error
  }

  sphereContainerElement = container;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  if (containerWidth <= 0 || containerHeight <= 0) {
    console.warn("3D container has zero dimensions. Cannot set up scene.");
    // Hide export buttons if setup fails
    const sphereExportButtons = container ? container.parentElement.querySelector('.export-buttons') : null;
    if (sphereExportButtons) {
      sphereExportButtons.style.display = 'none';
    }
    return null; // Return null on error
  }

  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a); // Match container background

  // 2. Camera
  // PerspectiveCamera( fov, aspect, near, far )
  camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 1000);
  // Position camera to look at the center of the sphere (0,0,0)
  camera.position.set(0, 0, 250); // Example start position

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); // antialias for smoother edges, alpha: false for solid background
  renderer.setSize(containerWidth, containerHeight);
  renderer.setPixelRatio(window.devicePixelRatio); // Handle high resolution displays

  // Append renderer's canvas to the container
  // Clear container first to remove old canvas or placeholder
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.appendChild(renderer.domElement);

  // 4. Lighting
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

  // Draw Sphere Outline and Grid
  // SphereGeometry(radius, widthSegments, heightSegments)
  // 参数设置
  const segments = 64; // 每条线的分段数（越高越平滑）
  const radius = sphereRadius; // 球体半径

  // 创建经线（8条，从0°到360°，每45°一条）
  for (let i = 0; i < 8; i++) {
    const longitudeLineGeometry = new THREE.BufferGeometry();
    const longitudePoints = [];
    const theta = (i / 8) * Math.PI * 2; // 经度角度（0~2π）

    // 从南极到北极生成点
    for (let j = 0; j <= segments; j++) {
      const phi = (j / segments) * Math.PI; // 纬度角度（0~π）
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      longitudePoints.push(new THREE.Vector3(x, y, z));
    }

    longitudeLineGeometry.setFromPoints(longitudePoints);
    const longitudeLine = new THREE.Line(
      longitudeLineGeometry,
      new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 })
    );
    scene.add(longitudeLine);
  }

  // 创建纬线（8条，从-90°到90°，每22.5°一条）
  for (let i = 1; i < 8; i++) {
    const latitudeLineGeometry = new THREE.BufferGeometry();
    const latitudePoints = [];
    const phi = (i / 8) * Math.PI; // 纬度角度（π/8 ~ 7π/8）

    // 绕赤道生成点
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2; // 经度角度（0~2π）
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      latitudePoints.push(new THREE.Vector3(x, y, z));
    }

    latitudeLineGeometry.setFromPoints(latitudePoints);
    const latitudeLine = new THREE.Line(
      latitudeLineGeometry,
      new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 })
    );
    scene.add(latitudeLine);
  }

  // Optional: Add axes lines for L*, a*, b* direction?


  // Draw Pixel Points
  // Using THREE.Points is more performant for large numbers of points
  const pointsGeometry = new THREE.BufferGeometry();
  const positions = []; // Array to store x, y, z coordinates
  const colors = [];    // Array to store r, g, b colors (0-1 range)

  const totalPixels = imageWidth * imageHeight;
  // Adjust sample factor to ensure minimum number of points (e.g., at least 1000 points)
  const minPoints = 1000;
  let actualSampleFactor = pixelSampleFactor;
  if (totalPixels / actualSampleFactor < minPoints) {
    actualSampleFactor = Math.max(1, Math.floor(totalPixels / minPoints));
    // console.warn(`Adjusting 3D sample factor to ${actualSampleFactor} to ensure at least ${minPoints} points.`);
  }


  // Process sampled pixel data
  for (let i = 0; i < totalPixels; i += actualSampleFactor) {
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

    // Add point position if it's not NaN/Infinity (could happen with invalid Lab from invalid RGB)
    if (isFinite(point3D.x) && isFinite(point3D.y) && isFinite(point3D.z)) {
      positions.push(point3D.x, point3D.y, point3D.z);
    } else {
      // console.warn("Skipping point with invalid coordinates:", point3D); // Debugging
    }
  }

  // Set attributes on the geometry
  pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // Only add color attribute if colors were collected (should match positions count)
  if (colors.length === positions.length) {
    pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  } else {
    console.warn("Color and Position counts mismatch in 3D points geometry.");
  }


  // Create material and points mesh
  const pointsMaterial = new THREE.PointsMaterial({
    size: 1.5, // Size of each point
    // Use vertexColors only if color attribute was successfully added
    vertexColors: colors.length === positions.length,
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

    // Only request next frame if renderer and scene are still valid
    if (renderer && scene && camera && controls) {
      animationFrameId = requestAnimationFrame(animate);

      // required if controls.enableDamping or controls.autoRotate are set to true
      controls.update();

      renderer.render(scene, camera);
    }
  }

  // Start the animation loop
  animate();

  // Handle window resize - listen to window resize and update based on container client size
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

  // Show 3D export buttons after successful setup
  const sphereExportButtons = container.parentElement ? container.parentElement.querySelector('.export-buttons') : null;
  if (sphereExportButtons) {
    sphereExportButtons.style.display = 'block';
  }


  // Return renderer, controls, scene, and camera
  return { renderer: renderer, controls: controls, scene: scene, camera: camera };

}

/**
 * Exports the rendered 3D scene from the renderer's canvas as a PNG image.
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer instance.
 * @param {THREE.Scene} scene - The Three.js scene instance.
 * @param {THREE.PerspectiveCamera} camera - The Three.js camera instance.
 * @param {string} filename - The desired name for the downloaded file.
 * @returns {string|null} Data URL of the image, or null on error.
 */
export function exportSphereAsImage (renderer, scene, camera, filename = 'color_sphere.png') {
  if (!renderer || !renderer.domElement || !scene || !camera) {
    console.error("Cannot export: Three.js renderer, scene, or camera is not available.");
    alert(t('errors.noSphere'));
    return null;
  }

  const canvasElement = renderer.domElement;

  if (canvasElement.width === 0 || canvasElement.height === 0) {
    console.error("Cannot export: 3D renderer canvas has zero dimensions.");
    alert(t('errors.invalidSphereCanvas'));
    return null;
  }

  try {
    // Render one frame explicitly before getting data URL
    // This ensures the canvas reflects the latest camera position, especially if using controls with damping
    renderer.render(scene, camera);

    // Get image data as Data URL (PNG format by default)
    // PNG supports alpha, but we set alpha: false on renderer, so background should be solid.
    const dataUrl = canvasElement.toDataURL('image/png');
    return dataUrl; // Return Data URL so main.js can use fileSaver
  } catch (e) {
    console.error("Error getting data URL from 3D canvas:", e);
    alert(t('errors.sphereExportFailed'));
    return null;
  }
}


/**
 * Disposes Three.js resources to prevent memory leaks.
 * Should be called before setting up a new scene or when the component is removed.
 */
export function disposeScene () { // Export the function
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Dispose renderer and its WebGL resources and remove its canvas from DOM
  if (renderer) {
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    // Nullify renderer reference AFTER disposal
    renderer = null;
  }

  // Dispose scene objects (geometry, materials, textures)
  if (scene) {
    scene.traverse(object => {
      // Only dispose objects that have geometry or material
      if (object.geometry) {
        object.geometry.dispose();
        // console.log(`Disposed geometry for ${object.type}`); // Debugging
      }

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
    // Nullify the scene reference
    scene = null;
  }

  // Dispose controls listeners
  if (controls) {
    controls.dispose();
    controls = null; // Nullify controls reference
  }

  // Remove window resize listener
  if (sphereContainerElement && sphereContainerElement.__resizeListener) {
    window.removeEventListener('resize', sphereContainerElement.__resizeListener);
    delete sphereContainerElement.__resizeListener; // Clean up stored reference
  }
  // Nullify container and camera references
  sphereContainerElement = null;
  camera = null; // Nullify camera reference

  console.log("Previous 3D scene disposed.");
}