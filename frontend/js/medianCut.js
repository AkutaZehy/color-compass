/**
 * Modified Median Cut Quantization (MMCQ) for dominant color extraction.
 *
 * Color Thief-style implementation: pixels are quantized into a 5-bit-per-channel
 * histogram (32768 bins max), and color cubes ("vboxes") are split along their
 * longest axis at the population median. Unlike the previous object-per-pixel
 * version, the histogram preserves rare-but-distinct colors (no averaging pool),
 * and cubes that cannot be split are protected, so no NaN swatches can appear.
 *
 * @param {Uint8Array|Uint8ClampedArray} pixelData - Image pixel data in RGBA format
 * @param {number} colorCount - Number of dominant colors to extract
 * @returns {Array<{r:number,g:number,b:number}>} Dominant colors (population-weighted means)
 */
export function extractDominantColors (pixelData, colorCount) {
  const histo = buildHistogram(pixelData);

  const cubes = [createInitialCube(histo)];

  while (cubes.length < colorCount) {
    // Pick the splittable cube with the highest population x volume priority,
    // the same heuristic Color Thief uses: large AND diverse regions get split first.
    let bestIdx = -1;
    let bestPriority = 0;
    for (let i = 0; i < cubes.length; i++) {
      const cube = cubes[i];
      if (!canSplit(cube)) continue;
      const priority = cube.count * cube.volume;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestIdx = i;
      }
    }

    // No cube can be split any further (e.g. a flat-color image) — stop early
    // instead of producing empty cubes with NaN averages.
    if (bestIdx < 0) break;

    const parts = splitCube(cubes[bestIdx]);
    cubes.splice(bestIdx, 1, ...parts);
  }

  return cubes.map(calculateAverageColor);
}

// ---------------------------------------------------------------------------
// Histogram: 5 bits per channel, index = r << 10 | g << 5 | b
// ---------------------------------------------------------------------------

const BITS = 5;
const LEVELS = 1 << BITS; // 32
const MAX_INDEX = LEVELS * LEVELS * LEVELS; // 32768

function buildHistogram (pixelData) {
  const counts = new Int32Array(MAX_INDEX);
  // Per-bin channel sums for exact population-weighted averages later
  const sumR = new Float64Array(MAX_INDEX);
  const sumG = new Float64Array(MAX_INDEX);
  const sumB = new Float64Array(MAX_INDEX);

  for (let i = 0; i < pixelData.length; i += 4) {
    // Skip mostly-transparent pixels so invisible areas do not skew the palette
    if (pixelData[i + 3] < 125) continue;

    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    const idx = ((r >> (8 - BITS)) << (BITS * 2)) | ((g >> (8 - BITS)) << BITS) | (b >> (8 - BITS));

    counts[idx]++;
    sumR[idx] += r;
    sumG[idx] += g;
    sumB[idx] += b;
  }

  // Compact the histogram into a list of occupied bins for fast iteration
  const bins = [];
  for (let idx = 0; idx < MAX_INDEX; idx++) {
    if (counts[idx] > 0) {
      bins.push({
        idx,
        count: counts[idx],
        sumR: sumR[idx],
        sumG: sumG[idx],
        sumB: sumB[idx]
      });
    }
  }

  return bins;
}

// ---------------------------------------------------------------------------
// Cubes ("vboxes")
// ---------------------------------------------------------------------------

function createInitialCube (bins) {
  const cube = {
    bins: bins.slice(),
    count: 0,
    minR: 255, maxR: 0,
    minG: 255, maxG: 0,
    minB: 255, maxB: 0,
    volume: 0
  };
  refreshCubeBounds(cube);
  return cube;
}

