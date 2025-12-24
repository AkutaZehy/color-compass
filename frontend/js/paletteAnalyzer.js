/**
 * Two-stage Kmeans algorithm for palette analysis
 *
 * @param {Uint8Array} pixelData - Original image pixel data
 * @param {Array} dominantColors - Dominant colors from MMCQ
 * @param {number} paletteSize - Total palette size
 * @param {number} maxHiddenColors - Maximum hidden colors count
 * @param {number} minHiddenPercentage - Minimum percentage for hidden colors
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} - Analyzed palette with color information
 */
import { rgbToLab, labDistance } from './colorUtils.js';
export function analyzePalette (pixelData, dominantColors, paletteSize, maxHiddenColors, minHiddenPercentage, width, height, maxBackgrounds = 3, useSuperpixels = false, backgroundVarianceScale = 1, superpixelData = null, useDeltaE = false) {
  // Handle different input types
  let inputData;
  let weights = null;
  if (useSuperpixels && superpixelData) {
    // For superpixel features (array of objects with avgRGB and pixelCount)
    inputData = new Array(superpixelData.features.length);
    weights = new Array(superpixelData.features.length);

    for (let i = 0; i < superpixelData.features.length; i++) {
      const feature = superpixelData.features[i];
      inputData[i] = {
        r: feature.avgRGB[0],
        g: feature.avgRGB[1],
        b: feature.avgRGB[2]
      };
      weights[i] = feature.pixelCount;
    }
  } else {
    // For raw pixel data (Uint8ClampedArray)
    inputData = new Array(pixelData.length / 4);
    for (let i = 0; i < pixelData.length; i += 4) {
      inputData[i / 4] = {
        r: pixelData[i],
        g: pixelData[i + 1],
        b: pixelData[i + 2]
      };
    }
  }

  console.log(superpixelData, "Superpixel data for clustering");
  console.log(inputData, "Input data for clustering");

  // Single stage Kmeans with all required colors
  const totalColors = Math.min(paletteSize, dominantColors.length + maxHiddenColors);

  // Run clustering with perceptual distance metric
  const result = kmeansClustering(inputData, dominantColors, 10, {
    useDeltaE: useDeltaE,
    weights: weights
  });

  // Identify hidden colors based on cluster size
  const sortedClusters = result.centroids
    .map((centroid, i) => ({
      centroid,
      count: result.counts[i],
      percentage: result.counts[i] / (width * height)
    }))
    .sort((a, b) => a.count - b.count);

  // Mark hidden colors (smallest clusters)
  const hiddenColorIndices = [];
  const maxHiddenToCheck = Math.min(maxHiddenColors, sortedClusters.length);
  for (let i = 0; i < maxHiddenToCheck; i++) {
    if (sortedClusters[i].percentage >= minHiddenPercentage || i === 0) {
      hiddenColorIndices.push(result.centroids.indexOf(sortedClusters[i].centroid));
    }
  }

  // Extract background colors with connectivity analysis
  const backgroundColors = extractBackgroundColors(
    pixelData,
    width,
    height,
    result.centroids,
    maxBackgrounds,
    {
      useConnectivity: true,
      backgroundVarianceScale: backgroundVarianceScale
    }
  );

  // Format output with hidden color markers
  return formatOutput(
    result.centroids,
    result.counts,
    backgroundColors,
    weights ? weights.reduce((a, b) => a + b, 0) : width * height,
    hiddenColorIndices
  );
}

