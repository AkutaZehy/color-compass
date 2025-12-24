# Color Compass

![License](https://img.shields.io/github/license/AkutaZehy/color-compass?style=flat-square)
![Repo Size](https://img.shields.io/github/repo-size/AkutaZehy/color-compass?style=flat-square)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/AkutaZehy/color-compass)

## ✨ Introduction

**Color Compass** is a lightweight, user-friendly tool designed to extract color palettes from images and visualize color spaces in 3D using the CIELAB color model. It provides a simple and effective way to explore and understand the style and colors of illustrations without complex deep learning or heavy libraries.

## 🎨 Features

### Core Functionality
- **Palette Extraction**: Efficiently extract color palettes from images using advanced algorithms:
  - **MMCQ (Modified Median Cut Quantization)**: For dominant color extraction
  - **SLIC Superpixel Algorithm**: For image segmentation preprocessing
  - **Two-stage K-means Clustering**: For palette analysis and refinement
  - **Background Color Detection**: Automatically identify and separate background colors
  - **Hidden Color Extraction**: Discover uncommon but important colors

### Visualizations
- **2D Color Analysis**:
  - HSV distribution histograms (Hue, Saturation, Value)
  - CIELAB distribution histograms (L*, a*, b*)
  - Advanced polar hue distribution chart
  - Color distance heatmap
  - Lab a*b* density distribution

- **3D Color Space**:
  - Interactive 3D sphere visualization in Lch color space
  - Mouse/touch controls for rotation and zoom
  - Export high-quality 3D renders

### Advanced Features
- **Multiple Color Distance Metrics**:
  - RGB Euclidean distance (fast)
  - CIELAB ΔE distance (perceptually accurate)
- **Performance Optimization**: Automatic image downsampling for large images (max 2MP)
- **Privacy-First**: All processing happens locally in your browser - no data leaves your device

### Export Options
- Export palette as PNG image
- Export palette data as JSON
- Export 3D color sphere as PNG

## 🚀 Quick Start

### Web Version (Recommended)

No installation required! Just open the HTML file directly in your browser.

**Options:**
1. **Direct File Opening**: Open `frontend/index.html` directly in your browser
2. **Local Server (Recommended)**: Use VSCode Live Server or any local web server:
   ```bash
   cd frontend
   npx serve
   # or
   python -m http.server 8000
   ```

### Features
- 🌐 **Internationalization**: Supports English and Chinese (toggle in top-right corner)
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ♿ **Accessibility**: Keyboard navigation, ARIA labels, reduced motion support
- 🎯 **Smart Defaults**: Optimized parameters for most use cases

## 🛠️ Technical Architecture

### Technology Stack
- **Pure Frontend**: No backend required, runs entirely in browser
- **Vanilla JavaScript (ES6 Modules)**: No framework overhead
- **Three.js**: For 3D visualization (v138, loaded locally)
- **HTML5 Canvas**: For 2D visualizations and image processing
- **Modern CSS**: Responsive design with dark theme

### Module Structure
```
frontend/
├── index.html              # Main entry point
├── css/
│   └── style.css          # All styling
├── js/
│   ├── main.js            # Core orchestrator and UI logic
│   ├── colorUtils.js      # RGB/HSV/Lab color conversions
│   ├── imageHandler.js    # Image loading and canvas operations
│   ├── medianCut.js       # MMCQ algorithm for dominant colors
│   ├── slic.js            # SLIC superpixel algorithm
│   ├── paletteAnalyzer.js # Two-stage K-means clustering
│   ├── paletteRenderer.js # Palette display and export
│   ├── colorStats.js      # Color statistics calculation
│   ├── visualization2D.js # 2D histograms and scatter plots
│   ├── visualizationAdvanced.js # Advanced visualizations
│   ├── sphereRenderer3D.js # 3D Lab color sphere
│   ├── fileSaver.js       # File export utilities
│   └── i18n.js            # Internationalization module
├── i18n/
│   ├── en-US.json         # English translations
│   └── zh-CN.json         # Chinese translations
└── lib/
    └── three/             # Three.js library files
```

### Color Space Conversions
- RGB ↔ HSV
- RGB ↔ CIELAB (via XYZ)
- Full ICC profile compliance with D65 illuminant

## 📊 Algorithm Details

### Palette Extraction Pipeline
1. **Image Downsampling**: For images > 2MP, downsample for performance
2. **SLIC Superpixel Preprocessing**: Group similar pixels into superpixels
3. **MMCQ Dominant Color Extraction**: Get initial color centers
4. **Two-stage K-means Clustering**:
   - Stage 1: Cluster pixels to initial centers
   - Stage 2: Refine with hidden color detection
5. **Background Color Handling**: Detect and separate background colors
6. **Final Palette Generation**: Merge similar colors and output final palette

### Color Difference Metrics
- **RGB Euclidean**: Fast but not perceptually accurate
- **CIELAB ΔE76**: Standard Euclidean distance in Lab space
- **CIELAB ΔE2000**: More accurate perceptual distance (coming soon)

## 🌍 Internationalization

Color Compass is fully internationalized with support for:
- 🇺🇸 English (en-US) - Default
- 🇨🇳 Chinese (zh-CN)

### Adding New Languages
1. Create a new JSON file in `frontend/i18n/` (e.g., `ja-JP.json`)
2. Copy structure from `en-US.json` and translate all values
3. The language will automatically appear in the language switcher

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute
- 🐛 **Bug Reports**: Found an issue? Open a GitHub issue
- 💡 **Feature Requests**: Have an idea? Share it with us
- 🔧 **Code Contributions**: Submit a pull request
- 📝 **Documentation**: Improve docs or add translations
- 🎨 **UI/UX**: Suggest design improvements

### Development Setup
1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/color-compass.git
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feature/amazing-new-feature
   ```
4. Make changes and commit:
   ```bash
   git commit -m "Add amazing new feature"
   ```
5. Push to GitHub and submit a pull request

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Three.js**: For powerful 3D visualization capabilities
- **Color Science**: CIE for developing the Lab color space standards
- **Open Source Community**: For inspiring this project

---

**Enjoy exploring colors!** 🌈

### Social
- 🌟 Star us on GitHub
- 🐛 Report bugs
- 💬 Join discussions
