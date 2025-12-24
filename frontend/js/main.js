// frontend/js/main.js

// Import functions/classes from other modules
// loadImageAndDisplay still takes a File, but it uses FileReader internally which handles Blobs as well.
import { loadImageAndDisplay, getCanvasPixelData } from './imageHandler.js';
import { extractDominantColors } from './medianCut.js';
import { analyzePalette } from './paletteAnalyzer.js';
import { applySLIC } from './slic.js';
import { drawPalette, exportPaletteAsImage } from './paletteRenderer.js'; // Import export function
import { calculateColorStats } from './colorStats.js';
import { drawHistogram, drawLabScatterPlotRevised } from './visualization2D.js';
import { drawHuePolarChart, drawHsvSquareChart, drawColorDistanceHeatmap, drawLabDensityChart } from './visualizationAdvanced.js';
import { setupSphereScene, disposeScene, exportSphereAsImage } from './sphereRenderer3D.js'; // Import setup, dispose, and export function
import { saveTextFile, saveDataUrlAsFile } from './fileSaver.js'; // Import file saver utilities
import { rgbToHex } from './colorUtils.js'; // Make sure this is imported


// --- State Variables ---
// Variables to store data/objects needed for export buttons, cleanup, and re-processing
let currentAnalyzedPalette = null; // Stores the processed palette data
let currentSphereRenderer = null; // Stores the Three.js renderer instance
let currentScene = null; // Stores the Three.js scene instance
let currentCamera = null; // Stores the Three.js camera instance
let currentImageFilename = 'image'; // Stores the base filename for exports
let currentImageSize = { width: 0, height: 0 }; // Stores the loaded image dimensions for percentage calculation
let currentPixelData = null; // Store pixel data to allow re-generating palette/3D from controls


