// frontend/js/sphereRenderer3D.js

// Import Three.js core and controls
import * as THREE from '../lib/three/build/three.module.js';
import { OrbitControls } from '../lib/three/examples/jsm/controls/OrbitControls.js';
import { rgbToLab, labToRgbLinear } from './colorUtils.js'; // Lab conversions
import { t } from './i18n.js'; // Import i18n module
import { showToast } from './toast.js';


let scene, camera, renderer, controls;
let sphereContainerElement;
let animationFrameId = null; // To keep track of the animation loop

// --- LCh → sphere mapping ("HSL-sphere" style) ------------------------------
// The sphere is a legend for cylindrical color spaces, drawn as a ball:
//   vertical axis  = lightness (north pole white L*=100, south pole black L*=0)
//   longitude      = hue angle h (LCh hue from a*/b*)
//   radius within a latitude circle = relative chroma C / Cmax(h, L*), the
//   fraction of the sRGB gamut boundary reached along that hue/lightness ray.
// Relative chroma (not raw C) is what makes every hue reach the wireframe
// surface: raw C caps around 100-130 in sRGB and varies per hue (yellows
// reach ~100, blues ~50), which collapses the cloud into a thin column
// around the axis and lopsides the top view.

const sphereRadius = 100;

function isInSrgbGamut (L, a, b) {
  const [r, g, bl] = labToRgbLinear(L, a, b);
  const tol = 1e-4;
  return r >= -tol && r <= 1 + tol &&
    g >= -tol && g <= 1 + tol &&
    bl >= -tol && bl <= 1 + tol;
}

// Largest chroma inside the sRGB gamut along the (L*, h) ray — binary search
function maxChromaInGamut (L, hueAngle) {
  const cosH = Math.cos(hueAngle);
  const sinH = Math.sin(hueAngle);
  if (!isInSrgbGamut(L, 0, 0)) return 0;
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (isInSrgbGamut(L, mid * cosH, mid * sinH)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// Helper function to map full Lab to a 3D Vector3 coordinate on/inside the sphere
const labToSphereCoords = (lab) => {
  const l = lab[0];
  const a = lab[1];
  const b = lab[2];

  const chroma = Math.sqrt(a * a + b * b);
  const hueAngle = Math.atan2(b, a);

  // Colatitude from L*: white at the north pole, black at the south
  const theta = (1 - l / 100) * Math.PI;
  const sinTheta = Math.sin(theta);

  // Relative chroma: how far toward the gamut boundary this color sits
  const cMax = maxChromaInGamut(l, hueAngle);
  const sRel = cMax > 1e-6 ? Math.min(1, chroma / cMax) : 0;

  // S_rel = 1 lands exactly on the wireframe sphere; 0 on the lightness axis
  const horizontal = sinTheta * sRel * sphereRadius;

  return new THREE.Vector3(
    horizontal * Math.cos(hueAngle),
    sphereRadius * Math.cos(theta),
    horizontal * Math.sin(hueAngle)
  );
};

// sRGB transfer (0-255 byte → linear-light 0-1): three.js r150+ treats vertex
// colors as linear working space and converts to sRGB on output, so feeding
// raw bytes washes every color out.
const srgbByteToLinear = (c) => {
  c /= 255;
  return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
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
  // Follow the container's CSS background so the viewport matches the
  // active theme (classic dark vs. skeuomorphic instrument window).
  scene.background = new THREE.Color(getComputedStyle(container).backgroundColor || '#2a2a2a');

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
    const alpha = pixelData[dataIndex + 3];

    // Skip mostly-transparent pixels so invisible areas do not plot
    if (alpha < 125) continue;

    // Store color as linear-light floats for three.js (r150+ color management)
    colors.push(srgbByteToLinear(r), srgbByteToLinear(g), srgbByteToLinear(b));

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
    size: 2.2, // Size of each point (world units, attenuated by distance)
    sizeAttenuation: true,
    // Use vertexColors only if color attribute was successfully added
    vertexColors: colors.length === positions.length,
    transparent: true,
    opacity: 0.75,
    // Normal blending keeps dark pixels visible against bright clusters —
    // additive blending erases the image's dark tail entirely.
    blending: THREE.NormalBlending,
    depthWrite: false // Soft, order-independent point cloud without z-fighting
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
    showToast(t('errors.noSphere'));
    return null;
  }

  const canvasElement = renderer.domElement;

  if (canvasElement.width === 0 || canvasElement.height === 0) {
    console.error("Cannot export: 3D renderer canvas has zero dimensions.");
    showToast(t('errors.invalidSphereCanvas'));
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
    showToast(t('errors.sphereExportFailed'));
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