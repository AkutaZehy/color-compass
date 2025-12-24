/**
 * Advanced 2D color visualizations
 * - Hue Polar Chart (色相极坐标图)
 * - HSV Square Chart (HSV方形图)
 * - Color Distance Heatmap (色彩距离热力图)
 */

import { rgbToHsv, rgbToLab } from './colorUtils.js';
import { t } from './i18n.js'; // Import i18n module

/**
 * Draws a polar histogram for hue distribution
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {number[]} hValues - Array of hue values (0-1)
 * @param {string} title - Chart title
 */
export function drawHuePolarChart(canvas, hValues, title = '色相分布') {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(centerX, centerY) - 40;

  // Clear canvas
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, width, height);

  if (!hValues || hValues.length === 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText(t('analysis.noHueData'), centerX, centerY);
    return;
  }

  // Create hue histogram bins (36 bins for 10-degree precision)
  const numBins = 36;
  const bins = new Array(numBins).fill(0);
  hValues.forEach(h => {
    const binIndex = Math.min(numBins - 1, Math.floor(h * numBins));
    bins[binIndex]++;
  });

  // Find max value for scaling
  const maxCount = Math.max(...bins);
  const minRadius = 30; // Inner radius (for visual appeal)

  // Draw polar grid
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  for (let r = minRadius; r <= maxRadius; r += (maxRadius - minRadius) / 4) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw angular grid
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2; // Start from top
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(angle) * maxRadius,
      centerY + Math.sin(angle) * maxRadius
    );
    ctx.stroke();
  }

  // Draw colored bars
  const barWidth = (Math.PI * 2) / numBins;

  bins.forEach((count, i) => {
    const normalizedCount = count / maxCount;
    const innerR = minRadius + (maxRadius - minRadius) * 0.15; // Leave some space
    const outerR = minRadius + (maxRadius - minRadius) * (0.15 + normalizedCount * 0.85);
    const startAngle = i * barWidth - Math.PI / 2;
    const endAngle = (i + 1) * barWidth - Math.PI / 2;

    // Create gradient color for this hue
    const hue = i / numBins;
    ctx.fillStyle = `hsla(${hue * 360}, 80%, 50%, 0.8)`;

    // Draw arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();
  });

  // Draw center circle
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(centerX, centerY, minRadius - 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw hue labels
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';

  const labelHues = [0, 3, 6, 9]; // Red, Yellow, Green, Blue
  const labelNames = ['R', 'Y', 'G', 'B'];

  labelHues.forEach((h, i) => {
    const angle = (h / 12) * Math.PI * 2 - Math.PI / 2;
    const labelR = maxRadius + 15;
    ctx.fillText(
      labelNames[i],
      centerX + Math.cos(angle) * labelR,
      centerY + Math.sin(angle) * labelR + 3
    );
  });

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, centerX, 20);
}

/**
 * Draws an HSV square chart (Hue x Saturation with Value as intensity)
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array} pixelData - Object with hValues, sValues, vValues arrays
 * @param {string} title - Chart title
 */
export function drawHsvSquareChart(canvas, pixelData, title = 'HSV分布图') {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, width, height);

  if (!pixelData || !pixelData.hValues || pixelData.hValues.length === 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText(t('analysis.noHSVData'), width / 2, height / 2);
    return;
  }

  const margin = 40;
  const chartWidth = width - margin * 2;
  const chartHeight = height - margin * 2 - 30; // Leave space for legend

  // Create 2D histogram (Hue x Saturation)
  const hBins = 36; // 10-degree precision for hue
  const sBins = 20; // 5% precision for saturation
  const histogram = new Array(hBins).fill(null).map(() => new Array(sBins).fill(0));

  // Aggregate by hue and saturation, weighted by value
  const totalWeight = pixelData.hValues.length;
  const sampleLimit = 50000; // Limit for performance

  pixelData.hValues.forEach((h, i) => {
    // Sample if needed
    if (i % Math.ceil(totalWeight / sampleLimit) !== 0) return;

    const s = pixelData.sValues[i];
    const v = pixelData.vValues[i];

    const hBin = Math.min(hBins - 1, Math.floor(h * hBins));
    const sBin = Math.min(sBins - 1, Math.floor(s * sBins));

    // Weight by value (darker pixels contribute less)
    histogram[hBin][sBin] += v;
  });

  // Find max for scaling
  let maxValue = 0;
  for (let h = 0; h < hBins; h++) {
    for (let s = 0; s < sBins; s++) {
      maxValue = Math.max(maxValue, histogram[h][s]);
    }
  }

  // Draw the heatmap
  const cellWidth = chartWidth / hBins;
  const cellHeight = chartHeight / sBins;

  for (let h = 0; h < hBins; h++) {
    for (let s = 0; s < sBins; s++) {
      const value = histogram[h][s];
      if (value === 0) continue;

      const normalizedValue = value / maxValue;
      const hue = h / hBins;
      const saturation = s / sBins;

      // Color intensity based on value
      const lightness = 0.2 + normalizedValue * 0.6;

      ctx.fillStyle = `hsla(${hue * 360}, ${saturation * 80}%, ${lightness * 70}%, 0.9)`;
      ctx.fillRect(
        margin + h * cellWidth,
        margin + chartHeight - (s + 1) * cellHeight,
        cellWidth - 1,
        cellHeight - 1
      );
    }
  }

  // Draw axes
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin, margin, chartWidth, chartHeight);

  // X-axis label (Hue)
  ctx.fillStyle = '#888';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('色相 (Hue)', margin + chartWidth / 2, height - 8);

  // Y-axis label (Saturation)
  ctx.save();
  ctx.translate(12, margin + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('饱和度 (Saturation)', 0, 0);
  ctx.restore();

  // Draw tick labels
  ctx.fillStyle = '#666';
  ctx.font = '9px sans-serif';

  // Hue labels (every 60 degrees)
  for (let i = 0; i <= 6; i++) {
    const x = margin + (i / 6) * chartWidth;
    ctx.fillText(`${i * 60}°`, x, margin + chartHeight + 12);
  }

  // Saturation labels (every 20%)
  for (let i = 0; i <= 5; i++) {
    const y = margin + chartHeight - (i / 5) * chartHeight;
    ctx.textAlign = 'right';
    ctx.fillText(`${i * 20}%`, margin - 5, y + 3);
    ctx.textAlign = 'center';
  }

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 20);

  // Legend for Value contribution
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('亮度权重: ', margin + chartWidth + 5, margin + 15);
  ctx.fillStyle = '#444';
  ctx.fillRect(margin + chartWidth + 60, margin + 8, 60, 10);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(margin + chartWidth + 60, margin + 8, 60 * 0.7, 10);
  ctx.fillText('→', margin + chartWidth + 125, margin + 16);
}

