# Color Compass 色彩指南针

![许可证](https://img.shields.io/github/license/AkutaZehy/color-compass?style=flat-square)
![仓库大小](https://img.shields.io/github/repo-size/AkutaZehy/color-compass?style=flat-square)
[![深度维基](https://deepwiki.com/badge.svg)](https://deepwiki.com/AkutaZehy/color-compass)

## ✨ 简介

**Color Compass** 是一款轻量级、用户友好的工具，旨在从图像中提取调色板，并使用 CIELAB 色彩模型在 3D 空间中可视化色彩空间。它提供了一种简单有效的方法来探索和理解插画的风格和色彩，无需复杂的深度学习或繁重的库。

## 🎨 功能

### 核心功能
- **调色板提取**：使用先进算法从图像中高效提取调色板：
  - **MMCQ（改进的中位切分量化）**：用于提取主色
  - **SLIC 超像素算法**：用于图像分割预处理
  - **二阶段 K-means 聚类**：用于调色板分析和优化
  - **背景色检测**：自动识别和分离背景色
  - **隐藏色提取**：发现不常见但重要的颜色

### 可视化
- **2D 色彩分析**：
  - HSV 分布直方图（色相、饱和度、明度）
  - CIELAB 分布直方图（L*、a*、b*）
  - 高级极坐标色相分布图
  - 色彩距离热力图
  - Lab a*b* 密度分布

- **3D 色彩空间**：
  - Lch 色彩空间中的交互式 3D 球体可视化
  - 鼠标/触摸控制旋转和缩放
  - 导出高质量 3D 渲染图

### 高级功能
- **多种色彩距离度量**：
  - RGB 欧几里得距离（快速）
  - CIELAB ΔE 距离（感知准确）
- **性能优化**：自动降采样大图片（最大 2MP）
- **隐私优先**：所有处理都在浏览器本地完成，数据不会离开您的设备

### 导出选项
- 将调色板导出为 PNG 图片
- 将调色板数据导出为 JSON
- 将 3D 色彩球体导出为 PNG

## 🚀 快速开始

### Web 版本（推荐）

无需安装！直接在浏览器中打开 HTML 文件即可。

**方式：**
1. **直接打开文件**：直接在浏览器中打开 `frontend/index.html`
2. **本地服务器（推荐）**：使用 VSCode Live Server 或任何本地 Web 服务器：
   ```bash
   cd frontend
   npx serve
   # 或者
   python -m http.server 8000
   ```

### 特性
- 🌐 **国际化**：支持英文和中文（右上角切换）
- 📱 **响应式设计**：支持桌面和移动设备
- ♿ **无障碍访问**：键盘导航、ARIA 标签、减少动画支持
- 🎯 **智能默认值**：针对大多数用例优化的参数

## 🛠️ 技术架构

### 技术栈
- **纯前端**：无需后端，完全在浏览器中运行
- **原生 JavaScript (ES6 模块)**：无框架开销
- **Three.js**：用于 3D 可视化（v138，本地加载）
- **HTML5 Canvas**：用于 2D 可视化和图像处理
- **现代 CSS**：带深色主题的响应式设计

### 模块结构
```
frontend/
├── index.html              # 主入口点
├── css/
│   └── style.css          # 所有样式
├── js/
│   ├── main.js            # 核心协调器和 UI 逻辑
│   ├── colorUtils.js      # RGB/HSV/Lab 色彩转换
│   ├── imageHandler.js    # 图像加载和画布操作
│   ├── medianCut.js       # MMCQ 算法提取主色
│   ├── slic.js            # SLIC 超像素算法
│   ├── paletteAnalyzer.js # 二阶段 K-means 聚类
│   ├── paletteRenderer.js # 调色板显示和导出
│   ├── colorStats.js      # 色彩统计计算
│   ├── visualization2D.js # 2D 直方图和散点图
│   ├── visualizationAdvanced.js # 高级可视化
│   ├── sphereRenderer3D.js # 3D Lab 色彩球体
│   ├── fileSaver.js       # 文件导出工具
│   └── i18n.js            # 国际化模块
├── i18n/
│   ├── en-US.json         # 英文翻译
│   └── zh-CN.json         # 中文翻译
└── lib/
    └── three/             # Three.js 库文件
```

### 色彩空间转换
- RGB ↔ HSV
- RGB ↔ CIELAB（经由 XYZ）
- 完全符合 ICC 配置文件，使用 D65 光源

## 📊 算法详情

### 调色板提取流程
1. **图像降采样**：对于 >2MP 的图像，降采样以提高性能
2. **SLIC 超像素预处理**：将相似像素分组为超像素
3. **MMCQ 主色提取**：获取初始颜色中心
4. **二阶段 K-means 聚类**：
   - 阶段 1：将像素聚类到初始中心
   - 阶段 2：使用隐藏色检测优化
5. **背景色处理**：检测和分离背景色
6. **生成最终调色板**：合并相似颜色并输出最终调色板

### 色彩差异度量
- **RGB 欧几里得**：快速但感知不准确
- **CIELAB ΔE76**：Lab 空间中的标准欧几里得距离
- **CIELAB ΔE2000**：更准确的感知距离（即将推出）

## 🌍 国际化

Color Compass 完全支持国际化：
- 🇺🇸 英文 (en-US) - 默认
- 🇨🇳 中文 (zh-CN)

### 添加新语言
1. 在 `frontend/i18n/` 中创建新的 JSON 文件（例如 `ja-JP.json`）
2. 从 `en-US.json` 复制结构并翻译所有值
3. 该语言将自动出现在语言切换器中

## 🤝 贡献

我们欢迎贡献！以下是您可以帮助的方式：

### 贡献方式
- 🐛 **错误报告**：发现问题？打开 GitHub issue
- 💡 **功能请求**：有想法？与我们分享
- 🔧 **代码贡献**：提交 pull request
- 📝 **文档**：改进文档或添加翻译
- 🎨 **UI/UX**：建议设计改进

### 开发设置
1. Fork 仓库
2. 克隆您的 fork：
   ```bash
   git clone https://github.com/YOUR-USERNAME/color-compass.git
   ```
3. 创建功能分支：
   ```bash
   git checkout -b feature/amazing-new-feature
   ```
4. 做出更改并提交：
   ```bash
   git commit -m "添加惊人的新功能"
   ```
5. 推送到 GitHub 并提交 pull request

## 📜 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- **Three.js**：提供强大的 3D 可视化功能
- **色彩科学**：CIE 开发 Lab 色彩空间标准
- **开源社区**：启发此项目

---

**尽情探索色彩！** 🌈

### 社交
- 🌟 在 GitHub 上给我们星标
- 🐛 报告错误
- 💬 加入讨论
