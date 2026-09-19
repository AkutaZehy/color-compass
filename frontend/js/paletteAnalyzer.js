/**
 * Palette Analyzer - Two-stage clustering with edge-aware hidden color detection
 * 
 * Improvements over original:
 * 1. Edge-aware hidden color detection (not just cluster size)
 * 2. Spatial connectivity for background detection
 * 3. Single targetPaletteSize parameter (no conflict)
 * 4. Optional ΔE perceptual distance metric
 * 
 * @param {Uint8Array} pixelData - Original image pixel data
 * @param {Array} dominantColors - Dominant colors from MMCQ
 * @param {Object} params - Analysis parameters
 * @returns {Array} - Analyzed palette with color information
 */
import { rgbToLab, labDistance } from './colorUtils.js';

export function analyzePalette(
  pixelData,
  dominantColors,
  params = {}
) {
  // Destructure parameters with defaults
  const {
    paletteSize = 12,
    maxHiddenColors = 3,
    minHiddenPercentage = 0.01,
    maxBackgrounds = 3,
    useSuperpixels = true,
    backgroundVarianceScale = 1,
    superpixelData = null,
    useDeltaE = false,
    width = 0,
    height = 0,
    // New edge-aware parameters
    edgeSensitivity = 0.5,
    contrastThreshold = 0.3,
    enableEdgeDetection = true
  } = params;

  // =========================================================================
  // STEP 1: Prepare input data (superpixel-based or pixel-based)
  // =========================================================================
  let inputData;
  let weights = null;

  if (useSuperpixels && superpixelData && superpixelData.features) {
    // Use superpixel features for faster and more coherent clustering
    inputData = superpixelData.features.map(f => ({
      r: f.avgRGB[0],
      g: f.avgRGB[1],
      b: f.avgRGB[2],
      // Preserve spatial info if available
      x: f.x || 0,
      y: f.y || 0,
      edgeStrength: f.edgeStrength || 0,
      contrast: f.contrast || 0
    }));
    weights = superpixelData.features.map(f => f.pixelCount || 1);
  } else {
    // Fallback to raw pixel data
    inputData = [];
    for (let i = 0; i < pixelData.length; i += 4) {
      inputData.push({
        r: pixelData[i],
        g: pixelData[i + 1],
        b: pixelData[i + 2]
      });
    }
  }

  // =========================================================================
  // STEP 2: Seed K-means from MMCQ, then expand to the target palette size
  // =========================================================================
  let seeds = dedupeColors(dominantColors);
  if (paletteSize > 0 && seeds.length > paletteSize) {
    seeds = seeds.slice(0, paletteSize);
  }

  // Hidden-color seeding: high-contrast / high-edge superpixels far from the
  // MMCQ seeds become extra centroids, so small-but-important colors can win
  // a cluster instead of being absorbed by a dominant neighbor color.
  if (useSuperpixels && superpixelData && superpixelData.features) {
    const room = Math.max(0, Math.max(paletteSize || 0, seeds.length) - seeds.length);
    const hiddenSeeds = pickHiddenSeeds(
      inputData,
      seeds,
      Math.min(maxHiddenColors, room),
      contrastThreshold,
      edgeSensitivity
    );
    seeds = seeds.concat(hiddenSeeds);
  }

  const kmeansOptions = {
    useDeltaE,
    weights,
    maxIterations: 20,
    convergenceThreshold: 1.0
  };

  let clusteringResult = kmeansClustering(inputData, seeds, kmeansOptions);

  clusteringResult = expandClustersToTarget(
    inputData,
    clusteringResult,
    paletteSize,
    kmeansOptions
  );

  clusteringResult = dropEmptyClusters(clusteringResult);

  // =========================================================================
  // STEP 3: Analyze clusters for hidden colors using edge-aware detection
  // =========================================================================
  const clusterAnalysis = analyzeClustersForHiddenColors(
    clusteringResult,
    {
      maxHiddenColors,
      minHiddenPercentage,
      edgeSensitivity,
      contrastThreshold,
      enableEdgeDetection,
      totalPixels: width * height
    }
  );

  // =========================================================================
  // STEP 4: Extract background colors using spatial connectivity
  // =========================================================================
  const backgroundIndices = extractBackgroundColorsSpatial(
    pixelData,
    width,
    height,
    clusteringResult.centroids,
    clusteringResult.labels,
    {
      maxBackgrounds,
      backgroundVarianceScale,
      minBackgroundPixels: Math.floor(width * height * 0.05) // At least 5% of image
    }
  );

  // =========================================================================
  // STEP 5: Format output
  // =========================================================================
  const totalWeight = weights 
    ? weights.reduce((a, b) => a + b, 0) 
    : (width * height || inputData.length);

  return formatOutput(
    clusteringResult.centroids,
    clusteringResult.counts,
    backgroundIndices,
    clusterAnalysis.hiddenIndices,
    totalWeight
  );
}

