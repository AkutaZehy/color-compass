// frontend/js/colorUtils.js

/**
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and v in the set [0, 1] (h is 0-360 degrees normally, here 0-1 for simplicity).
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSV representation [h, s, v]
 */
function rgbToHsv (r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h, s, v]; // h in [0, 1), s in [0, 1], v in [0, 1]
}

/**
* Converts an RGB color value to CIELAB color space.
* Based on http://www.easyrgb.com/index.php?X=MATH&B=RGBlab
* Assumes r, g, and b are contained in the set [0, 255].
* Uses D65 Illuminant and 2 degree observer.
* @param   Number  r       The red color value
* @param   Number  g       The green color value
* @param   Number  b       The blue color value
* @return  Array           The LAB representation [L*, a*, b*]
*/
function rgbToLab (r, g, b) {
  // 1. RGB to sRGB (Normalize 0-255 to 0-1)
  let var_R = r / 255;
  let var_G = g / 255;
  let var_B = b / 255;

  // 2. sRGB to Linear RGB (Apply gamma correction)
  if (var_R > 0.04045) var_R = Math.pow((var_R + 0.055) / 1.055, 2.4);
  else var_R = var_R / 12.92;
  if (var_G > 0.04045) var_G = Math.pow((var_G + 0.055) / 1.055, 2.4);
  else var_G = var_G / 12.92;
  if (var_B > 0.04045) var_B = Math.pow((var_B + 0.055) / 1.055, 2.4);
  else var_B = var_B / 12.92;

  // Scale to 0-100 (for XYZ conversion)
  var_R = var_R * 100;
  var_G = var_G * 100;
  var_B = var_B * 100;

  // 3. Linear RGB to CIE XYZ
  let X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
  let Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
  let Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;

  // 4. CIE XYZ to CIELAB (Using D65 Illuminant as Reference White)
  // Reference White D65 (for 2 degree observer): X=95.047, Y=100.000, Z=108.883
  const ref_X = 95.047;
  const ref_Y = 100.000;
  const ref_Z = 108.883;

  let var_X = X / ref_X;
  let var_Y = Y / ref_Y;
  let var_Z = Z / ref_Z;

  if (var_X > 0.008856) var_X = Math.pow(var_X, (1 / 3));
  else var_X = (903.3 * var_X + 16) / 116;
  if (var_Y > 0.008856) var_Y = Math.pow(var_Y, (1 / 3));
  else var_Y = (903.3 * var_Y + 16) / 116;
  if (var_Z > 0.008856) var_Z = Math.pow(var_Z, (1 / 3));
  else var_Z = (903.3 * var_Z + 16) / 116;

  let CIELab_L = (116 * var_Y) - 16;
  let CIELab_a = 500 * (var_X - var_Y);
  let CIELab_b = 200 * (var_Y - var_Z);

  return [CIELab_L, CIELab_a, CIELab_b];
  // L* ranges from 0 to 100
  // a* and b* typically range from -128 to 128 (approx)
}

// Note: You might also need HSV to RGB and Lab to RGB later for rendering.
// For now, only RGB to HSV/Lab is implemented as per the step's goal.