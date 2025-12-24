/**
 * Web Worker for RGB to Lab color space conversion
 * Offloads the computationally intensive conversion from the main thread
 */

// Pre-compute constants for sRGB to Linear RGB conversion
const sRGBtoLinear = (c) => {
  return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
};

// Pre-compute constants for CIE XYZ to CIELAB conversion
const ref_X = 95.047;
const ref_Y = 100.000;
const ref_Z = 108.883;
const epsilon = 0.008856;
const kappa = 903.3;

// CIE Lab f* function
const f = (c) => {
  return c > epsilon ? Math.pow(c, 1 / 3) : (kappa * c + 16) / 116;
};

/**
 * Converts a single RGB color to Lab
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {number[]} Lab color [L*, a*, b*]
 */
function rgbToLabWorker(r, g, b) {
  // 1. RGB to sRGB (Normalize 0-255 to 0-1)
  let var_R = r / 255;
  let var_G = g / 255;
  let var_B = b / 255;

  // 2. sRGB to Linear RGB
  var_R = sRGBtoLinear(var_R);
  var_G = sRGBtoLinear(var_G);
  var_B = sRGBtoLinear(var_B);

  // Scale to 0-100
  var_R *= 100;
  var_G *= 100;
  var_B *= 100;

  // 3. Linear RGB to CIE XYZ
  const X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
  const Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
  const Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;

  // 4. CIE XYZ to CIELAB
  let var_X = X / ref_X;
  let var_Y = Y / ref_Y;
  let var_Z = Z / ref_Z;

  var_X = f(var_X);
  var_Y = f(var_Y);
  var_Z = f(var_Z);

  const CIELab_L = (116 * var_Y) - 16;
  const CIELab_a = 500 * (var_X - var_Y);
  const CIELab_b = 200 * (var_Y - var_Z);

  return [CIELab_L, CIELab_a, CIELab_b];
}

/**
 * Calculates Euclidean distance between two Lab colors
 * @param {number[]} lab1 - First Lab color
 * @param {number[]} lab2 - Second Lab color
 * @returns {number} Color distance (Delta E 1976)
 */
function labDistanceWorker(lab1, lab2) {
  const deltaL = lab1[0] - lab2[0];
  const deltaA = lab1[1] - lab2[1];
  const deltaB = lab1[2] - lab2[2];
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

/**
 * Converts RGB pixel data to Lab format
 * @param {Uint8ClampedArray} pixelData - RGBA pixel data
 * @param {number} sampleFactor - Process every Nth pixel
 * @returns {object} Lab data with values and statistics
 */
function convertToLabBulk(pixelData, sampleFactor = 1) {
  const totalPixels = pixelData.length / 4;
  const labValues = [];

  // For statistics
  const lValues = [];
  const aValues = [];
  const bValues = [];

  for (let i = 0; i < totalPixels; i += sampleFactor) {
    const idx = i * 4;
    const r = pixelData[idx];
    const g = pixelData[idx + 1];
    const b = pixelData[idx + 2];

    const lab = rgbToLabWorker(r, g, b);

    labValues.push(lab);
    lValues.push(lab[0]);
    aValues.push(lab[1]);
    bValues.push(lab[2]);
  }

  // Calculate statistics
  const avgL = lValues.reduce((a, b) => a + b, 0) / lValues.length;
  const avgA = aValues.reduce((a, b) => a + b, 0) / aValues.length;
  const avgB = bValues.reduce((a, b) => a + b, 0) / bValues.length;

  return {
    values: labValues,
    stats: {
      avg: [avgL, avgA, avgB],
      count: labValues.length
    }
  };
}

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'convertBulk':
        const { pixelData, sampleFactor = 1 } = data;
        const result = convertToLabBulk(pixelData, sampleFactor);
        self.postMessage({ type: 'conversionComplete', data: result });
        break;

      case 'convertSingle':
        const { r, g, b } = data;
        const lab = rgbToLabWorker(r, g, b);
        self.postMessage({ type: 'singleConverted', data: lab });
        break;

      case 'distance':
        const { lab1, lab2 } = data;
        const dist = labDistanceWorker(lab1, lab2);
        self.postMessage({ type: 'distanceCalculated', data: dist });
        break;

      case 'batchDistance':
        const { referenceLab, compareLabs } = data;
        const distances = compareLabs.map(lab => labDistanceWorker(referenceLab, lab));
        self.postMessage({ type: 'batchDistanceComplete', data: distances });
        break;

      default:
        self.postMessage({ type: 'error', data: `Unknown message type: ${type}` });
    }
  } catch (error) {
    self.postMessage({ type: 'error', data: error.message });
  }
};
