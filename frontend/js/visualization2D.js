// frontend/js/visualization2D.js

/**
 * Draws a histogram on a canvas.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {number[]} data - Array of numerical data points for the histogram.
 * @param {string} channelName - Name of the channel (e.g., "Hue", "L*").
 * @param {number} rangeMin - Minimum value of the data range.
 * @param {number} rangeMax - Maximum value of the data range.
 * @param {number} binCount - Number of bins for the histogram.
 */
function drawHistogram (canvas, data, channelName, rangeMin, rangeMax, binCount) {
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#333'; // Background color
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (!data || data.length === 0 || binCount <= 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText("No data", canvasWidth / 2, canvasHeight / 2);
    return;
  }

  // --- Calculate Histogram Bins ---
  const bins = new Array(binCount).fill(0);
  const range = rangeMax - rangeMin;
  const binWidthValue = range / binCount;

  data.forEach(value => {
    // Ensure value is within range (or handle out of range)
    let binIndex = Math.floor(((value - rangeMin) / range) * binCount);
    // Clamp index to valid range [0, binCount - 1]
    binIndex = Math.max(0, Math.min(binCount - 1, binIndex));
    bins[binIndex]++;
  });

  // Find max bin count for scaling
  const maxBinCount = Math.max(...bins);
  if (maxBinCount === 0) { // Handle case where all bins are empty
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
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

  // Optional: Draw axes or labels if needed
  // ctx.strokeStyle = '#888';
  // ctx.beginPath();
  // ctx.moveTo(0, canvasHeight);
  // ctx.lineTo(canvasWidth, canvasHeight); // X-axis
  // ctx.stroke();
}

/**
* Draws a scatter plot of a* vs. b* values in CIELAB space on a canvas.
* @param {HTMLCanvasElement} canvas - The canvas element.
* @param {{a: number[], b: number[]}} labValues - Object containing arrays of a* and b* values.
* @param {number} pixelSampleFactor - Process every Nth pixel for performance (e.g., 10 for 1/10th of pixels).
*/
function drawLabScatterPlot (canvas, labValues, pixelSampleFactor = 10) { // Default sample factor
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#333'; // Background color
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (!labValues || labValues.a.length === 0 || labValues.b.length === 0 || labValues.a.length !== labValues.b.length) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText("No Lab data for scatter plot", canvasWidth / 2, canvasHeight / 2);
    return;
  }

  const aValues = labValues.a;
  const bValues = labValues.b;
  const numDataPoints = aValues.length;

  // --- Determine Lab range for mapping ---
  // Standard Lab ranges: L*[0,100], a*[-128, 128], b*[-128, 128] approx.
  // Let's use a fixed perceptual range for a* and b* for consistent visualization,
  // e.g., [-100, 100] for both a* and b*.
  const labRangeA = 200; // From -100 to +100
  const labMinA = -100;
  const labRangeB = 200; // From -100 to +100
  const labMinB = -100;


  // --- Draw axes (a*=0 and b*=0) ---
  // Map Lab origin (0,0) to canvas center
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  ctx.strokeStyle = '#888'; // Gray axes
  ctx.lineWidth = 1;

  // Draw vertical axis (a* = 0, maps to horizontal center)
  ctx.beginPath();
  ctx.moveTo(canvasCenterX, 0);
  ctx.lineTo(canvasCenterX, canvasHeight);
  ctx.stroke();

  // Draw horizontal axis (b* = 0, maps to vertical center)
  ctx.beginPath();
  ctx.moveTo(0, canvasCenterY);
  ctx.lineTo(canvasWidth, canvasCenterY);
  ctx.stroke();

  // Optional: axis labels
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('+a*', canvasWidth - 20, canvasCenterY + 15);
  ctx.textAlign = 'right';
  ctx.fillText('-a*', 20, canvasCenterY + 15);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('+b*', canvasCenterX, 5); // Lab +b* is yellow, often mapped upwards
  ctx.textBaseline = 'bottom';
  ctx.fillText('-b*', canvasCenterX, canvasHeight - 5); // Lab -b* is blue, often mapped downwards


  // --- Draw data points ---
  // Iterate through the data and draw points
  // Apply pixelSampleFactor here to avoid drawing too many points
  const pointSize = 1; // Size of each point (in pixels)
  const pointAlpha = 0.5; // Make points semi-transparent if density is high

  ctx.globalAlpha = pointAlpha; // Set global alpha for points
  ctx.fillStyle = '#fff'; // Default point color (will be overwritten per point)

  for (let i = 0; i < numDataPoints; i += pixelSampleFactor) {
    const a = aValues[i];
    const b = bValues[i];
    // Note: The original pixel color should ideally be used here.
    // We only passed a* and b* values. Need original RGB or Lab for color.
    // Let's revise: Pass original pixelData or a sampled version.
    // For simplicity in this step, let's just use a default point color.
    // A better approach: Pass the original pixelData to this function.

    // --- Revised approach: Pass original pixelData ---
    // Skip drawing points for now and revisit after fixing input data.
    // Need to get original pixel's color for each point.
    // This requires mapping i back to original pixelData index.
    // Let's pass the rawValues from colorStats instead of just a,b arrays.

    // Skip drawing points for now. This function needs redesign or different input.
    // It's easier to draw points if we iterate through the raw pixel data again
    // and draw sampled points, converting RGB to Lab on the fly.

    // Re-writing drawLabScatterPlot to take pixelData:
    // See revised function below.
  }
  ctx.globalAlpha = 1.0; // Reset global alpha


}

