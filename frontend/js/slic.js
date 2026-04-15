/**
 * SLIC (Simple Linear Iterative Clustering) superpixel algorithm
 * 
 * Enhanced version with:
 * - Edge strength calculation for hidden color detection
 * - Local contrast estimation
 * - Spatial position preservation for background detection
 * 
 * @param {Uint8Array} pixelData - Image pixel data in RGBA format
 * @param {number} width - Image width
 * @param {number} height - Image height 
 * @param {number} superpixelCount - Desired number of superpixels
 * @param {number} compactness - Compactness factor (balance color vs spatial)
 * @returns {Object} - Superpixel data with enhanced features
 */
export function applySLIC(pixelData, width, height, superpixelCount, compactness) {
  // Downsample large images for performance
  let workingData = { data: pixelData, width, height };
  if (width * height > 1e5) {
    workingData = downsampleImage(pixelData, width, height);
  }

  // Initialize cluster centers
  const clusterCenters = initializeClusterCenters(
    workingData.data, 
    workingData.width, 
    workingData.height, 
    superpixelCount
  );

  // Assign pixels to clusters with iterative refinement
  const labels = assignPixelsToClusters(
    workingData.data, 
    workingData.width, 
    workingData.height, 
    clusterCenters, 
    compactness
  );

  // Enforce connectivity to avoid orphaned pixels
  const cleanedLabels = enforceConnectivity(
    labels, 
    workingData.width, 
    workingData.height
  );

  // Upscale labels back to original size if downsampled
  let finalLabels = cleanedLabels;
  let scaleRatio = 1;
  if (workingData.width !== width || workingData.height !== height) {
    finalLabels = upscaleLabels(cleanedLabels, workingData.width, workingData.height, width, height);
    scaleRatio = width / workingData.width;
  }

  // Extract enhanced features including edge strength and contrast
  const features = extractSuperpixelFeaturesEnhanced(
    pixelData,
    finalLabels,
    width,
    height,
    clusterCenters.length,
    scaleRatio
  );

  return {
    labels: finalLabels,
    features: features,
    superpixelCount: features.length
  };
}

/**
 * Downsample image using max pooling for better edge preservation
 */
function downsampleImage(pixelData, width, height, maxPixels = 1e5) {
  const ratio = Math.sqrt((width * height) / maxPixels);
  const newWidth = Math.max(1, Math.floor(width / ratio));
  const newHeight = Math.max(1, Math.floor(height / ratio));

  const downsampled = new Uint8Array(newWidth * newHeight * 4);
  const xRatio = width / newWidth;
  const yRatio = height / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcEndX = Math.min(width, Math.ceil((x + 1) * xRatio));
      const srcEndY = Math.min(height, Math.ceil((y + 1) * yRatio));

      // Max pooling for edge preservation
      let maxR = 0, maxG = 0, maxB = 0;
      for (let sy = srcY; sy < srcEndY; sy++) {
        for (let sx = srcX; sx < srcEndX; sx++) {
          const idx = (sy * width + sx) * 4;
          maxR = Math.max(maxR, pixelData[idx]);
          maxG = Math.max(maxG, pixelData[idx + 1]);
          maxB = Math.max(maxB, pixelData[idx + 2]);
        }
      }

      const dstIdx = (y * newWidth + x) * 4;
      downsampled[dstIdx] = maxR;
      downsampled[dstIdx + 1] = maxG;
      downsampled[dstIdx + 2] = maxB;
      downsampled[dstIdx + 3] = 255;
    }
  }

  return { data: downsampled, width: newWidth, height: newHeight };
}

/**
 * Upscale labels using nearest-neighbor interpolation
 */
function upscaleLabels(labels, srcWidth, srcHeight, dstWidth, dstHeight) {
  const upscaled = new Int32Array(dstWidth * dstHeight);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = srcY * srcWidth + srcX;
      upscaled[y * dstWidth + x] = labels[srcIdx];
    }
  }

  return upscaled;
}

/**
 * Initialize cluster centers with gradient adjustment
 */
function initializeClusterCenters(rgbData, width, height, superpixelCount) {
  const clusterCenters = [];
  const step = Math.sqrt((width * height) / superpixelCount);

  for (let y = Math.floor(step / 2); y < height; y += step) {
    for (let x = Math.floor(step / 2); x < width; x += step) {
      // Move center to lowest gradient position in 3x3 neighborhood
      const adjusted = findLowestGradientNeighbor(rgbData, width, height, x, y);
      clusterCenters.push({
        x: adjusted.x,
        y: adjusted.y,
        r: adjusted.r,
        g: adjusted.g,
        b: adjusted.b
      });
    }
  }

  return clusterCenters;
}

