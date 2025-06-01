// frontend/js/paletteAnalyzer.js
import { rgbToLab, labDistance, rgbToHsv, rgbToHex } from './colorUtils.js';

export class PaletteColor {
  constructor(rgbObj, count, isBackground = false, isFeature = false) {
    if (!rgbObj || typeof rgbObj.r !== 'number' || typeof rgbObj.g !== 'number' || typeof rgbObj.b !== 'number') {
      console.error("Invalid RGB object:", rgbObj);
      this.rgb = { r: 255, g: 0, b: 255 }; // 错误色
      this.count = 0;
    } else {
      this.rgb = { r: rgbObj.r, g: rgbObj.g, b: rgbObj.b };
      this.count = count;
    }
    this.lab = rgbToLab(this.rgb.r, this.rgb.g, this.rgb.b);
    this.isBackground = isBackground;
    this.isFeature = isFeature;
    this.hex = rgbToHex(this.rgb.r, this.rgb.g, this.rgb.b);
  }
}

export function analyzePalette (rawPalette, featureThreshold, totalPixels, mergeIntensity, backgroundThreshold, maxColors, minColors) {
  if (!rawPalette || rawPalette.length === 0) return [];

  // 1. 转换数据并加权处理（按像素数加权）
  const weightedColors = rawPalette.map(entry => ({
    lab: rgbToLab(entry.r, entry.g, entry.b),
    count: entry.count,
    rgb: { r: entry.r, g: entry.g, b: entry.b }
  }));

  const actualRadius = Math.pow(10, mergeIntensity) * 0.1

  // 2. 约束聚类半径的K-means
  const clusters = constrainedKmeans(weightedColors, {
    maxRadius: actualRadius,
    maxClusters: maxColors,
    minClusters: minColors,
    maxIterations: 20
  });

  // 3. 转换为PaletteColor
  const palette = clusters.map(cluster =>
    new PaletteColor(cluster.rgb, cluster.count)
  );

  // 4. 背景和特征检测
  detectBackground(palette, backgroundThreshold, totalPixels);
  identifyFeatures(palette, featureThreshold, totalPixels);

  return palette.sort((a, b) => a.lab[0] - b.lab[0]);
}

/**
 * 带半径约束的K-means聚类
 */
function constrainedKmeans (colors, { maxRadius, maxClusters, minClusters, maxIterations }) {
  // 初始化聚类中心（K-means++）
  let centroids = initializeCentroids(colors, maxClusters);
  let clusters = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配阶段：建立半径约束的聚类
    clusters = Array(centroids.length).fill().map(() => []);

    colors.forEach(color => {
      let closestIdx = -1;
      let minDist = Infinity;

      // 查找最近的且满足半径约束的聚类
      centroids.forEach((centroid, idx) => {
        const dist = labDistance(color.lab, centroid.lab);
        if (dist < maxRadius && dist < minDist) {
          minDist = dist;
          closestIdx = idx;
        }
      });

      // 如果没有满足约束的聚类，分配到最近的中心（即使超出半径）
      if (closestIdx === -1) {
        closestIdx = centroids.reduce((bestIdx, _, idx) => {
          const dist = labDistance(color.lab, centroids[idx].lab);
          return dist < minDist ? idx : bestIdx;
        }, 0);
      }

      clusters[closestIdx].push(color);
    });

    // 移除空聚类
    clusters = clusters.filter(c => c.length > 0);

    // 更新聚类中心
    const newCentroids = clusters.map(cluster => {
      const totalLab = [0, 0, 0];
      let totalCount = 0;

      cluster.forEach(color => {
        totalLab[0] += color.lab[0] * color.count;
        totalLab[1] += color.lab[1] * color.count;
        totalLab[2] += color.lab[2] * color.count;
        totalCount += color.count;
      });

      return {
        lab: [
          totalLab[0] / totalCount,
          totalLab[1] / totalCount,
          totalLab[2] / totalCount
        ],
        count: totalCount,
        rgb: getAverageRgb(cluster)
      };
    });

    // 检查收敛
    if (isConverged(centroids, newCentroids, 1.0)) break;
    centroids = newCentroids;
  }

  // 后处理：合并过近的聚类
  return mergeCloseClusters(centroids, maxRadius, minClusters);
}

// K-means++初始化
function initializeCentroids (colors, k) {
  const centroids = [colors[Math.floor(Math.random() * colors.length)]];

  while (centroids.length < k) {
    const distances = colors.map(color =>
      Math.min(...centroids.map(c => labDistance(color.lab, c.lab)))
    );
    const sum = distances.reduce((a, b) => a + b, 0);
    const threshold = Math.random() * sum;

    let accum = 0;
    for (let i = 0; i < colors.length; i++) {
      accum += distances[i];
      if (accum >= threshold) {
        centroids.push(colors[i]);
        break;
      }
    }
  }

  return centroids;
}