// --- Revised drawLabScatterPlot function ---
/**
* Draws a scatter plot of a* vs. b* values in CIELAB space on a canvas,
* using the original pixel colors for the points.
* @param {HTMLCanvasElement} canvas - The canvas element.
* @param {Uint8ClampedArray} pixelData - The pixel data array (R, G, B, A).
* @param {number} imageWidth - Original image width.
* @param {number} imageHeight - Original image height.
* @param {number} pixelSampleFactor - Process every Nth pixel for performance (e.g., 10 for 1/10th of pixels).
*/
function drawLabScatterPlotRevised (canvas, pixelData, imageWidth, imageHeight, pixelSampleFactor = 20) { // Increased default sample factor
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#333'; // Background color
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (!pixelData || pixelData.length === 0 || imageWidth === 0 || imageHeight === 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
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
  // Map Lab -100 to canvas edge, +100 to opposite canvas edge.
  const plotRangeA = 200; // -100 to 100
  const plotMinA = -100;
  const plotRangeB = 200; // -100 to 100
  const plotMinB = -100;

  const scaleX = canvasWidth / plotRangeA;
  const scaleY = canvasHeight / plotRangeB;

  // Choose point rendering method: simple rectangle or arc
  const pointSize = 1.5; // Slightly larger points for better visibility
  const pointAlpha = 0.3; // Transparency for dense areas

  ctx.globalAlpha = pointAlpha; // Set global alpha

  // Process pixels with sampling
  const totalPixels = imageWidth * imageHeight;
  for (let i = 0; i < totalPixels; i += pixelSampleFactor) {
    // Calculate index in pixelData array
    const dataIndex = i * 4;
    if (dataIndex >= pixelData.length) break; // Should not happen with correct totalPixels/sampleFactor

    const r = pixelData[dataIndex];
    const g = pixelData[dataIndex + 1];
    const b = pixelData[dataIndex + 2];

    const lab = rgbToLab(r, g, b);
    const l = lab[0]; // Luminance - could use for point brightness/size?
    const a = lab[1];
    const b_lab = lab[2]; // Use b_lab to avoid conflict with function param 'b'

    // Map Lab (a, b) to canvas (x, y)
    // Lab a* maps to X: -100 -> 0, 100 -> canvasWidth. Origin 0 -> canvasCenterX.
    // x = (a - labMinA) * scaleX
    const x = canvasCenterX + a * scaleX * 0.5; // Scale factor 0.5 because range is 200, center is 0
    // Lab b* maps to Y: -100 -> canvasHeight, 100 -> 0. Origin 0 -> canvasCenterY. (Inverted Y-axis)
    // y = canvasHeight - (b_lab - labMinB) * scaleY
    const y = canvasCenterY - b_lab * scaleY * 0.5; // Scale factor 0.5, inverted due to canvas Y-axis

    // Check if the point is within the assumed plotting range [-100, 100] for a*b*
    // Optional: Only draw points within this range
    // if (a >= plotMinA && a <= plotMinA + plotRangeA && b_lab >= plotMinB && b_lab <= plotMinB + plotRangeB) {

    // Set point color using the pixel's original color
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    // Draw the point as a small rectangle
    ctx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);

    // Or draw as a circle (slightly more complex)
    // ctx.beginPath();
    // ctx.arc(x, y, pointSize / 2, 0, Math.PI * 2);
    // ctx.fill();
    // }
  }

  ctx.globalAlpha = 1.0; // Reset global alpha
}