// frontend/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  // 获取 HTML 元素
  const imageInput = document.getElementById('imageInput');
  const uploadedImage = document.getElementById('uploadedImage');
  const hiddenCanvas = document.getElementById('hiddenCanvas'); // 获取隐藏的 Canvas

  // 检查元素是否存在
  if (!imageInput || !uploadedImage || !hiddenCanvas) {
    console.error("Error: Required HTML elements not found. Check index.html IDs.");
    return;
  }

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

          // --- Step 2: Get Pixel Data and Perform Color Conversion ---
          const pixelData = getCanvasPixelData(loadedImgElement, hiddenCanvas);

          if (pixelData) {
            console.log(`Successfully retrieved pixel data: ${pixelData.length} bytes for ${loadedImgElement.naturalWidth}x${loadedImgElement.naturalHeight} image.`);

            // --- Perform Color Conversions (for demonstration) ---
            console.log("Performing color conversions for sample pixels:");

            // Let's sample a few pixels: top-left, middle, bottom-right
            const width = loadedImgElement.naturalWidth;
            const height = loadedImgElement.naturalHeight;

            // Pixel indices in the Uint8ClampedArray:
            // (y * width + x) * 4  gives the starting index for pixel at (x, y)
            const indicesToSample = [
              (0 * width + 0) * 4, // Top-left (0, 0)
              (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4, // Middle (width/2, height/2)
              ((height - 1) * width + (width - 1)) * 4 // Bottom-right (width-1, height-1)
            ];

            // Ensure indices are within bounds
            const validIndices = indicesToSample.filter(index => index >= 0 && index < pixelData.length - 3);

            validIndices.forEach(index => {
              const r = pixelData[index];
              const g = pixelData[index + 1];
              const b = pixelData[index + 2];
              // Alpha channel is pixelData[index + 3], often ignored for color analysis

              const hsv = rgbToHsv(r, g, b);
              const lab = rgbToLab(r, g, b);

              console.log(`Pixel at index ${index / 4} (approx):`);
              console.log(`  RGB: (${r}, ${g}, ${b})`);
              console.log(`  HSV: (${hsv[0].toFixed(3)}, ${hsv[1].toFixed(3)}, ${hsv[2].toFixed(3)})`); // .toFixed(3) for cleaner output
              console.log(`  Lab: (${lab[0].toFixed(3)}, ${lab[1].toFixed(3)}, ${lab[2].toFixed(3)})`);
            });


            // TODO: Proceed to Step 3 (Palette Extraction) and Step 4 (Stats/2D Viz)
            console.log("\nStep 2 complete: Pixel data obtained and color conversions verified. Ready for palette extraction and analysis.");

          } else {
            console.error("Failed to get pixel data from canvas.");
            alert("无法处理图片像素数据。"); // Give user feedback
          }


        })
        .catch(error => {
          console.error("Error during image loading process:", error);
          alert("无法加载图片。请确保文件是有效的图片格式。");
        });

    } else {
      console.log("File selection cancelled.");
      uploadedImage.style.display = 'none';
      uploadedImage.src = '#';
      // Hide or clear other results if any were previously displayed
      // TODO: Add cleanup for palette, viz etc.
    }

    // Optional: event.target.value = null;
  });

  console.log("main.js script finished execution. Waiting for user interaction.");
});