/**
 * Draws a color distance heatmap
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array} palette - Palette colors
 * @param {Uint8ClampedArray} pixelData - Image pixel data
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @param {string} title - Chart title
 */
export function drawColorDistanceHeatmap(canvas, palette, pixelData, imageWidth, imageHeight, title = '色彩距离热力图') {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, width, height);

  if (!palette || palette.length === 0 || !pixelData) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText(t('analysis.noData'), width / 2, height / 2);
    return;
  }

  const margin = 50;
  const chartSize = Math.min(width, height) - margin * 2;
  const gridSize = Math.min(100, Math.floor(chartSize / 5)); // Grid cells

  // Downsample image for the heatmap
  const cellWidth = imageWidth / gridSize;
  const cellHeight = imageHeight / gridSize;

  // Calculate average distance from each cell to nearest palette color
  const distances = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      // Sample pixels in this cell
      const startX = Math.floor(gx * cellWidth);
      const endX = Math.floor((gx + 1) * cellWidth);
      const startY = Math.floor(gy * cellHeight);
      const endY = Math.floor((gy + 1) * cellHeight);

      let totalDist = 0;
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          // Ensure we don't exceed pixel data bounds
          const idx = (y * imageWidth + x) * 4;
          if (idx + 3 >= pixelData.length) continue; // Skip if out of bounds

          const r = pixelData[idx];
          const g = pixelData[idx + 1];
          const b = pixelData[idx + 2];

          const pixelLab = rgbToLab(r, g, b);

          // Find closest palette color
          let minDist = Infinity;
          palette.forEach(color => {
            const dist = Math.sqrt(
              Math.pow(pixelLab[0] - color.lab[0], 2) +
              Math.pow(pixelLab[1] - color.lab[1], 2) +
              Math.pow(pixelLab[2] - color.lab[2], 2)
            );
            minDist = Math.min(minDist, dist);
          });

          totalDist += minDist;
          count++;
        }
      }

      const avgDist = count > 0 ? totalDist / count : 0;
      distances.push(avgDist);
    }
  }

  // Find max distance for scaling
  const maxDist = Math.max(...distances, 1); // Avoid division by zero

  // Draw heatmap cells
  const cellPixelSize = chartSize / gridSize;

  for (let i = 0; i < distances.length; i++) {
    const gx = i % gridSize;
    const gy = Math.floor(i / gridSize);
    const dist = distances[i];
    const normalizedDist = dist / maxDist;

    // Color gradient: Green (low distance) -> Yellow -> Red (high distance)
    let r, g_, b_;
    if (normalizedDist < 0.5) {
      // Green to Yellow
      const t = normalizedDist * 2;
      r = Math.floor(255 * t);
      g_ = 255;
      b_ = 0;
    } else {
      // Yellow to Red
      const t = (normalizedDist - 0.5) * 2;
      r = 255;
      g_ = Math.floor(255 * (1 - t));
      b_ = 0;
    }

    ctx.fillStyle = `rgb(${r}, ${g_}, ${b_})`;
    ctx.fillRect(
      margin + gx * cellPixelSize,
      margin + gy * cellPixelSize,
      cellPixelSize + 1, // +1 to avoid gaps
      cellPixelSize + 1
    );
  }

  // Draw border
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin, margin, chartSize, chartSize);

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 20);

  // Legend
  const legendY = margin + chartSize + 25;
  const legendWidth = 100;
  const legendHeight = 12;

  // Gradient legend
  const gradient = ctx.createLinearGradient(margin, 0, margin + legendWidth, 0);
  gradient.addColorStop(0, 'rgb(0, 255, 0)');
  gradient.addColorStop(0.5, 'rgb(255, 255, 0)');
  gradient.addColorStop(1, 'rgb(255, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(margin, legendY, legendWidth, legendHeight);

  // Legend labels
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('低差异', margin, legendY + legendHeight + 12);
  ctx.fillText('高差异', margin + legendWidth, legendY + legendHeight + 12);

  // Description
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(`(显示每个区域到最近色板颜色的平均色差)`, margin + legendWidth / 2, legendY + legendHeight + 25);
}