/**
 * Find position with lowest gradient in 3x3 neighborhood
 */
function findLowestGradientNeighbor(rgbData, width, height, x, y) {
  let minGradient = Infinity;
  let bestX = x, bestY = y;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const gradient = calculateGradient(rgbData, width, height, nx, ny);
        if (gradient < minGradient) {
          minGradient = gradient;
          bestX = nx;
          bestY = ny;
        }
      }
    }
  }

  const idx = bestY * width + bestX;
  return {
    x: bestX,
    y: bestY,
    r: rgbData[idx * 4],
    g: rgbData[idx * 4 + 1],
    b: rgbData[idx * 4 + 2]
  };
}

/**
 * Calculate gradient magnitude using Sobel-like operator
 */
function calculateGradient(rgbData, width, height, x, y) {
  if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) {
    return Infinity;
  }

  // Get luminance values
  const getLuminance = (px, py) => {
    const idx = (py * width + px) * 4;
    return 0.299 * rgbData[idx] + 0.587 * rgbData[idx + 1] + 0.114 * rgbData[idx + 2];
  };

  const dx = getLuminance(x + 1, y) - getLuminance(x - 1, y);
  const dy = getLuminance(x, y + 1) - getLuminance(x, y - 1);

  return dx * dx + dy * dy;
}

/**
 * Assign pixels to nearest cluster centers
 */
function assignPixelsToClusters(rgbData, width, height, clusterCenters, compactness) {
  const labels = new Int32Array(width * height).fill(-1);
  const distances = new Float32Array(width * height).fill(Infinity);
  const step = Math.sqrt((width * height) / clusterCenters.length);

  let previousLabels = null;
  
  for (let iter = 0; iter < 10; iter++) {
    clusterCenters.forEach((center, clusterIdx) => {
      if (!center) return;

      const searchRegion = Math.floor(2 * step);

      for (let y = Math.max(0, Math.floor(center.y) - searchRegion);
           y < Math.min(height, Math.floor(center.y) + searchRegion); y++) {
        for (let x = Math.max(0, Math.floor(center.x) - searchRegion);
             x < Math.min(width, Math.floor(center.x) + searchRegion); x++) {
          const pixelIdx = y * width + x;

          // Color distance in RGB space
          const r = rgbData[pixelIdx * 4];
          const g = rgbData[pixelIdx * 4 + 1];
          const b = rgbData[pixelIdx * 4 + 2];
          
          const colorDist = Math.pow(r - center.r, 2) +
                           Math.pow(g - center.g, 2) +
                           Math.pow(b - center.b, 2);

          // Spatial distance (normalized)
          const dx = x - center.x;
          const dy = y - center.y;
          const spatialDist = dx * dx + dy * dy;

          // Combined distance with compactness factor
          const distance = colorDist + (compactness / (step * step)) * spatialDist;

          if (distance < distances[pixelIdx]) {
            distances[pixelIdx] = distance;
            labels[pixelIdx] = clusterIdx;
          }
        }
      }
    });

    // Check convergence
    if (previousLabels) {
      let changed = false;
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] !== previousLabels[i]) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        console.log(`SLIC converged after ${iter + 1} iterations`);
        break;
      }
    }
    previousLabels = labels.slice();

    // Update cluster centers
    const newCenters = updateClusterCenters(rgbData, width, height, labels, clusterCenters.length);
    for (let i = 0; i < newCenters.length; i++) {
      if (newCenters[i]) {
        clusterCenters[i] = newCenters[i];
      }
    }
  }

  return labels;
}

/**
 * Update cluster centers based on assigned pixels
 */
function updateClusterCenters(rgbData, width, height, labels, clusterCount) {
  const centers = new Array(clusterCount).fill(null);
  const counts = new Array(clusterCount).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const label = labels[idx];
      if (label >= 0 && label < clusterCount) {
        if (!centers[label]) {
          centers[label] = { x: 0, y: 0, r: 0, g: 0, b: 0 };
        }
        centers[label].x += x;
        centers[label].y += y;
        centers[label].r += rgbData[idx * 4];
        centers[label].g += rgbData[idx * 4 + 1];
        centers[label].b += rgbData[idx * 4 + 2];
        counts[label]++;
      }
    }
  }

  return centers.map((center, i) => {
    if (counts[i] > 0) {
      return {
        x: center.x / counts[i],
        y: center.y / counts[i],
        r: center.r / counts[i],
        g: center.g / counts[i],
        b: center.b / counts[i]
      };
    }
    return null;
  });
}

/**
 * Enforce connectivity to avoid small orphaned segments
 */
