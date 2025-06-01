// frontend/js/imageHandler.js

/**
 * Reads a File object and displays it in an <img> element.
 * Uses FileReader to get a Data URL.
 * @param {File} file - The image file selected by the user (from input.files[0]).
 * @param {HTMLImageElement} imgElement - The <img> element where the image should be displayed.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the loaded imgElement when done, or rejects on error.
 */
function loadImageAndDisplay (file, imgElement) {
  return new Promise((resolve, reject) => {
    // Basic check to ensure a file object is provided
    if (!file || !(file instanceof File)) {
      console.error("Invalid file provided.");
      imgElement.style.display = 'none'; // Hide image if input is bad
      imgElement.src = '#'; // Reset src
      reject(new Error("Invalid file input."));
      return;
    }

    // Use FileReader to read the file content
    const reader = new FileReader();

    // Set up event handlers for the reader
    // onload is called when the file reading is successful
    reader.onload = function (e) {
      // e.target.result contains the data as a Data URL (base64 encoded)
      imgElement.src = e.target.result;

      // Wait for the image element to actually load the data URL
      // This ensures we have width/height information available later
      imgElement.onload = function () {
        console.log(`Image loaded successfully: ${imgElement.naturalWidth}x${imgElement.naturalHeight}`);
        imgElement.style.display = 'block'; // Make the image visible
        resolve(imgElement); // Resolve the promise with the loaded image element
      };

      // Handle potential errors during image element loading (e.g., invalid image format despite file extension)
      imgElement.onerror = function () {
        console.error("Error loading image data URL into img element.");
        imgElement.style.display = 'none';
        imgElement.src = '#';
        reject(new Error("Failed to load image data."));
      };
    };

    // onerror is called if file reading itself fails
    reader.onerror = function (e) {
      console.error("Error reading file with FileReader:", e);
      imgElement.style.display = 'none';
      imgElement.src = '#';
      reject(e); // Reject the promise with the FileReader error
    };

    // Read the file as a Data URL (base64 string representing the image)
    reader.readAsDataURL(file);

    // Ensure the image is hidden while the new file is being processed
    imgElement.style.display = 'none';
    imgElement.src = '#'; // Reset src immediately on new selection
  });
}