/**
 * Remove duplicate colors (MMCQ can converge to the same average for two cubes)
 */
function dedupeColors(colors) {
  const seen = new Set();
  const out = [];
  for (const c of colors) {
    const key = `${c.r},${c.g},${c.b}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ r: c.r, g: c.g, b: c.b });
    }
  }
  return out;
}

/**
 * Expand a clustering result up to targetSize centroids by forking the most
 * dispersed clusters and re-running K-means. Makes the targetPaletteSize
 * parameter meaningful: MMCQ only seeds the initial centroids, and clusters
 * with high per-channel spread get split to reach the requested palette size.
 * Runs in rounds (a cluster forks at most once per round) so small seed sets
 * can still reach large targets.
 */
function expandClustersToTarget(data, result, targetSize, kmeansOptions) {
  if (!targetSize) return result;
  let current = result;

  for (let round = 0; current.centroids.length < targetSize && round < 3; round++) {
    const need = targetSize - current.centroids.length;
    const stats = measureClusterSpread(data, current);
    const ranked = stats
      .map((s, idx) => ({ idx, spread: s.magnitude }))
      .sort((a, b) => b.spread - a.spread);

    const centroids = current.centroids.slice();
    let splits = 0;
    for (const { idx, spread } of ranked) {
      if (splits >= need || spread <= 0) break;

      const c = centroids[idx];
      const s = stats[idx];
      const axes = ['r', 'g', 'b'];
      const axis = axes[s.dominantAxis];
      const offset = Math.max(10, s.std[s.dominantAxis] * 0.8);

      const child = { r: c.r, g: c.g, b: c.b };
      const sibling = { r: c.r, g: c.g, b: c.b };
      child[axis] = Math.min(255, Math.round(child[axis] + offset));
      sibling[axis] = Math.max(0, Math.round(sibling[axis] - offset));

      centroids[idx] = child;
      centroids.push(sibling);
      splits++;
    }

    if (splits === 0) break;
    current = kmeansClustering(data, centroids, kmeansOptions);
  }

  return current;
}

/**
 * One pass over the data measuring per-cluster dispersion:
 * weighted per-channel std of members plus the dominant axis.
 */
function measureClusterSpread(data, { labels, centroids }) {
  const k = centroids.length;
  const count = new Float64Array(k);
  const sum = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0 }));
  const sumSq = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0 }));

  for (let i = 0; i < data.length; i++) {
    const l = labels[i];
    if (l < 0 || l >= k) continue;
    const p = data[i];
    count[l]++;
    sum[l].r += p.r;
    sum[l].g += p.g;
    sum[l].b += p.b;
    sumSq[l].r += p.r * p.r;
    sumSq[l].g += p.g * p.g;
    sumSq[l].b += p.b * p.b;
  }

  const axes = ['r', 'g', 'b'];
  return centroids.map((_, i) => {
    if (count[i] <= 0) {
      return { std: [0, 0, 0], magnitude: 0, dominantAxis: 0 };
    }
    const std = [0, 1, 2].map(ch => {
      const mean = sum[i][axes[ch]] / count[i];
      const variance = Math.max(0, sumSq[i][axes[ch]] / count[i] - mean * mean);
      return Math.sqrt(variance);
    });
    let dominantAxis = 0;
    for (let ch = 1; ch < 3; ch++) {
      if (std[ch] > std[dominantAxis]) dominantAxis = ch;
    }
    return { std, magnitude: std[dominantAxis], dominantAxis };
  });
}

/**
 * Drop clusters that lost every member during K-means (merged into others),
 * remapping labels so downstream indices stay consistent.
 */
function dropEmptyClusters({ centroids, labels, counts }) {
  const keepIdx = [];
  centroids.forEach((_, i) => {
    if (counts[i] > 0) keepIdx.push(i);
  });
  if (keepIdx.length === centroids.length) {
    return { centroids, labels, counts };
  }

  const remap = new Map(keepIdx.map((old, neo) => [old, neo]));
  return {
    centroids: keepIdx.map(i => centroids[i]),
    counts: keepIdx.map(i => counts[i]),
    labels: labels.map(l => (l >= 0 && remap.has(l)) ? remap.get(l) : -1)
  };
}

/**
 * Pick extra "hidden color" seeds from superpixel features: colors with high
 * local contrast or edge strength that sit far (RGB >= 60) from every seed
 * chosen so far. These become additional K-means centroids.
 */
function pickHiddenSeeds(features, existingSeeds, maxSeeds, contrastThreshold, edgeSensitivity) {
  if (maxSeeds <= 0) return [];

  const scored = features
    .map((f, i) => ({
      f,
      score: (f.contrast || 0) * 0.6 + (f.edgeStrength || 0) * 0.4
    }))
    .filter(c => (c.f.contrast || 0) >= contrastThreshold || (c.f.edgeStrength || 0) >= edgeSensitivity)
    .sort((a, b) => b.score - a.score);

  const MIN_SEED_DISTANCE = 60;
  const farFromAll = (color, list) => list.every(s => {
    const dr = s.r - color.r, dg = s.g - color.g, db = s.b - color.b;
    return Math.sqrt(dr * dr + dg * dg + db * db) >= MIN_SEED_DISTANCE;
  });

  const picked = [];
  for (const c of scored) {
    if (picked.length >= maxSeeds) break;
    const color = { r: c.f.r, g: c.f.g, b: c.f.b };
    if (farFromAll(color, existingSeeds) && farFromAll(color, picked)) {
      picked.push(color);
    }
  }
  return picked;
}

/**
 * K-means clustering with optional ΔE perceptual distance
 */function kmeansClustering(pixelData, initialCentroids, options = {}) {
  const {
    useDeltaE = false,
    weights = null,
    maxIterations = 20,
    convergenceThreshold = 1.0
  } = options;

  // Validate initial centroids
  if (!initialCentroids || initialCentroids.length === 0) {
    throw new Error('No initial centroids provided');
  }

  // Initialize centroids from MMCQ results
  let centroids = initialCentroids.map(c => ({
    r: c.r,
    g: c.g,
    b: c.b
  }));

  let labels = new Array(pixelData.length).fill(-1);
  let counts = new Array(centroids.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    const newCounts = new Array(centroids.length).fill(0);
    const newSums = centroids.map(() => ({ r: 0, g: 0, b: 0, edge: 0, contrast: 0 }));

    // Assignment step: assign each pixel to nearest centroid
    for (let i = 0; i < pixelData.length; i++) {
      const pixel = pixelData[i];

      let minDist = Infinity;
      let bestCluster = -1;

      for (let cIdx = 0; cIdx < centroids.length; cIdx++) {
        const centroid = centroids[cIdx];
        let dist;

        if (useDeltaE) {
          // Use perceptual ΔE distance in Lab space
          const lab1 = rgbToLab(pixel.r, pixel.g, pixel.b);
          const lab2 = rgbToLab(centroid.r, centroid.g, centroid.b);
          dist = labDistance(lab1, lab2);
        } else {
          // Use RGB Euclidean distance (faster)
          dist = colorDistanceRGB(
            pixel.r, pixel.g, pixel.b,
            centroid.r, centroid.g, centroid.b
          );
        }

        if (dist < minDist) {
          minDist = dist;
          bestCluster = cIdx;
        }
      }

      if (bestCluster < 0) continue;

      if (labels[i] !== bestCluster) {
        changed = true;
        labels[i] = bestCluster;
      }

      const weight = weights ? weights[i] : 1;
      newCounts[bestCluster] += weight;
      newSums[bestCluster].r += pixel.r * weight;
      newSums[bestCluster].g += pixel.g * weight;
      newSums[bestCluster].b += pixel.b * weight;
      // Aggregate superpixel edge/contrast so cluster tagging sees real values
      newSums[bestCluster].edge += (pixel.edgeStrength || 0) * weight;
      newSums[bestCluster].contrast += (pixel.contrast || 0) * weight;
    }

    // Update centroids (carrying weighted mean edge strength and contrast)
    centroids = newSums.map((sum, idx) => {
      const fallback = centroids[idx] || { r: 0, g: 0, b: 0, edgeStrength: 0, contrast: 0 };
      const hasMembers = newCounts[idx] > 0;
      return {
        r: hasMembers ? Math.round(sum.r / newCounts[idx]) : fallback.r,
        g: hasMembers ? Math.round(sum.g / newCounts[idx]) : fallback.g,
        b: hasMembers ? Math.round(sum.b / newCounts[idx]) : fallback.b,
        edgeStrength: hasMembers ? sum.edge / newCounts[idx] : (fallback.edgeStrength || 0),
        contrast: hasMembers ? sum.contrast / newCounts[idx] : (fallback.contrast || 0)
      };
    });

    counts = newCounts;

    // Check for convergence
    if (!changed) {
      console.log(`K-means converged after ${iter + 1} iterations`);
      break;
    }
  }

  return { centroids, labels, counts };
}

/**
 * Analyze clusters to identify hidden colors using edge-aware metrics
 * 
 * HIDDEN COLOR DETECTION STRATEGY:
 * 1. Small clusters that are spatially concentrated (likely important objects)
 * 2. High edge-strength colors (boundaries of objects)
 * 3. High local contrast colors (stand out from surroundings)
 * 4. Colors with unusual hue (outliers in color distribution)
 */
function analyzeClustersForHiddenColors(clusteringResult, options) {
  const {
    maxHiddenColors,
    minHiddenPercentage,
    edgeSensitivity,
    contrastThreshold,
    enableEdgeDetection,
    totalPixels
  } = options;

  const { centroids, counts } = clusteringResult;

  // Calculate cluster statistics
  const clusterStats = centroids.map((centroid, idx) => {
    const count = counts[idx];
    const percentage = count / totalPixels;

    // Calculate color distribution metrics
    const lab = rgbToLab(centroid.r, centroid.g, centroid.b);
    // Hue angle from a*/b* — NOT L*, which is lightness
    const hue = Math.atan2(lab[2], lab[1]);

    return {
      idx,
      centroid,
      count,
      percentage,
      lab,
      hue,
      // Hidden color score components (aggregated by K-means; 0 without superpixels)
      sizeScore: percentage, // Raw size score
      edgeScore: centroid.edgeStrength || 0, // Edge strength if available
      contrastScore: centroid.contrast || 0, // Local contrast if available
      hueUniqueness: 0 // Filled in below once the circular mean is known
    };
  });

  // Circular mean hue across clusters (weighted by member counts).
  // Averaging hue angles linearly is wrong: red (-170°) and magenta (+170°)
  // would average to cyan instead of ~180°.
  let sinSum = 0, cosSum = 0, weightSum = 0;
  for (const stat of clusterStats) {
    sinSum += Math.sin(stat.hue) * stat.count;
    cosSum += Math.cos(stat.hue) * stat.count;
    weightSum += stat.count;
  }
  const avgHue = weightSum > 0 ? Math.atan2(sinSum, cosSum) : 0;

  for (const stat of clusterStats) {
    // Normalized circular distance from the mean hue: 0 = same hue, 1 = opposite
    stat.hueUniqueness = circularHueDistance(stat.hue, avgHue) / Math.PI;
  }

  // Calculate threshold dynamically based on distribution
  const avgPercentage = clusterStats.reduce((sum, c) => sum + c.percentage, 0) / clusterStats.length;

  // Hidden color candidates: small but significant
  const hiddenCandidates = [];

  for (const stat of clusterStats) {
    // Criteria for hidden color:
    // 1. Small cluster (below average percentage)
    // 2. AND (
    //    a. High edge strength (object boundaries), OR
    //    b. High local contrast (stands out), OR
    //    c. Hue > 54 degrees away from the weighted mean hue, OR
    //    d. Small but not tiny (above minimum threshold)
    // )

    const isSmall = stat.percentage < avgPercentage;
    const isAboveMinThreshold = stat.percentage >= minHiddenPercentage;
    const hasEdge = enableEdgeDetection && stat.edgeScore > edgeSensitivity * 0.5;
    const hasContrast = stat.contrastScore > contrastThreshold;
    const isHueUnique = stat.hueUniqueness > 0.3;

    if (isSmall && isAboveMinThreshold && (hasEdge || hasContrast || isHueUnique)) {
      // Calculate hidden score (higher = more likely to be important hidden color)
      const hiddenScore =
        (hasEdge ? stat.edgeScore * edgeSensitivity : 0) +
        (hasContrast ? stat.contrastScore * 0.5 : 0) +
        (isHueUnique ? stat.hueUniqueness * 0.3 : 0) +
        (stat.percentage / avgPercentage * 0.2);

      hiddenCandidates.push({
        idx: stat.idx,
        score: hiddenScore,
        reason: hasEdge ? 'edge' : hasContrast ? 'contrast' : 'hue'
      });
    }
  }

  // Sort by hidden score and take top candidates
  hiddenCandidates.sort((a, b) => b.score - a.score);
  const hiddenIndices = hiddenCandidates
    .slice(0, maxHiddenColors)
    .map(c => c.idx);

  return { hiddenIndices, hiddenCandidates };
}

/**
 * Circular distance between two hue angles in radians (0..PI)
 */
function circularHueDistance(h1, h2) {
  const diff = Math.abs(h1 - h2) % (2 * Math.PI);
  return diff > Math.PI ? 2 * Math.PI - diff : diff;
}

/**
 * Extract background colors using spatial connectivity analysis
 * 
 * BACKGROUND DETECTION STRATEGY:
 * 1. Find large connected regions (clusters)
 * 2. Prefer regions at image edges (background is usually at edges)
 * 3. Check if color matches expected background characteristics
 */
function extractBackgroundColorsSpatial(
  pixelData,
  width,
  height,
  centroids,
  labels,
  options = {}
) {
  const {
    maxBackgrounds = 3,
    backgroundVarianceScale = 1,
    minBackgroundPixels = 1000
  } = options;

  if (width === 0 || height === 0) {
    return [];
  }

  // Sample edge pixels to find background candidates
  const edgeSamples = sampleEdgePixels(pixelData, width, height, 100);
  
  // Count centroid matches at edges
  const centroidMatches = new Array(centroids.length).fill(0);
  const threshold = 30 * backgroundVarianceScale;

  for (const sample of edgeSamples) {
    // Find nearest centroid
    let minDist = Infinity;
    let bestMatch = -1;
    
    for (let cIdx = 0; cIdx < centroids.length; cIdx++) {
      const dist = colorDistanceRGB(
        sample.r, sample.g, sample.b,
        centroids[cIdx].r, centroids[cIdx].g, centroids[cIdx].b
      );
      if (dist < minDist) {
        minDist = dist;
        bestMatch = cIdx;
      }
    }
    
    if (bestMatch >= 0 && minDist < threshold) {
      centroidMatches[bestMatch]++;
    }
  }

  // Find largest clusters that also appear at edges
  const clusterSizes = centroids.map((_, idx) => ({
    idx,
    size: centroidMatches[idx], // Weight by edge presence
    isLarge: centroidMatches[idx] > 10 // Significant edge presence
  }));

  // Sort by edge presence (descending) and take top candidates
  clusterSizes.sort((a, b) => b.size - a.size);
  
  return clusterSizes
    .slice(0, maxBackgrounds)
    .filter(c => c.isLarge)
    .map(c => c.idx);
}

/**
 * Sample pixels from image edges (more likely to be background)
 */
function sampleEdgePixels(pixelData, width, height, maxSamples) {
  const samples = [];
  const step = Math.max(1, Math.floor((width + height) * 2 / maxSamples));
  
  // Top and bottom rows
  for (let x = 0; x < width; x += step) {
    samples.push(getPixelRGB(pixelData, x, 0, width));
    samples.push(getPixelRGB(pixelData, x, height - 1, width));
  }
  
  // Left and right columns
  for (let y = 0; y < height; y += step) {
    samples.push(getPixelRGB(pixelData, 0, y, width));
    samples.push(getPixelRGB(pixelData, width - 1, y, width));
  }
  
  return samples;
}

/**
 * Get RGB values for a pixel at (x, y)
 */
function getPixelRGB(pixelData, x, y, width) {
  const idx = (y * width + x) * 4;
  return {
    r: pixelData[idx] || 0,
    g: pixelData[idx + 1] || 0,
    b: pixelData[idx + 2] || 0
  };
}

/**
 * Calculate RGB color distance
 */
function colorDistanceRGB(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Format output with color information
 */
function formatOutput(centroids, counts, backgroundIndices, hiddenIndices, totalPixels) {
  return centroids.map((color, idx) => ({
    rgb: { r: color.r, g: color.g, b: color.b },
    lab: rgbToLab(color.r, color.g, color.b),
    count: counts[idx] || 0,
    percentage: (counts[idx] || 0) / totalPixels,
    isBackground: backgroundIndices.includes(idx),
    isHidden: hiddenIndices.includes(idx)
  }));
}