function enforceConnectivity(labels, width, height) {
  const cleanedLabels = new Int32Array(width * height).fill(-1);
  const visited = new Uint8Array(width * height);
  const labelMap = new Map();
  let currentLabel = 0;

  // Calculate minimum segment size (0.5% of average)
  const avgSegmentSize = (width * height) / (new Set(labels).size);
  const minSegmentSize = Math.max(10, Math.floor(avgSegmentSize * 0.005));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      // Flood fill to find connected component
      const component = [];
      const queue = [{ x, y }];
      visited[idx] = 1;

      while (queue.length > 0) {
        const { x: cx, y: cy } = queue.shift();
        component.push(cy * width + cx);

        // 4-way connectivity
        const neighbors = [
          { x: cx - 1, y: cy },
          { x: cx + 1, y: cy },
          { x: cx, y: cy - 1 },
          { x: cx, y: cy + 1 }
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
            const nIdx = n.y * width + n.x;
            if (!visited[nIdx] && labels[nIdx] === labels[idx]) {
              visited[nIdx] = 1;
              queue.push(n);
            }
          }
        }
      }

      // Assign label based on component size
      if (component.length >= minSegmentSize) {
        const label = labels[component[0]];
        if (!labelMap.has(label)) {
          labelMap.set(label, currentLabel++);
        }
        const newLabel = labelMap.get(label);
        for (const pos of component) {
          cleanedLabels[pos] = newLabel;
        }
      }
    }
  }

  return cleanedLabels;
}

/**
 * Extract enhanced superpixel features including edge strength and contrast
 */
function extractSuperpixelFeaturesEnhanced(rgbData, labels, width, height, clusterCount, scaleRatio = 1) {
  // Aggregate features per superpixel
  const tempFeatures = new Array(clusterCount);
  for (let i = 0; i < clusterCount; i++) {
    tempFeatures[i] = {
      pixelCount: 0,
      sumR: 0, sumG: 0, sumB: 0,
      sumX: 0, sumY: 0,
      edgeCount: 0,
      neighborColors: [] // For contrast calculation
    };
  }

  // First pass: aggregate color and position
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const label = labels[idx];
      
      if (label >= 0 && label < clusterCount) {
        const feature = tempFeatures[label];
        feature.pixelCount++;
        feature.sumR += rgbData[idx * 4];
        feature.sumG += rgbData[idx * 4 + 1];
        feature.sumB += rgbData[idx * 4 + 2];
        feature.sumX += x;
        feature.sumY += y;

        // Check if this pixel is at an edge (different from neighbors)
        const neighbors = [
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y - 1 },
          { x, y: y + 1 }
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
            const nIdx = n.y * width + n.x;
            if (labels[nIdx] !== label) {
              feature.edgeCount++;
              // Collect neighbor colors for contrast
              if (feature.neighborColors.length < 10) {
                feature.neighborColors.push({
                  r: rgbData[nIdx * 4],
                  g: rgbData[nIdx * 4 + 1],
                  b: rgbData[nIdx * 4 + 2]
                });
              }
            }
          }
        }
      }
    }
  }

  // Calculate edge strength and contrast
  const features = [];
  for (let i = 0; i < clusterCount; i++) {
    const f = tempFeatures[i];
    if (f.pixelCount === 0) continue;

    // Average RGB
    const avgRGB = [
      Math.round(f.sumR / f.pixelCount),
      Math.round(f.sumG / f.pixelCount),
      Math.round(f.sumB / f.pixelCount)
    ];

    // Average position (scale back to original coordinates)
    const avgX = (f.sumX / f.pixelCount) * scaleRatio;
    const avgY = (f.sumY / f.pixelCount) * scaleRatio;

    // Edge strength: ratio of edge pixels to total pixels
    const edgeStrength = f.edgeCount / (f.pixelCount * 4); // Normalized by max possible edges

    // Local contrast: difference between superpixel color and neighbor colors
    let contrast = 0;
    if (f.neighborColors.length > 0) {
      let totalDiff = 0;
      for (const nc of f.neighborColors) {
        totalDiff += colorDistanceRGB(avgRGB[0], avgRGB[1], avgRGB[2], nc.r, nc.g, nc.b);
      }
      contrast = totalDiff / f.neighborColors.length / 255; // Normalize to 0-1
    }

    // Is this a boundary superpixel? (high edge ratio)
    const isBoundary = edgeStrength > 0.1;

    features.push({
      avgRGB,
      pixelCount: f.pixelCount,
      x: avgX,
      y: avgY,
      edgeStrength,
      contrast,
      isBoundary
    });
  }

  return features;
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
