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
export function rgbToHsv (r, g, b) {
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
export function rgbToLab (r, g, b) {
  // 1. RGB to sRGB (Normalize 0-255 to 0-1)
  let var_R = r / 255;
  let var_G = g / 255;
  let var_B = b / 255;

  // 2. sRGB to Linear RGB (Apply gamma correction)
  // Apply power function with constant exponent and factor
  const sRGBtoLinear = (c) => {
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };

  var_R = sRGBtoLinear(var_R);
  var_G = sRGBtoLinear(var_G);
  var_B = sRGBtoLinear(var_B);

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

  // Apply the CIE Lab f* function
  const f = (c) => {
    const epsilon = 0.008856; // (6/29)^3
    const kappa = 903.3;    // (29/3)^3
    return c > epsilon ? Math.pow(c, 1 / 3) : (kappa * c + 16) / 116;
  };


  var_X = f(var_X);
  var_Y = f(var_Y);
  var_Z = f(var_Z);

  let CIELab_L = (116 * var_Y) - 16;
  let CIELab_a = 500 * (var_X - var_Y);
  let CIELab_b = 200 * (var_Y - var_Z);

  return [CIELab_L, CIELab_a, CIELab_b];
  // L* ranges from 0 to 100
  // a* and b* typically range from -128 to 128 (approx)
}

/**
* Converts an RGB color array [r, g, b] (0-255) to a Hex string (#RRGGBB).
* @param   Array   rgb   The RGB color array [r, g, b]
* @return  String        The Hex representation
*/
export function rgbToHex (rgb) {
  const toHex = (c) => {
    // Ensure the value is a number and within [0, 255] before rounding
    const val = Math.max(0, Math.min(255, Math.round(c)));
    const hex = val.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  // Ensure rgb is an array and has 3 elements
  if (!Array.isArray(rgb) || rgb.length < 3) {
    console.error("Invalid input to rgbToHex:", rgb);
    return "#FF00FF"; // Return a distinct error color
  }
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`.toUpperCase();
}

/**
* Converts a Hex string (#RRGGBB) to an RGB color array [r, g, b] (0-255).
* @param   String  hex     The Hex representation (#RRGGBB or #RGB)
* @return  Array           The RGB representation [r, g, b]
*/
export function hexToRgb (hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null; // Return null if hex is invalid
}


/**
* Calculates the Euclidean distance between two colors in the CIELAB color space (Delta E 1976).
* Based on https://en.wikipedia.org/wiki/Color_difference#Euclidean_distance_in_L*a*b*_or_L*u*v*
* @param   Array  lab1   First LAB color [L*, a*, b*]
* @param   Array  lab2   Second LAB color [L*, a*, b*]
* @return  Number        The color difference (Delta E)
*/
export function labDistance (lab1, lab2) {
  if (!lab1 || !lab2 || lab1.length < 3 || lab2.length < 3) {
    console.error("Invalid input to labDistance:", lab1, lab2);
    return Infinity; // Return large distance on invalid input
  }
  const deltaL = lab1[0] - lab2[0];
  const deltaA = lab1[1] - lab2[1];
  const deltaB = lab1[2] - lab2[2];
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}