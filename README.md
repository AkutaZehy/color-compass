# color-compass

![License](https://img.shields.io/github/license/AkutaZehy/color-compass?style=flat-square)
![Repo Size](https://img.shields.io/github/repo-size/AkutaZehy/color-compass?style=flat-square)

## ✨ 项目简介

**Color Compass** 是一个旨在帮助画师和创意工作者分析和理解图像色彩风格的工具。它不仅能提取图像的代表性颜色调色板，还能通过独特的色彩空间可视化方式，直观展示图像的整体色彩倾向和分布。本项目提供纯前端在线版本和高性能的C#桌面版本。

## 🎨 功能特性

*   **智能调色板提取:**
    *   基于简单高效的颜色量化算法（如 Median Cut）从图像中提取具有代表性的颜色。
    *   支持设定最大颜色数量，自动合并相似颜色。
    *   初步尝试识别并区分前景主色、背景色和少量具有特色的颜色（如藏色）。
    *   输出包含颜色值（RGB/Hex）、像素比例及标记的调色板。
*   **色彩倾向分析:**
    *   计算并展示图像整体在 HSV 和 Lab 颜色空间中的统计信息（如平均值、方差），量化色彩倾向。
    *   生成 HSV 和 Lab 颜色空间的直方图，直观显示颜色、饱和度、明度等的分布。
*   **创新色彩空间可视化 (Lab 色球):**
    *   将图像像素在 Lab 颜色空间中的分布映射并渲染到三维球体上。
    *   水平方向：角度表示色相 (Hue)，距离中心轴的半径表示色度 (Chroma)。
    *   垂直方向：高度表示明度 (Lightness)。
    *   提供不可交互的静态渲染（多角度截图）和未来可能支持的可交互版本（拖拽旋转、维度筛选）。
    *   可自定义经纬线数量，帮助理解空间结构。
*   **结果输出:**
    *   将提取的调色板以标准色卡图片格式导出。
    *   将当前色球可视化视图导出为图片。
    *   导出调色板详细数据。
*   **双平台支持:**
    *   纯前端版本：无需安装，浏览器即可在线使用，方便快速体验和分享。
    *   C# 桌面版本：提供更流畅的性能和稳定的体验。

## 🚀 快速开始

本项目包含两个独立的应用：纯前端版和C#桌面版。

### 纯前端版本

无需安装。当在线版本部署完成后，你可以通过以下链接直接访问：
[链接到你的在线 demo 地址] <!-- TODO: Replace with your deployed URL -->

如果想在本地运行：

1.  克隆仓库: `git clone https://github.com/你的用户名/你的仓库名.git`
2.  进入前端目录: `cd 你的仓库名/frontend`
3.  安装依赖: `npm install` 或 `yarn install`
4.  启动本地服务器: `npm start` 或 `yarn start`
5.  在浏览器中打开 `http://localhost:3000` (或其他终端提示的地址)。

### C# 桌面版本

1.  克隆仓库: `git clone https://github.com/你的用户名/你的仓库名.git`
2.  进入桌面端目录: `cd 你的仓库名/desktop-csharp`
3.  使用 Visual Studio 或 VS Code 打开项目文件 (`.sln` 或 `.csproj`)。
4.  确保已安装 .NET SDK (建议使用 .NET 6 或更高版本)。
5.  构建并运行项目。

你也可以从 [Releases](https://github.com/你的用户名/你的仓库名/releases) 页面下载预编译好的二进制文件直接使用（如果已提供）。 <!-- TODO: Set up GitHub Releases -->

## 🖼️ 截图预览

<!-- TODO: 在这里插入项目截图或 GIF，展示调色板和色球可视化 -->
<!-- 这是非常重要的一部分，能直观展示项目效果 -->
![调色板提取截图](docs/screenshots/palette_example.png) <!-- 示例 placeholder -->
![Lab色球可视化截图](docs/screenshots/sphere_example.png) <!-- 示例 placeholder -->

## 🤔 设计理念与技术选择

*   **避免深度学习:** 专注于经典的图像处理和颜色算法，降低实现复杂度，保持程序轻量。
*   **类 Filter 算法:** 优先使用如 Median Cut 这样概念相对简单、实现直接的算法进行颜色量化。
*   **原生实现:** 核心颜色处理逻辑尽量使用原生代码（JS/C#）实现，减少对大型外部库的依赖（但3D可视化会使用成熟的图形库）。
*   **用户友好:** 输出结果力求直观、易于理解，特别是色彩空间的各种可视化图表。

## 🤝 贡献

欢迎所有形式的贡献！如果你有任何问题、建议或想提交代码改进，请随时提交 [Issues](https://github.com/你的用户名/你的仓库名/issues) 或发起 [Pull Requests](https://github.com/你的用户名/你的仓库名/pulls)。

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) <!-- TODO: Create this file --> 了解如何参与贡献。

本项目遵循 [行为准则](CODE_OF_CONDUCT.md) <!-- TODO: Create this file -->。

## 📜 License

本项目采用 [MIT License](LICENSE) 开源许可证。

## ✨ 鸣谢

感谢所有启发本项目思想、提供帮助或贡献代码的朋友。

---

**享受色彩探索的旅程吧！**