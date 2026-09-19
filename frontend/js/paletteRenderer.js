// frontend/js/paletteRenderer.js
import { rgbToHex } from './colorUtils.js'; // Import the function
import { t } from './i18n.js'; // Import i18n module
import { showToast } from './toast.js';

/**
 * Draws a paint-chip swatch (skeuomorphic theme): rounded paper card with a
 * gloss band, a white label plate, and a punched hole at the top edge.
 */
function drawChipSwatch (ctx, x, y, width, height, hex) {
  const radius = 6;
  const labelHeight = 20;

  // Chip body
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = hex;
  ctx.fill();

  // Subtle edge shading so the chip reads as a physical card
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Gloss band across the top
  const gloss = ctx.createLinearGradient(0, y, 0, y + height * 0.45);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, width - 2, height * 0.45, { tl: radius - 1, tr: radius - 1, bl: 0, br: 0 });
  ctx.fill();

  // White label plate on the lower part (like a Pantone strip)
  ctx.beginPath();
  ctx.roundRect(x + 1, y + height - labelHeight - 1, width - 2, labelHeight, { tl: 0, tr: 0, bl: radius - 1, br: radius - 1 });
  ctx.fillStyle = '#fffef8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.stroke();
}

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

  // Paint-chip rendering in the skeuomorphic theme
  const chipMode = document.body.classList.contains('skeuo');

  const swatchHeight = 50;
  const textHeight = 15;
  const tagHeight = 12;
  const padding = 10;
  const swatchGap = 5;
  const textGap = 5;
  const tagGap = 3;
  const fixedSwatchWidth = 80;

  // In chip mode hex/percentage print onto the chip's own label plate and a
  // small tag ribbon sits under each chip; otherwise text stacks below.
  const rowHeight = chipMode
    ? swatchHeight + 14 + swatchGap
    : swatchHeight + textGap + textHeight + tagGap + tagHeight + tagGap + tagHeight + swatchGap;

  const parentWidth = canvasElement.parentElement ? canvasElement.parentElement.clientWidth : 800;
  const maxSwatchesPerRow = Math.floor((parentWidth - padding * 2 + swatchGap) / (fixedSwatchWidth + swatchGap));
  const numRows = Math.ceil(palette.length / maxSwatchesPerRow);

  const requiredHeight = padding * 2 + numRows * rowHeight - swatchGap;
  canvasElement.width = parentWidth;
  canvasElement.height = requiredHeight;

  // Paper backing in chip mode, dark studio backdrop otherwise
  ctx.fillStyle = chipMode ? 'transparent' : '#333';
  if (!chipMode) {
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  }

  let currentX = padding;
  let currentY = padding;

  palette.forEach((color, index) => {
    if (index > 0 && index % maxSwatchesPerRow === 0) {
      currentX = padding;
      currentY += rowHeight;
    }

    const hex = rgbToHex([color.rgb.r, color.rgb.g, color.rgb.b]);

    if (chipMode) {
      drawChipSwatch(ctx, currentX, currentY, fixedSwatchWidth, swatchHeight, hex);

      // Print hex + percentage on the chip's label plate
      ctx.fillStyle = '#3d372b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '9px "Courier New", monospace';
      ctx.fillText(hex, currentX + fixedSwatchWidth / 2, currentY + swatchHeight - 14);
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#6b5d42';
      ctx.fillText(
        `${((color.percentage || 0) * 100).toFixed(1)}%`,
        currentX + fixedSwatchWidth / 2, currentY + swatchHeight - 5
      );

      // Tag marker as a small ribbon under the chip
      if (color.isBackground || color.isHidden) {
        ctx.fillStyle = color.isBackground ? '#2e7d32' : '#c9a227';
        ctx.beginPath();
        ctx.roundRect(currentX + 4, currentY + swatchHeight + 3, fixedSwatchWidth - 8, 11, 2);
        ctx.fill();
        ctx.fillStyle = '#fffef8';
        ctx.font = '8px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          color.isBackground ? t('palette.tags.background') : t('palette.tags.featured'),
          currentX + fixedSwatchWidth / 2, currentY + swatchHeight + 9
        );
      }
    } else {
      ctx.fillStyle = hex;
      ctx.fillRect(currentX, currentY, fixedSwatchWidth, swatchHeight);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // HEX label
      ctx.fillStyle = '#ffffff';
      ctx.font = `${textHeight - 3}px sans-serif`;
      ctx.fillText(hex, currentX + fixedSwatchWidth / 2, currentY + swatchHeight + textGap);

      // Pixel percentage (share of the analyzed image)
      ctx.fillStyle = '#b0b0c0';
      ctx.font = `${tagHeight - 2}px sans-serif`;
      const pct = `${((color.percentage || 0) * 100).toFixed(1)}%`;
      ctx.fillText(pct, currentX + fixedSwatchWidth / 2, currentY + swatchHeight + textGap + textHeight + tagGap);

      // Optional tag line (background / hidden)
      if (color.isBackground) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText(t('palette.tags.background'), currentX + fixedSwatchWidth / 2, currentY + swatchHeight + textGap + textHeight + tagGap + tagHeight + tagGap);
      } else if (color.isHidden) {
        ctx.fillStyle = '#ffff00';
        ctx.fillText(t('palette.tags.featured'), currentX + fixedSwatchWidth / 2, currentY + swatchHeight + textGap + textHeight + tagGap + tagHeight + tagGap);
      }
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
    showToast(t('errors.noPalette'));
    return null;
  }

  try {
    // Get image data as Data URL (PNG format by default)
    const dataUrl = canvasElement.toDataURL('image/png');
    return dataUrl; // Return Data URL so main.js can use fileSaver
  } catch (e) {
    console.error("Error getting data URL from palette canvas:", e);
    showToast(t('errors.paletteExportFailed'));
    return null;
  }
}