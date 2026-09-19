// Regression tests for the palette pipeline (MMCQ + SLIC + analysis).
// These run the pure algorithm modules directly in Node with synthetic
// images — no browser or canvas required: `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractDominantColors } from '../frontend/js/medianCut.js';
import { applySLIC } from '../frontend/js/slic.js';
import { analyzePalette } from '../frontend/js/paletteAnalyzer.js';
import { rgbToLab, labToRgb } from '../frontend/js/colorUtils.js';

// --- helpers ---------------------------------------------------------------

function flatImage(width, height, [r, g, b]) {
  const px = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255;
  }
  return px;
}

function fill(px, width, x0, y0, x1, y1, [r, g, b]) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
}

function gradientImage(width, height) {
  const px = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      px[i] = Math.round((x * 255) / width);
      px[i + 1] = Math.round((y * 255) / height);
      px[i + 2] = 128; px[i + 3] = 255;
    }
  }
  return px;
}

function hasColor(palette, [r, g, b], tolerance = 15) {
  // medianCut returns bare {r,g,b}; the analyzer wraps them in {rgb:{...}}
  return palette.some(c => {
    const rgb = c.rgb || c;
    return Math.abs(rgb.r - r) <= tolerance &&
      Math.abs(rgb.g - g) <= tolerance &&
      Math.abs(rgb.b - b) <= tolerance;
  });
}

function noNaN(palette) {
  return palette.every(c =>
    Number.isFinite(c.rgb.r) && Number.isFinite(c.rgb.g) && Number.isFinite(c.rgb.b) &&
    Number.isFinite(c.lab[0]) && Number.isFinite(c.lab[1]) && Number.isFinite(c.lab[2]));
}

const ANALYZE_DEFAULTS = {
  paletteSize: 12,
  maxHiddenColors: 3,
  minHiddenPercentage: 0.005,
  maxBackgrounds: 3,
  useSuperpixels: false,
  edgeSensitivity: 0.5,
  contrastThreshold: 0.3,
  enableEdgeDetection: true
};

// --- medianCut -------------------------------------------------------------

test('MMCQ: flat image yields exactly one valid color (no empty-cube NaN)', () => {
  const colors = extractDominantColors(flatImage(100, 100, [200, 30, 40]), 8);
  assert.equal(colors.length, 1);
  assert.deepEqual(colors[0], { r: 200, g: 30, b: 40 });
});

test('MMCQ: rare vivid color (0.5% of pixels) survives quantization', () => {
  const px = flatImage(200, 100, [250, 250, 245]);
  fill(px, 200, 0, 99, 100, 100, [220, 30, 40]); // 100 px of 20000 = 0.5%
  const colors = extractDominantColors(px, 8);
  assert.ok(colors.length >= 2, 'expected background and rare color');
  assert.ok(hasColor(colors, [220, 30, 40], 10), 'rare red missing from palette');
  assert.ok(hasColor(colors, [250, 250, 245], 10), 'background missing from palette');
});

test('MMCQ: fully transparent image produces finite colors', () => {
  const colors = extractDominantColors(new Uint8Array(5000 * 4), 6);
  assert.ok(colors.every(c => [c.r, c.g, c.b].every(Number.isFinite)));
});

// --- colorUtils -------------------------------------------------------------

test('Lab→sRGB conversion round-trips rgbToLab inside the sRGB gamut', () => {
  for (const [r, g, b] of [[255, 0, 0], [30, 150, 220], [250, 180, 20], [110, 85, 55], [128, 128, 128], [255, 255, 255]]) {
    const [L, a, bb] = rgbToLab(r, g, b);
    const [r2, g2, b2] = labToRgb(L, a, bb);
    assert.ok(Math.abs(r2 - r) <= 1 && Math.abs(g2 - g) <= 1 && Math.abs(b2 - b) <= 1,
      `rgb(${r},${g},${b}) round-tripped to rgb(${r2},${g2},${b2})`);
  }
  // White must stay white (the old approximation produced rgb(255,251,151))
  assert.deepEqual(labToRgb(100, 0, 0), [255, 255, 255]);
});

// --- analysis pipeline (pixel path) -----------------------------------------

test('pipeline: finds planted colors on a synthetic scene and keeps percentages sane', () => {
  const W = 300, H = 300;
  const px = flatImage(W, H, [244, 244, 240]);     // background ~50%
  fill(px, W, 0, 0, W, 80, [150, 190, 230]);        // sky band
  fill(px, W, 0, 230, W, H, [110, 85, 55]);         // ground band
  fill(px, W, 140, 140, 165, 160, [220, 40, 60]);   // vivid red 0.56%
  fill(px, W, 60, 60, 80, 75, [30, 150, 220]);      // vivid blue 0.33%

  const seeds = extractDominantColors(px, 8);
  const palette = analyzePalette(px, seeds, { ...ANALYZE_DEFAULTS, width: W, height: H });

  assert.ok(noNaN(palette), 'palette contains NaN colors');
  for (const target of [[244, 244, 240], [150, 190, 230], [110, 85, 55], [220, 40, 60], [30, 150, 220]]) {
    assert.ok(hasColor(palette, target), `planted color ${target} missing`);
  }

  const totalPct = palette.reduce((s, c) => s + c.percentage, 0);
  assert.ok(totalPct > 0.95 && totalPct < 1.05, `percentages sum to ${totalPct}`);
  assert.ok(palette.every(c => c.count > 0), 'palette contains empty (0%) clusters');
});

test('pipeline: targetPaletteSize is honored (expansion and truncation)', () => {
  const px = gradientImage(200, 200);
  const seeds = extractDominantColors(px, 6);

  const expanded = analyzePalette(px, seeds, { ...ANALYZE_DEFAULTS, paletteSize: 14, width: 200, height: 200 });
  assert.equal(expanded.length, 14, 'palette should grow to the requested size');
  assert.ok(noNaN(expanded));

  const truncated = analyzePalette(px, extractDominantColors(px, 10),
    { ...ANALYZE_DEFAULTS, paletteSize: 4, width: 200, height: 200 });
  assert.equal(truncated.length, 4, 'palette should shrink to the requested size');
});

// --- analysis pipeline (superpixel path) -------------------------------------

test('pipeline: SLIC produces real superpixels and hidden color gets tagged', () => {
  const W = 300, H = 300;
  const px = flatImage(W, H, [244, 244, 240]);
  fill(px, W, 0, 0, W, 80, [150, 190, 230]);
  fill(px, W, 0, 230, W, H, [110, 85, 55]);
  fill(px, W, 140, 140, 165, 160, [220, 40, 60]); // vivid red, 0.56% of image

  const superpixelData = applySLIC(px, W, H, 200, 10);
  // Before the integer-grid fix this collapsed to ~2 giant blobs.
  assert.ok(superpixelData.features.length >= 100,
    `expected ~200 superpixels, got ${superpixelData.features.length}`);

  const seeds = extractDominantColors(px, 8);
  const palette = analyzePalette(px, seeds, {
    ...ANALYZE_DEFAULTS,
    useSuperpixels: true,
    superpixelData,
    width: W,
    height: H
  });

  assert.ok(noNaN(palette));
  const red = palette.find(c => hasColor([c], [220, 40, 60], 15));
  assert.ok(red, 'vivid red missing from superpixel-path palette');
  assert.equal(red.isHidden, true, 'vivid red should be tagged as hidden color');
});
