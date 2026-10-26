# Algorithm Reference

Every formula, constant and threshold below is taken from the source tree. Each
entry cites the file and line it comes from. Where a value the UI exposes has no
counterpart in the code, it is listed under [Undefined in source](#undefined-in-source)
instead of being guessed.

Paths are relative to the repository root.

## Pipeline

The browser entry point calls the stages in this order
(`frontend/js/main.js:156-186`):

```
image file
  -> decode + downsample            (1)
  -> SLIC superpixels               (2)   [cached by superpixel params]
  -> MMCQ dominant colors           (3)
  -> K-means + cluster expansion    (4)
  -> hidden-color tagging           (5)
  -> background tagging             (6)
  -> palette output                 (7)
```

SLIC runs on the working pixel buffer; MMCQ and the analyzer read the same
buffer, so every stage below operates on the downsampled dimensions
(`frontend/js/main.js:544-547`).

## 1. Decode and downsample

- The image is drawn to a hidden canvas and read back as RGBA
  (`frontend/js/imageHandler.js:101-113`).
- Images above **2,000,000 pixels** are downscaled before analysis;
  `scale = sqrt(maxPixels / totalPixels)` and both sides are floored to
  integers (`frontend/js/imageHandler.js:76`, `frontend/js/imageHandler.js:93-98`).
- The downscaled dimensions, not the original ones, are the only valid
  dimensions for every downstream consumer (`frontend/js/main.js:540-547`).

## 2. SLIC superpixels

Implementation: `frontend/js/slic.js`. Enabled by default
(`frontend/js/main.js:124`).

- **Internal downsample**: if the working buffer exceeds **100,000 pixels**,
  SLIC first max-pools the image to that budget
  (`frontend/js/slic.js:19`, `frontend/js/slic.js:75-77`). Max pooling (not
  averaging) is used so edges survive the reduction
  (`frontend/js/slic.js:91-100`).
- **Seed spacing**: `step = sqrt(width * height / superpixelCount)`, floored to
  an integer (`frontend/js/slic.js:138-142`).
- **Seed placement**: each seed moves to the lowest-gradient pixel in its 3x3
  neighbourhood (`frontend/js/slic.js:147`, `frontend/js/slic.js:164-191`).
- **Gradient**: luminance uses the Rec.601 weights
  `0.299 R + 0.587 G + 0.114 B`; the magnitude is the squared central
  difference `dx^2 + dy^2` (`frontend/js/slic.js:202-210`). Border pixels return
  `Infinity` (`frontend/js/slic.js:197-199`).
- **Distance function**:
  `D = (dr^2 + dg^2 + db^2) + (compactness / step^2) * (dx^2 + dy^2)`
  (`frontend/js/slic.js:240-250`). Search window is `floor(2 * step)` pixels
  around each centre (`frontend/js/slic.js:227`).
- **Iterations**: at most **10**, early-exit when the label array stops
  changing (`frontend/js/slic.js:223`, `frontend/js/slic.js:261-273`).
- **Connectivity enforcement**: 4-way flood fill; a component survives only if
  `size >= max(10, floor(avgSegmentSize * 0.005))` where
  `avgSegmentSize = width * height / numberOfLabels`
  (`frontend/js/slic.js:337-338`, `frontend/js/slic.js:379-388`).
- **Per-superpixel features** (`frontend/js/slic.js:397-497`):
  - `edgeStrength = edgePixelCount / (pixelCount * 4)` — a ratio in `[0, 1]`,
    since each pixel has at most four neighbours (`frontend/js/slic.js:471`).
  - `contrast = mean(RGB distance to neighbours) / 255`, also in `[0, 1]`
    (`frontend/js/slic.js:474-481`). At most **10** neighbour colours are
    collected per superpixel (`frontend/js/slic.js:439`).
  - `isBoundary = edgeStrength > 0.1` (`frontend/js/slic.js:484`).

## 3. MMCQ dominant colors

Implementation: `frontend/js/medianCut.js` (Color-Thief style).

- **Quantization**: 5 bits per channel, 32 levels, 32,768 histogram bins, index
  `r << 10 | g << 5 | b` (`frontend/js/medianCut.js:49-51`,
  `frontend/js/medianCut.js:67`).
- **Transparency**: pixels with `alpha < 125` are skipped
  (`frontend/js/medianCut.js:62`).
- **Cube priority**: the cube with the largest `population * volume` is split
  first, where `volume = (maxR-minR+1)(maxG-minG+1)(maxB-minB+1)` in quantised
  units (`frontend/js/medianCut.js:27`, `frontend/js/medianCut.js:134-136`).
- **Split axis**: the channel with the widest range (`frontend/js/medianCut.js:149-157`).
- **Cut point**: cumulative population reaches `count / 2`; bins before the
  median become one cube, the rest the other
  (`frontend/js/medianCut.js:163-172`).
- **Degenerate split**: if one side would be empty the cube is locked and
  returned unchanged, which is why a flat-colour image yields one colour and
  never a NaN swatch (`frontend/js/medianCut.js:182-185`).
- **Colour output**: population-weighted mean of the raw 8-bit channels inside
  each cube, rounded (`frontend/js/medianCut.js:197-208`).
- Requested count comes from the `dominantColors` parameter
  (`frontend/js/main.js:161-164`); the loop stops early if no cube can be split
  further (`frontend/js/medianCut.js:36`).

## 4. K-means clustering

Implementation: `frontend/js/paletteAnalyzer.js`.

- **Inputs**: superpixel features when `useSuperpixels` is on, otherwise raw
  pixels (`frontend/js/paletteAnalyzer.js:46-69`). In superpixel mode each
  superpixel is one sample weighted by its pixel count
  (`frontend/js/paletteAnalyzer.js:58`).
- **Seeds**: MMCQ colours, de-duplicated by exact RGB triple and truncated to
  `paletteSize` (`frontend/js/paletteAnalyzer.js:74-77`,
  `frontend/js/paletteAnalyzer.js:162-173`).
- **Distance**: RGB Euclidean by default, CIELAB Delta E when `useDeltaE` is
  enabled (`frontend/js/paletteAnalyzer.js:377-389`).
- **Iterations**: at most **20** (`frontend/js/paletteAnalyzer.js:97`,
  `frontend/js/paletteAnalyzer.js:356`).
- **Convergence**: the loop stops when no sample changes cluster
  (`frontend/js/paletteAnalyzer.js:430-433`).
- **Centroid update**: weighted mean of members, weighted by superpixel pixel
  count when available (`frontend/js/paletteAnalyzer.js:404-425`).
- **Cluster expansion** to reach `paletteSize`
  (`frontend/js/paletteAnalyzer.js:183-220`):
  - at most **3 rounds**, one fork per cluster per round
    (`frontend/js/paletteAnalyzer.js:187`).
  - clusters are ranked by per-channel standard deviation; the dominant axis
    is the one with the largest std (`frontend/js/paletteAnalyzer.js:226-261`).
  - the fork offset is `max(10, std * 0.8)` in 8-bit units, applied as `+offset`
    / `-offset` on the dominant axis and clamped to `[0, 255]`
    (`frontend/js/paletteAnalyzer.js:203-208`).

## 5. Hidden color detection

Two mechanisms, both in `frontend/js/paletteAnalyzer.js`.

### 5a. Hidden seeds (superpixel path only)

`pickHiddenSeeds` (`frontend/js/paletteAnalyzer.js:289-315`):

- candidate score `= 0.6 * contrast + 0.4 * edgeStrength`
  (`frontend/js/paletteAnalyzer.js:293-296`).
- a candidate qualifies when `contrast >= contrastThreshold` **or**
  `edgeStrength >= edgeSensitivity` (`frontend/js/paletteAnalyzer.js:297`).
- a candidate must be at least **60** RGB units away (Euclidean) from every
  existing seed and from every already-picked seed
  (`frontend/js/paletteAnalyzer.js:300-304`).
- at most `min(maxHiddenColors, paletteSize - seeds.length)` seeds are added
  (`frontend/js/paletteAnalyzer.js:83-91`).

### 5b. Hidden tagging

`analyzeClustersForHiddenColors` (`frontend/js/paletteAnalyzer.js:448-546`):

- hue angle comes from `atan2(b*, a*)` of the centroid Lab
  (`frontend/js/paletteAnalyzer.js:466-468`).
- the mean hue is a **circular** mean weighted by cluster population:
  `avgHue = atan2(sum(sin(h)*count), sum(cos(h)*count))`
  (`frontend/js/paletteAnalyzer.js:488-494`).
- `hueUniqueness = circularHueDistance(hue, avgHue) / PI`, so `0` means the
  same hue and `1` means the opposite hue
  (`frontend/js/paletteAnalyzer.js:498`, `frontend/js/paletteAnalyzer.js:551-554`).
- a cluster is a hidden candidate when **all** of:
  - `percentage < avgPercentage` — smaller than the average cluster
    (`frontend/js/paletteAnalyzer.js:502`, `frontend/js/paletteAnalyzer.js:517`);
  - `percentage >= minHiddenPercentage` — above the noise floor
    (`frontend/js/paletteAnalyzer.js:518`);
  - and at least one of
    - `edgeScore > edgeSensitivity * 0.5`
      (`frontend/js/paletteAnalyzer.js:519`),
    - `contrastScore > contrastThreshold`
      (`frontend/js/paletteAnalyzer.js:520`),
    - `hueUniqueness > 0.3`
      (`frontend/js/paletteAnalyzer.js:521`).
- **hidden score** (higher wins):
  ```
  hiddenScore = (hasEdge    ? edgeScore * edgeSensitivity : 0)
              + (hasContrast? contrastScore * 0.5        : 0)
              + (hasHue     ? hueUniqueness * 0.3        : 0)
              + (percentage / avgPercentage * 0.2)
  ```
  (`frontend/js/paletteAnalyzer.js:525-529`).
- the reported reason is `edge`, then `contrast`, then `hue`, in that priority
  (`frontend/js/paletteAnalyzer.js:534`).
- at most `maxHiddenColors` clusters are tagged, highest score first
  (`frontend/js/paletteAnalyzer.js:540-543`).

## 6. Background detection

`extractBackgroundColorsSpatial` (`frontend/js/paletteAnalyzer.js:564-624`):

- edge pixels are sampled from the top row, bottom row, left column and right
  column, with a stride of `max(1, floor((width + height) * 2 / 100))` for at
  most about 100 samples per side (`frontend/js/paletteAnalyzer.js:583`,
  `frontend/js/paletteAnalyzer.js:629-646`).
- a sampled pixel counts toward a centroid when its RGB Euclidean distance to
  that centroid is below `30 * backgroundVarianceScale`
  (`frontend/js/paletteAnalyzer.js:587`, `frontend/js/paletteAnalyzer.js:605`).
- a centroid qualifies as background when it matched **more than 10** edge
  samples (`frontend/js/paletteAnalyzer.js:614`).
- results are sorted by edge-match count and truncated to `maxBackgrounds`
  (`frontend/js/paletteAnalyzer.js:618-623`).

## 7. Palette output

`formatOutput` (`frontend/js/paletteAnalyzer.js:674-683`) emits one object per
cluster:

| Field         | Meaning                                                  | Source                                    |
| ------------- | -------------------------------------------------------- | ----------------------------------------- |
| `rgb`         | 8-bit `{r, g, b}` centroid                                | `frontend/js/paletteAnalyzer.js:676`        |
| `lab`         | CIELAB `{L*, a*, b*}` of the centroid                     | `frontend/js/paletteAnalyzer.js:677`        |
| `count`       | weighted pixel count of the cluster                       | `frontend/js/paletteAnalyzer.js:678`        |
| `percentage`  | `count / totalWeight`                                     | `frontend/js/paletteAnalyzer.js:679`        |
| `isBackground`| cluster matched the background rule                      | `frontend/js/paletteAnalyzer.js:680`        |
| `isHidden`    | cluster matched the hidden-colour rule                   | `frontend/js/paletteAnalyzer.js:681`        |

`totalWeight` is the sum of superpixel pixel counts in superpixel mode, and
`width * height` in the pixel path (`frontend/js/paletteAnalyzer.js:146-148`).
The hidden-colour stage instead uses `width * height` as its denominator in both
modes (`frontend/js/paletteAnalyzer.js:123`, `frontend/js/paletteAnalyzer.js:463`).

**Display order** (`frontend/js/main.js:222-240`):

- `percentage` — descending.
- `luminance` — ascending by `L*`.
- `hue` — ascending by `(atan2(b*, a*) + 2PI) mod 2PI`.

**JSON export** writes `rgb`, `hex`, `pixelPercentage` (one decimal, as a
string), `isBackground` and `isHidden` (`frontend/js/main.js:925-933`). The
export divides by `currentWorkingSize.width * height`, i.e. the downsampled
pixel count, not by the total weight used inside the analyzer
(`frontend/js/main.js:924`).

## Color space conversions

### RGB to HSV

`frontend/js/colorUtils.js:13-37`. Returns `[h, s, v]` with `h` in `[0, 1)`
(one turn), `s` and `v` in `[0, 1]`. `s = (max - min) / max`, `s = 0` when
`max = 0`. Hue is `0` for achromatic pixels (`frontend/js/colorUtils.js:23-33`).

### RGB to CIELAB

`frontend/js/colorUtils.js:49-104`, sRGB input assumed:

1. Normalise to `[0, 1]` (`frontend/js/colorUtils.js:51-53`).
2. Inverse sRGB gamma: `c > 0.04045 ? ((c + 0.055) / 1.055)^2.4 : c / 12.92`
   (`frontend/js/colorUtils.js:57-63`).
3. Scale to 0-100 and apply the sRGB to XYZ matrix
   (`frontend/js/colorUtils.js:66-73`):
   ```
   X = 0.4124 R + 0.3576 G + 0.1805 B
   Y = 0.2126 R + 0.7152 G + 0.0722 B
   Z = 0.0193 R + 0.1192 G + 0.9505 B
   ```
4. Divide by the D65 reference white `X=95.047, Y=100.000, Z=108.883`
   (`frontend/js/colorUtils.js:77-83`).
5. Apply the CIE `f` function with `epsilon = 0.008856` and `kappa = 903.3`
   (`frontend/js/colorUtils.js:86-90`).
6. `L* = 116 f(Y) - 16`, `a* = 500 (f(X) - f(Y))`,
   `b* = 200 (f(Y) - f(Z))` (`frontend/js/colorUtils.js:97-99`).

### CIELAB to RGB

- `labToRgbLinear` returns **unclamped** linear-light sRGB so callers can test
  gamut membership (`frontend/js/colorUtils.js:156-181`). It uses the inverse
  matrix `3.2406 / -1.5372 / -0.4986` and friends
  (`frontend/js/colorUtils.js:176-180`).
- `labToRgb` clamps to `[0, 1]`, applies the sRGB transfer function, and scales
  to bytes (`frontend/js/colorUtils.js:191-198`).
- Round-trip accuracy is asserted for in-gamut colours in
  `test/pipeline.test.mjs:95-104`.

## Color distance metrics

| Metric             | Formula                                                     | Unit                | Source                                   |
| ------------------ | ----------------------------------------------------------- | ------------------- | ---------------------------------------- |
| RGB Euclidean      | `sqrt(dr^2 + dg^2 + db^2)`                                  | 0 to 441.67         | `frontend/js/paletteAnalyzer.js:663-669` |
| CIELAB Delta E 1976| `sqrt(dL^2 + da^2 + db^2)`                                   | Delta E units       | `frontend/js/colorUtils.js:207-215`      |

Both are used in different places: K-means assignment picks one by the
`useDeltaE` flag (`frontend/js/paletteAnalyzer.js:377-389`), while the
heatmap always uses Delta E 1976 (`frontend/js/visualizationAdvanced.js:228-240`)
and background matching always uses RGB Euclidean
(`frontend/js/paletteAnalyzer.js:595-598`).

## Derived measurements

| Measurement           | Definition                                                     | Range / unit | Source                                   |
| --------------------- | -------------------------------------------------------------- | ------------ | ---------------------------------------- |
| Chroma `C`            | `sqrt(a*^2 + b*^2)`                                             | Lab units    | `frontend/js/sphereRenderer3D.js:60`     |
| LCh hue angle         | `atan2(b*, a*)`                                                | radians      | `frontend/js/sphereRenderer3D.js:61`     |
| Circular hue distance| `min(|h1-h2| mod 2PI, 2PI - that)`                             | 0 to PI      | `frontend/js/paletteAnalyzer.js:551-554` |
| Hue uniqueness        | circular hue distance / PI                                     | 0 to 1       | `frontend/js/paletteAnalyzer.js:498`     |
| Edge strength         | edge pixels / (pixel count * 4)                                | 0 to 1       | `frontend/js/slic.js:471`                |
| Local contrast        | mean RGB distance to neighbours / 255                          | 0 to 1       | `frontend/js/slic.js:474-481`            |
| Cluster percentage    | cluster weight / total weight                                  | 0 to 1       | `frontend/js/paletteAnalyzer.js:679`     |
| Hidden score          | weighted sum, see [5b](#5-hidden-color-detection)               | unitless     | `frontend/js/paletteAnalyzer.js:525-529` |
| Sample std. deviation | `sqrt(sum((x - mean)^2) / (n - 1))`                             | same as input| `frontend/js/colorStats.js:77-81`         |

The HSV hue average and standard deviation are plain linear averages even
though hue is cyclic; the source flags this as an accepted approximation
(`frontend/js/colorStats.js:100-102`).

## Visualization mappings

### Histograms

- **60 bins** for every channel (`frontend/js/main.js:593`).
- Ranges: hue `[0, 1]`, saturation `[0, 1]`, value `[0, 1]`, `L*` `[0, 100]`,
  `a*` and `b*` `[-100, 100]` (`frontend/js/main.js:594-600`).
- The hue histogram applies a 3-tap circular smoothing
  `(prev + 2*count + next) / 4` so the wrap-around bin is not split
  (`frontend/js/visualization2D.js:53-59`).
- Statistics and histograms are computed on every 10th pixel
  (`frontend/js/main.js:579-580`).

### Hue polar chart

- **36 bins** of 10 degrees each (`frontend/js/visualizationAdvanced.js:38-43`).
- Radius uses a logarithmic scale: `log(count + 1) / log(maxCount + 1)`
  (`frontend/js/visualizationAdvanced.js:82-88`).
- Inner radius **30 px**, outer radius `min(width, height)/2 - 40`
  (`frontend/js/visualizationAdvanced.js:23`, `frontend/js/visualizationAdvanced.js:47`).

### Lab a*b* density

- **40 x 40 bins** over `a*` and `b*` in `[-100, 100]`
  (`frontend/js/colorStats.js:33-36`, `frontend/js/colorStats.js:62-66`).
- Cell colour is the exact Lab-to-sRGB conversion at `L* = 50`; opacity runs
  from `0.3` to `1.0` with the count (`frontend/js/visualizationAdvanced.js:351-358`).

### Lab a*b* scatter

- Plots `a*` and `b*` over `[-120, 120]`, every 100th pixel
  (`frontend/js/visualization2D.js:160-163`, `frontend/js/main.js:604`).
- Point size 2.5 px, alpha 0.6, highlight alpha 0.9
  (`frontend/js/visualization2D.js:169-171`).

### Colour distance heatmap

- Fixed **50 x 50 grid** over the image (`frontend/js/visualizationAdvanced.js:191`).
- Each cell averages the Delta E 1976 distance to the nearest palette colour,
  sampled with at most **8 samples per axis**
  (`frontend/js/visualizationAdvanced.js:202-245`).
- Colour ramp: green at 0, yellow at half of the maximum cell distance, red at
  the maximum (`frontend/js/visualizationAdvanced.js:250-268`).

### S-L map panel

- Mosaic block size `max(2, ceil(sqrt(pixels / 150^2)))`, so at most 150 x 150
  blocks (`frontend/js/slMapRenderer.js:9`, `frontend/js/slMapRenderer.js:36`).
- **Clustering map**: a local median cut over the mosaic pixels into **16**
  colours, then each block is filled with its nearest colour
  (`frontend/js/slMapRenderer.js:150`, `frontend/js/slMapRenderer.js:158-168`).
  This median cut is a separate implementation from the MMCQ stage: it splits
  the largest bucket at the midpoint of its pixel count
  (`frontend/js/slMapRenderer.js:86-93`, `frontend/js/slMapRenderer.js:111-125`).
- **S map**: greyscale value `round(saturation * 255)`
  (`frontend/js/slMapRenderer.js:181-186`).
- **L map**: `L*` normalised to 0-255 then posterised into **10 levels** of
  25.6 units (`frontend/js/slMapRenderer.js:196-205`).

### 3D Lch sphere

Implementation: `frontend/js/sphereRenderer3D.js`.

- Sphere radius **100** units (`frontend/js/sphereRenderer3D.js:26`).
- Vertical axis: `theta = (1 - L*/100) * PI`, so `L* = 100` is the north pole
  (`frontend/js/sphereRenderer3D.js:64`).
- Longitude: the LCh hue angle `atan2(b*, a*)`
  (`frontend/js/sphereRenderer3D.js:61`, `frontend/js/sphereRenderer3D.js:74-78`).
- Radius inside a latitude circle is the **relative chroma**
  `min(1, C / Cmax(L*, h))`, where `Cmax` is the largest in-gamut chroma along
  the `(L*, h)` ray, found by a 12-step binary search over `[0, 200]`
  (`frontend/js/sphereRenderer3D.js:37-52`, `frontend/js/sphereRenderer3D.js:69-72`).
- Gamut membership uses a tolerance of `1e-4` on the linear-light channels
  (`frontend/js/sphereRenderer3D.js:28-34`).
- Points are sampled every 200th pixel (`frontend/js/main.js:673`).
- Vertex colours are converted from sRGB bytes to linear light before being
  handed to three.js (`frontend/js/sphereRenderer3D.js:84-87`).

## Tunable parameters

| Parameter                 | Range    | Default | Source                                              |
| ------------------------- | -------- | ------- | --------------------------------------------------- |
| `targetPaletteSize`       | 4-24     | 12      | `frontend/index.html:118-120`, `frontend/js/main.js:104` |
| `dominantColors`          | 2-20     | 8       | `frontend/index.html:100-102`, `frontend/js/main.js:107` |
| `maxHiddenColors`         | 0-5      | 3       | `frontend/index.html:133-135`, `frontend/js/main.js:110` |
| `hiddenColorThreshold`    | 0-0.05   | 0.005   | `frontend/index.html:148-150`, `frontend/js/main.js:111` |
| `edgeSensitivity`         | 0-1      | 0.5     | `frontend/index.html:165-167`, `frontend/js/main.js:112` |
| `contrastThreshold`       | 0-1      | 0.3     | `frontend/index.html:179-181`, `frontend/js/main.js:113` |
| `superpixelCount`         | 50-500   | 200     | `frontend/index.html:193-195`, `frontend/js/main.js:116` |
| `superpixelCompactness`   | 1-50     | 10      | `frontend/index.html:208-210`, `frontend/js/main.js:117` |
| `backgroundVarianceScale` | 0.5-10.0 | 1.0     | `frontend/index.html:223-225`, `frontend/js/main.js:121` |
| `maxBackgrounds`          | 1-5      | 3       | `frontend/index.html:238-240`, `frontend/js/main.js:120` |
| `useDeltaE`               | on/off   | off     | `frontend/index.html:250-253`, `frontend/js/main.js:125` |
| `useSuperpixels`          | on/off   | on      | `frontend/js/main.js:124` (no UI control)           |
| `sortMode`                | percentage / luminance / hue | percentage | `frontend/index.html:83-87`, `frontend/js/main.js:128` |

`hiddenColorThreshold` is passed to the analyzer as `minHiddenPercentage`
(`frontend/js/main.js:173`); the analyzer's own default is `0.01`
(`frontend/js/paletteAnalyzer.js:26`), which only applies when the caller
omits the value.

The `maxHiddenColors` slider carries `value="2"` in the markup
(`frontend/index.html:135`) while the JavaScript default is `3`
(`frontend/js/main.js:110`). The script overwrites the attribute at start-up
(`frontend/js/main.js:260`), so the effective default is `3`.

## Undefined in source

The following are exposed by the UI, documented elsewhere in the project, or
implied by the interface, but have no definition in the code:

- **CIELAB Delta E 2000**. The only colour-difference implementation is the
  Euclidean distance in Lab, i.e. Delta E 1976
  (`frontend/js/colorUtils.js:207-215`). The Chinese README previously listed
  Delta E 2000 as "coming soon"; it is not in the code.
- **ICC colour profiles**. The conversion assumes plain sRGB with a D65 white
  point (`frontend/js/colorUtils.js:77-79`); no ICC profile is read anywhere.
- **Minimum background pixel count**. `minBackgroundPixels` is computed as 5%
  of the image and passed into the background detector
  (`frontend/js/paletteAnalyzer.js:139`), but the detector never reads it
  (`frontend/js/paletteAnalyzer.js:572-576`); the background rule is the edge
  match count alone.
- **K-means convergence threshold**. `convergenceThreshold: 1.0` is set in the
  options object (`frontend/js/paletteAnalyzer.js:98`) but never read; the loop
  exits on an unchanged label array (`frontend/js/paletteAnalyzer.js:430-433`).
- **Screenshots or demo images**. The repository tracks no image asset, so the
  README cannot link one.
