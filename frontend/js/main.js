// frontend/js/main.js

// Import functions/classes from other modules
import { loadImageAndDisplay, getCanvasPixelData } from './imageHandler.js';
import { extractPaletteMedianCut } from './medianCut.js';
import { analyzePalette } from './paletteAnalyzer.js';
import { drawPalette, exportPaletteAsImage } from './paletteRenderer.js'; // Import export function
import { calculateColorStats } from './colorStats.js';
import { drawHistogram, drawLabScatterPlotRevised } from './visualization2D.js';
import { setupSphereScene, disposeScene, exportSphereAsImage } from './sphereRenderer3D.js'; // Import setup, dispose, and export function
import { saveTextFile, saveDataUrlAsFile } from './fileSaver.js'; // Import file saver utilities
import { rgbToHex } from './colorUtils.js'; // <-- FIX: Import rgbToHex here


// --- State Variables ---
// Variables to store data/objects needed for export buttons and cleanup
let currentAnalyzedPalette = null; // Stores the processed palette data
let currentSphereRenderer = null; // Stores the Three.js renderer instance
let currentScene = null; // <-- Add variable for Three.js scene
let currentCamera = null; // <-- Add variable for Three.js camera
let currentImageFilename = 'image'; // Stores the base filename for exports
let currentImageSize = { width: 0, height: 0 }; // Stores the loaded image dimensions for percentage calculation