// Kmeans clustering implementation
function kmeansClustering (pixelData, initialCentroids, maxIterations, options = {}) {
  // Input validation
  if (!initialCentroids || initialCentroids.length === 0) {
    throw new Error('No initial centroids provided');
  }

  // Validate centroids (allow 0,0,0 as valid color)
  initialCentroids.forEach((centroid, idx) => {
    if (!centroid || centroid.r === undefined || centroid.g === undefined || centroid.b === undefined) {
      console.error(`Invalid centroid at index ${idx}:`, centroid);
      throw new Error(`Invalid centroid at index ${idx}`);
    }
  });

  let centroids = [...initialCentroids];
  let labels = new Array(pixelData.length).fill(-1);
  let counts = new Array(centroids.length).fill(0);
  const weights = options.weights || null;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assignment step
    let changed = false;
    const newCounts = new Array(centroids.length).fill(0);
    const newSums = centroids.map(() => ({ r: 0, g: 0, b: 0 }));

    for (let i = 0; i < pixelData.length; i++) {
      const pixel = pixelData[i];
      const r = pixel.r;
      const g = pixel.g;
      const b = pixel.b;

      // Find nearest centroid
      let minDist = Infinity;
      let bestCluster = -1;

      centroids.forEach((centroid, idx) => {
        if (!centroid || centroid.r === undefined || centroid.g === undefined || centroid.b === undefined) {
          console.error(`Invalid centroid at index ${idx}:`, centroid);
          throw new Error(`Invalid centroid at index ${idx}`);
        }
        let dist;
        if (options.useDeltaE) {
          // 使用ΔE色差距离
          const lab1 = rgbToLab(r, g, b);
          const lab2 = rgbToLab(centroid.r, centroid.g, centroid.b);
          dist = labDistance(lab1, lab2);
        } else {
          // 使用RGB欧氏距离
          dist = colorDistance(r, g, b, centroid.r, centroid.g, centroid.b);
        }
        if (dist < minDist) {
          minDist = dist;
          bestCluster = idx;
        }
      });

      // Update label and cluster stats
      // 注意：当使用超像素时，i是超像素索引；使用原始像素时，i是数据索引
      const labelIndex = weights ? i : i / 4; // 超像素数据没有/4的转换
      if (labels[labelIndex] !== bestCluster) {
        changed = true;
        labels[labelIndex] = bestCluster;
      }

      const weight = weights ? weights[i] : 1;
      newCounts[bestCluster] += weight;
      newSums[bestCluster].r += r * weight;
      newSums[bestCluster].g += g * weight;
      newSums[bestCluster].b += b * weight;
    }

    // Update centroids
    centroids = newSums.map((sum, idx) => {
      const fallback = centroids[idx] || { r: 0, g: 0, b: 0 };
      return {
        r: newCounts[idx] > 0 ? Math.round(sum.r / newCounts[idx]) : fallback.r,
        g: newCounts[idx] > 0 ? Math.round(sum.g / newCounts[idx]) : fallback.g,
        b: newCounts[idx] > 0 ? Math.round(sum.b / newCounts[idx]) : fallback.b
      };
    });

    counts = newCounts;

    // Early termination if converged
    if (!changed) break;
  }

  return { centroids, labels, counts };
}



// Background color extraction
function extractBackgroundColors (pixelData, width, height, centroids, maxBackgrounds = 3, options = {}) {
  // Find largest connected regions (background candidates)
  const backgroundCandidates = findBackgroundRegions(pixelData, width, height, maxBackgrounds);

  // Match candidate regions to palette colors
  const backgroundColors = [];
  const baseThreshold = 20; // Base color matching threshold
  const threshold = baseThreshold * (options.backgroundVarianceScale || 1);

  console.log(`Using background color matching threshold: ${threshold} (scale: ${options.backgroundVarianceScale || 1})`);

  backgroundCandidates.forEach(candidate => {
    // Find closest palette color
    const match = centroids.findIndex(color =>
      colorDistance(color.r, color.g, color.b, candidate.r, candidate.g, candidate.b) < threshold
    );

    if (match >= 0) {
      backgroundColors.push(match);
    } else {
    }
  });

  return [...new Set(backgroundColors)]; // Remove duplicates
}

// Helper functions

function colorDistance (r1, g1, b1, r2, g2, b2) {
  // Simple Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

function initializeCentroids (pixels, k) {
  // Simple random initialization
  const centroids = [];
  const step = Math.floor(pixels.length / k);

  for (let i = 0; i < k; i++) {
    const idx = i * step;
    centroids.push({ ...pixels[idx] });
  }

  return centroids;
}

function findBackgroundRegions (pixelData, width, height, maxBackgrounds = 3) {
  // Simple implementation: find large uniform regions
  const candidates = [];
  const gridSize = 10; // Check every 10th pixel

  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width; x += gridSize) {
      const idx = (y * width + x) * 4;
      candidates.push({
        r: pixelData[idx],
        g: pixelData[idx + 1],
        b: pixelData[idx + 2]
      });
    }
  }

  // Group similar colors
  return clusterSimilarColors(candidates, 10, maxBackgrounds);
}

function clusterSimilarColors (colors, threshold, maxBackgrounds = 3) {
  // Simple color clustering
  const clusters = [];

  colors.forEach(color => {
    let found = false;

    for (const cluster of clusters) {
      const centroid = cluster[0];
      if (colorDistance(
        color.r, color.g, color.b,
        centroid.r, centroid.g, centroid.b
      ) < threshold) {
        cluster.push(color);
        found = true;
        break;
      }
    }

    if (!found) {
      clusters.push([color]);
    }
  });

  // Return largest clusters
  return clusters
    .sort((a, b) => b.length - a.length)
    .slice(0, maxBackgrounds)
    .map(cluster => cluster[0]);
}

function sampleArray (arr, size) {
  // Simple array sampling
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

function formatOutput (centroids, counts, backgroundIndices, totalPixels, hiddenIndices = []) {
  return centroids.map((color, idx) => ({
    rgb: { r: color.r, g: color.g, b: color.b },
    lab: rgbToLab(color.r, color.g, color.b),
    count: counts[idx],
    percentage: counts[idx] / totalPixels,
    isBackground: backgroundIndices.includes(idx),
    isHidden: hiddenIndices.includes(idx)
  }));
}

