# Color Compass

Extract a colour palette from an image and inspect the image's colour
statistics, entirely in the browser. The image is never uploaded: there is no
backend, no build step, and no runtime dependency on a network service.

![License](https://img.shields.io/github/license/AkutaZehy/color-compass?style=flat-square)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/AkutaZehy/color-compass)

## Quick start

Open the app either directly or behind a local server.

```bash
# local server (recommended: avoids file:// module restrictions)
npm start
# or
cd frontend && npx serve
# or
python -m http.server 8000
```

Then open `frontend/index.html` in a browser. Opening the file directly also
works, but ES modules and the Three.js import map are subject to browser
`file://` rules.

Run the regression suite (synthetic images, no browser needed):

```bash
npm test
```

## Usage

1. Load an image: drag and drop it onto the upload area, pick a file, or paste
   from the clipboard with `Ctrl+V` / `Cmd+V`.
2. The palette is extracted and the analysis panels render automatically.
3. Adjust parameters and re-render. The panel exposes the MMCQ seed count, the
   target palette size, the hidden-colour thresholds, the SLIC parameters, the
   background matching parameters and the RGB-vs-Delta-E distance switch; the
   full list with ranges and defaults is in
   [Tunable parameters](docs/ALGORITHM.md#tunable-parameters).
   "Reset parameters" restores the defaults, and the palette order can be set to
   percentage, luminance or hue.
4. Export: palette as PNG, palette as JSON, or the 3D sphere as PNG.

Screenshots: none are tracked in this repository yet — screenshots pending.

## Metrics and algorithms

Every value below is produced by the code; the formula, the constant and the
source line are in [docs/ALGORITHM.md](docs/ALGORITHM.md).

| Metric | Unit | Range | Definition |
| --- | --- | --- | --- |
| Palette share | fraction of image pixels | 0 - 1 | [7. Palette output](docs/ALGORITHM.md#7-palette-output) |
| Pixel count | pixels | 0 - working buffer size | [7. Palette output](docs/ALGORITHM.md#7-palette-output) |
| Hue (H) | turns | 0 - 1 | [Color space conversions](docs/ALGORITHM.md#color-space-conversions) |
| Saturation (S) | ratio | 0 - 1 | [Color space conversions](docs/ALGORITHM.md#color-space-conversions) |
| Value (V) | ratio | 0 - 1 | [Color space conversions](docs/ALGORITHM.md#color-space-conversions) |
| Lightness L\* | Lab units | 0 - 100 | [Color space conversions](docs/ALGORITHM.md#color-space-conversions) |
| a\*, b\* | Lab units | about -128 - 128; histograms clip to -100 - 100 | [Color space conversions](docs/ALGORITHM.md#color-space-conversions) |
| RGB Euclidean distance | RGB units | 0 - 441.7 | [Color distance metrics](docs/ALGORITHM.md#color-distance-metrics) |
| CIELAB Delta E (1976) | Delta E units | 0 upward, unbounded | [Color distance metrics](docs/ALGORITHM.md#color-distance-metrics) |
| Edge strength | ratio of edge pixels | 0 - 1 | [Derived measurements](docs/ALGORITHM.md#derived-measurements) |
| Local contrast | RGB distance / 255 | 0 - 1 | [Derived measurements](docs/ALGORITHM.md#derived-measurements) |
| Hue uniqueness | ratio | 0 - 1 | [Derived measurements](docs/ALGORITHM.md#derived-measurements) |
| Chroma C | Lab units | 0 upward | [Derived measurements](docs/ALGORITHM.md#derived-measurements) |
| Relative chroma C / Cmax | ratio | 0 - 1 | [3D Lch sphere](docs/ALGORITHM.md#3d-lch-sphere) |
| Hidden score | unitless weighted sum | 0 upward | [5. Hidden color detection](docs/ALGORITHM.md#5-hidden-color-detection) |

Pipeline stages: [1. Decode and downsample](docs/ALGORITHM.md#1-decode-and-downsample) →
[2. SLIC superpixels](docs/ALGORITHM.md#2-slic-superpixels) →
[3. MMCQ dominant colors](docs/ALGORITHM.md#3-mmcq-dominant-colors) →
[4. K-means clustering](docs/ALGORITHM.md#4-k-means-clustering) →
[5. Hidden color detection](docs/ALGORITHM.md#5-hidden-color-detection) →
[6. Background detection](docs/ALGORITHM.md#6-background-detection) →
[7. Palette output](docs/ALGORITHM.md#7-palette-output).

## Known limitations

- Only Delta E 1976 is implemented. Delta E 2000 does not exist in the code.
- The RGB-to-Lab conversion assumes sRGB with a D65 white point; ICC profiles
  are not read.
- Hue average and standard deviation use plain linear averages even though hue
  is a cyclic quantity.
- Images above 2 MP are downscaled before analysis, so palette shares describe
  the downscaled buffer, not the original file.
- The 3D sphere and the scatter plot work on sampled pixels (every 200th and
  every 100th pixel respectively).
- Background detection relies on edge sampling only; a background that never
  touches the image border is not detected.
- The repository ships no screenshot or demo image.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ALGORITHM.md](docs/ALGORITHM.md) | Formulas, constants, thresholds, units, with `file:line` sources |
| [README_ZH.md](README_ZH.md) | Chinese version of this file |
| [frontend/i18n/en-US.json](frontend/i18n/en-US.json) | UI strings (English) |
| [frontend/i18n/zh-CN.json](frontend/i18n/zh-CN.json) | UI strings (Chinese) |

## Build and test

There is no build step. The app is plain ES modules served from `frontend/`.

```bash
npm test     # node --test, runs test/pipeline.test.mjs
npm start    # npx serve frontend
```

`npm test` exercises the MMCQ, SLIC and analyzer modules directly in Node with
synthetic images: it needs neither a browser nor a canvas.

## License

MIT — see [LICENSE](LICENSE).

Acknowledgements: MMCQ follows the Color-Thief approach by Lokesh Dhakar; 3D rendering uses Three.js; CIELAB follows the CIE standard.
