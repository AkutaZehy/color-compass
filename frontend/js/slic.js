

/**
 * SLIC (Simple Linear Iterative Clustering) superpixel algorithm implementation
 * 
 * @param {Uint8Array} pixelData - Image pixel data in RGBA format
 * @param {number} width - Image width
 * @param {number} height - Image height 
 * @param {number} superpixelCount - Desired number of superpixels
 * @param {number} compactness - Compactness factor (balance between color and spatial proximity)
 * @returns {Object} - Superpixel data containing labels and features
 */
function downsampleImage (pixelData, width, height, maxPixels = 1e5) {
    // Calculate downsampling ratio to keep total pixels <= maxPixels
    const ratio = Math.sqrt((width * height) / maxPixels);
    const newWidth = Math.max(1, Math.floor(width / ratio));
    const newHeight = Math.max(1, Math.floor(height / ratio));

    const downsampled = new Uint8Array(newWidth * newHeight * 4);

    // Max pooling downsampling
    const xRatio = width / newWidth;
    const yRatio = height / newHeight;

    for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
            const srcX = Math.floor(x * xRatio);
            const srcY = Math.floor(y * yRatio);
            const srcEndX = Math.min(width, Math.ceil((x + 1) * xRatio));
            const srcEndY = Math.min(height, Math.ceil((y + 1) * yRatio));

            // Find max RGB values in the pooling window
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
            downsampled[dstIdx + 3] = 255; // Alpha
        }
    }

    return {
        data: downsampled,
        width: newWidth,
        height: newHeight
    };
}

function upscaleLabels (labels, srcWidth, srcHeight, dstWidth, dstHeight) {
    const upscaled = new Int32Array(dstWidth * dstHeight);
    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;

    for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
            const srcX = Math.floor(x * xRatio);
            const srcY = Math.floor(y * yRatio);
            const srcIdx = srcY * srcWidth + srcX;
            const dstIdx = y * dstWidth + x;
            upscaled[dstIdx] = labels[srcIdx];
        }
    }

    return upscaled;
}

export function applySLIC (pixelData, width, height, superpixelCount, compactness) {
    // Downsample large images to improve performance
    let downsampled = { data: pixelData, width, height };
    if (width * height > 1e5) {
        downsampled = downsampleImage(pixelData, width, height);
    }

    // Initialize cluster centers (superpixel seeds)
    const clusterCenters = initializeClusterCenters(downsampled.data, downsampled.width, downsampled.height, superpixelCount);

    // Assign pixels to nearest cluster
    const labels = assignPixelsToClusters(downsampled.data, downsampled.width, downsampled.height, clusterCenters, compactness);

    // Enforce connectivity and remove small segments
    const cleanedLabels = enforceConnectivity(labels, downsampled.width, downsampled.height);

    // Upscale labels back to original size if downsampled
    let finalLabels = cleanedLabels;
    if (downsampled.width !== width || downsampled.height !== height) {
        finalLabels = upscaleLabels(cleanedLabels, downsampled.width, downsampled.height, width, height);
    }

    return {
        labels: finalLabels,
        features: extractSuperpixelFeatures(pixelData, finalLabels, clusterCenters.length)
    };
}

// Helper functions



function calculateGradient (rgbData, width, height, x, y) {
    // Calculate gradient in RGB color space (luminance approximation)
    // Using central differences in 3x3 neighborhood
    if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) {
        return Infinity; // Border pixels have high gradient
    }

    const idx = y * width + x;
    const idxLeft = y * width + (x - 1);
    const idxRight = y * width + (x + 1);
    const idxTop = (y - 1) * width + x;
    const idxBottom = (y + 1) * width + x;

    // Calculate luminance (approximate: 0.299*R + 0.587*G + 0.114*B)
    const getLuminance = (index) => {
        const r = rgbData[index * 4];
        const g = rgbData[index * 4 + 1];
        const b = rgbData[index * 4 + 2];
        return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    const dx = getLuminance(idxRight) - getLuminance(idxLeft);
    const dy = getLuminance(idxBottom) - getLuminance(idxTop);

    return dx * dx + dy * dy; // Gradient magnitude squared
}

function findLowestGradientNeighbor (rgbData, width, height, x, y) {
    let minGradient = Infinity;
    let bestX = x;
    let bestY = y;

    // Search in 3x3 neighborhood
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

    // Get RGB values at best position
    const idx = bestY * width + bestX;
    const rgbOffset = idx * 4;

    // Return RGB values instead of LAB
    return {
        x: bestX,
        y: bestY,
        r: rgbData[rgbOffset] || 0,
        g: rgbData[rgbOffset + 1] || 0,
        b: rgbData[rgbOffset + 2] || 0
    };
}

function initializeClusterCenters (rgbData, width, height, superpixelCount) {
    const clusterCenters = [];
    const step = Math.sqrt((width * height) / superpixelCount);

    for (let y = Math.floor(step / 2); y < height; y += step) {
        for (let x = Math.floor(step / 2); x < width; x += step) {
            // Adjust center to lowest gradient position in 3x3 neighborhood
            const adjustedCenter = findLowestGradientNeighbor(rgbData, width, height, x, y);
            clusterCenters.push({
                x: adjustedCenter.x,
                y: adjustedCenter.y,
                r: adjustedCenter.r,
                g: adjustedCenter.g,
                b: adjustedCenter.b
            });
        }
    }

    return clusterCenters;
}

