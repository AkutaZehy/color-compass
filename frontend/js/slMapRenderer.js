/**
 * SL Map Renderer - Creates three visualizations for S-L Map analysis
 * 
 * Uses mosaic downsampling for performance, with accurate block mapping.
 */

import { rgbToHsv, rgbToLab } from './colorUtils.js';

const MAX_MOSAIC_SIZE = 150;

function createMosaic(pixelData, width, height) {
  const totalPixels = width * height;
  const targetPixels = MAX_MOSAIC_SIZE * MAX_MOSAIC_SIZE;

  let blockSize = Math.max(2, Math.ceil(Math.sqrt(totalPixels / targetPixels)));

  const mosaicWidth = Math.ceil(width / blockSize);
  const mosaicHeight = Math.ceil(height / blockSize);

  const mosaicData = new Uint8Array(mosaicWidth * mosaicHeight * 4);

  for (let my = 0; my < mosaicHeight; my++) {
    for (let mx = 0; mx < mosaicWidth; mx++) {
      const startX = mx * blockSize;
      const startY = my * blockSize;
      const endX = Math.min(startX + blockSize, width);
      const endY = Math.min(startY + blockSize, height);

      let sumR = 0, sumG = 0, sumB = 0, count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          sumR += pixelData[idx];
          sumG += pixelData[idx + 1];
          sumB += pixelData[idx + 2];
          count++;
        }
      }

      const mosaicIdx = (my * mosaicWidth + mx) * 4;
      mosaicData[mosaicIdx] = Math.round(sumR / count);
      mosaicData[mosaicIdx + 1] = Math.round(sumG / count);
      mosaicData[mosaicIdx + 2] = Math.round(sumB / count);
      mosaicData[mosaicIdx + 3] = 255;
    }
  }

  return { mosaicData, mosaicWidth, mosaicHeight, blockSize };
}

