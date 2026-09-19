// toast.js - lightweight non-blocking notifications (replacement for alert())

let container = null;

/**
 * Shows a transient toast message at the bottom of the screen.
 * @param {string} message - The text to display.
 * @param {number} duration - How long the toast stays visible (ms).
 */
export function showToast (message, duration = 3000) {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  // Next frame so the transition from the hidden state can play
  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