function refreshCubeBounds (cube) {
  cube.count = 0;
  cube.minR = 255; cube.maxR = 0;
  cube.minG = 255; cube.maxG = 0;
  cube.minB = 255; cube.maxB = 0;

  for (const bin of cube.bins) {
    const r = (bin.idx >> (BITS * 2)) & (LEVELS - 1);
    const g = (bin.idx >> BITS) & (LEVELS - 1);
    const b = bin.idx & (LEVELS - 1);

    cube.count += bin.count;
    if (r < cube.minR) cube.minR = r;
    if (r > cube.maxR) cube.maxR = r;
    if (g < cube.minG) cube.minG = g;
    if (g > cube.maxG) cube.maxG = g;
    if (b < cube.minB) cube.minB = b;
    if (b > cube.maxB) cube.maxB = b;
  }

  // Bins were dropped (e.g. all pixels transparent) — clamp to an empty cube
  if (cube.count === 0) {
    cube.minR = cube.maxR = cube.minG = cube.maxG = cube.minB = cube.maxB = 0;
  }

  cube.volume = (cube.maxR - cube.minR + 1) *
    (cube.maxG - cube.minG + 1) *
    (cube.maxB - cube.minB + 1);
}

function canSplit (cube) {
  // A cube splits only if it holds pixels on both sides of some channel median:
  // more than one occupied bin AND a non-degenerate range along some axis.
  // A locked cube failed a previous median cut and must not be retried.
  return !cube.locked &&
    cube.bins.length > 1 &&
    (cube.maxR > cube.minR || cube.maxG > cube.minG || cube.maxB > cube.minB);
}

function splitCube (cube) {
  const rangeR = cube.maxR - cube.minR;
  const rangeG = cube.maxG - cube.minG;
  const rangeB = cube.maxB - cube.minB;
  const maxRange = Math.max(rangeR, rangeG, rangeB);

  // Sort occupied bins by the widest channel
  const shift = maxRange === rangeR ? (BITS * 2) : maxRange === rangeG ? BITS : 0;
  const mask = LEVELS - 1;
  cube.bins.sort((a, b) => ((a.idx >> shift) & mask) - ((b.idx >> shift) & mask));

  // Walk cumulative population to the median (Color Thief's count-based cut):
  // find the first bin index m where cumulative(0..m) reaches half the cube's
  // population; bins [0..m) form cube1, [m..] form cube2. If the median is
  // never reached, the last bin carries the mass and becomes cube2 alone.
  const halfCount = cube.count / 2;
  let cumulative = 0;
  let medianIndex = cube.bins.length - 1;
  for (let i = 0; i < cube.bins.length - 1; i++) {
    cumulative += cube.bins[i].count;
    if (cumulative >= halfCount) {
      medianIndex = i + 1;
      break;
    }
  }

  const cube1 = { bins: cube.bins.slice(0, medianIndex), count: 0, minR: 255, maxR: 0, minG: 255, maxG: 0, minB: 255, maxB: 0, volume: 0 };
  const cube2 = { bins: cube.bins.slice(medianIndex), count: 0, minR: 255, maxR: 0, minG: 255, maxG: 0, minB: 255, maxB: 0, volume: 0 };
  refreshCubeBounds(cube1);
  refreshCubeBounds(cube2);

  // Degenerate split (all population on one side of the median): this cube
  // cannot be cut further. Lock it and return it unchanged so the caller
  // makes no progress with it and never sees an empty cube.
  if (cube1.count === 0 || cube2.count === 0) {
    cube.locked = true;
    return [cube];
  }

  return [cube1, cube2];
}

function calculateAverageColor (cube) {
  if (cube.count === 0) {
    // Should be unreachable (protected by canSplit/degenerate handling),
    // guarded here so a palette color can never be NaN.
    return { r: 0, g: 0, b: 0 };
  }

  let sumR = 0, sumG = 0, sumB = 0;
  for (const bin of cube.bins) {
    sumR += bin.sumR;
    sumG += bin.sumG;
    sumB += bin.sumB;
  }

  return {
    r: Math.round(sumR / cube.count),
    g: Math.round(sumG / cube.count),
    b: Math.round(sumB / cube.count)
  };
}
