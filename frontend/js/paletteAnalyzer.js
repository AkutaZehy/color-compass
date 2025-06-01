// frontend/js/paletteAnalyzer.js
import { rgbToLab, labDistance, rgbToHsv } from './colorUtils.js';

/**
 * Represents a color in the processed palette with additional info.
 */
export class PaletteColor { // Export the class
  // Constructor expects an object like { r: number, g: number, b: number } as the first argument
  constructor(rgbObj, count, isBackground = false, isFeature = false) {
    // Basic validation for input object structure
    if (!rgbObj || typeof rgbObj.r !== 'number' || typeof rgbObj.g !== 'number' || typeof rgbObj.b !== 'number') {
      console.error("Invalid RGB object passed to PaletteColor constructor:", rgbObj);
      // Assign a default error color if input is invalid
      this.rgb = { r: 255, g: 0, b: 255 }; // Magenta error color
      this.count = 0;
    } else {
      this.rgb = { r: rgbObj.r, g: rgbObj.g, b: rgbObj.b };
      this.count = count;
    }

    this.isBackground = isBackground;
    this.isFeature = isFeature;
    // Pre-calculate Lab for easier distance comparisons
    this.lab = rgbToLab(this.rgb.r, this.rgb.g, this.rgb.b);
  }

  // Combine this color with another color (merges counts and averages colors)
  merge (otherColor) {
    const totalCount = this.count + otherColor.count;
    if (totalCount === 0) return this; // Avoid division by zero

    // Access r, g, b from the .rgb property of both objects
    const mergedR = (this.rgb.r * this.count + otherColor.rgb.r * otherColor.count) / totalCount;
    const mergedG = (this.rgb.g * this.count + otherColor.rgb.g * otherColor.count) / totalCount;
    const mergedB = (this.rgb.b * this.count + otherColor.rgb.b * otherColor.count) / totalCount;

    this.rgb = { r: Math.round(mergedR), g: Math.round(mergedG), b: Math.round(mergedB) };
    this.count = totalCount;
    this.isBackground = this.isBackground || otherColor.isBackground;
    this.isFeature = this.isFeature || otherColor.isFeature;
    this.lab = rgbToLab(this.rgb.r, this.rgb.g, this.rgb.b); // Recalculate Lab

    return this; // Return the merged color (this object)
  }
}


/**
 * Analyzes a raw palette (from Median Cut) to merge similar colors,
 * identify background/feature colors, and refine the palette.
 * @param {{r: number, g: number, b: number, count: number}[]} rawPalette - The palette from extractPaletteMedianCut.
 * @param {number} colorThreshold - Maximum allowed Delta E distance between colors to be merged.
 * @param {number} totalPixels - Total number of pixels in the original image (for percentage calculation).
 * @returns {PaletteColor[]} The final, processed palette.
 */
