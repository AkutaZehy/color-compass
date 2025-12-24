// i18n.js - Internationalization module for Color Compass

let currentLocale = 'en-US';
let translations = {};

/**
 * Load translation file for specified locale
 * @param {string} locale - Locale code (e.g., 'en-US', 'zh-CN')
 * @returns {Promise<void>}
 */
export async function loadLocale(locale) {
  try {
    const response = await fetch(`i18n/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${locale} translation file`);
    }
    translations = await response.json();
    currentLocale = locale;

    // Save preference
    localStorage.setItem('color-compass-locale', locale);

    // Update all translated elements
    document.dispatchEvent(new CustomEvent('i18n:loaded', { detail: { locale } }));

    return translations;
  } catch (error) {
    console.error(`Error loading locale ${locale}:`, error);
    // Fallback to English
    if (locale !== 'en-US') {
      return loadLocale('en-US');
    }
    throw error;
  }
}

/**
 * Get translated text by key
 * @param {string} key - Dot-separated key path (e.g., 'app.title')
 * @param {object} params - Optional parameters for interpolation
 * @returns {string} Translated text
 */
export function t(key, params = {}) {
  const keys = key.split('.');
  let value = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }

  // Interpolate parameters
  for (const [param, paramValue] of Object.entries(params)) {
    value = value.replace(new RegExp(`\\{${param}\\}`, 'g'), paramValue);
  }

  return value;
}

/**
 * Get current locale
 * @returns {string} Current locale code
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Initialize i18n module
 * @returns {Promise<string>} Loaded locale
 */
export async function initI18n() {
  // Check localStorage first
  const savedLocale = localStorage.getItem('color-compass-locale');

  // Detect browser language as fallback
  const browserLang = navigator.language || navigator.userLanguage;
  let defaultLocale = 'en-US';

  if (savedLocale) {
    defaultLocale = savedLocale;
  } else if (browserLang.startsWith('zh')) {
    defaultLocale = 'zh-CN';
  }

  await loadLocale(defaultLocale);
  return currentLocale;
}

/**
 * Update all elements with data-i18n attribute
 */
export function updateAllElements() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });

  // Update elements with data-i18n-key attribute (for tooltips, placeholders, etc.)
  document.querySelectorAll('[data-i18n-key]').forEach(element => {
    const key = element.getAttribute('data-i18n-key');
    const attribute = element.getAttribute('data-i18n-attr') || 'textContent';

    if (attribute === 'textContent') {
      element.textContent = t(key);
    } else if (attribute === 'placeholder') {
      element.placeholder = t(key);
    } else if (attribute === 'title') {
      element.title = t(key);
    } else if (attribute.startsWith('data-')) {
      // Handle data attributes
      element.setAttribute(attribute, t(key));
    }
  });

  // Update elements with data-i18n-html for HTML content
  document.querySelectorAll('[data-i18n-html]').forEach(element => {
    const key = element.getAttribute('data-i18n-html');
    element.innerHTML = t(key);
  });
}

// Listen for i18n loaded event to update all elements
document.addEventListener('i18n:loaded', updateAllElements);
