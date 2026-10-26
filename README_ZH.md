# Color Compass

从图像中提取色板，并在浏览器内分析图像的色彩统计。图片不会上传：没有后端、
没有构建步骤，运行时不依赖任何网络服务。

![许可证](https://img.shields.io/github/license/AkutaZehy/color-compass?style=flat-square)
[![深度维基](https://deepwiki.com/badge.svg)](https://deepwiki.com/AkutaZehy/color-compass)

## 快速开始

可以直接打开页面，也可以用本地服务器打开。

```bash
# 本地服务器（推荐：避免 file:// 下的模块限制）
npm start
# 或者
cd frontend && npx serve
# 或者
python -m http.server 8000
```

然后在浏览器中打开 `frontend/index.html`。直接双击文件也能运行，但 ES 模块
与 Three.js 的 import map 受浏览器 `file://` 规则限制。

运行回归测试（使用合成图，无需浏览器）：

```bash
npm test
```

## 使用

1. 载入图片：拖拽到上传区域、选择文件，或用 `Ctrl+V` / `Cmd+V` 从剪贴板粘贴。
2. 色板自动提取，分析面板自动渲染。
3. 调整参数并重新生成色板。面板提供 MMCQ 初始颜色簇数量、目标色板大小、
   藏色检测阈值、SLIC 参数、背景色匹配参数，以及 RGB 与 ΔE 的距离切换；
   完整参数、取值范围与默认值见
   [可调参数](docs/ALGORITHM.md#tunable-parameters)。
   "重置参数"可恢复默认值；色板排序可选占比、亮度或色相。
4. 导出：色板 PNG、色板 JSON、3D 色彩球体 PNG。

截图：本仓库尚未收录任何截图，待补。

## 指标与算法

下表中的数值全部由代码产生；公式、常量与源码行号见
[docs/ALGORITHM.md](docs/ALGORITHM.md)。

| 指标 | 单位 | 取值范围 | 定义 |
| --- | --- | --- | --- |
| 色板占比 | 图像像素比例 | 0 - 1 | [7. Palette output](docs/ALGORITHM.md#7-palette-output) |
| 像素数 | 像素 | 0 - 工作缓冲区大小 | [7. Palette output](docs/ALGORITHM.md#7-palette-output) |
| 色相 (H) | 圈数 | 0 - 1 | [色彩空间转换](docs/ALGORITHM.md#color-space-conversions) |
| 饱和度 (S) | 比例 | 0 - 1 | [色彩空间转换](docs/ALGORITHM.md#color-space-conversions) |
| 明度 (V) | 比例 | 0 - 1 | [色彩空间转换](docs/ALGORITHM.md#color-space-conversions) |
| 明度 L\* | Lab 单位 | 0 - 100 | [色彩空间转换](docs/ALGORITHM.md#color-space-conversions) |
| a\*、b\* | Lab 单位 | 约 -128 - 128；直方图截断到 -100 - 100 | [色彩空间转换](docs/ALGORITHM.md#color-space-conversions) |
| RGB 欧几里得距离 | RGB 单位 | 0 - 441.7 | [色差度量](docs/ALGORITHM.md#color-distance-metrics) |
| CIELAB ΔE (1976) | ΔE 单位 | 0 起，无上界 | [色差度量](docs/ALGORITHM.md#color-distance-metrics) |
| 边缘强度 | 边缘像素比例 | 0 - 1 | [派生量](docs/ALGORITHM.md#derived-measurements) |
| 局部对比度 | RGB 距离 / 255 | 0 - 1 | [派生量](docs/ALGORITHM.md#derived-measurements) |
| 色相独特性 | 比例 | 0 - 1 | [派生量](docs/ALGORITHM.md#derived-measurements) |
| 彩度 C | Lab 单位 | 0 起 | [派生量](docs/ALGORITHM.md#derived-measurements) |
| 相对彩度 C / Cmax | 比例 | 0 - 1 | [3D Lch 色彩球体](docs/ALGORITHM.md#3d-lch-sphere) |
| 藏色分数 | 无量纲加权和 | 0 起 | [5. 藏色检测](docs/ALGORITHM.md#5-hidden-color-detection) |

流程各阶段：[1. 解码与降采样](docs/ALGORITHM.md#1-decode-and-downsample) →
[2. SLIC 超像素](docs/ALGORITHM.md#2-slic-superpixels) →
[3. MMCQ 主色提取](docs/ALGORITHM.md#3-mmcq-dominant-colors) →
[4. K-means 聚类](docs/ALGORITHM.md#4-k-means-clustering) →
[5. 藏色检测](docs/ALGORITHM.md#5-hidden-color-detection) →
[6. 背景色检测](docs/ALGORITHM.md#6-background-detection) →
[7. 色板输出](docs/ALGORITHM.md#7-palette-output)。

## 已知限制

- 只实现了 ΔE 1976，代码中没有 ΔE 2000。
- RGB 到 Lab 的转换假定输入为 sRGB 且使用 D65 光源，不读取 ICC 配置文件。
- 色相的平均值与标准差使用普通线性平均，而色相本身是周期量。
- 超过 2 MP 的图片会先降采样再分析，因此色板占比描述的是降采样后的缓冲区，
  不是原始文件。
- 3D 色彩球体与散点图使用抽样像素（分别每 200 个、每 100 个像素取一个）。
- 背景色检测只依赖边缘采样；若背景色完全不接触图像边界，则检测不到。
- 仓库未附带任何截图或演示图。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/ALGORITHM.md](docs/ALGORITHM.md) | 公式、常量、阈值、单位，附 `file:line` 出处 |
| [README.md](README.md) | 本文档的英文版 |
| [frontend/i18n/en-US.json](frontend/i18n/en-US.json) | 界面文案（英文） |
| [frontend/i18n/zh-CN.json](frontend/i18n/zh-CN.json) | 界面文案（中文） |

## 构建与测试

没有构建步骤，页面就是 `frontend/` 下的原生 ES 模块。

```bash
npm test     # node --test，运行 test/pipeline.test.mjs
npm start    # npx serve frontend
```

`npm test` 直接在 Node 中用合成图调用 MMCQ、SLIC 与分析模块，既不需要浏览器
也不需要 canvas。

## 许可证

MIT，见 [LICENSE](LICENSE)。

致谢：MMCQ 实现参考了 Lokesh Dhakar 的 Color-Thief；3D 渲染使用 Three.js；
CIELAB 遵循 CIE 标准。