export function analyzePalette (rawPalette, colorThreshold, totalPixels) { // Export the function
  if (!rawPalette || rawPalette.length === 0) {
    return [];
  }

  // Convert raw palette entries to our internal PaletteColor objects
  let processedPalette = rawPalette.map(entry =>
    // Pass an object { r, g, b } derived from the entry, and the entry.count
    new PaletteColor({ r: entry.r, g: entry.g, b: entry.b }, entry.count)
  );

  // Filter out any invalid PaletteColor objects created (though the constructor should prevent this)
  processedPalette = processedPalette.filter(color => color.count > 0);


  // --- 1. Merge Similar Colors based on Threshold ---
  let merged = true;
  // Simple loop limiter to prevent infinite loops
  const maxMergeIterations = processedPalette.length * 2; // Heuristic limit
  let mergeIteration = 0;

  while (merged && processedPalette.length > 1 && mergeIteration < maxMergeIterations) {
    merged = false;
    mergeIteration++;
    const newPalette = [];
    const mergedIndices = new Set();

    for (let i = 0; i < processedPalette.length; i++) {
      if (mergedIndices.has(i)) continue;

      let currentColor = processedPalette[i]; // Start with the current color

      for (let j = i + 1; j < processedPalette.length; j++) {
        if (mergedIndices.has(j)) continue;

        // Calculate distance
        if (labDistance(currentColor.lab, processedPalette[j].lab) < colorThreshold) {
          // Merge j into i
          currentColor.merge(processedPalette[j]);
          mergedIndices.add(j);
          merged = true; // Indicate a merge happened
        }
      }
      newPalette.push(currentColor); // Add the (potentially merged) current color to the new palette
    }
    processedPalette = newPalette; // Update the palette for the next iteration
  }
  if (mergeIteration >= maxMergeIterations) {
    console.warn(`Merge loop reached max iterations (${maxMergeIterations}). Merging stopped.`);
  }
  // console.log(`Finished merging after ${mergeIteration} iterations.`); // Debugging


  // --- 2. Identify Background Color (Simple Heuristic) ---
  // Sort by count descending BEFORE background/feature detection
  processedPalette.sort((a, b) => b.count - a.count);

  if (processedPalette.length > 0) {
    const largestColor = processedPalette[0];
    // Refined heuristic: background if count > X% AND saturation is low
    const largestColorHsv = rgbToHsv(largestColor.rgb.r, largestColor.rgb.g, largestColor.rgb.b);
    const backgroundThresholdPercent = 0.4; // e.g., 40% of total pixels
    const backgroundSaturationThreshold = 0.15; // e.g., less than 15% saturation
    const minBackgroundCount = totalPixels * backgroundThresholdPercent;


    // Check if the most frequent color covers a significant area AND is relatively desaturated
    if (largestColor.count >= minBackgroundCount && largestColorHsv[1] < backgroundSaturationThreshold) {
      largestColor.isBackground = true;
      console.log(`Identified potential background color: RGB(${largestColor.rgb.r}, ${largestColor.rgb.g}, ${largestColor.rgb.b}) with ${((largestColor.count / totalPixels) * 100).toFixed(1)}% pixels and HSV S=${largestColorHsv[1].toFixed(2)}.`);
    } else {
      console.log(`Largest color not marked as background (Count: ${((largestColor.count / totalPixels) * 100).toFixed(1)}%, HSV S: ${largestColorHsv[1].toFixed(2)}).`);
    }
  } else {
    console.warn("No colors left in processed palette after merging.");
  }

  // --- 3. Identify Feature Colors (Simple Heuristic - MVP+) ---
  // Look for colors with small pixel counts that are perceptually distinct from the dominant colors.
  // Simple approach: Take the smallest few colors (that are not background)
  // and check if their distance from the largest color is significant.
  const numFeatureCandidates = 3; // Look at the smallest N colors
  const featureThresholdDistanceFactor = 1.8; // Heuristic: significantly further than merge threshold
  const minFeatureColorCount = totalPixels * 0.001; // Heuristic: Feature colors should represent at least 0.1% of pixels? Or define a min absolute count.
  // Or simply look at the smallest N colors regardless of count? Let's use smallest N and check distance.


  if (processedPalette.length > 1) {
    const largestColor = processedPalette[0]; // Still the first after sorting by count

    // Iterate from the smallest colors upwards, up to numFeatureCandidates
    for (let i = processedPalette.length - 1; i >= 1 && (processedPalette.length - 1 - i) < numFeatureCandidates; i--) {
      const candidate = processedPalette[i];
      // Only consider if not already marked as background
      if (!candidate.isBackground) {
        // Check if distinct from the largest (potential background) color
        const distFromLargest = labDistance(candidate.lab, largestColor.lab);
        if (distFromLargest > colorThreshold * featureThresholdDistanceFactor) { // Heuristic: significantly distant from largest
          candidate.isFeature = true;
          console.log(`Identified potential feature color: RGB(${candidate.rgb.r}, ${candidate.rgb.g}, ${candidate.rgb.b}) with ${((candidate.count / totalPixels) * 100).toFixed(1)}% pixels (Dist from largest: ${distFromLargest.toFixed(2)}).`);
        } else {
          // console.log(`Small color not marked as feature (Count: ${((candidate.count / totalPixels) * 100).toFixed(1)}%, Dist from largest: ${distFromLargest.toFixed(2)}).`); // Debugging
        }
      }
    }
  }


  // Sort the final palette for consistent display order (e.g., by Luminance L*)
  processedPalette.sort((a, b) => a.lab[0] - b.lab[0]); // Sort by Luminance (L*)

  return processedPalette;
}