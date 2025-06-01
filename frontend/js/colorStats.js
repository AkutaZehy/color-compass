// frontend/js/colorStats.js
import { rgbToHsv, rgbToLab } from './colorUtils.js'; // Import conversion functions

/**
 * Calculates statistical summary (average, std dev) for HSV and Lab color channels
 * from image pixel data.
 * @param {Uint8ClampedArray} pixelData - The pixel data array (R, G, B, A).
 * @param {number} width - Image width.
 * @param {number} height - Image height.
 * @returns {{hsv: {avg: number[], stdDev: number[]}, lab: {avg: number[], stdDev: number[]}, rawValues: object}|null} An object containing stats and raw values, or null on error.
 */
export function calculateColorStats (pixelData, width, height) { // Export the function
  if (!pixelData || pixelData.length === 0 || width === 0 || height === 0) {
    return null;
  }

  const totalPixels = width * height;
  if (pixelData.length !== totalPixels * 4) {
    console.error("Pixel data size mismatch with image dimensions.");
    return null;
  }

  // Arrays to accumulate values for stats and visualization
  const hValues = [];
  const sValues = [];
  const vValues = [];
  const lValues = [];
  const aValues = [];
  const bValues = [];

  // Process a sampled set of pixels for performance.
  // A higher sample factor means processing fewer pixels.
  const sampleFactor = 1; // Process every 1st pixel (all) for stats accuracy

  // Process all pixels for accurate stats calculation
  for (let i = 0; i < pixelData.length; i += 4 * sampleFactor) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    // Ignore alpha

    const hsv = rgbToHsv(r, g, b);
    const lab = rgbToLab(r, g, b);

    hValues.push(hsv[0]); // Hue [0, 1)
    sValues.push(hsv[1]); // Saturation [0, 1]
    vValues.push(hsv[2]); // Value [0, 1]
    lValues.push(lab[0]); // L* [0, 100]
    aValues.push(lab[1]); // a* [approx -128, 128]
    bValues.push(lab[2]); // b* [approx -128, 128]
  }

  // Helper function to calculate average
  const calculateAverage = (arr) => {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
  };

  // Helper function to calculate standard deviation (sample standard deviation)
  const calculateStdDev = (arr, avg) => {
    if (arr.length < 2) return 0; // Need at least 2 values for sample std dev
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
  };

  // Calculate averages
  const avgH = calculateAverage(hValues);
  const avgS = calculateAverage(sValues);
  const avgV = calculateAverage(vValues);
  const avgL = calculateAverage(lValues);
  const avgA = calculateAverage(aValues);
  const avgB = calculateAverage(bValues);

  // Calculate standard deviations
  const stdDevH = calculateStdDev(hValues, avgH);
  const stdDevS = calculateStdDev(sValues, avgS);
  const stdDevV = calculateStdDev(vValues, avgV);
  const stdDevL = calculateStdDev(lValues, avgL);
  const stdDevA = calculateStdDev(aValues, avgA);
  const stdDevB = calculateStdDev(bValues, avgB);


  // Note on Hue average/stdDev: Simple average/stdDev on 0-1 range is not ideal
  // for cyclical data. More accurate methods exist (circular mean/variance),
  // but require more complex math. Using simple method for MVP.

  return {
    hsv: {
      avg: [avgH, avgS, avgV],
      stdDev: [stdDevH, stdDevS, stdDevV]
    },
    lab: {
      avg: [avgL, avgA, avgB],
      stdDev: [stdDevL, stdDevA, stdDevB]
    },
    // Return the raw values arrays for visualization (these might be sampled if sampleFactor > 1)
    rawValues: {
      h: hValues, s: sValues, v: vValues,
      l: lValues, a: aValues, b: bValues
    }
  };
}