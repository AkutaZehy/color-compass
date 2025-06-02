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
export function analyzePalette (pixelData, dominantColors, paletteSize, maxHiddenColors, minHiddenPercentage, width, height, maxBackgrounds = 3) {
  // Single stage Kmeans with all required colors
  const totalColors = Math.min(paletteSize, dominantColors.length + maxHiddenColors);

  // Run clustering
  const result = kmeansClustering(pixelData, dominantColors, 10);

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
  for (let i = 0; i < Math.min(maxHiddenColors, dominantColors.length - maxBackgrounds); i++) {
    if (sortedClusters[i].percentage >= minHiddenPercentage || i === 0) {
      hiddenColorIndices.push(result.centroids.indexOf(sortedClusters[i].centroid));
    }
  }

  // Extract background colors
  const backgroundColors = extractBackgroundColors(
    pixelData,
    width,
    height,
    result.centroids,
    maxBackgrounds
  );

  // Format output with hidden color markers
  return formatOutput(
    result.centroids,
    result.counts,
    backgroundColors,
    width * height,
    hiddenColorIndices
  );
}

// Kmeans clustering implementation
function kmeansClustering (pixelData, initialCentroids, maxIterations) {
  let centroids = [...initialCentroids];
  let labels = new Array(pixelData.length / 4).fill(-1);
  let counts = new Array(centroids.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assignment step
    let changed = false;
    const newCounts = new Array(centroids.length).fill(0);
    const newSums = centroids.map(() => ({ r: 0, g: 0, b: 0 }));

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];

      // Find nearest centroid
      let minDist = Infinity;
      let bestCluster = -1;

      centroids.forEach((centroid, idx) => {
        const dist = colorDistance(r, g, b, centroid.r, centroid.g, centroid.b);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = idx;
        }
      });

      // Update label and cluster stats
      if (labels[i / 4] !== bestCluster) {
        changed = true;
        labels[i / 4] = bestCluster;
      }

      newCounts[bestCluster]++;
      newSums[bestCluster].r += r;
      newSums[bestCluster].g += g;
      newSums[bestCluster].b += b;
    }

    // Update centroids
    centroids = newSums.map((sum, idx) => ({
      r: newCounts[idx] > 0 ? Math.round(sum.r / newCounts[idx]) : centroids[idx].r,
      g: newCounts[idx] > 0 ? Math.round(sum.g / newCounts[idx]) : centroids[idx].g,
      b: newCounts[idx] > 0 ? Math.round(sum.b / newCounts[idx]) : centroids[idx].b
    }));

    counts = newCounts;

    // Early termination if converged
    if (!changed) break;
  }

  return { centroids, labels, counts };
}



// Background color extraction
function extractBackgroundColors (pixelData, width, height, centroids, maxBackgrounds = 3) {
  // Find largest connected regions (background candidates)
  const backgroundCandidates = findBackgroundRegions(pixelData, width, height, maxBackgrounds);

  // Match candidate regions to palette colors
  const backgroundColors = [];
  const threshold = 20; // Color matching threshold

  backgroundCandidates.forEach(candidate => {
    // Find closest palette color
    const match = centroids.findIndex(color =>
      colorDistance(color.r, color.g, color.b, candidate.r, candidate.g, candidate.b) < threshold
    );

    if (match >= 0) {
      backgroundColors.push(match);
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

// Placeholder for RGB to Lab conversion
function rgbToLab (r, g, b) {
  // Implementation would go here
  return [0, 0, 0]; // Dummy values
}
