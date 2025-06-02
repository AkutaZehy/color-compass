import { rgbToLab } from './colorUtils.js';

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
export function applySLIC (pixelData, width, height, superpixelCount, compactness) {
    // Convert RGBA to Lab color space for better perceptual distance
    const labData = convertRGBtoLab(pixelData, width, height);

    // Initialize cluster centers (superpixel seeds)
    const clusterCenters = initializeClusterCenters(labData, width, height, superpixelCount);

    // Assign pixels to nearest cluster
    const labels = assignPixelsToClusters(labData, width, height, clusterCenters, compactness);

    // Enforce connectivity and remove small segments
    const cleanedLabels = enforceConnectivity(labels, width, height);

    console.log(`SLIC completed with ${new Set(cleanedLabels).size} superpixels.`);
    console.log(cleanedLabels, 'labels');

    return {
        labels: cleanedLabels,
        features: extractSuperpixelFeatures(labData, cleanedLabels, clusterCenters.length)
    };
}

// Helper functions

function convertRGBtoLab (rgbData, width, height) {
    const labData = new Float32Array(width * height * 3);

    for (let i = 0; i < rgbData.length; i += 4) {
        const [L, a, b] = rgbToLab(rgbData[i], rgbData[i + 1], rgbData[i + 2]);
        const pixelIdx = i / 4;
        labData[pixelIdx * 3] = L;
        labData[pixelIdx * 3 + 1] = a;
        labData[pixelIdx * 3 + 2] = b;
    }

    return labData;
}

function calculateGradient (labData, width, height, x, y) {
    // Calculate gradient in Lab color space
    // Using central differences in 3x3 neighborhood
    if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) {
        return Infinity; // Border pixels have high gradient
    }

    const idx = y * width + x;
    const idxLeft = y * width + (x - 1);
    const idxRight = y * width + (x + 1);
    const idxTop = (y - 1) * width + x;
    const idxBottom = (y + 1) * width + x;

    // Calculate gradient in L channel (luminance)
    const dx = labData[idxRight * 3] - labData[idxLeft * 3];
    const dy = labData[idxBottom * 3] - labData[idxTop * 3];

    return dx * dx + dy * dy; // Gradient magnitude squared
}

function findLowestGradientNeighbor (labData, width, height, x, y) {
    let minGradient = Infinity;
    let bestX = x;
    let bestY = y;

    // Search in 3x3 neighborhood
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const gradient = calculateGradient(labData, width, height, nx, ny);
                if (gradient < minGradient) {
                    minGradient = gradient;
                    bestX = nx;
                    bestY = ny;
                }
            }
        }
    }

    // Get Lab values at best position
    const idx = bestY * width + bestX;
    return {
        x: bestX,
        y: bestY,
        L: labData[idx * 3],
        a: labData[idx * 3 + 1],
        b: labData[idx * 3 + 2]
    };
}

function initializeClusterCenters (labData, width, height, superpixelCount) {
    const clusterCenters = [];
    const step = Math.sqrt((width * height) / superpixelCount);

    for (let y = Math.floor(step / 2); y < height; y += step) {
        for (let x = Math.floor(step / 2); x < width; x += step) {
            // Adjust center to lowest gradient position in 3x3 neighborhood
            const adjustedCenter = findLowestGradientNeighbor(labData, width, height, x, y);
            clusterCenters.push(adjustedCenter);
        }
    }

    return clusterCenters;
}

function updateClusterCenters (labData, width, height, labels, clusterCount) {
    const centers = new Array(clusterCount);
    const counts = new Array(clusterCount).fill(0);

    // Initialize centers
    for (let i = 0; i < clusterCount; i++) {
        centers[i] = { x: 0, y: 0, L: 0, a: 0, b: 0 };
    }

    // Accumulate positions and colors
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const label = labels[idx];

            if (label >= 0 && label < clusterCount) {
                const labOffset = idx * 3;
                centers[label].x += x;
                centers[label].y += y;
                centers[label].L += labData[labOffset];
                centers[label].a += labData[labOffset + 1];
                centers[label].b += labData[labOffset + 2];
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
                L: centers[i].L / counts[i],
                a: centers[i].a / counts[i],
                b: centers[i].b / counts[i]
            });
        } else {
            // If cluster is empty, keep previous center
            updatedCenters.push(null);
        }
    }

    return updatedCenters;
}

function assignPixelsToClusters (labData, width, height, clusterCenters, compactness) {
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

                    const colorDist = Math.sqrt(
                        Math.pow(labData[labOffset] - center.L, 2) +
                        Math.pow(labData[labOffset + 1] - center.a, 2) +
                        Math.pow(labData[labOffset + 2] - center.b, 2)
                    );

                    const spatialDist = Math.sqrt(
                        Math.pow(x - center.x, 2) +
                        Math.pow(y - center.y, 2)
                    );

                    const distance = colorDist + (compactness / step) * spatialDist;

                    if (distance < distances[pixelIdx]) {
                        distances[pixelIdx] = distance;
                        labels[pixelIdx] = clusterIdx;
                    }
                }
            }
        });

        // Update cluster centers
        const newCenters = updateClusterCenters(labData, width, height, labels, clusterCenters.length);
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

function extractSuperpixelFeatures (labData, labels, clusterCount) {
    // Extract average color and other features for each superpixel
    const features = new Array(clusterCount);

    for (let i = 0; i < clusterCount; i++) {
        features[i] = {
            avgLab: [0, 0, 0],
            pixelCount: 0
        };
    }

    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (label >= 0) {
            features[label].avgLab[0] += labData[i * 3];
            features[label].avgLab[1] += labData[i * 3 + 1];
            features[label].avgLab[2] += labData[i * 3 + 2];
            features[label].pixelCount++;
        }
    }

    // Normalize averages
    features.forEach(feat => {
        if (feat.pixelCount > 0) {
            feat.avgLab[0] /= feat.pixelCount;
            feat.avgLab[1] /= feat.pixelCount;
            feat.avgLab[2] /= feat.pixelCount;
        }
    });

    return features;
}

// Additional helper functions would be implemented here...