/**
 * Draws a 3D-like color distribution using density estimation
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array} labValues - Array of Lab color values
 * @param {string} title - Chart title
 */
export function drawLabDensityChart(canvas, labValues, title = 'Lab色彩密度分布') {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, width, height);

  if (!labValues || labValues.length === 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText(t('analysis.noLabData'), width / 2, height / 2);
    return;
  }

  const margin = 50;
  const plotWidth = width - margin * 2;
  const plotHeight = height - margin * 2 - 30;

  // Create 2D histogram (a* vs b*)
  const aBins = 40;
  const bBins = 40;
  const aMin = -100, aMax = 100;
  const bMin = -100, bMax = 100;
  const histogram = new Array(aBins).fill(null).map(() => new Array(bBins).fill(0));

  labValues.forEach(lab => {
    const a = lab[1];
    const b = lab[2];

    if (a < aMin || a > aMax || b < bMin || b > bMax) return;

    const aBin = Math.floor((a - aMin) / (aMax - aMin) * aBins);
    const bBin = Math.floor((b - bMin) / (bMax - bMin) * bBins);

    if (aBin >= 0 && aBin < aBins && bBin >= 0 && bBin < bBins) {
      histogram[aBin][bBin]++;
    }
  });

  // Find max for scaling
  let maxCount = 0;
  for (let i = 0; i < aBins; i++) {
    for (let j = 0; j < bBins; j++) {
      maxCount = Math.max(maxCount, histogram[i][j]);
    }
  }

  // Draw heatmap with color based on a* and b*
  const cellWidth = plotWidth / aBins;
  const cellHeight = plotHeight / bBins;

  for (let a = 0; a < aBins; a++) {
    for (let b = 0; b < bBins; b++) {
      const count = histogram[a][b];
      if (count === 0) continue;

      const normalizedCount = count / maxCount;
      const aVal = aMin + (a + 0.5) * (aMax - aMin) / aBins;
      const bVal = bMin + (b + 0.5) * (bMax - bMin) / bBins;

      // Convert Lab to approximate RGB for coloring
      const l = 50; // Use middle luminance
      const color = labToRgbApproximation(l, aVal, bVal);

      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.3 + normalizedCount * 0.7})`;
      ctx.fillRect(
        margin + a * cellWidth,
        margin + plotHeight - (b + 1) * cellHeight,
        cellWidth - 0.5,
        cellHeight - 0.5
      );
    }
  }

  // Draw axes
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin, margin, plotWidth, plotHeight);

  // Axis labels
  ctx.fillStyle = '#888';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('a* (红-绿轴)', margin + plotWidth / 2, height - 8);

  ctx.save();
  ctx.translate(12, margin + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('b* (黄-蓝轴)', 0, 0);
  ctx.restore();

  // Tick labels
  ctx.font = '9px sans-serif';
  [-100, 0, 100].forEach(val => {
    const x = margin + (val - aMin) / (aMax - aMin) * plotWidth;
    ctx.fillText(val.toString(), x, margin + plotHeight + 12);
  });

  [-100, 0, 100].forEach(val => {
    const y = margin + plotHeight - (val - bMin) / (bMax - bMin) * plotHeight;
    ctx.textAlign = 'right';
    ctx.fillText(val.toString(), margin - 5, y + 3);
    ctx.textAlign = 'center';
  });

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 20);
}

/**
 * Approximate RGB from Lab (for visualization only)
 */
function labToRgbApproximation(l, a, b) {
  // Simple approximation for visualization
  const y = (l + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const r = x * 1.656492 - y * 0.354851 - z * 0.255038;
  const g = -x * 0.707196 + y * 1.656393 + z * 0.036152;
  const bl = x * 0.051713 - y * 0.121364 + z * 0.371043;

  return {
    r: Math.max(0, Math.min(255, Math.round((r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : r * 12.92) * 255))),
    g: Math.max(0, Math.min(255, Math.round((g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : g * 12.92) * 255))),
    b: Math.max(0, Math.min(255, Math.round((bl > 0.0031308 ? 1.055 * Math.pow(bl, 1 / 2.4) - 0.055 : bl * 12.92) * 255)))
  };
}
