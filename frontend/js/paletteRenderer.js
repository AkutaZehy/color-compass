// frontend/js/paletteRenderer.js
import { rgbToHex } from './colorUtils.js'; // Import the function
import { t } from './i18n.js'; // Import i18n module

/**
 * Draws the color palette onto a canvas element.
 * @param {PaletteColor[]} palette - The processed palette array.
 * @param {HTMLCanvasElement} canvasElement - The canvas element to draw onto.
 * @param {number} totalPixels - Total number of pixels in the original image.
 */
export function drawPalette (palette, canvasElement, totalPixels) {
  const placeholder = document.getElementById('palettePlaceholder');
  const paletteExportButtons = canvasElement.parentElement ? canvasElement.parentElement.querySelector('.export-buttons') : null;

  if (!palette || palette.length === 0 || !canvasElement) {
    canvasElement.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    if (paletteExportButtons) {
      console.log("Hiding palette export buttons (palette is empty or invalid).");
      paletteExportButtons.style.display = 'none';
    }
    return;
  }

  if (placeholder) placeholder.style.display = 'none';
  canvasElement.style.display = 'block';

  const ctx = canvasElement.getContext('2d');

  const swatchHeight = 50;
  const textHeight = 15;
  const tagHeight = 12;
  const padding = 10;
  const swatchGap = 5;
  const textGap = 5;
  const tagGap = 3;
  const fixedSwatchWidth = 80;

  const parentWidth = canvasElement.parentElement ? canvasElement.parentElement.clientWidth : 800;
  const maxSwatchesPerRow = Math.floor((parentWidth - padding * 2 + swatchGap) / (fixedSwatchWidth + swatchGap));
  const numRows = Math.ceil(palette.length / maxSwatchesPerRow);

  const requiredHeight = padding * 2 + numRows * (swatchHeight + textGap + textHeight + tagGap + tagHeight + swatchGap) - swatchGap;
  canvasElement.width = parentWidth;
  canvasElement.height = requiredHeight;

  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  let currentX = padding;
  let currentY = padding;

  palette.forEach((color, index) => {
    if (index > 0 && index % maxSwatchesPerRow === 0) {
      currentX = padding;
      currentY += swatchHeight + textGap + textHeight + tagGap + tagHeight + swatchGap;
    }

    ctx.fillStyle = rgbToHex([color.rgb.r, color.rgb.g, color.rgb.b]);
    ctx.fillRect(currentX, currentY, fixedSwatchWidth, swatchHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${textHeight - 3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const hex = rgbToHex([color.rgb.r, color.rgb.g, color.rgb.b]);
    ctx.fillText(hex, currentX + fixedSwatchWidth / 2, currentY + swatchHeight + textGap);

    ctx.font = `${tagHeight - 2}px sans-serif`;
    ctx.textBaseline = 'top';

    if (color.isBackground) {
      ctx.fillStyle = '#00ff00';
      ctx.fillText(t('palette.tags.background'), currentX + fixedSwatchWidth / 2, currentY + swatchHeight + textGap + textHeight + tagGap);
    } else if (color.isHidden) {
      ctx.fillStyle = '#ffff00';
      ctx.fillText(t('palette.tags.featured'), currentX + fixedSwatchWidth / 2, currentY + swatchHeight + textGap + textHeight + tagGap);
    }

    currentX += fixedSwatchWidth + swatchGap;
  });

  if (paletteExportButtons) {
    console.log("Showing palette export buttons.");
    paletteExportButtons.style.display = 'block';
  }
}

/**
 * Exports the drawn palette canvas as a PNG image.
 * @param {HTMLCanvasElement} canvasElement - The canvas element containing the drawn palette.
 * @param {string} filename - The desired name for the downloaded file (e.g., "palette.png").
 * @returns {string|null} Data URL of the image, or null on error.
 */
export function exportPaletteAsImage (canvasElement, filename = 'color_palette.png') { // Export the function
  if (!canvasElement || canvasElement.width === 0 || canvasElement.height === 0) {
    console.error("Cannot export empty or non-existent palette canvas.");
    alert(t('errors.noPalette'));
    return null;
  }

  try {
    // Get image data as Data URL (PNG format by default)
    const dataUrl = canvasElement.toDataURL('image/png');
    return dataUrl; // Return Data URL so main.js can use fileSaver
  } catch (e) {
    console.error("Error getting data URL from palette canvas:", e);
    alert(t('errors.paletteExportFailed'));
    return null;
  }
}