document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  // Dynamic version info from GitHub
  fetch('https://api.github.com/repos/AkutaZehy/color-compass/commits/main')
    .then(response => response.ok ? response.json() : Promise.reject('API error'))
    .then(data => {
      const footer = document.querySelector('footer');
      if (footer) {
        const versionSpan = document.createElement('span');
        versionSpan.className = 'git-version';
        versionSpan.textContent = `Git版本: ${data.sha.substring(0, 7)}`;
        footer.appendChild(versionSpan);
      }
    })
    .catch(e => console.log('版本信息获取失败:', e));

  // --- Palette Parameters with Default Values ---
  const paletteParams = {
    // 主参数
    paletteSize: 20, // 总色板颜色数量 (与界面默认值一致)
    // 主色参数
    dominantColors: 8, // 主色数量 (界面范围2-20)
    // 藏色参数
    maxHiddenColors: 2, // 藏色最大数量 (与界面默认值一致)
    minHiddenPercentage: 0.01, // 藏色最小占比阈值
    // SLIC参数
    superpixelCount: 200, // 超像素数量
    superpixelCompactness: 10, // 超像素紧密度
    // 背景色参数
    maxBackgrounds: 3, // 最大背景色数量 (与界面默认值一致)
    backgroundVarianceScale: 1, // 背景色方差扩展系数
    useSuperpixels: true, // 是否使用SLIC超像素预处理
    useDeltaE: false // 是否使用ΔE色差距离 (新增参数)
  };

  // --- Get HTML Elements ---
  const imageInput = document.getElementById('imageInput'); // File input
  const uploadArea = document.getElementById('uploadArea'); // Drag and drop area
  const uploadedImage = document.getElementById('uploadedImage'); // Image display
  const imageDisplay = document.getElementById('imageDisplay'); // Image display container
  const imagePlaceholder = document.getElementById('imagePlaceholder'); // Placeholder
  const removeImageBtn = document.getElementById('removeImageBtn'); // Remove button
  const hiddenCanvas = document.getElementById('hiddenCanvas'); // Hidden canvas for pixel data
  const paletteCanvas = document.getElementById('paletteCanvas'); // Palette canvas
  const reRenderPaletteBtn = document.getElementById('reRenderPaletteBtn'); // Re-render button
  const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn'); // Toggle advanced params
  const resetParamsBtn = document.getElementById('resetParamsBtn'); // Reset parameters button

  // Parameter controls
  const paletteSizeInput = document.getElementById('paletteSize');
  const dominantColorsInput = document.getElementById('dominantColors');
  const maxHiddenColorsInput = document.getElementById('maxHiddenColors');
  const minHiddenPercentageInput = document.getElementById('minHiddenPercentage');
  const superpixelCountInput = document.getElementById('superpixelCount');
  const superpixelCompactnessInput = document.getElementById('superpixelCompactness');
  const maxBackgroundsInput = document.getElementById('maxBackgrounds');
  const backgroundVarianceScaleInput = document.getElementById('backgroundVarianceScale');
  const useDeltaEInput = document.getElementById('useDeltaE');

  // Parameter value displays
  const paletteSizeValue = document.getElementById('paletteSizeValue');
  const dominantColorsValue = document.getElementById('dominantColorsValue');
  const maxHiddenColorsValue = document.getElementById('maxHiddenColorsValue');
  const minHiddenPercentageValue = document.getElementById('minHiddenPercentageValue');
  const superpixelCountValue = document.getElementById('superpixelCountValue');
  const superpixelCompactnessValue = document.getElementById('superpixelCompactnessValue');
  const maxBackgroundsValue = document.getElementById('maxBackgroundsValue');
  const backgroundVarianceScaleValue = document.getElementById('backgroundVarianceScaleValue');
  const useDeltaEValue = document.getElementById('useDeltaEValue');

  // Initialize parameter controls
  function initParamControls () {
    // Set initial values
    paletteSizeInput.value = paletteParams.paletteSize;
    dominantColorsInput.value = paletteParams.dominantColors;
    maxHiddenColorsInput.value = paletteParams.maxHiddenColors;
    minHiddenPercentageInput.value = paletteParams.minHiddenPercentage;
    superpixelCountInput.value = paletteParams.superpixelCount;
    superpixelCompactnessInput.value = paletteParams.superpixelCompactness;
    maxBackgroundsInput.value = paletteParams.maxBackgrounds;
    backgroundVarianceScaleInput.value = paletteParams.backgroundVarianceScale;
    useDeltaEInput.checked = paletteParams.useDeltaE;

    // Update displayed values
    paletteSizeValue.textContent = paletteParams.paletteSize;
    dominantColorsValue.textContent = paletteParams.dominantColors;
    maxHiddenColorsValue.textContent = paletteParams.maxHiddenColors;
    minHiddenPercentageValue.textContent = paletteParams.minHiddenPercentage.toFixed(3);
    superpixelCountValue.textContent = paletteParams.superpixelCount;
    superpixelCompactnessValue.textContent = paletteParams.superpixelCompactness.toFixed(1);
    maxBackgroundsValue.textContent = paletteParams.maxBackgrounds;
    backgroundVarianceScaleValue.textContent = paletteParams.backgroundVarianceScale.toFixed(1);
    useDeltaEValue.textContent = paletteParams.useDeltaE ? '开启' : '关闭';

    // Add event listeners
    paletteSizeInput.addEventListener('input', updateParamsFromControls);
    dominantColorsInput.addEventListener('input', updateParamsFromControls);
    maxHiddenColorsInput.addEventListener('input', updateParamsFromControls);
    minHiddenPercentageInput.addEventListener('input', updateParamsFromControls);
    superpixelCountInput.addEventListener('input', updateParamsFromControls);
    superpixelCompactnessInput.addEventListener('input', updateParamsFromControls);
    maxBackgroundsInput.addEventListener('input', updateParamsFromControls);
    backgroundVarianceScaleInput.addEventListener('input', updateParamsFromControls);
    useDeltaEInput.addEventListener('change', updateParamsFromControls);

    // Toggle advanced params
    toggleAdvancedBtn.addEventListener('click', () => {
      const advancedContent = document.querySelector('.advanced-content');
      const isHidden = advancedContent.style.display === 'none';
      advancedContent.style.display = isHidden ? 'block' : 'none';
      toggleAdvancedBtn.textContent = isHidden ? '隐藏高级参数' : '显示高级参数';
    });

    // Reset parameters
    resetParamsBtn.addEventListener('click', resetParamsToDefaults);

    // Remove image button
    removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering file input
      resetToInitialState();
    });

    // Click on uploaded image to reselect
    uploadedImage.addEventListener('click', () => {
      imageInput.click();
    });
  }

  // Update params from control values
  function updateParamsFromControls () {
    paletteParams.paletteSize = parseInt(paletteSizeInput.value);
    paletteParams.dominantColors = parseInt(dominantColorsInput.value);
    paletteParams.maxHiddenColors = parseInt(maxHiddenColorsInput.value);
    paletteParams.minHiddenPercentage = parseFloat(minHiddenPercentageInput.value);
    paletteParams.superpixelCount = parseInt(superpixelCountInput.value);
    paletteParams.superpixelCompactness = parseFloat(superpixelCompactnessInput.value);
    paletteParams.maxBackgrounds = parseInt(maxBackgroundsInput.value);
    paletteParams.backgroundVarianceScale = parseFloat(backgroundVarianceScaleInput.value);
    paletteParams.useDeltaE = useDeltaEInput.checked;

    // Update displayed values
    paletteSizeValue.textContent = paletteParams.paletteSize;
    dominantColorsValue.textContent = paletteParams.dominantColors;
    maxHiddenColorsValue.textContent = paletteParams.maxHiddenColors;
    minHiddenPercentageValue.textContent = paletteParams.minHiddenPercentage.toFixed(3);
    superpixelCountValue.textContent = paletteParams.superpixelCount;
    superpixelCompactnessValue.textContent = paletteParams.superpixelCompactness.toFixed(1);
    maxBackgroundsValue.textContent = paletteParams.maxBackgrounds;
    backgroundVarianceScaleValue.textContent = paletteParams.backgroundVarianceScale.toFixed(1);
    useDeltaEValue.textContent = paletteParams.useDeltaE ? '开启' : '关闭';
  }

  // Reset parameters to defaults
  function resetParamsToDefaults () {
    const defaultParams = {
      paletteSize: 20,
      dominantColors: 8,
      maxHiddenColors: 2,
      minHiddenPercentage: 0.01,
      superpixelCount: 200,
      superpixelCompactness: 10,
      maxBackgrounds: 3,
      backgroundVarianceScale: 1,
      useSuperpixels: true,
      useDeltaE: false
    };

    // Update paletteParams
    Object.assign(paletteParams, defaultParams);

    // Update UI controls
    paletteSizeInput.value = paletteParams.paletteSize;
    dominantColorsInput.value = paletteParams.dominantColors;
    maxHiddenColorsInput.value = paletteParams.maxHiddenColors;
    minHiddenPercentageInput.value = paletteParams.minHiddenPercentage;
    superpixelCountInput.value = paletteParams.superpixelCount;
    superpixelCompactnessInput.value = paletteParams.superpixelCompactness;
    maxBackgroundsInput.value = paletteParams.maxBackgrounds;
    backgroundVarianceScaleInput.value = paletteParams.backgroundVarianceScale;
    useDeltaEInput.checked = paletteParams.useDeltaE;

    // Update displayed values
    updateParamsFromControls();

    console.log('Parameters reset to defaults');
    alert('参数已重置为默认值');
  }

  // Initialize controls
  initParamControls();

  // Add re-render button event listener
  reRenderPaletteBtn.addEventListener('click', () => {
    if (currentPixelData && currentImageSize.width > 0 && currentImageSize.height > 0) {
      console.log("Re-rendering palette with current parameters...");

      console.log(paletteParams);

      const totalPixels = currentImageSize.width * currentImageSize.height;

      // 1. 使用SLIC超像素预处理
      const superpixelData = applySLIC(
        currentPixelData,
        currentImageSize.width,
        currentImageSize.height,
        paletteParams.superpixelCount,
        paletteParams.superpixelCompactness
      );

      // 2. 使用MMCQ提取主色
      const dominantColors = extractDominantColors(
        currentPixelData,
        paletteParams.dominantColors
      );

      // 3. 使用二阶段Kmeans分析调色板
      const analyzedPalette = analyzePalette(
        currentPixelData,
        dominantColors,
        paletteParams.paletteSize,
        paletteParams.maxHiddenColors,
        paletteParams.minHiddenPercentage,
        currentImageSize.width,
        currentImageSize.height,
        paletteParams.maxBackgrounds,
        paletteParams.useSuperpixels,
        paletteParams.backgroundVarianceScale,
        superpixelData
      );
      console.log(`Palette analyzed and merged (${analyzedPalette.length} colors).`);

      // Sort and render palette
      analyzedPalette.sort((a, b) => a.lab[0] - b.lab[0]);
      drawPalette(analyzedPalette, paletteCanvas, totalPixels);

      // Store the new palette
      currentAnalyzedPalette = analyzedPalette;

      console.log("Palette re-rendered with current parameters.");
    } else {
      console.warn("Cannot re-render palette: no pixel data available.");
    }
  });

  // Color analysis elements
  const colorAnalysisSection = document.querySelector('.color-analysis-section');
  const hsvStatsParagraph = document.getElementById('hsvStats');
  const labStatsParagraph = document.getElementById('labStats');
  const histHCanvas = document.getElementById('histH');
  const histSCanvas = document.getElementById('histS');
  const histVCanvas = document.getElementById('histV');
  const histLCanvas = document.getElementById('histL');
  const histACanvas = document.getElementById('hista');
  const histBCanvas = document.getElementById('histb');
  const labScatterCanvas = document.getElementById('labScatter');

  // 3D sphere elements
  const colorSphereSection = document.querySelector('.color-sphere-section');
  const sphereContainer = document.getElementById('sphereContainer');
  const spherePlaceholder = document.getElementById('spherePlaceholder');

  // Export Buttons
  const savePaletteImageBtn = document.getElementById('savePaletteImageBtn');
  const savePaletteDataBtn = document.getElementById('savePaletteDataBtn');
  const saveSphereImageBtn = document.getElementById('saveSphereImageBtn');

  // Export button containers
  const paletteExportButtonsDiv = document.querySelector('.palette-section .export-buttons');
  const sphereExportButtonsDiv = document.querySelector('.color-sphere-section .export-buttons');


  // --- Check Necessary Elements Exist ---
  if (!imageInput || !uploadArea || !uploadedImage || !hiddenCanvas || !paletteCanvas ||
    !colorAnalysisSection || !hsvStatsParagraph || !labStatsParagraph ||
    !histHCanvas || !histSCanvas || !histVCanvas ||
    !histLCanvas || !histACanvas || !histBCanvas || !labScatterCanvas ||
    !colorSphereSection || !sphereContainer || !spherePlaceholder ||
    !savePaletteImageBtn || !savePaletteDataBtn || !saveSphereImageBtn ||
    !paletteExportButtonsDiv || !sphereExportButtonsDiv) {
    console.error("Error: Required HTML elements not found. Check index.html IDs.");
    // Potentially display an error message to the user here
    return; // Stop script execution if critical elements are missing
  }

  // --- Initial State: Hide Sections and Buttons ---
  hideResults();


  // --- Unified Image Processing Function ---
  /**
   * Cleans up previous results and processes a new image file.
   * This function orchestrates the entire analysis workflow.
   * @param {File | Blob} file - The image file or blob to process.
   * @param {string} filename - The original filename (or a descriptive name).
   */
  function processImageFile (file, filename) {
    // Cleanup previous results and state
    hideResults();
    disposeScene(); // Dispose previous 3D scene resources
    resetStateVariables(); // Reset state variables

    // Basic file/blob validation
    if (!file || typeof file.size !== 'number' || typeof file.type !== 'string') {
      console.error("Invalid input: Provided object is not a valid File or Blob.", file);
      alert("无效的文件或图片数据。");
      return;
    }
    if (!file.type.startsWith('image/')) {
      console.error("Invalid input: Provided file is not an image type.", file.type);
      alert("请选择或粘贴图片文件。");
      return;
    }
    if (file.size === 0) {
      console.warn("Provided file is empty.");
      alert("文件内容为空。");
      return;
    }


    console.log(`Processing image: ${filename}`);
    // Set base filename, removing extension. Use 'image' as fallback.
    currentImageFilename = filename ? filename.split('.').slice(0, -1).join('.') || 'image' : 'pasted_image';


    // Show loading indicator or message? TODO

    // Load and display the image using imageHandler
    // loadImageAndDisplay takes a File/Blob, uses FileReader, and loads into an <img>
    loadImageAndDisplay(file, uploadedImage)
      .then(loadedImgElement => {
        console.log("Image loading and display successful. Now getting pixel data...");

        // Hide upload area, show image
        document.querySelector('.upload-area').classList.add('hidden');

        // Show image and hide placeholder
        uploadedImage.style.display = 'block';
        imagePlaceholder.style.display = 'none';
        imageDisplay.classList.add('has-image');

        document.querySelector('.dashboard-container').classList.add('visible');

        // Store image size
        currentImageSize = { width: loadedImgElement.naturalWidth, height: loadedImgElement.naturalHeight };

        // --- Step 2: Get Pixel Data ---
        const pixelData = getCanvasPixelData(loadedImgElement, hiddenCanvas);
        const width = currentImageSize.width;
        const height = currentImageSize.height;
        const totalPixels = width * height;

        if (pixelData && totalPixels > 0) {
          console.log(`Successfully retrieved pixel data: ${pixelData.length} bytes for ${width}x${height} image.`);

          // Store pixel data globally for potential re-processing (e.g., palette options)
          currentPixelData = pixelData;

          // --- Step 3: Extract, Analyze, and Render Palette ---
          console.log("Extracting and analyzing palette...");
          // 1. 使用SLIC超像素预处理
          const superpixelData = applySLIC(
            currentPixelData,
            currentImageSize.width,
            currentImageSize.height,
            paletteParams.superpixelCount,
            paletteParams.superpixelCompactness
          );

          // 2. 使用MMCQ提取主色
          const dominantColors = extractDominantColors(
            currentPixelData,
            paletteParams.dominantColors
          );

          // 3. 使用二阶段Kmeans分析调色板
          const analyzedPalette = analyzePalette(
            currentPixelData,
            dominantColors,
            paletteParams.paletteSize,
            paletteParams.maxHiddenColors,
            paletteParams.minHiddenPercentage,
            currentImageSize.width,
            currentImageSize.height,
            paletteParams.maxBackgrounds,
            paletteParams.useSuperpixels,
            paletteParams.backgroundVarianceScale,
            superpixelData,
            paletteParams.useDeltaE
          );
          console.log(`Palette analyzed and merged (${analyzedPalette.length} colors).`);

          // Store the analyzed palette data for export
          currentAnalyzedPalette = analyzedPalette;

          // Sort for display (e.g., by luminance)
          analyzedPalette.sort((a, b) => a.lab[0] - b.lab[0]);

          // Draw palette to canvas (This function also handles showing palette buttons)
          drawPalette(analyzedPalette, paletteCanvas, totalPixels);
          console.log("Palette rendered to canvas.");


          // --- Step 4: Calculate Stats and Draw 2D Visualizations ---
          console.log("Calculating color stats and drawing 2D visualizations...");

          // Calculate stats once with sampling for both basic and advanced visualizations
          // Use sampleFactor=10 for good balance between accuracy and performance
          const sampleFactor = 10;
          const colorStats = calculateColorStats(pixelData, width, height, sampleFactor);

          if (colorStats) {
            // Display stats summary
            hsvStatsParagraph.textContent =
              `平均 HSV: H=${colorStats.hsv.avg[0].toFixed(3)}, S=${colorStats.hsv.avg[1].toFixed(3)}, V=${colorStats.hsv.avg[2].toFixed(3)} ` +
              `| 标准差: H=${colorStats.hsv.stdDev[0].toFixed(3)}, S=${colorStats.hsv.stdDev[1].toFixed(3)}, V=${colorStats.hsv.stdDev[2].toFixed(3)}`;

            labStatsParagraph.textContent =
              `平均 Lab: L*=${colorStats.lab.avg[0].toFixed(3)}, a*=${colorStats.lab.avg[1].toFixed(3)}, b*=${colorStats.lab.avg[2].toFixed(3)} ` +
              `| 标准差: L*=${colorStats.lab.stdDev[0].toFixed(3)}, a*=${colorStats.lab.stdDev[1].toFixed(3)}, b*=${colorStats.lab.stdDev[2].toFixed(3)}`;

            // Draw Histograms
            const binCount = 60; // Number of bars in histogram
            drawHistogram(histHCanvas, colorStats.rawValues.h, "Hue", 0, 1, binCount);
            drawHistogram(histSCanvas, colorStats.rawValues.s, "Saturation", 0, 1, binCount);
            drawHistogram(histVCanvas, colorStats.rawValues.v, "Value", 0, 1, binCount);
            drawHistogram(histLCanvas, colorStats.rawValues.l, "L*", 0, 100, binCount);
            // Use a reasonable range for a* and b* histograms
            drawHistogram(histACanvas, colorStats.rawValues.a, "a*", -100, 100, binCount);
            drawHistogram(histBCanvas, colorStats.rawValues.b, "b*", -100, 100, binCount);

            // Draw Lab a*b* Scatter Plot
            // Sample factor 100 means process every 100th pixel
            drawLabScatterPlotRevised(labScatterCanvas, pixelData, width, height, 100);


            // Draw Advanced Visualizations using the same sampled data
            console.log("Drawing advanced visualizations...");

            // Get canvas elements
            const huePolarCanvas = document.getElementById('huePolar');
            const hsvSquareCanvas = document.getElementById('hsvSquare');
            const distanceHeatmapCanvas = document.getElementById('distanceHeatmap');
            const labDensityCanvas = document.getElementById('labDensity');

            // Draw Hue Polar Chart
            if (huePolarCanvas) {
              drawHuePolarChart(huePolarCanvas, colorStats.rawValues.h, '色相极坐标分布');
            }

            // HSV Square Chart 已移除（数据格式不匹配且实用性有限）

            // Draw Color Distance Heatmap
            if (distanceHeatmapCanvas && analyzedPalette) {
              drawColorDistanceHeatmap(distanceHeatmapCanvas, analyzedPalette, pixelData, width, height, '色彩距离热力图');
            }

            // Draw Lab Density Chart
            if (labDensityCanvas) {
              drawLabDensityChart(labDensityCanvas, colorStats.values, 'Lab密度分布');
            }


            // Show the analysis section
            colorAnalysisSection.style.display = 'block';

            // Show the advanced visualization section
            const advancedVizSection = document.getElementById('advancedVizSection');
            if (advancedVizSection) {
              advancedVizSection.style.display = 'block';
            }

            console.log("Color stats calculated and 2D visualizations rendered.");

            // --- Step 5: Setup and Render 3D Sphere ---
            console.log("Preparing to setup 3D color sphere...");

            // Show the container BEFORE setup so it has dimensions
            spherePlaceholder.style.display = 'none';
            colorSphereSection.style.display = 'block'; // This will ensure container has dimensions

            // Use requestAnimationFrame to wait for layout calculation before 3D setup
            requestAnimationFrame(() => {
              console.log("Attempting to setup 3D color sphere after next frame...");

              // Re-get container element inside raf - although not strictly needed
              const sphereContainer = document.getElementById('sphereContainer');
              // pixelData, width, height are still accessible via closure

              // Call the 3D setup function and store the returned object
              // Sample factor 200 means process every 200th pixel for 3D points
              const sphereSceneInfo = setupSphereScene(sphereContainer, pixelData, width, height, 200);

              if (sphereSceneInfo) { // Check if setup was successful (returned non-null)
                console.log("3D scene setup successful.");
                // Store the references returned by setupSphereScene
                currentSphereRenderer = sphereSceneInfo.renderer;
                currentScene = sphereSceneInfo.scene;
                currentCamera = sphereSceneInfo.camera;

                // 3D export buttons are shown inside setupSphereScene on success

              } else {
                console.error("Failed to setup 3D scene.");
                // Hide sphere section and buttons if setup failed
                colorSphereSection.style.display = 'none'; // Hide the section again
                spherePlaceholder.style.display = 'block'; // Show placeholder again
                const sphereExportButtonsDiv = document.querySelector('.color-sphere-section .export-buttons'); // Re-get button div
                if (sphereExportButtonsDiv) sphereExportButtonsDiv.style.display = 'none'; // Ensure buttons are hidden
              }
              console.log("3D color sphere setup sequence complete.");
            }); // End of requestAnimationFrame callback


          } else {
            console.error("Failed to calculate color stats.");
            // Hide analysis and sphere sections if stats fail
            colorAnalysisSection.style.display = 'none';
            colorSphereSection.style.display = 'none';
            spherePlaceholder.style.display = 'block';
            const sphereExportButtonsDiv = document.querySelector('.color-sphere-section .export-buttons');
            if (sphereExportButtonsDiv) sphereExportButtonsDiv.style.display = 'none';
          }

          console.log("\nProcessing complete for image.");


        } else {
          console.error("Failed to get pixel data from canvas or image size is zero.");
          alert("无法处理图片像素数据。");
          // Cleanup results
          hideResults();
          disposeScene();
          resetStateVariables();
        }

      })
      .catch(error => { // <-- Catch and log the actual error object
        console.error("Error during image loading process:", error);
        alert("无法加载图片。请确保文件是有效的图片格式。详细信息请查看控制台。");
        // Cleanup results
        hideResults();
        disposeScene();
        resetStateVariables();
      });
  }

  // --- Helper function to hide all result sections ---
  function hideResults () {
    uploadedImage.style.display = 'none';
    uploadedImage.src = '#'; // Reset image src
    document.querySelector('.dashboard-container').classList.remove('visible');

    // Hide palette results (drawPalette([], ...) handles canvas and buttons)
    drawPalette([], paletteCanvas, 0);
    const palettePlaceholder = document.getElementById('palettePlaceholder');
    if (palettePlaceholder) palettePlaceholder.style.display = 'block';


    // Hide analysis section
    colorAnalysisSection.style.display = 'none';

    // Hide advanced visualization section
    const advancedVizSection = document.getElementById('advancedVizSection');
    if (advancedVizSection) {
      advancedVizSection.style.display = 'none';
    }

    // Hide sphere section
    colorSphereSection.style.display = 'none';
    const spherePlaceholder = document.getElementById('spherePlaceholder');
    if (spherePlaceholder) spherePlaceholder.style.display = 'block';
    const sphereExportButtonsDiv = document.querySelector('.color-sphere-section .export-buttons');
    if (sphereExportButtonsDiv) sphereExportButtonsDiv.style.display = 'none'; // Ensure sphere buttons are hidden
  }

  // Reset to initial state (show upload area, hide all results)
  function resetToInitialState() {
    // Reset image display
    uploadedImage.style.display = 'none';
    uploadedImage.src = '#';
    imagePlaceholder.style.display = 'block';
    imageDisplay.classList.remove('has-image');

    // Show upload area
    document.querySelector('.upload-area').classList.remove('hidden');

    // Hide all results
    hideResults();

    // Reset state variables
    resetStateVariables();

    // Reset 3D scene
    disposeScene();
  }

  // --- Helper function to reset state variables ---
  function resetStateVariables () {
    currentAnalyzedPalette = null;
    currentSphereRenderer = null;
    currentScene = null;
    currentCamera = null;
    currentImageFilename = 'image';
    currentImageSize = { width: 0, height: 0 };
    currentPixelData = null; // Clear pixel data
  }


  // --- Add Input Event Listeners ---

  // 1. File Input Listener
  imageInput.addEventListener('change', function (event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      processImageFile(selectedFile, selectedFile.name);
    } else {
      console.log("File selection cancelled.");
      // Cleanup results and state
      hideResults();
      disposeScene();
      resetStateVariables();
    }
    // Optional: event.target.value = null; // Clear the input value if needed after processing or cancelling
  });


  // 2. Drag and Drop Listeners
  uploadArea.addEventListener('dragover', (event) => {
    event.preventDefault(); // Prevent default behavior (preventing file from being opened)
    // Check if the drag data contains files AND at least one is an image
    const isFile = event.dataTransfer.items && event.dataTransfer.items.length > 0 && event.dataTransfer.items[0].kind === 'file';
    const isImage = isFile && event.dataTransfer.items[0].type.startsWith('image/');

    if (isImage) {
      uploadArea.classList.add('dragover'); // Add visual feedback
      event.dataTransfer.dropEffect = 'copy'; // Show "copy" cursor
    } else {
      // Not a valid image file drag - indicate it's not droppable
      event.dataTransfer.dropEffect = 'none';
    }
  });

  uploadArea.addEventListener('dragleave', (event) => {
    event.preventDefault();
    uploadArea.classList.remove('dragover'); // Remove visual feedback
  });

  uploadArea.addEventListener('drop', (event) => {
    event.preventDefault(); // Prevent default behavior (preventing file from being opened)
    uploadArea.classList.remove('dragover'); // Remove visual feedback

    if (event.dataTransfer.items) {
      // Use DataTransferItemList interface for accessing the file(s)
      // Find the first image file item
      for (let i = 0; i < event.dataTransfer.items.length; i++) {
        const item = event.dataTransfer.items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile(); // Get the File object
          if (file) {
            console.log(`Dropped item is an image file: ${file.type}`);
            processImageFile(file, file.name); // Process the dropped file
            return; // Stop checking other items
          }
        }
      }
      // If loop finishes without finding an image file
      console.warn("Dropped data does not contain an image file.");
      alert("请拖拽一个图片文件。");

    } // Fallback for browsers that might not fully support DataTransferItemList
    else if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0]; // Get the first file
      if (file.type.startsWith('image/')) {
        console.log(`Dropped fallback file is an image: ${file.type}`);
        processImageFile(file, file.name);
      } else {
        console.warn("Dropped fallback file is not an image.");
        alert("请拖拽一个图片文件。");
      }
    } else {
      console.warn("No files found in drop data.");
      alert("请拖拽一个图片文件。");
    }
  });


  // 3. Paste Listener (on the whole document)
  document.addEventListener('paste', (event) => {
    console.log("Paste event fired.");
    // Check if clipboard data contains items
    if (event.clipboardData && event.clipboardData.items) {
      // Iterate through clipboard items
      for (let i = 0; i < event.clipboardData.items.length; i++) {
        const item = event.clipboardData.items[i];
        // Check if the item is a file (kind) and is an image (type)
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          event.preventDefault(); // Prevent default paste behavior (e.g., pasting as text)
          const file = item.getAsFile(); // Get the File object (or Blob)
          if (file) {
            console.log(`Pasted item is an image file: ${file.type} (${file.size} bytes)`);
            // Use a generic filename like "pasted_image.png"
            // getAsFile() might return null in some cases depending on browser/content
            // Ensure file is not null before processing
            if (file) {
              processImageFile(file, `pasted_image.${file.type.split('/')[1] || 'png'}`); // Process the pasted image
              return; // Stop checking other items
            }
          }
        }
      }
    }
    // If no image file found in clipboard, let default paste happen (e.g., pasting text)
    console.log("No image file found in paste data.");
  });


  // --- Export Button Event Listeners (Remain the same) ---
  // These access the global state variables (currentAnalyzedPalette, currentSphereRenderer etc.)

  savePaletteImageBtn.addEventListener('click', () => {
    console.log("Save Palette Image button clicked.");
    const dataUrl = exportPaletteAsImage(paletteCanvas);
    if (dataUrl) {
      saveDataUrlAsFile(dataUrl, `${currentImageFilename}_palette.png`);
    }
  });

  savePaletteDataBtn.addEventListener('click', () => {
    console.log("Save Palette Data button clicked.");
    // Check if data and image size are available
    if (currentAnalyzedPalette && currentImageSize.width > 0 && currentImageSize.height > 0) {
      const dataToSave = currentAnalyzedPalette.map(colorInfo => ({
        rgb: colorInfo.rgb,
        hex: rgbToHex([colorInfo.rgb.r, colorInfo.rgb.g, colorInfo.rgb.b]),
        pixelPercentage: ((colorInfo.count / (currentImageSize.width * currentImageSize.height)) * 100).toFixed(1) + '%',
        isBackground: colorInfo.isBackground,
        isFeature: colorInfo.isFeature
      }));
      const jsonString = JSON.stringify(dataToSave, null, 2);
      saveTextFile(`${currentImageFilename}_palette.json`, jsonString, 'application/json');
    } else {
      console.warn("No analyzed palette data available or image size is zero for export.");
      alert("调色板数据未生成，无法导出。");
    }
  });

  saveSphereImageBtn.addEventListener('click', () => {
    console.log("Save Sphere Image button clicked.");
    // Need the renderer, scene, and camera instances
    if (currentSphereRenderer && currentScene && currentCamera) {
      const dataUrl = exportSphereAsImage(currentSphereRenderer, currentScene, currentCamera);
      if (dataUrl) {
        saveDataUrlAsFile(dataUrl, `${currentImageFilename}_sphere.png`);
      }
    } else {
      console.warn("Three.js renderer, scene, or camera not available for sphere export.");
      alert("3D 色球未生成，无法导出。");
    }
  });


  console.log("main.js script finished execution. Waiting for user interaction.");
});