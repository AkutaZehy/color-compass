# Color Compass

![License](https://img.shields.io/github/license/AkutaZehy/color-compass?style=flat-square)
![Repo Size](https://img.shields.io/github/repo-size/AkutaZehy/color-compass?style=flat-square)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/AkutaZehy/color-compass)

## ✨ Introduction

**Color Compass** is a lightweight, privacy-first color analysis tool that extracts color palettes from images and visualizes color spaces. It combines computer vision algorithms with intuitive visualizations to help designers, artists, and developers understand and work with color effectively.

**No data leaves your device.** All processing happens locally in your browser.

## 🎨 Features

### Core Functionality

- **Palette Extraction**: Advanced algorithm pipeline combining:
    - **SLIC Superpixel Segmentation**: Groups pixels into meaningful regions with spatial coherence
    - **MMCQ (Modified Median Cut Quantization)**: Extracts dominant color centers
    - **Edge-Aware K-means Clustering**: Refines colors using perceptual metrics
    - **Background Color Detection**: Identifies background using spatial connectivity
    - **Hidden Color Extraction**: Discovers important colors that would otherwise be missed

### Visualizations

- **2D Color Analysis**:
    - HSV distribution histograms (Hue, Saturation, Value)
    - CIELAB distribution histograms (L*, a*, b\*)
    - Polar hue distribution chart
    - Color distance heatmap
    - Lab a*b* density distribution
    - Lab a*b* scatter plot

- **3D Color Space**:
    - Interactive 3D sphere visualization in Lch color space
    - Mouse/touch controls for rotation and zoom
    - Export high-quality 3D renders

### Advanced Features

- **Multiple Color Distance Metrics**:
    - RGB Euclidean distance (fast)
    - CIELAB ΔE distance (perceptually accurate)
- **Edge-Aware Hidden Color Detection**: Finds small but important colors using:
    - Edge strength analysis (colors at object boundaries)
    - Local contrast detection (colors that stand out)
    - Hue uniqueness scoring
- **Automatic Image Optimization**: Downsamples large images (max 2MP) for performance
- **Fully Local**: Zero network requests for image processing

### Export Options

- Palette as PNG image
- Palette data as JSON
- 3D color sphere as PNG

## 🚀 Quick Start

### Web Version (Recommended)

No installation required! Just open the HTML file directly in your browser.

**Options:**

1. **Direct File**: Open `frontend/index.html` directly
2. **Local Server** (Recommended for CORS-free access):
    ```bash
    cd frontend
    npx serve
    # or
    python -m http.server 8000
    ```

### Features

- 🌐 **Internationalization**: English and Chinese
- 📱 **Responsive Design**: Desktop and mobile
- ♿ **Accessibility**: Keyboard navigation, ARIA labels, reduced motion support
- 🎯 **Tunable Parameters**: Adjust algorithm behavior to suit your images

## 🛠️ Technical Architecture

### Technology Stack

- **Pure Frontend**: No backend, no dependencies, runs in any modern browser(Server needed to avoid cross-domain issues in JavaScript.)
- **Vanilla JavaScript (ES6 Modules)**: Zero framework overhead
- **Three.js**: 3D visualization (loaded locally)
- **HTML5 Canvas**: 2D rendering and image processing
- **Modern CSS**: Dark theme with responsive layout

### Module Structure

```
frontend/
├── index.html              # Main entry point
├── css/
│   └── style.css          # Styling and responsive design
├── js/
│   ├── main.js            # Core orchestrator and UI logic
│   ├── colorUtils.js      # RGB/HSV/Lab color conversions
│   ├── imageHandler.js    # Image loading and pixel extraction
│   ├── medianCut.js       # MMCQ algorithm for dominant colors
│   ├── slic.js            # SLIC superpixel with edge features
│   ├── paletteAnalyzer.js # Edge-aware clustering and analysis
│   ├── paletteRenderer.js # Palette display and export
│   ├── colorStats.js      # Statistical color analysis
│   ├── visualization2D.js # 2D histograms and scatter plots
│   ├── visualizationAdvanced.js # Advanced visualizations
│   ├── sphereRenderer3D.js # 3D Lch color sphere
│   ├── fileSaver.js       # Export utilities
│   └── i18n.js            # Internationalization
├── i18n/
│   ├── en-US.json         # English
│   └── zh-CN.json         # Chinese
└── lib/
    └── three/             # Three.js library
```

## 📊 Algorithm Details

### Palette Extraction Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IMAGE INPUT                                   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. SLIC Superpixel Segmentation                                    │
│     - Groups pixels into spatially coherent regions                  │
│     - Extracts: avgRGB, position, edgeStrength, contrast            │
│     - Enables edge-aware analysis later                               │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. MMCQ Dominant Color Extraction                                  │
│     - Builds 3D histogram of quantized colors                       │
│     - Iterative median cut to find color clusters                   │
│     - Returns initial centroids for clustering                       │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Edge-Aware K-means Clustering                                   │
│     - Assigns superpixels to nearest centroids                      │
│     - Uses RGB or ΔE distance (configurable)                        │
│     - Iteratively refines cluster centers                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Hidden Color Detection                                           │
│     Criteria for hidden colors:                                      │
│     - High edge strength (at object boundaries)                      │
│     - High local contrast (stands out from surroundings)             │
│     - Hue uniqueness (color outlier in distribution)                 │
│     - Small but above minimum threshold                              │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Background Color Detection                                       │
│     - Samples edge pixels (background usually at edges)              │
│     - Finds clusters present at image boundaries                    │
│     - Prioritizes large connected regions                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FINAL PALETTE                                 │
│     - Sorted by L* luminance                                        │
│     - Tagged with: isBackground, isHidden                            │
│     - Each color: RGB, Lab, count, percentage                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Color Difference Metrics

- **RGB Euclidean**: Fast, hardware-accelerated, good for real-time preview
- **CIELAB ΔE**: Perceptually accurate, recommended for final output

### Tunable Parameters

| Parameter               | Range   | Default | Description                              |
| ----------------------- | ------- | ------- | ---------------------------------------- |
| `targetPaletteSize`     | 4-24    | 12      | Target number of colors in final palette |
| `dominantColors`        | 2-20    | 8       | Initial color centers from MMCQ          |
| `maxHiddenColors`       | 0-5     | 3       | Maximum hidden colors to detect          |
| `hiddenColorThreshold`  | 0-0.05  | 0.005   | Minimum pixel ratio for hidden color     |
| `edgeSensitivity`       | 0-1     | 0.5     | Sensitivity to edge-boundary colors      |
| `contrastThreshold`     | 0-1     | 0.3     | Sensitivity to high-contrast colors      |
| `superpixelCount`       | 50-500  | 200     | Number of superpixel regions             |
| `superpixelCompactness` | 1-50    | 10      | Regularity of superpixel shapes          |
| `maxBackgrounds`        | 1-5     | 3       | Maximum background colors                |
| `useDeltaE`             | boolean | false   | Use perceptual distance metric           |

### Hidden Color Detection Strategy

Hidden colors are colors that are **small in quantity but important in meaning** (e.g., a small insect on a leaf, text on a sign). Our algorithm detects them using:

1. **Edge Strength**: Colors at object boundaries often indicate important transitions
2. **Local Contrast**: Colors that contrast sharply with surroundings are perceptually significant
3. **Hue Uniqueness**: Colors that are outliers in the hue distribution may be meaningful
4. **Size Threshold**: Only considers colors above a minimum pixel ratio to filter noise

## 🌍 Internationalization

Supported languages:

- 🇺🇸 English (en-US) - Default
- 🇨🇳 Chinese (zh-CN)

### Adding New Languages

1. Create a new JSON file in `frontend/i18n/` (e.g., `ja-JP.json`)
2. Copy structure from `en-US.json` and translate all values
3. The language will automatically appear in the language switcher

## 🤝 Contributing

> If you want it, then you have to take it.

No issues, no PRs.

Any modification ideas: fork it and do it yourself, the code is provided "AS IS".

## 📜 License

MIT License - feel free to use, modify, and distribute.

## 🙏 Acknowledgments

- **Lokesh Dhakar** - Original Color-Thief MMCQ algorithm
- **Three.js** - 3D visualization framework
- **CIE** - Lab color space standards

