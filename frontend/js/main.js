// frontend/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  // 获取 HTML 元素
  const imageInput = document.getElementById('imageInput');
  const uploadedImage = document.getElementById('uploadedImage');
  const hiddenCanvas = document.getElementById('hiddenCanvas');
  const paletteCanvas = document.getElementById('paletteCanvas');
  // --- Step 4: Get new analysis elements ---
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


  // TODO: Get input for max palette colors, color threshold, etc.

  // 检查必要元素是否存在
  if (!imageInput || !uploadedImage || !hiddenCanvas || !paletteCanvas ||
    !colorAnalysisSection || !hsvStatsParagraph || !labStatsParagraph ||
    !histHCanvas || !histSCanvas || !histVCanvas ||
    !histLCanvas || !histACanvas || !histBCanvas || !labScatterCanvas) {
    console.error("Error: Required HTML elements not found. Check index.html IDs.");
    return;
  }

  // 初始隐藏调色板 Canvas 和分析区域
  paletteCanvas.style.display = 'none';
  colorAnalysisSection.style.display = 'none';


  // 为文件输入框添加 'change' 事件监听器
  imageInput.addEventListener('change', function (event) {
    const files = event.target.files;

    // Hide previous results when a new file is selected
    uploadedImage.style.display = 'none';
    uploadedImage.src = '#';
    drawPalette([], paletteCanvas, 0); // Clear palette display
    document.getElementById('palettePlaceholder').style.display = 'block';
    colorAnalysisSection.style.display = 'none'; // Hide analysis section


    if (files && files.length > 0) {
      const selectedFile = files[0];
      console.log(`File selected: ${selectedFile.name} (${selectedFile.type}, ${selectedFile.size} bytes)`);

      loadImageAndDisplay(selectedFile, uploadedImage)
        .then(loadedImgElement => {
          console.log("Image loading and display successful. Now getting pixel data...");

          // --- Step 2: Get Pixel Data ---
          const pixelData = getCanvasPixelData(loadedImgElement, hiddenCanvas);
          const width = loadedImgElement.naturalWidth;
          const height = loadedImgElement.naturalHeight;
          const totalPixels = width * height;

          if (pixelData && totalPixels > 0) {
            console.log(`Successfully retrieved pixel data: ${pixelData.length} bytes for ${width}x${height} image.`);

            // --- Step 3: Extract, Analyze, and Render Palette ---
            console.log("Extracting and analyzing palette...");
            const maxColors = 12; // Hardcode for now
            const colorThreshold = 20; // Hardcode Delta E threshold for now

            const rawPalette = extractPaletteMedianCut(pixelData, maxColors);
            console.log(`Raw palette extracted (${rawPalette.length} colors).`);

            const analyzedPalette = analyzePalette(rawPalette, colorThreshold, totalPixels);
            console.log(`Palette analyzed and merged (${analyzedPalette.length} colors).`);

            analyzedPalette.sort((a, b) => a.lab[0] - b.lab[0]); // Sort by luminance before rendering

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
              drawLabScatterPlotRevised(labScatterCanvas, pixelData, width, height, 100); // Sample every 100th pixel

              // Show the analysis section
              colorAnalysisSection.style.display = 'block';

              console.log("Color stats calculated and 2D visualizations rendered.");

            } else {
              console.error("Failed to calculate color stats.");
              // Hide analysis section if stats fail
              colorAnalysisSection.style.display = 'none';
            }


            console.log("\nStep 4 complete: Color tendency analyzed and visualized in 2D. Ready for 3D visualization and export.");

          } else {
            console.error("Failed to get pixel data from canvas or image size is zero.");
            alert("无法处理图片像素数据。");
            // Cleanup previous results if any
            drawPalette([], paletteCanvas, 0);
            document.getElementById('palettePlaceholder').style.display = 'block';
            colorAnalysisSection.style.display = 'none'; // Hide analysis section
          }


        })
        .catch(error => {
          console.error("Error during image loading process:", error);
          alert("无法加载图片。请确保文件是有效的图片格式。");
          // Cleanup previous results if any
          drawPalette([], paletteCanvas, 0);
          document.getElementById('palettePlaceholder').style.display = 'block';
          colorAnalysisSection.style.display = 'none'; // Hide analysis section
        });

    } else {
      console.log("File selection cancelled.");
      uploadedImage.style.display = 'none';
      uploadedImage.src = '#';
      // Hide or clear other results
      drawPalette([], paletteCanvas, 0);
      document.getElementById('palettePlaceholder').style.display = 'block';
      colorAnalysisSection.style.display = 'none'; // Hide analysis section
    }
  });

  console.log("main.js script finished execution. Waiting for user interaction.");
});