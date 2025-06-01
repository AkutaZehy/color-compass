// frontend/js/imageHandler.js

/**
 * Reads a File object and displays it in an <img> element.
 * Uses FileReader to get a Data URL.
 * @param {File} file - The image file selected by the user.
 * @param {HTMLImageElement} imgElement - The <img> element to display the image.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the loaded imgElement, or rejects on error.
 */
function loadImageAndDisplay (file, imgElement) {
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
* @param {HTMLImageElement} imgElement - The loaded <img> element.
* @param {HTMLCanvasElement} canvasElement - The <canvas> element to draw onto.
* @returns {Uint8ClampedArray | null} The pixel data array (R, G, B, A for each pixel), or null if an error occurred.
*/
function getCanvasPixelData (imgElement, canvasElement) {
  if (!imgElement || !canvasElement || !imgElement.complete || imgElement.naturalWidth === 0) {
    console.error("Invalid image element or canvas provided, or image not fully loaded.");
    return null;
  }

  const ctx = canvasElement.getContext('2d');

  // Set canvas dimensions to match the image
  canvasElement.width = imgElement.naturalWidth;
  canvasElement.height = imgElement.naturalHeight;

  // Clear the canvas (good practice)
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw the image onto the canvas
  // Important: Using drawImage allows access to pixel data via getImageData
  ctx.drawImage(imgElement, 0, 0, canvasElement.width, canvasElement.height);

  try {
    // Get the pixel data
    // getImageData returns ImageData object, .data property is Uint8ClampedArray
    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    return imageData.data; // This is the Uint8ClampedArray (R, G, B, A, R, G, B, A, ...)
  } catch (e) {
    console.error("Error getting image data from canvas:", e);
    console.warn("This might be due to CORS restrictions if the image was loaded from a different origin. However, for files selected by the user, this should not happen when served via a local web server.");
    return null;
  }
}