function updateClusterCenters (rgbData, width, height, labels, clusterCount) {
    const centers = new Array(clusterCount);
    const counts = new Array(clusterCount).fill(0);

    // Initialize centers
    for (let i = 0; i < clusterCount; i++) {
        centers[i] = { x: 0, y: 0, r: 0, g: 0, b: 0 };
    }

    // Accumulate positions and colors
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const label = labels[idx];

            if (label >= 0 && label < clusterCount) {
                const rgbOffset = idx * 4;
                centers[label].x += x;
                centers[label].y += y;
                centers[label].r += rgbData[rgbOffset];
                centers[label].g += rgbData[rgbOffset + 1];
                centers[label].b += rgbData[rgbOffset + 2];
                counts[label]++;
            }
        }
    }

    // Normalize to get averages
    const updatedCenters = [];
    for (let i = 0; i < clusterCount; i++) {
        if (counts[i] > 0) {
            updatedCenters.push({
                x: centers[i].x / counts[i],
                y: centers[i].y / counts[i],
                r: centers[i].r / counts[i],
                g: centers[i].g / counts[i],
                b: centers[i].b / counts[i]
            });
        } else {
            // If cluster is empty, keep previous center
            updatedCenters.push(null);
        }
    }

    return updatedCenters;
}

function assignPixelsToClusters (downsampledData, width, height, clusterCenters, compactness) {
    const labels = new Int32Array(width * height).fill(-1);
    const distances = new Float32Array(width * height).fill(Infinity);
    const step = Math.sqrt((width * height) / clusterCenters.length);

    for (let iter = 0; iter < 10; iter++) {
        clusterCenters.forEach((center, clusterIdx) => {
            if (!center) return; // Skip empty clusters

            const searchRegion = Math.floor(2 * step);

            for (let y = Math.max(0, Math.floor(center.y) - searchRegion);
                y < Math.min(height, Math.floor(center.y) + searchRegion); y++) {
                for (let x = Math.max(0, Math.floor(center.x) - searchRegion);
                    x < Math.min(width, Math.floor(center.x) + searchRegion); x++) {
                    const pixelIdx = y * width + x;
                    const labOffset = pixelIdx * 3;

                    // 预计算常用值
                    const dx = x - center.x;
                    const dy = y - center.y;

                    // 优化距离计算 - 直接在RGB空间计算
                    const r = downsampledData[pixelIdx * 4];
                    const g = downsampledData[pixelIdx * 4 + 1];
                    const b = downsampledData[pixelIdx * 4 + 2];
                    const colorDist = Math.pow(r - center.r, 2) +
                        Math.pow(g - center.g, 2) +
                        Math.pow(b - center.b, 2);

                    const spatialDist = dx * dx + dy * dy; // 使用平方距离避免平方根

                    // 预计算归一化因子
                    // 使用完整的compactness范围(1-50)，避免硬编码限制
                    const normalizedFactor = compactness / (step * step);
                    const distance = colorDist + normalizedFactor * spatialDist;
                    if (distance < distances[pixelIdx]) {
                        distances[pixelIdx] = distance;
                        labels[pixelIdx] = clusterIdx;
                    }
                }
            }
        });

        // Update cluster centers
        const newCenters = updateClusterCenters(downsampledData, width, height, labels, clusterCenters.length);
        clusterCenters = newCenters.map((center, i) => center || clusterCenters[i]);
    }

    return labels;
}

function floodFill (labels, width, height, startX, startY, targetLabel) {
    const segment = [];
    const queue = [];
    const visited = new Uint8Array(width * height);

    // Check if starting position is valid
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
        return segment;
    }

    const startIdx = startY * width + startX;
    if (labels[startIdx] !== targetLabel || visited[startIdx]) {
        return segment;
    }

    queue.push({ x: startX, y: startY });
    visited[startIdx] = 1;

    // 4-way connectivity (up, down, left, right)
    const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: 0 }   // right
    ];

    while (queue.length > 0) {
        const { x, y } = queue.shift();
        const idx = y * width + x;
        segment.push(idx);

        // Check neighbors
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (!visited[nIdx] && labels[nIdx] === targetLabel) {
                    visited[nIdx] = 1;
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }

    return segment;
}

function enforceConnectivity (labels, width, height) {
    const cleanedLabels = new Int32Array(width * height);
    const visited = new Uint8Array(width * height);
    const minSegmentSize = (width * height) / (2 * new Set(labels).size); // Minimum 50% of average size

    let currentLabel = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            if (!visited[idx]) {
                const segment = floodFill(labels, width, height, x, y, labels[idx]);

                if (segment.length >= minSegmentSize) {
                    // Keep this segment
                    segment.forEach(pos => {
                        cleanedLabels[pos] = currentLabel;
                        visited[pos] = 1;
                    });
                    currentLabel++;
                } else {
                    // Mark small segments to be reassigned
                    segment.forEach(pos => {
                        visited[pos] = 1;
                    });
                }
            }
        }
    }

    // Reassign pixels from small segments to neighboring labels
    return cleanedLabels;
}

function extractSuperpixelFeatures (rgbData, labels, clusterCount) {
    // Extract average color and other features for each superpixel
    const features = new Array(clusterCount);

    for (let i = 0; i < clusterCount; i++) {
        features[i] = {
            avgRGB: [0, 0, 0],
            pixelCount: 0
        };
    }

    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (label >= 0) {
            features[label].avgRGB[0] += rgbData[i * 4];
            features[label].avgRGB[1] += rgbData[i * 4 + 1];
            features[label].avgRGB[2] += rgbData[i * 4 + 2];
            features[label].pixelCount++;
        }
    }

    // Normalize averages and filter out empty clusters
    const filteredFeatures = [];
    features.forEach(feat => {
        if (feat.pixelCount > 0) {
            feat.avgRGB[0] /= feat.pixelCount;
            feat.avgRGB[1] /= feat.pixelCount;
            feat.avgRGB[2] /= feat.pixelCount;
            filteredFeatures.push(feat);
        }
    });

    return filteredFeatures;
}