// frontend/js/medianCut.js
import { rgbToLab } from './colorUtils.js'; // Import Lab conversion

// Helper class to represent a color box and its colors
class ColorBox {
  constructor(colors) {
    this.colors = colors; // Array of {r, g, b, lab} objects (pixelIndex, originalR etc. were removed for simplicity)
    // Initialize min/max with extreme values
    this.min = { r: 255, g: 255, b: 255, l: 100, a: 128, b_lab: 128 }; // b_lab to avoid conflict with 'b' in rgb
    this.max = { r: 0, g: 0, b: 0, l: 0, a: -128, b_lab: -128 }; // b_lab to avoid conflict

    // Calculate min/max for the colors in this box
    // If the box is empty, ranges will be invalid, handled when checking colors.length
    this.colors.forEach(color => {
      this.min.r = Math.min(this.min.r, color.r);
      this.max.r = Math.max(this.max.r, color.r);
      this.min.g = Math.min(this.min.g, color.g);
      this.max.g = Math.max(this.max.g, color.g);
      this.min.b = Math.min(this.min.b, color.b);
      this.max.b = Math.max(this.max.b, color.b);
      this.min.l = Math.min(this.min.l, color.lab[0]);
      this.max.l = Math.max(this.max.l, color.lab[0]);
      this.min.a = Math.min(this.min.a, color.lab[1]);
      this.max.a = Math.max(this.max.a, color.lab[1]);
      this.min.b_lab = Math.min(this.min.b_lab, color.lab[2]);
      this.max.b_lab = Math.max(this.max.b_lab, color.lab[2]);
    });

    // Calculate the range (width) of the box in each channel
    this.range = {
      r: this.max.r - this.min.r,
      g: this.max.g - this.min.g,
      b: this.max.b - this.min.b,
      l: this.max.l - this.min.l,
      a: this.max.a - this.min.a,
      b_lab: this.max.b_lab - this.min.b_lab
    };
  }

  // Find the channel with the widest range (heuristic for splitting)
  getWidestChannel () {
    let widest = 'r';
    let maxRange = this.range.r;

    if (this.range.g > maxRange) {
      widest = 'g';
      maxRange = this.range.g;
    }
    if (this.range.b > maxRange) {
      widest = 'b';
      maxRange = this.range.b;
    }
    // Consider splitting based on Lab ranges if they are significantly larger
    // Heuristic: prioritize Lab ranges more? Or combine RGB and Lab ranges?
    // For simplicity, let's just check if any Lab range is the maximum.
    if (this.range.l > maxRange) { widest = 'l'; maxRange = this.range.l; }
    if (this.range.a > maxRange) { widest = 'a'; maxRange = this.range.a; }
    if (this.range.b_lab > maxRange) { widest = 'b_lab'; maxRange = this.range.b_lab; }


    return widest;
  }

  // Calculate the representative color (average) for this box
  getAverageColor () {
    if (this.colors.length === 0) return null; // Return null for empty boxes
    let sumR = 0, sumG = 0, sumB = 0;
    this.colors.forEach(color => {
      sumR += color.r;
      sumG += color.g;
      sumB += color.b;
    });
    return {
      r: Math.round(sumR / this.colors.length),
      g: Math.round(sumG / this.colors.length),
      b: Math.round(sumB / this.colors.length)
    };
  }
}

/**
 * Extracts a color palette from image pixel data using the Median Cut algorithm.
 * @param {Uint8ClampedArray} pixelData - The pixel data array (R, G, B, A) from canvas.getImageData.
 * @param {number} maxColors - The desired maximum number of colors in the palette.
 * @returns {{r: number, g: number, b: number, count: number}[]} An array of extracted colors with their approximate pixel count.
 */
export function extractPaletteMedianCut (pixelData, maxColors) {
  if (!pixelData || pixelData.length === 0 || maxColors <= 0) {
    return [];
  }

  // 1. Collect colors and convert to Lab. Store original RGB.
  // For simplicity and performance, process every Nth pixel if pixel count is very large?
  // Let's process all pixels first for accuracy on smaller images.
  const allColors = [];
  const totalRawPixels = pixelData.length / 4; // Total number of actual pixels

  for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    // Ignore alpha

    allColors.push({
      r: r, g: g, b: b,
      lab: rgbToLab(r, g, b), // Convert to Lab using colorUtils
      // Keep original values? Maybe not needed in the final palette structure
    });
  }

  // Optimization: Reduce number of colors by combining identical ones?
  // Not done here for simplicity, median cut will handle distribution.

  // 2. Initialize with a single box containing all colors
  let colorBoxes = [];
  if (allColors.length > 0) { // Only create box if there are colors
    colorBoxes.push(new ColorBox(allColors));
  } else {
    return []; // No colors found
  }


  // 3. Repeatedly split the widest box until we have maxColors boxes
  let splits = 0;
  // Stop when we have enough boxes OR when we can't split meaningfully
  while (colorBoxes.length < maxColors && splits < totalRawPixels) { // Limit splits to avoid infinite loop/very slow process
    // Sort boxes by size (number of colors), largest first
    colorBoxes.sort((a, b) => b.colors.length - a.colors.length);

    const boxToSplit = colorBoxes[0];

    // If the largest box has only one color or is empty, we can't split further meaningfully
    if (boxToSplit.colors.length <= 1) {
      // Check if all boxes have size 1, then break? For now, breaking on largest is enough.
      break;
    }

    // Get the widest channel to split on
    const widestChannel = boxToSplit.getWidestChannel();

    // Sort colors within the box along the widest channel
    boxToSplit.colors.sort((a, b) => {
      // Sort based on the value of the widest channel
      if (widestChannel === 'l' || widestChannel === 'a' || widestChannel === 'b_lab') {
        // Sort by Lab channel
        const channelIndex = widestChannel === 'l' ? 0 : (widestChannel === 'a' ? 1 : 2);
        return a.lab[channelIndex] - b.lab[channelIndex];
      } else {
        // Sort by RGB channel
        return a[widestChannel] - b[widestChannel];
      }
    });

    // Find the median position and split the box
    const medianIndex = Math.floor(boxToSplit.colors.length / 2);
    const box1 = new ColorBox(boxToSplit.colors.slice(0, medianIndex));
    const box2 = new ColorBox(boxToSplit.colors.slice(medianIndex));

    // Ensure both new boxes are not empty before replacing
    if (box1.colors.length === 0 || box2.colors.length === 0) {
      // Should not happen with correct medianIndex unless all remaining colors are identical
      console.warn("Median cut split resulted in empty box. Stopping split.");
      break; // Cannot split further
    }

    // Replace the original box with the two new boxes
    colorBoxes.splice(0, 1, box1, box2);
    splits++; // Increment split counter

  }

  // 4. Calculate the representative color for each final box (average RGB)
  // Also, estimate the pixel count for each color. Filter out empty boxes.
  const palette = colorBoxes
    .map(box => {
      const avgColor = box.getAverageColor(); // Returns { r, g, b } or null
      if (!avgColor) return null; // Map empty boxes to null

      const count = box.colors.length; // Number of pixels in this box
      return {
        r: avgColor.r,
        g: avgColor.g,
        b: avgColor.b,
        count: count,
        // Optional: Keep Lab color for later analysis/sorting/thresholding
        // lab: rgbToLab(avgColor.r, avgColor.g, avgColor.b) // Recalculate Lab for the average color if needed
      };
    })
    .filter(entry => entry !== null); // Filter out null entries (from empty boxes)


  // Note: This initial palette might contain similar colors or background colors.
  // Post-processing (thresholding, background/feature detection) is done in paletteAnalyzer.js

  return palette;
}