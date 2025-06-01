// frontend/js/paletteRenderer.js
import { rgbToHex } from './colorUtils.js'; // Import the function

/**
 * Draws the color palette onto a canvas element.
 * @param {PaletteColor[]} palette - The processed palette array.
 * @param {HTMLCanvasElement} canvasElement - The canvas element to draw onto.
 * @param {number} totalPixels - Total number of pixels in the original image.
 */
export function drawPalette (palette, canvasElement, totalPixels) { // Export the function
  const placeholder = document.getElementById('palettePlaceholder');

  if (!palette || palette.length === 0 || !canvasElement) {
    canvasElement.style.display = 'none'; // Hide canvas if no palette
    if (placeholder) placeholder.style.display = 'block'; // Show placeholder
    return;
  }

  if (placeholder) placeholder.style.display = 'none'; // Hide placeholder
  canvasElement.style.display = 'block'; // Show the canvas

  const ctx = canvasElement.getContext('2d');

  // --- Drawing parameters ---
  const swatchHeight = 50; // Height of each color swatch
  const textHeight = 15;   // Height for color info text (reduced slightly)
  const tagHeight = 12;    // Height for feature/background tag
  const padding = 10;      // Padding around the palette
  const swatchGap = 5;     // Gap between color swatches
  const textGap = 5;       // Gap between swatch and text
  const tagGap = 3;        // Gap between text and tag

  // Calculate required canvas size based on fixed swatch width
  const fixedSwatchWidth = 80; // Fixed width for each swatch
  const requiredWidth = padding * 2 + palette.length * (fixedSwatchWidth + swatchGap) - swatchGap;
  // Height = padding (top) + swatch + textGap + text + tagGap + tag + padding (bottom)
  const requiredHeight = padding * 2 + swatchHeight + textGap + textHeight + tagGap + tagHeight;

  // Adjust canvas size - keep it within reasonable bounds
  // Using clientWidth of the parent container for max width
  const parentWidth = canvasElement.parentElement ? canvasElement.parentElement.clientWidth : requiredWidth;
  canvasElement.width = Math.max(requiredWidth, 300); // Minimum width
  canvasElement.height = requiredHeight;


  // Clear the canvas
  ctx.fillStyle = '#333'; // Match container background
  ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  let currentX = padding;

  // Draw each color swatch and its info
  palette.forEach(color => {
    // Draw the color swatch rectangle
    // Pass RGB as an array to rgbToHex - FIX from previous step
    ctx.fillStyle = rgbToHex([color.rgb.r, color.rgb.g, color.rgb.b]);
    ctx.fillRect(currentX, padding, fixedSwatchWidth, swatchHeight);

    // Draw the color info text (Hex value)
    ctx.fillStyle = '#ffffff'; // White text color
    ctx.font = `${textHeight - 3}px sans-serif`; // Adjust font size based on textHeight
    ctx.textAlign = 'center'; // Center text below the swatch
    ctx.textBaseline = 'top'; // Align text to the top of the baseline

    // Calculate hex string correctly - FIX from previous step
    const hex = rgbToHex([color.rgb.r, color.rgb.g, color.rgb.b]);

    ctx.fillText(hex, currentX + fixedSwatchWidth / 2, padding + swatchHeight + textGap);

    // Optional: Display percentage or background/feature tag
    ctx.font = `${tagHeight - 2}px sans-serif`; // Smaller font for tags
    ctx.textBaseline = 'top'; // Align tags to the top of their baseline


    if (color.isBackground) {
      ctx.fillStyle = '#00ff00'; // Green tag for background
      ctx.fillText("背景", currentX + fixedSwatchWidth / 2, padding + swatchHeight + textGap + textHeight + tagGap);
    } else if (color.isFeature) {
      ctx.fillStyle = '#ffff00'; // Yellow tag for feature
      ctx.fillText("特色", currentX + fixedSwatchWidth / 2, padding + swatchHeight + textGap + textHeight + tagGap);
    }


    // Move to the next position
    currentX += fixedSwatchWidth + swatchGap;
  });
}