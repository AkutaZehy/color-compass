// frontend/js/fileSaver.js
import { showToast } from './toast.js';

/**
 * Saves text content as a file using Blob and URL.createObjectURL.
 * @param {string} filename - The desired name for the downloaded file.
 * @param {string} textContent - The text content to save.
 * @param {string} mimeType - The MIME type of the file (e.g., 'text/plain', 'application/json').
 */
export function saveTextFile (filename, textContent, mimeType = 'text/plain') {
  try {
    const blob = new Blob([textContent], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click(); // Programmatically click the link to trigger download

    // Clean up the blob URL after the browser has had time to start the
    // download; revoking too early can abort large downloads
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10000);

    console.log(`Saved text file: ${filename}`);

  } catch (e) {
    console.error("Error saving text file:", e);
    showToast(`Failed to save file ${filename}.`);
  }
}

/**
* Saves image data (as Data URL) as a file.
* @param {string} dataUrl - The image data as a Data URL (e.g., from canvas.toDataURL()).
* @param {string} filename - The desired name for the downloaded file.
*/
export function saveDataUrlAsFile (dataUrl, filename) {
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename; // Set the filename
    a.click(); // Programmatically click the link

    console.log(`Saved image file: ${filename}`);

  } catch (e) {
    console.error("Error saving image file:", e);
    showToast(`Failed to save image ${filename}.`);
  }
}