// frontend/js/medianCut.js

// Helper class to represent a color box and its colors
class ColorBox {
  constructor(colors) {
    this.colors = colors; // Array of {r, g, b, lab, pixelIndex, originalR, originalG, originalB} objects
    this.min = { r: 255, g: 255, b: 255, l: 100, a: 128, b_lab: 128 }; // b_lab to avoid conflict with 'b' in rgb
    this.max = { r: 0, g: 0, b: 0, l: 0, a: -128, b_lab: -128 }; // b_lab to avoid conflict

    // Calculate min/max for the colors in this box
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
    // Could also consider Lab ranges for splitting, e.g., if Lab ranges are wider
    if (this.range.l > maxRange) { widest = 'l'; maxRange = this.range.l; }
    if (this.range.a > maxRange) { widest = 'a'; maxRange = this.range.a; }
    if (this.range.b_lab > maxRange) { widest = 'b_lab'; maxRange = this.range.b_lab; }

    return widest;
  }

  // Calculate the representative color (average) for this box
  getAverageColor () {
    if (this.colors.length === 0) return null;
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
function extractPaletteMedianCut (pixelData, maxColors) {
  if (!pixelData || pixelData.length === 0 || maxColors <= 0) {
    return [];
  }

  // 1. Collect unique or sampled colors and convert to Lab
  // For simplicity and performance, let's process every Nth pixel
  // In a real scenario for large images, you might sample or use a better initial color set.
  // Let's process all pixels for now.

  const allColors = [];
  // Store original pixel count for each color (approximated by box size)
  // We'll use original RGB and convert to Lab for analysis later
  for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    // Ignore alpha for color analysis

    // Store original values, and convert to Lab for potential analysis/splitting
    allColors.push({
      r: r, g: g, b: b,
      lab: rgbToLab(r, g, b), // Convert to Lab using colorUtils
      // We don't need pixelIndex for Median Cut itself, but could be useful later
      // pixelIndex: i / 4,
      // Keep original values if needed later, maybe not needed here
      // originalR: r, originalG: g, originalB: b
    });
  }

  // Remove duplicates? For simplicity in this MVP, let's not optimize for duplicates yet.
  // Processing all pixels might be slow for very large images.

  // 2. Initialize with a single box containing all colors
  let colorBoxes = [new ColorBox(allColors)];

  // 3. Repeatedly split the widest box until we have maxColors boxes
  // Or until we can't split anymore (all boxes contain only one color or range is 0)
  while (colorBoxes.length < maxColors) {
    // Sort boxes by size (number of colors), largest first
    colorBoxes.sort((a, b) => b.colors.length - a.colors.length);

    const boxToSplit = colorBoxes[0];

    // If the largest box has only one color, we can't split further meaningfully
    if (boxToSplit.colors.length <= 1) {
      // Maybe check if all boxes are size 1, then stop.
      // For now, just break if the biggest one is trivial.
      break;
    }

    // Get the widest channel to split on
    const widestChannel = boxToSplit.getWidestChannel();

    // Sort colors within the box along the widest channel
    boxToSplit.colors.sort((a, b) => {
      // Sort based on the value of the widest channel
      if (widestChannel === 'l' || widestChannel === 'a' || widestChannel === 'b_lab') {
        // Sort by Lab channel if it was the widest
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

    // Replace the original box with the two new boxes
    colorBoxes.splice(0, 1, box1, box2);

    // Optimization: If splitting didn't actually create two new boxes (e.g. colors were identical at median), stop.
    if (box1.colors.length === 0 || box2.colors.length === 0) {
      console.warn("Median cut split resulted in empty box, stopping split.");
      break;
    }

  }

  // 4. Calculate the representative color for each final box (e.g., average RGB)
  // Also, estimate the pixel count for each color
  const palette = colorBoxes
    // Filter out any boxes that might somehow be empty or result in null avgColor
    .map(box => {
      const avgColor = box.getAverageColor();
      if (!avgColor) return null; // If avgColor is null, map returns null
      const count = box.colors.length; // Still get count from the box
      return {
        r: avgColor.r,
        g: avgColor.g,
        b: avgColor.b,
        count: count,
      };
    })
    .filter(entry => entry !== null); // Filter out any null entries resulting from empty boxes


  return palette; // This palette is passed to analyzePalette
}