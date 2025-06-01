// frontend/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  // 获取 HTML 元素
  const imageInput = document.getElementById('imageInput');
  const uploadedImage = document.getElementById('uploadedImage');
  const hiddenCanvas = document.getElementById('hiddenCanvas');
  const paletteCanvas = document.getElementById('paletteCanvas'); // 获取调色板 Canvas

  // TODO: Get input for max palette colors and color threshold
  // const maxColorsInput = document.getElementById('maxColors');
  // const colorThresholdInput = document.getElementById('colorThreshold'); // Need to add this input


  // 检查元素是否存在
  if (!imageInput || !uploadedImage || !hiddenCanvas || !paletteCanvas) {
    console.error("Error: Required HTML elements not found. Check index.html IDs.");
    return;
  }

  // 初始隐藏调色板 Canvas
  paletteCanvas.style.display = 'none';


  // 为文件输入框添加 'change' 事件监听器
  imageInput.addEventListener('change', function (event) {
    const files = event.target.files;

    if (files && files.length > 0) {
      const selectedFile = files[0];
      console.log(`File selected: ${selectedFile.name} (${selectedFile.type}, ${selectedFile.size} bytes)`);

      // 调用 imageHandler 函数加载和显示图片
      loadImageAndDisplay(selectedFile, uploadedImage)
        .then(loadedImgElement => {
          console.log("Image loading and display successful. Now getting pixel data...");

          // --- Step 2: Get Pixel Data ---
          const pixelData = getCanvasPixelData(loadedImgElement, hiddenCanvas);
          const totalPixels = loadedImgElement.naturalWidth * loadedImgElement.naturalHeight; // Total pixel count

          if (pixelData && totalPixels > 0) {
            console.log(`Successfully retrieved pixel data: ${pixelData.length} bytes for ${loadedImgElement.naturalWidth}x${loadedImgElement.naturalHeight} image.`);

            // --- Step 3: Extract, Analyze, and Render Palette ---
            console.log("Extracting and analyzing palette...");

            // TODO: Read max colors and threshold from UI inputs
            const maxColors = 12; // Hardcode for now, get from UI later
            const colorThreshold = 20; // Hardcode Delta E threshold for now, get from UI later (Delta E values often range from 0 to ~100+)

            const rawPalette = extractPaletteMedianCut(pixelData, maxColors);
            console.log(`Raw palette extracted (${rawPalette.length} colors).`);

            const analyzedPalette = analyzePalette(rawPalette, colorThreshold, totalPixels);
            console.log(`Palette analyzed and merged (${analyzedPalette.length} colors).`);

            // Sort again by luminance before rendering for consistent display order
            analyzedPalette.sort((a, b) => a.lab[0] - b.lab[0]);

            drawPalette(analyzedPalette, paletteCanvas, totalPixels);
            console.log("Palette rendered to canvas.");


            // --- Step 4/5/6 TODO: Proceed to other visualizations and features ---
            console.log("\nStep 3 complete: Palette extracted, analyzed, and rendered. Ready for color tendency analysis and visualization.");

          } else {
            console.error("Failed to get pixel data from canvas or image size is zero.");
            alert("无法处理图片像素数据。");
            // TODO: Cleanup previous results if any
            drawPalette([], paletteCanvas, 0); // Clear palette display
          }


        })
        .catch(error => {
          console.error("Error during image loading process:", error);
          alert("无法加载图片。请确保文件是有效的图片格式。");
          // TODO: Cleanup previous results if any
          drawPalette([], paletteCanvas, 0); // Clear palette display
        });

    } else {
      console.log("File selection cancelled.");
      uploadedImage.style.display = 'none';
      uploadedImage.src = '#';
      // Hide or clear other results
      drawPalette([], paletteCanvas, 0); // Clear palette display
      document.getElementById('palettePlaceholder').style.display = 'block';
    }

    // Optional: event.target.value = null;
  });

  console.log("main.js script finished execution. Waiting for user interaction.");
});