// 合并距离小于maxRadius的聚类
function mergeCloseClusters (clusters, maxRadius, minClusters) {
  const merged = [];
  const used = new Set();

  // 按聚类大小降序处理
  clusters.sort((a, b) => b.count - a.count);

  for (let i = 0; i < clusters.length; i++) {
    if (used.has(i)) continue;

    let current = clusters[i];
    for (let j = i + 1; j < clusters.length; j++) {
      if (used.has(j)) continue;

      const dist = labDistance(current.lab, clusters[j].lab);
      if (dist < maxRadius && merged.length + clusters.length - used.size > minClusters) {
        // 合并较小的聚类
        current = {
          lab: [
            (current.lab[0] * current.count + clusters[j].lab[0] * clusters[j].count) / (current.count + clusters[j].count),
            (current.lab[1] * current.count + clusters[j].lab[1] * clusters[j].count) / (current.count + clusters[j].count),
            (current.lab[2] * current.count + clusters[j].lab[2] * clusters[j].count) / (current.count + clusters[j].count)
          ],
          count: current.count + clusters[j].count,
          rgb: getAverageRgb([current, clusters[j]])
        };
        used.add(j);
      }
    }
    merged.push(current);
    used.add(i);
  }

  return merged;
}

// 计算聚类平均RGB（加权）
function getAverageRgb (colors) {
  const total = colors.reduce((sum, c) => sum + c.count, 0);
  return {
    r: Math.round(colors.reduce((sum, c) => sum + c.rgb.r * c.count, 0) / total),
    g: Math.round(colors.reduce((sum, c) => sum + c.rgb.g * c.count, 0) / total),
    b: Math.round(colors.reduce((sum, c) => sum + c.rgb.b * c.count, 0) / total)
  };
}

// 收敛检测
function isConverged (oldCentroids, newCentroids, threshold) {
  if (oldCentroids.length !== newCentroids.length) return false;
  return oldCentroids.every((c, i) => labDistance(c.lab, newCentroids[i].lab) < threshold);
}

// 背景检测（保持原逻辑）
function detectBackground (palette, threshold, totalPixels) {
  const region = findLargestSimilarRegion(palette, threshold);
  if (region && region.colors.length > 0) {
    const avgHsv = rgbToHsv(
      region.colors.reduce((sum, c) => sum + c.rgb.r, 0) / region.colors.length,
      region.colors.reduce((sum, c) => sum + c.rgb.g, 0) / region.colors.length,
      region.colors.reduce((sum, c) => sum + c.rgb.b, 0) / region.colors.length
    );
    // if (avgHsv[1] < 0.15) {
    region.colors.forEach(c => c.isBackground = true);
    // }
  }
}

// 特征标记（保持原逻辑）
function identifyFeatures (palette, threshold, totalPixels) {
  palette.forEach(color => {
    if (palette.length < 2) {
      color.isFeature = true;
      return;
    }
    const avgDist = palette.reduce((sum, c) =>
      c === color ? sum : sum + labDistance(color.lab, c.lab), 0) / (palette.length - 1);
    color.isFeature = avgDist > threshold;
  });
}

/**
 * 查找调色板中最大的相似颜色区域
 * @param {PaletteColor[]} colors - 调色板颜色数组
 * @param {number} similarityThreshold - 相似度阈值（Lab ΔE距离）
 * @returns {Object|null} 最大区域信息 { colors: PaletteColor[], totalCount: number }
 */
function findLargestSimilarRegion (colors, similarityThreshold) {
  if (!colors || colors.length === 0) return null;

  // 1. 构建相似颜色组
  const groups = [];
  const visited = new Set(); // 记录已处理颜色索引

  for (let i = 0; i < colors.length; i++) {
    if (visited.has(i)) continue;

    // 新建颜色组，以当前颜色为种子
    const currentGroup = [colors[i]];
    visited.add(i);

    // 寻找所有相似颜色（广度优先搜索）
    const queue = [i];
    while (queue.length > 0) {
      const baseIdx = queue.shift();
      const baseColor = colors[baseIdx];

      // 检查未访问的颜色
      for (let j = 0; j < colors.length; j++) {
        if (visited.has(j)) continue;

        // 计算Lab颜色距离
        const distance = labDistance(baseColor.lab, colors[j].lab);
        if (distance <= similarityThreshold) {
          currentGroup.push(colors[j]);
          visited.add(j);
          queue.push(j); // 加入队列继续扩展
        }
      }
    }

    groups.push(currentGroup);
  }

  // 2. 找出最大的组
  let largestGroup = null;
  let maxPixelCount = 0;

  groups.forEach(group => {
    const pixelCount = group.reduce((sum, color) => sum + color.count, 0);
    if (pixelCount > maxPixelCount) {
      maxPixelCount = pixelCount;
      largestGroup = group;
    }
  });

  // 3. 返回结果（如果没有满足阈值的组则返回null）
  return largestGroup ? {
    colors: largestGroup,
    totalCount: maxPixelCount
  } : null;
}
