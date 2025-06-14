/**
 * Modified Median Cut Quantization (MMCQ) algorithm for dominant color extraction
 * 
 * @param {Uint8Array} pixelData - Image pixel data in RGBA format
 * @param {number} colorCount - Number of dominant colors to extract
 * @returns {Array} - Array of dominant colors in RGB format
 */
export function extractDominantColors (pixelData, colorCount, useDownsampling = true) {
  // Convert pixel data to color cubes
  const cubes = [createInitialColorCube(pixelData, useDownsampling)];

  // Split cubes until we have the desired number of colors
  while (cubes.length < colorCount) {
    // Find the cube with the largest range
    const cubeToSplit = findCubeWithLargestRange(cubes);

    // Split the cube along the axis with the largest range
    const [cube1, cube2] = splitColorCube(cubeToSplit);

    // Replace the original cube with the two new cubes
    cubes.splice(cubes.indexOf(cubeToSplit), 1, cube1, cube2);
  }

  // Calculate average colors for each cube
  return cubes.map(cube => calculateAverageColor(cube));
}

// Helper functions

function downsamplePixelData (pixelData) {
  const downsampled = [];

  // Calculate total pixels (RGBA = 4 values per pixel)
  const totalPixels = pixelData.length / 4;

  // If already below threshold, return original
  if (totalPixels <= 1e4) return pixelData;

  // Calculate n for n*n pooling to reduce to ~1e5 pixels
  const n = Math.ceil(Math.sqrt(totalPixels / 1e4));
  const blockSize = n * n;
  const blockStride = n * 4; // n pixels in RGBA format

  // n*n average pooling
  for (let i = 0; i < pixelData.length; i += blockStride) {
    // Skip incomplete blocks
    if (i + (blockSize - 1) * 4 >= pixelData.length) continue;

    let sumR = 0, sumG = 0, sumB = 0;
    let count = 0;

    // Sum values in current block
    for (let j = 0; j < blockSize; j++) {
      const idx = i + j * 4;
      if (idx >= pixelData.length) break;

      sumR += pixelData[idx];
      sumG += pixelData[idx + 1];
      sumB += pixelData[idx + 2];
      count++;
    }

    // Calculate average and add to result
    downsampled.push(
      Math.round(sumR / count),
      Math.round(sumG / count),
      Math.round(sumB / count),
      255 // Alpha channel
    );
  }

  return new Uint8Array(downsampled);
}

function createInitialColorCube (pixelData, useDownsampling = true) {
  // Apply downsampling if enabled

  const processedData = useDownsampling ? downsamplePixelData(pixelData) : pixelData;

  const cube = {
    pixels: [],
    minR: 255, maxR: 0,
    minG: 255, maxG: 0,
    minB: 255, maxB: 0
  };

  // Process pixel data and find min/max values
  // for (let i = 0; i < pixelData.length; i += 4) {
  //   const r = pixelData[i];
  //   const g = pixelData[i + 1];
  //   const b = pixelData[i + 2];

  //   cube.pixels.push({ r, g, b });

  //   // Update min/max values
  //   if (r < cube.minR) cube.minR = r;
  //   if (r > cube.maxR) cube.maxR = r;
  //   if (g < cube.minG) cube.minG = g;
  //   if (g > cube.maxG) cube.maxG = g;
  //   if (b < cube.minB) cube.minB = b;
  //   if (b > cube.maxB) cube.maxB = b;
  // }
  for (let i = 0; i < processedData.length; i += 4) {
    const r = processedData[i];
    const g = processedData[i + 1];
    const b = processedData[i + 2];

    cube.pixels.push({ r, g, b });

    // Update min/max values
    if (r < cube.minR) cube.minR = r;
    if (r > cube.maxR) cube.maxR = r;
    if (g < cube.minG) cube.minG = g;
    if (g > cube.maxG) cube.maxG = g;
    if (b < cube.minB) cube.minB = b;
    if (b > cube.maxB) cube.maxB = b;
  }

  return cube;
}

function findCubeWithLargestRange (cubes) {
  let maxRange = -1;
  let selectedCube = null;

  cubes.forEach(cube => {
    const rangeR = cube.maxR - cube.minR;
    const rangeG = cube.maxG - cube.minG;
    const rangeB = cube.maxB - cube.minB;

    const maxCubeRange = Math.max(rangeR, rangeG, rangeB);

    if (maxCubeRange > maxRange) {
      maxRange = maxCubeRange;
      selectedCube = cube;
    }
  });

  return selectedCube;
}

function splitColorCube (cube) {
  // Determine which color channel has the largest range
  const rangeR = cube.maxR - cube.minR;
  const rangeG = cube.maxG - cube.minG;
  const rangeB = cube.maxB - cube.minB;

  const maxRange = Math.max(rangeR, rangeG, rangeB);
  let sortBy = 'r';

  if (maxRange === rangeG) {
    sortBy = 'g';
  } else if (maxRange === rangeB) {
    sortBy = 'b';
  }

  // Sort pixels by the selected channel
  cube.pixels.sort((a, b) => a[sortBy] - b[sortBy]);

  // Find median index
  const medianIndex = Math.floor(cube.pixels.length / 2);

  // Create two new cubes
  const cube1 = {
    pixels: cube.pixels.slice(0, medianIndex),
    minR: 255, maxR: 0,
    minG: 255, maxG: 0,
    minB: 255, maxB: 0
  };

  const cube2 = {
    pixels: cube.pixels.slice(medianIndex),
    minR: 255, maxR: 0,
    minG: 255, maxG: 0,
    minB: 255, maxB: 0
  };

  // Calculate new min/max for each cube
  updateCubeMinMax(cube1);
  updateCubeMinMax(cube2);

  return [cube1, cube2];
}

function updateCubeMinMax (cube) {
  cube.pixels.forEach(pixel => {
    if (pixel.r < cube.minR) cube.minR = pixel.r;
    if (pixel.r > cube.maxR) cube.maxR = pixel.r;
    if (pixel.g < cube.minG) cube.minG = pixel.g;
    if (pixel.g > cube.maxG) cube.maxG = pixel.g;
    if (pixel.b < cube.minB) cube.minB = pixel.b;
    if (pixel.b > cube.maxB) cube.maxB = pixel.b;
  });
}

function calculateAverageColor (cube) {
  let sumR = 0, sumG = 0, sumB = 0;
  const count = cube.pixels.length;

  cube.pixels.forEach(pixel => {
    sumR += pixel.r;
    sumG += pixel.g;
    sumB += pixel.b;
  });

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count)
  };
}