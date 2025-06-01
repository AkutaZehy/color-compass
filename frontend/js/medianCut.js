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
 * @param {number} maxSplit - The maximum number of splits to perform (controls color granularity).
 * @returns {{r: number, g: number, b: number, count: number}[]} An array of extracted colors with their approximate pixel count.
 */
export function extractPaletteMedianCut (pixelData, maxSplit) {
  if (!pixelData || pixelData.length === 0 || maxSplit <= 0) {
    return [];
  }

  // 1. Collect colors and convert to Lab
  const allColors = [];
  for (let i = 0; i < pixelData.length; i += 4) {
    allColors.push({
      r: pixelData[i],
      g: pixelData[i + 1],
      b: pixelData[i + 2],
      lab: rgbToLab(pixelData[i], pixelData[i + 1], pixelData[i + 2])
    });
  }

  // 2. Initialize with a single box
  let colorBoxes = [new ColorBox(allColors)];

  // 3. Split boxes until maxSplit is reached
  let splits = 0;
  const finalSplit = Math.min(maxSplit ** 2, 40000); // CORE
  while (splits < finalSplit) {
    // Find the largest box to split
    let largestBoxIndex = 0;
    for (let i = 1; i < colorBoxes.length; i++) {
      if (colorBoxes[i].colors.length > colorBoxes[largestBoxIndex].colors.length) {
        largestBoxIndex = i;
      }
    }

    const boxToSplit = colorBoxes[largestBoxIndex];
    if (boxToSplit.colors.length <= 1) break; // Can't split further

    // Split along widest channel
    const widestChannel = boxToSplit.getWidestChannel();
    boxToSplit.colors.sort((a, b) => {
      const channel = widestChannel === 'l' ? 0 :
        widestChannel === 'a' ? 1 :
          widestChannel === 'b_lab' ? 2 : widestChannel;
      return a.lab[channel] - b.lab[channel];
    });

    const medianIndex = Math.floor(boxToSplit.colors.length / 2);
    const box1 = new ColorBox(boxToSplit.colors.slice(0, medianIndex));
    const box2 = new ColorBox(boxToSplit.colors.slice(medianIndex));

    // Replace with new boxes
    colorBoxes.splice(largestBoxIndex, 1, box1, box2);
    splits++;
  }

  // 4. Generate final palette
  return colorBoxes
    .map(box => {
      const avg = box.getAverageColor();
      return avg ? { ...avg, count: box.colors.length } : null;
    })
    .filter(Boolean);
}
