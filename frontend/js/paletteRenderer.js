// frontend/js/paletteRenderer.js

/**
 * Draws the color palette onto a canvas element.
 * @param {PaletteColor[]} palette - The processed palette array.
 * @param {HTMLCanvasElement} canvasElement - The canvas element to draw onto.
 * @param {number} totalPixels - Total number of pixels in the original image.
 */
function drawPalette (palette, canvasElement, totalPixels) {
  if (!palette || palette.length === 0 || !canvasElement) {
    canvasElement.style.display = 'none'; // Hide canvas if no palette
    document.getElementById('palettePlaceholder').style.display = 'block'; // Show placeholder
    return;
  }

  document.getElementById('palettePlaceholder').style.display = 'none'; // Hide placeholder
  canvasElement.style.display = 'block'; // Show the canvas

  const ctx = canvasElement.getContext('2d');

  // --- Drawing parameters ---
  const swatchHeight = 50; // Height of each color swatch
  const textHeight = 20;   // Height for color info text
  const padding = 10;      // Padding around the palette
  const swatchGap = 5;     // Gap between color swatches
  const textGap = 5;       // Gap between swatch and text

  // Calculate required canvas size
  // We'll arrange colors horizontally
  const totalSwatchWidth = palette.reduce((sum, color) => sum + (color.count / totalPixels) * (canvasElement.width - padding * 2), 0); // Placeholder, needs proper layout
  // Let's use a fixed swatch width for now for simplicity, dynamic width based on pixel count later
  const fixedSwatchWidth = 80; // Fixed width for each swatch
  const requiredWidth = padding * 2 + palette.length * (fixedSwatchWidth + swatchGap) - swatchGap;
  const requiredHeight = padding * 2 + swatchHeight + textHeight + textGap; // Swatch + text height

  // Adjust canvas size - keep it within reasonable bounds
  canvasElement.width = Math.max(requiredWidth, 300); // Minimum width
  canvasElement.height = requiredHeight;


  // Clear the canvas
  ctx.fillStyle = '#333'; // Match container background
  ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  let currentX = padding;

  // Draw each color swatch and its info
  palette.forEach(color => {
    // Draw the color swatch rectangle
    // *** FIX 1: Pass RGB as an array to rgbToHex ***
    ctx.fillStyle = rgbToHex([color.rgb.r, color.rgb.g, color.rgb.b]);
    ctx.fillRect(currentX, padding, fixedSwatchWidth, swatchHeight);

    // Draw the color info text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // *** FIX 2: Calculate hex string correctly ***
    const hex = rgbToHex([color.rgb.r, color.rgb.g, color.rgb.b]);

    // Display Hex value
    ctx.fillText(hex, currentX + fixedSwatchWidth / 2, padding + swatchHeight + textGap + textHeight / 2);

    // Optional: Display percentage or background/feature tag
    if (color.isBackground) {
      ctx.fillStyle = '#00ff00'; // Green tag for background
      ctx.font = '10px sans-serif';
      ctx.fillText("BG", currentX + fixedSwatchWidth / 2, padding + swatchHeight + textGap + textHeight + 5);
    } else if (color.isFeature) {
      ctx.fillStyle = '#ffff00'; // Yellow tag for feature
      ctx.font = '10px sans-serif';
      ctx.fillText("FEAT", currentX + fixedSwatchWidth / 2, padding + swatchHeight + textGap + textHeight + 5);
    }


    // Move to the next position
    currentX += fixedSwatchWidth + swatchGap;
  });
}