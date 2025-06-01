// frontend/js/visualization2D.js
import { rgbToLab } from './colorUtils.js'; // Import Lab conversion

/**
 * Draws a histogram on a canvas.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {number[]} data - Array of numerical data points for the histogram.
 * @param {string} channelName - Name of the channel (e.g., "Hue", "L*").
 * @param {number} rangeMin - Minimum value of the data range.
 * @param {number} rangeMax - Maximum value of the data range.
 * @param {number} binCount - Number of bins for the histogram.
 */
export function drawHistogram (canvas, data, channelName, rangeMin, rangeMax, binCount) { // Export the function
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#333'; // Background color
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (!data || data.length === 0 || binCount <= 0 || rangeMax <= rangeMin) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`No data for ${channelName}`, canvasWidth / 2, canvasHeight / 2);
    return;
  }

  // --- Calculate Histogram Bins ---
  const bins = new Array(binCount).fill(0);
  const range = rangeMax - rangeMin;
  // Avoid division by zero if range is 0
  const binWidthValue = range === 0 ? 0 : range / binCount;


  data.forEach(value => {
    // Calculate bin index, clamping to bounds
    let binIndex = 0;
    if (range > 0) {
      binIndex = Math.floor(((value - rangeMin) / range) * binCount);
      binIndex = Math.max(0, Math.min(binCount - 1, binIndex));
    } // If range is 0, all values are the same, should go to bin 0

    bins[binIndex]++;
  });

  // Find max bin count for scaling
  const maxBinCount = Math.max(...bins);
  if (maxBinCount === 0) { // Handle case where all bins are zero
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`No data for ${channelName} in range`, canvasWidth / 2, canvasHeight / 2);
    return;
  }


  // --- Draw Histogram Bars ---
  const barWidth = canvasWidth / binCount;
  const barPadding = 1; // Small gap between bars

  ctx.fillStyle = '#5a9'; // Bar color (e.g., a teal color)

  bins.forEach((count, index) => {
    // Scale bar height based on maxBinCount
    const barHeight = (count / maxBinCount) * canvasHeight;
    const x = index * barWidth;
    const y = canvasHeight - barHeight; // Draw from bottom up

    ctx.fillRect(x, y, barWidth - barPadding, barHeight);
  });

  // Optional: Draw axis line at the bottom
  // ctx.strokeStyle = '#888';
  // ctx.lineWidth = 1;
  // ctx.beginPath();
  // ctx.moveTo(0, canvasHeight);
  // ctx.lineTo(canvasWidth, canvasHeight);
  // ctx.stroke();
}

/**
 * Draws a scatter plot of a* vs. b* values in CIELAB space on a canvas,
 * using the original pixel colors for the points.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {Uint8ClampedArray} pixelData - The pixel data array (R, G, B, A).
 * @param {number} imageWidth - Original image width.
 * @param {number} imageHeight - Original image height.
 * @param {number} pixelSampleFactor - Process every Nth pixel for performance (e.g., 10 for 1/10th of pixels).
 */
export function drawLabScatterPlotRevised (canvas, pixelData, imageWidth, imageHeight, pixelSampleFactor = 20) { // Export the function
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#333'; // Background color
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (!pixelData || pixelData.length === 0 || imageWidth === 0 || imageHeight === 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("No pixel data for scatter plot", canvasWidth / 2, canvasHeight / 2);
    return;
  }

  // --- Draw axes (a*=0 and b*=0) ---
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  ctx.strokeStyle = '#888'; // Gray axes
  ctx.lineWidth = 1;

  // Vertical axis (a* = 0)
  ctx.beginPath();
  ctx.moveTo(canvasCenterX, 0);
  ctx.lineTo(canvasCenterX, canvasHeight);
  ctx.stroke();

  // Horizontal axis (b* = 0)
  ctx.beginPath();
  ctx.moveTo(0, canvasCenterY);
  ctx.lineTo(canvasWidth, canvasCenterY);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('+a*', canvasWidth - 20, canvasCenterY + 15);
  ctx.textAlign = 'right';
  ctx.fillText('-a*', 20, canvasCenterY + 15);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('+b*', canvasCenterX, 5);
  ctx.textBaseline = 'bottom';
  ctx.fillText('-b*', canvasCenterX, canvasHeight - 5);


  // --- Draw data points ---
  // Map Lab a* and b* ranges (e.g., [-100, 100]) to canvas coordinates.
  // Need to find the appropriate scaling factors.
  // Let's assume the plotting area covers a* from -100 to 100, and b* from -100 to 100.
  // These values are typical approximate ranges for a* and b*.
  const plotRangeA = 200; // From -100 to +100
  const plotMinA = -100;
  const plotRangeB = 200; // From -100 to +100
  const plotMinB = -100;

  const scaleX = canvasWidth / plotRangeA;
  const scaleY = canvasHeight / plotRangeB;

  // Choose point rendering method: simple rectangle or arc
  const pointSize = 1.5; // Increased point size for better visibility
  const pointAlpha = 0.6; // Increased opacity for better clarity
  const highlightAlpha = 0.9; // Alpha for highlighted points

  ctx.globalAlpha = pointAlpha; // Set global alpha

  // Process pixels with sampling (reduced sample factor for more points)
  const totalPixels = imageWidth * imageHeight;
  for (let i = 0; i < totalPixels; i += pixelSampleFactor) {
    // Calculate index in pixelData array
    const dataIndex = i * 4;
    if (dataIndex >= pixelData.length) break;

    const r = pixelData[dataIndex];
    const g = pixelData[dataIndex + 1];
    const b = pixelData[dataIndex + 2];
    // Alpha pixelData[dataIndex + 3]

    // Convert to Lab
    const lab = rgbToLab(r, g, b);
    // const l = lab[0]; // Luminance - could use for point brightness/size?
    const a = lab[1];
    const b_lab = lab[2]; // Use b_lab to avoid conflict with function param 'b'

    // Map Lab (a, b) to canvas (x, y)
    // Lab a* maps to X: -100 -> 0, 100 -> canvasWidth. Origin 0 -> canvasCenterX.
    // X = canvasCenterX + a * scaleX * 0.5 (since total range is 200, center is 0)
    const x = canvasCenterX + a * scaleX * 0.5;
    // Lab b* maps to Y: -100 -> canvasHeight, 100 -> 0. Origin 0 -> canvasCenterY. (Inverted Y-axis)
    // Y = canvasCenterY - b_lab * scaleY * 0.5 (since total range is 200, center is 0)
    const y = canvasCenterY - b_lab * scaleY * 0.5;


    // Check if the mapped point is within the canvas bounds
    // Optional: Only draw points that map within the defined Lab range for plotting
    // if (a >= plotMinA && a <= plotMinA + plotRangeA && b_lab >= plotMinB && b_lab <= plotMinB + plotRangeB) {

    // Set point color using the pixel's original color
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    // Draw the point as a small rectangle with highlight effect
    // Ensure point is within canvas bounds before drawing
    if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
      // Draw main point
      ctx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);

      // Draw highlight effect
      ctx.globalAlpha = highlightAlpha;
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.globalAlpha = pointAlpha;
    }
    // }
  }

  ctx.globalAlpha = 1.0; // Reset global alpha
}