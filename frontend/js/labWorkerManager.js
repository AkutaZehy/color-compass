/**
 * Manager for RGB to Lab Web Worker conversion
 * Provides both async (Worker-based) and sync fallback methods
 */

let labWorker = null;
const WORKER_PATH = './js/workers/labConverter.js';

// Initialize the worker
function initLabWorker() {
  if (labWorker) return labWorker;

  try {
    labWorker = new Worker(WORKER_PATH);

    labWorker.onmessage = function(e) {
      const { type, data } = e.data;
      // Handlers will be registered per operation
      if (labWorker.messageHandlers && labWorker.messageHandlers[type]) {
        labWorker.messageHandlers[type].forEach(handler => handler(data));
      }
    };

    labWorker.onerror = function(error) {
      console.error('Lab Worker error:', error);
    };

    labWorker.messageHandlers = {};

    console.log('Lab Worker initialized');
    return labWorker;
  } catch (error) {
    console.warn('Failed to initialize Lab Worker, falling back to sync conversion:', error);
    return null;
  }
}

/**
 * Convert RGB to Lab asynchronously using Web Worker
 * @param {Uint8ClampedArray} pixelData - RGBA pixel data
 * @param {number} sampleFactor - Process every Nth pixel
 * @returns {Promise<object>} Promise resolving to Lab data
 */
export function convertToLabAsync(pixelData, sampleFactor = 10) {
  const worker = initLabWorker();

  return new Promise((resolve, reject) => {
    if (!worker) {
      // Fallback to sync version
      const result = convertToLabSync(pixelData, sampleFactor);
      resolve(result);
      return;
    }

    // Register one-time handler
    if (!worker.messageHandlers['conversionComplete']) {
      worker.messageHandlers['conversionComplete'] = [];
    }

    const handler = (data) => {
      resolve(data);
      // Remove this handler
      worker.messageHandlers['conversionComplete'] = worker.messageHandlers['conversionComplete'].filter(h => h !== handler);
    };

    worker.messageHandlers['conversionComplete'].push(handler);

    worker.postMessage({
      type: 'convertBulk',
      data: { pixelData, sampleFactor }
    });
  });
}

/**
 * Convert RGB to Lab synchronously (fallback or for small datasets)
 * @param {Uint8ClampedArray} pixelData - RGBA pixel data
 * @param {number} sampleFactor - Process every Nth pixel
 * @returns {object} Lab data with values and statistics
 */
export function convertToLabSync(pixelData, sampleFactor = 10) {
  const totalPixels = pixelData.length / 4;
  const labValues = [];
  const lValues = [];
  const aValues = [];
  const bValues = [];

  for (let i = 0; i < totalPixels; i += sampleFactor) {
    const idx = i * 4;
    const r = pixelData[idx];
    const g = pixelData[idx + 1];
    const b = pixelData[idx + 2];

    const lab = rgbToLabSync(r, g, b);
    labValues.push(lab);
    lValues.push(lab[0]);
    aValues.push(lab[1]);
    bValues.push(lab[2]);
  }

  const avgL = lValues.reduce((a, b) => a + b, 0) / lValues.length;
  const avgA = aValues.reduce((a, b) => a + b, 0) / aValues.length;
  const avgB = bValues.reduce((a, b) => a + b, 0) / aValues.length;

  return {
    values: labValues,
    stats: {
      avg: [avgL, avgA, avgB],
      count: labValues.length
    }
  };
}

/**
 * Synchronous RGB to Lab conversion (same as colorUtils.js)
 */
function rgbToLabSync(r, g, b) {
  let var_R = r / 255;
  let var_G = g / 255;
  let var_B = b / 255;

  const sRGBtoLinear = (c) => {
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };

  var_R = sRGBtoLinear(var_R);
  var_G = sRGBtoLinear(var_G);
  var_B = sRGBtoLinear(var_B);

  var_R *= 100;
  var_G *= 100;
  var_B *= 100;

  const X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
  const Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
  const Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;

  const ref_X = 95.047;
  const ref_Y = 100.000;
  const ref_Z = 108.883;
  const epsilon = 0.008856;
  const kappa = 903.3;

  let var_X = X / ref_X;
  let var_Y = Y / ref_Y;
  let var_Z = Z / ref_Z;

  const f = (c) => {
    return c > epsilon ? Math.pow(c, 1 / 3) : (kappa * c + 16) / 116;
  };

  var_X = f(var_X);
  var_Y = f(var_Y);
  var_Z = f(var_Z);

  const CIELab_L = (116 * var_Y) - 16;
  const CIELab_a = 500 * (var_X - var_Y);
  const CIELab_b = 200 * (var_Y - var_Z);

  return [CIELab_L, CIELab_a, CIELab_b];
}

/**
 * Calculate Lab distance asynchronously
 * @param {number[]} lab1 - First Lab color
 * @param {number[]} lab2 - Second Lab color
 * @returns {Promise<number>} Distance
 */
export function calculateLabDistanceAsync(lab1, lab2) {
  const worker = initLabWorker();

  return new Promise((resolve, reject) => {
    if (!worker) {
      resolve(calculateLabDistanceSync(lab1, lab2));
      return;
    }

    if (!worker.messageHandlers['distanceCalculated']) {
      worker.messageHandlers['distanceCalculated'] = [];
    }

    const handler = (data) => {
      resolve(data);
      worker.messageHandlers['distanceCalculated'] = worker.messageHandlers['distanceCalculated'].filter(h => h !== handler);
    };

    worker.messageHandlers['distanceCalculated'].push(handler);

    worker.postMessage({
      type: 'distance',
      data: { lab1, lab2 }
    });
  });
}

/**
 * Calculate Lab distance synchronously
 */
export function calculateLabDistanceSync(lab1, lab2) {
  const deltaL = lab1[0] - lab2[0];
  const deltaA = lab1[1] - lab2[1];
  const deltaB = lab1[2] - lab2[2];
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

/**
 * Terminate the worker (cleanup)
 */
export function disposeLabWorker() {
  if (labWorker) {
    labWorker.terminate();
    labWorker = null;
    console.log('Lab Worker disposed');
  }
}
