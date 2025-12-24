// frontend/js/imageHandler.js

/**
 * Reads a File object and displays it in an <img> element.
 * Uses FileReader to get a Data URL.
 * @param {File} file - The image file selected by the user.
 * @param {HTMLImageElement} imgElement - The <img> element to display the image.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the loaded imgElement, or rejects on error.
 */
export function loadImageAndDisplay (file, imgElement) {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof File)) {
      console.error("Invalid file provided.");
      imgElement.style.display = 'none';
      imgElement.src = '#';
      reject(new Error("Invalid file input."));
      return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      imgElement.src = e.target.result;

      imgElement.onload = function () {
        console.log(`Image loaded successfully: ${imgElement.naturalWidth}x${imgElement.naturalHeight}`);
        imgElement.style.display = 'block';
        resolve(imgElement); // Resolve with the loaded image element
      };

      imgElement.onerror = function () {
        console.error("Error loading image data URL into img element.");
        imgElement.style.display = 'none';
        imgElement.src = '#';
        reject(new Error("Failed to load image data."));
      };
    };

    reader.onerror = function (e) {
      console.error("Error reading file with FileReader:", e);
      imgElement.style.display = 'none';
      imgElement.src = '#';
      reject(e);
    };

    reader.readAsDataURL(file);

    imgElement.style.display = 'none';
    imgElement.src = '#';
  });
}


/**
* Draws a loaded image element onto a canvas and returns the pixel data.
* For large images (>2MP), automatically downsamples for better performance.
* @param {HTMLImageElement} imgElement - The loaded <img> element.
* @param {HTMLCanvasElement} canvasElement - The <canvas> element to draw onto.
* @param {number} maxPixels - Maximum number of pixels (default: 2000000 for 2MP)
* @returns {Uint8ClampedArray | null} The pixel data array (R, G, B, A for each pixel), or null if an error occurred.
*/
export function getCanvasPixelData (imgElement, canvasElement, maxPixels = 2000000) {
  // Check if the image is fully loaded and has dimensions
  if (!imgElement || !canvasElement || !imgElement.complete || imgElement.naturalWidth === 0) {
    console.error("Invalid image element or canvas provided, or image not fully loaded.");
    return null;
  }

  const ctx = canvasElement.getContext('2d');

  const originalWidth = imgElement.naturalWidth;
  const originalHeight = imgElement.naturalHeight;
  const totalPixels = originalWidth * originalHeight;

  // Downsample large images for better performance
  let drawWidth = originalWidth;
  let drawHeight = originalHeight;

  if (totalPixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / totalPixels);
    drawWidth = Math.floor(originalWidth * scale);
    drawHeight = Math.floor(originalHeight * scale);
    console.log(`Downsampling image from ${originalWidth}x${originalHeight} to ${drawWidth}x${drawHeight} for performance`);
  }

  // Set canvas dimensions (may be smaller than original for large images)
  canvasElement.width = drawWidth;
  canvasElement.height = drawHeight;

  // Clear the canvas (good practice)
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw the image onto the canvas (with downsampling if needed)
  ctx.drawImage(imgElement, 0, 0, drawWidth, drawHeight);

  try {
    // Get the pixel data
    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    return imageData.data; // This is the Uint8ClampedArray (R, G, B, A, R, G, B, A, ...)
  } catch (e) {
    console.error("Error getting image data from canvas:", e);
    console.warn("This might be due to CORS restrictions if the image was loaded from a different origin. However, for files selected by the user, this should not happen when served via a local web server.");
    return null;
  }
}