document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  // --- Get HTML Elements ---
  const imageInput = document.getElementById('imageInput');
  const uploadedImage = document.getElementById('uploadedImage');
  const hiddenCanvas = document.getElementById('hiddenCanvas');
  const paletteCanvas = document.getElementById('paletteCanvas');

  // Step 4: Get analysis elements
  const colorAnalysisSection = document.querySelector('.color-analysis-section'); // The main analysis div
  const hsvStatsParagraph = document.getElementById('hsvStats');
  const labStatsParagraph = document.getElementById('labStats');
  const histHCanvas = document.getElementById('histH');
  const histSCanvas = document.getElementById('histS');
  const histVCanvas = document.getElementById('histV');
  const histLCanvas = document.getElementById('histL');
  const histACanvas = document.getElementById('hista');
  const histBCanvas = document.getElementById('histb');
  const labScatterCanvas = document.getElementById('labScatter');

  // Step 5: Get sphere elements
  const colorSphereSection = document.querySelector('.color-sphere-section');
  const sphereContainer = document.getElementById('sphereContainer');
  const spherePlaceholder = document.getElementById('spherePlaceholder');

  // Step 6: Get Export Buttons
  const savePaletteImageBtn = document.getElementById('savePaletteImageBtn');
  const savePaletteDataBtn = document.getElementById('savePaletteDataBtn');
  const saveSphereImageBtn = document.getElementById('saveSphereImageBtn');

  // Get export button containers (to show/hide the buttons)
  const paletteExportButtonsDiv = document.querySelector('.palette-section .export-buttons');
  const sphereExportButtonsDiv = document.querySelector('.color-sphere-section .export-buttons');


  // --- Check Necessary Elements Exist ---
  if (!imageInput || !uploadedImage || !hiddenCanvas || !paletteCanvas ||
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
  paletteCanvas.style.display = 'none';
  colorAnalysisSection.style.display = 'none';
  colorSphereSection.style.display = 'none';
  spherePlaceholder.style.display = 'block'; // Show sphere placeholder initially
  paletteExportButtonsDiv.style.display = 'none'; // Hide buttons initially
  sphereExportButtonsDiv.style.display = 'none'; // Hide buttons initially


  // --- Step 6: Add Event Listeners for Export Buttons ---

  savePaletteImageBtn.addEventListener('click', () => {
    console.log("Save Palette Image button clicked.");
    // exportPaletteAsImage returns Data URL, then use fileSaver to download
    const dataUrl = exportPaletteAsImage(paletteCanvas);
    if (dataUrl) {
      saveDataUrlAsFile(dataUrl, `${currentImageFilename}_palette.png`);
    }
  });

  savePaletteDataBtn.addEventListener('click', () => {
    console.log("Save Palette Data button clicked.");
    // Save analyzed palette data as JSON
    if (currentAnalyzedPalette && currentImageSize.width > 0 && currentImageSize.height > 0) { // Check if data and image size are available
      // Format data nicely for JSON output (remove lab, add hex and percentage)
      const dataToSave = currentAnalyzedPalette.map(colorInfo => ({
        rgb: colorInfo.rgb,
        hex: rgbToHex([colorInfo.rgb.r, colorInfo.rgb.g, colorInfo.rgb.b]), // Add hex for convenience
        // Calculate percentage based on total pixels from stored image size
        pixelPercentage: ((colorInfo.count / (currentImageSize.width * currentImageSize.height)) * 100).toFixed(1) + '%',
        isBackground: colorInfo.isBackground,
        isFeature: colorInfo.isFeature
        // Lab data is not included in JSON export for simplicity, but could be added
      }));

      const jsonString = JSON.stringify(dataToSave, null, 2); // Use 2 spaces for indentation
      saveTextFile(`${currentImageFilename}_palette.json`, jsonString, 'application/json');
    } else {
      console.warn("No analyzed palette data available or image size is zero for export.");
      alert("调色板数据未生成，无法导出。");
    }
  });

  saveSphereImageBtn.addEventListener('click', () => {
    console.log("Save Sphere Image button clicked.");
    // exportSphereAsImage returns Data URL, then use fileSaver to download
    // Need the renderer, scene, and camera instances
    if (currentSphereRenderer && currentScene && currentCamera) { // Check if all required 3D objects exist
      // exportSphereAsImage will render one frame and return the Data URL
      const dataUrl = exportSphereAsImage(currentSphereRenderer, currentScene, currentCamera); // <-- Pass scene and camera
      if (dataUrl) {
        saveDataUrlAsFile(dataUrl, `${currentImageFilename}_sphere.png`);
      }
    } else {
      console.warn("Three.js renderer, scene, or camera not available for sphere export.");
      alert("3D 色球未生成，无法导出。");
    }
  });


  // --- Add 'change' event listener to the file input ---
  imageInput.addEventListener('change', function (event) {
    const files = event.target.files;

    // --- Cleanup previous results when a new file is selected ---
    console.log("New file selected. Starting cleanup...");
    uploadedImage.style.display = 'none';
    uploadedImage.src = '#'; // Reset image src

    // Clear and hide palette results
    drawPalette([], paletteCanvas, 0); // Use drawPalette with empty array to clear/hide canvas and buttons
    // placeholder is shown by drawPalette

    // Hide analysis section
    colorAnalysisSection.style.display = 'none';
    // Stat paragraphs are reset by calculateColorStats if it fails, no need to clear here

    // Hide sphere section
    colorSphereSection.style.display = 'none';
    spherePlaceholder.style.display = 'block'; // Show sphere placeholder
    sphereExportButtonsDiv.style.display = 'none'; // Ensure sphere buttons are hidden

    // Dispose previous 3D scene and clear all related references
    disposeScene();
    currentSphereRenderer = null; // Clear the reference AFTER disposing
    currentScene = null; // Clear scene reference
    currentCamera = null; // Clear camera reference
    console.log("Disposed previous scene and cleared references.");

    // Clear previous palette data reference and image info
    currentAnalyzedPalette = null;
    currentImageSize = { width: 0, height: 0 }; // Reset image size
    currentImageFilename = 'image'; // Reset filename


    if (files && files.length > 0) {
      const selectedFile = files[0];
      console.log(`File selected: ${selectedFile.name} (${selectedFile.type}, ${selectedFile.size} bytes)`);

      // Set the base filename for exports (remove extension)
      // Use 'image' as fallback if filename has no extension
      currentImageFilename = selectedFile.name.split('.').slice(0, -1).join('.') || 'image';

      // --- Load and display the image ---
      loadImageAndDisplay(selectedFile, uploadedImage)
        .then(loadedImgElement => {
          console.log("Image loading and display successful. Now getting pixel data...");

          // Store image size for percentage calculation in export
          currentImageSize = { width: loadedImgElement.naturalWidth, height: loadedImgElement.naturalHeight };

          // --- Step 2: Get Pixel Data ---
          const pixelData = getCanvasPixelData(loadedImgElement, hiddenCanvas);
          const width = loadedImgElement.naturalWidth;
          const height = loadedImgElement.naturalHeight;
          const totalPixels = width * height;

          if (pixelData && totalPixels > 0) {
            console.log(`Successfully retrieved pixel data: ${pixelData.length} bytes for ${width}x${height} image.`);

            // --- Step 3: Extract, Analyze, and Render Palette ---
            console.log("Extracting and analyzing palette...");
            // Hardcoded parameters for now (TODO: add UI inputs)
            const maxColors = 12;
            const colorThreshold = 20; // Delta E threshold for merging (e.g., 20 is a noticeable difference)

            const rawPalette = extractPaletteMedianCut(pixelData, maxColors);
            console.log(`Raw palette extracted (${rawPalette.length} colors).`);

            const analyzedPalette = analyzePalette(rawPalette, colorThreshold, totalPixels);
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

            const colorStats = calculateColorStats(pixelData, width, height);

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


              // Show the analysis section
              colorAnalysisSection.style.display = 'block';

              console.log("Color stats calculated and 2D visualizations rendered.");

              // --- Step 5: Setup and Render 3D Sphere ---
              console.log("Preparing to setup 3D color sphere...");

              // Show the container BEFORE calling setupSphereScene
              spherePlaceholder.style.display = 'none';
              colorSphereSection.style.display = 'block'; // This will ensure container has dimensions

              // *** FIX: Use requestAnimationFrame to wait for layout calculation before 3D setup ***
              requestAnimationFrame(() => {
                console.log("Attempting to setup 3D color sphere after next frame...");

                // Re-get container element just to be safe after display change, although not strictly needed
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
                  // Get button div again as section might have been hidden
                  const sphereExportButtonsDiv = document.querySelector('.color-sphere-section .export-buttons');
                  if (sphereExportButtonsDiv) sphereExportButtonsDiv.style.display = 'none'; // Ensure buttons are hidden
                }
                console.log("3D color sphere setup sequence complete."); // Log after requestAnimationFrame callback
              }); // End of requestAnimationFrame callback


            } else {
              console.error("Failed to calculate color stats.");
              // Hide analysis and sphere sections if stats fail
              colorAnalysisSection.style.display = 'none';
              colorSphereSection.style.display = 'none';
              spherePlaceholder.style.display = 'block';
              sphereExportButtonsDiv.style.display = 'none'; // Ensure buttons are hidden
            }

            console.log("\nProcessing complete for image.");


          } else {
            console.error("Failed to get pixel data from canvas or image size is zero.");
            alert("无法处理图片像素数据。");
            // Cleanup previous results
            drawPalette([], paletteCanvas, 0); // Clears palette and hides its buttons
            document.getElementById('palettePlaceholder').style.display = 'block';
            colorAnalysisSection.style.display = 'none';
            colorSphereSection.style.display = 'none';
            spherePlaceholder.style.display = 'block';
            sphereExportButtonsDiv.style.display = 'none'; // Ensure buttons are hidden
          }

        })
        .catch(error => {
          console.error("Error during image loading process:", error);
          alert("无法加载图片。请确保文件是有效的图片格式。");
          // Cleanup previous results
          drawPalette([], paletteCanvas, 0); // Clears palette and hides its buttons
          document.getElementById('palettePlaceholder').style.display = 'block';
          colorAnalysisSection.style.display = 'none';
          colorSphereSection.style.display = 'none';
          spherePlaceholder.style.display = 'block';
          sphereExportButtonsDiv.style.display = 'none'; // Ensure buttons are hidden
        });

    } else {
      // File selection cancelled cleanup
      console.log("File selection cancelled.");
      uploadedImage.style.display = 'none';
      uploadedImage.src = '#';
      // Hide or clear all results sections and buttons
      drawPalette([], paletteCanvas, 0); // Clears palette and hides its buttons
      document.getElementById('palettePlaceholder').style.display = 'block';
      colorAnalysisSection.style.display = 'none';
      colorSphereSection.style.display = 'none';
      spherePlaceholder.style.display = 'block';
      sphereExportButtonsDiv.style.display = 'none'; // Ensure buttons are hidden


      // Dispose scene and clear references on cancel
      disposeScene();
      currentSphereRenderer = null;
      currentScene = null;
      currentCamera = null;

      // Clear palette data and image info references
      currentAnalyzedPalette = null;
      currentImageSize = { width: 0, height: 0 };
      currentImageFilename = 'image';

    }
    // Optional: event.target.value = null; // Clear the input value if needed
  });

  console.log("main.js script finished execution. Waiting for user interaction.");
});