function medianCut(pixels, numColors) {
  if (pixels.length === 0) return [];

  function getColorRange(pixels, channel) {
    let min = 255, max = 0;
    for (const p of pixels) {
      const val = p[['r', 'g', 'b'][channel]];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    return max - min;
  }

  function splitPixels(pixels) {
    const ranges = [0, 1, 2].map(c => getColorRange(pixels, c));
    const splitChannel = ranges.indexOf(Math.max(...ranges));
    
    pixels.sort((a, b) => a[['r', 'g', 'b'][splitChannel]] - b[['r', 'g', 'b'][splitChannel]]);
    const mid = Math.floor(pixels.length / 2);
    return [pixels.slice(0, mid), pixels.slice(mid)];
  }

  function averagePixels(pixels) {
    if (pixels.length === 0) return { r: 0, g: 0, b: 0 };
    const sum = pixels.reduce((acc, p) => ({
      r: acc.r + p.r,
      g: acc.g + p.g,
      b: acc.b + p.b
    }), { r: 0, g: 0, b: 0 });
    return {
      r: Math.round(sum.r / pixels.length),
      g: Math.round(sum.g / pixels.length),
      b: Math.round(sum.b / pixels.length)
    };
  }

  let buckets = [pixels];

  while (buckets.length < numColors) {
    let maxIdx = 0;
    let maxSize = buckets[0].length;
    for (let i = 1; i < buckets.length; i++) {
      if (buckets[i].length > maxSize) {
        maxSize = buckets[i].length;
        maxIdx = i;
      }
    }

    const [b1, b2] = splitPixels(buckets[maxIdx]);
    if (b1.length === 0 || b2.length === 0) break;
    
    buckets.splice(maxIdx, 1, b1, b2);
  }

  return buckets.filter(b => b.length > 0).map(averagePixels);
}

function findNearestColor(pixel, palette) {
  let minDist = Infinity;
  let nearest = palette[0];

  for (const color of palette) {
    const dist = Math.pow(pixel.r - color.r, 2) +
                 Math.pow(pixel.g - color.g, 2) +
                 Math.pow(pixel.b - color.b, 2);
    if (dist < minDist) {
      minDist = dist;
      nearest = color;
    }
  }

  return nearest;
}

/**
 * 1. Mosaic Clustering - Median cut with mosaic downsampling + block fill
 */
export function drawClusteredImage(canvas, pixelData, width, height, numColors = 16) {
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  const { mosaicData, mosaicWidth, mosaicHeight, blockSize } = createMosaic(pixelData, width, height);

  const mosaicPixels = [];
  for (let i = 0; i < mosaicData.length; i += 4) {
    mosaicPixels.push({ r: mosaicData[i], g: mosaicData[i + 1], b: mosaicData[i + 2] });
  }

  const palette = medianCut(mosaicPixels, numColors);

  const coloredMosaic = new Uint8Array(mosaicWidth * mosaicHeight * 4);
  for (let i = 0; i < mosaicPixels.length; i++) {
    const nearest = findNearestColor(mosaicPixels[i], palette);
    const idx = i * 4;
    coloredMosaic[idx] = nearest.r;
    coloredMosaic[idx + 1] = nearest.g;
    coloredMosaic[idx + 2] = nearest.b;
    coloredMosaic[idx + 3] = 255;
  }

  const outputData = ctx.createImageData(width, height);
  const output = outputData.data;

  for (let my = 0; my < mosaicHeight; my++) {
    for (let mx = 0; mx < mosaicWidth; mx++) {
      const colorR = coloredMosaic[(my * mosaicWidth + mx) * 4];
      const colorG = coloredMosaic[(my * mosaicWidth + mx) * 4 + 1];
      const colorB = coloredMosaic[(my * mosaicWidth + mx) * 4 + 2];

      const startX = mx * blockSize;
      const startY = my * blockSize;
      const endX = Math.min(startX + blockSize, width);
      const endY = Math.min(startY + blockSize, height);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const pixelIdx = (y * width + x) * 4;
          output[pixelIdx] = colorR;
          output[pixelIdx + 1] = colorG;
          output[pixelIdx + 2] = colorB;
          output[pixelIdx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(outputData, 0, 0);
}

/**
 * 2. S Map - Saturation grayscale with mosaic + block fill
 */
export function drawSMap(canvas, pixelData, width, height) {
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  const { mosaicData, mosaicWidth, mosaicHeight, blockSize } = createMosaic(pixelData, width, height);

  const grayMosaic = new Uint8Array(mosaicWidth * mosaicHeight * 4);
  for (let i = 0; i < mosaicData.length; i += 4) {
    const hsv = rgbToHsv(mosaicData[i], mosaicData[i + 1], mosaicData[i + 2]);
    const gray = Math.round(hsv[1] * 255);
    grayMosaic[i] = gray;
    grayMosaic[i + 1] = gray;
    grayMosaic[i + 2] = gray;
    grayMosaic[i + 3] = 255;
  }

  const outputData = ctx.createImageData(width, height);
  const output = outputData.data;

  for (let my = 0; my < mosaicHeight; my++) {
    for (let mx = 0; mx < mosaicWidth; mx++) {
      const gray = grayMosaic[(my * mosaicWidth + mx) * 4];

      const startX = mx * blockSize;
      const startY = my * blockSize;
      const endX = Math.min(startX + blockSize, width);
      const endY = Math.min(startY + blockSize, height);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const pixelIdx = (y * width + x) * 4;
          output[pixelIdx] = gray;
          output[pixelIdx + 1] = gray;
          output[pixelIdx + 2] = gray;
          output[pixelIdx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(outputData, 0, 0);
}

/**
 * 3. L Map - Standard 8-bit posterization with mosaic + block fill
 */
export function drawLMap(canvas, pixelData, width, height) {
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  const numLevels = 10;
  const levelSize = 256 / numLevels;

  const { mosaicData, mosaicWidth, mosaicHeight, blockSize } = createMosaic(pixelData, width, height);

  const posterizedMosaic = new Uint8Array(mosaicWidth * mosaicHeight * 4);
  for (let i = 0; i < mosaicData.length; i += 4) {
    const [l] = rgbToLab(mosaicData[i], mosaicData[i + 1], mosaicData[i + 2]);
    const normalizedL = Math.round((l / 100) * 255);
    const posterizedL = Math.floor(normalizedL / levelSize) * levelSize + levelSize / 2;

    posterizedMosaic[i] = posterizedL;
    posterizedMosaic[i + 1] = posterizedL;
    posterizedMosaic[i + 2] = posterizedL;
    posterizedMosaic[i + 3] = 255;
  }

  const outputData = ctx.createImageData(width, height);
  const output = outputData.data;

  for (let my = 0; my < mosaicHeight; my++) {
    for (let mx = 0; mx < mosaicWidth; mx++) {
      const gray = posterizedMosaic[(my * mosaicWidth + mx) * 4];

      const startX = mx * blockSize;
      const startY = my * blockSize;
      const endX = Math.min(startX + blockSize, width);
      const endY = Math.min(startY + blockSize, height);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const pixelIdx = (y * width + x) * 4;
          output[pixelIdx] = gray;
          output[pixelIdx + 1] = gray;
          output[pixelIdx + 2] = gray;
          output[pixelIdx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(outputData, 0, 0);
}

export function drawSLMapPanel(clusterCanvas, sMapCanvas, lMapCanvas, pixelData, width, height) {
  drawClusteredImage(clusterCanvas, pixelData, width, height, 16);
  drawSMap(sMapCanvas, pixelData, width, height);
  drawLMap(lMapCanvas, pixelData, width, height);
}
