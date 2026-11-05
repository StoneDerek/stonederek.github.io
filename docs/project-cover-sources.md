# Temporary project cover sources

These covers use the screenshots supplied for the portfolio. The source PNGs remain untouched and are not included in public assets. Coordinates are zero-based pixels in the source image; right and bottom crop bounds are exclusive.

| Project cover | Supplied source filename | Source size | Crop: left, top, width, height | Published cover size |
| --- | --- | --- | --- | --- |
| `acoustic-drone-detection-spectrogram.webp` | `Screenshot 2026-09-29 234350.png` | 676 × 278 | 27, 50, 288, 216 | 288 × 216 |
| `rag-advising-response.webp` | `Screenshot 2026-09-29 233900.png` | 993 × 223 | 0, 0, 993, 223 | 996 × 747 |
| `lightning-simulation-canvas.webp` | `Screenshot 2026-10-21 095802.png` | 2048 × 885 | 430, 120, 792, 594 | 792 × 594 |

- The acoustic cover is a close crop of the original spectrogram panel. The prediction heading and separate Grad-CAM overlay are outside the crop.
- The lightning cover is a close crop of the central simulation canvas. Surrounding controls, chart, and borders are outside the crop.
- The RAG response is retained in full at its original pixel size. It is placed at (1, 262) on a 996 × 747 canvas using the exact source background RGB (44, 44, 46), or `#2c2c2e`. No text is removed, retyped, or generated.
- Main covers are lossless WebP with no scaling, color adjustments, or sharpening. Their decoded RGB pixels were verified against the exact source crops/reframe.
- Matching 240 × 180 thumbnails are downsampled from these covers with Lanczos and saved as lossless WebP.
- The screenshots are temporary visual samples. They do not add measured-performance claims to the project descriptions.

Covers: `public/art/project-screenshots/`. Thumbnails: `public/thumbnails/project-screenshots/`.

| Source filename | SHA-256 |
| --- | --- |
| `Screenshot 2026-09-29 234350.png` | `c68773d34fe1910d8cd509bdb7b9fcde87ef09e0d2c5ef297d65e8ba7a987ad5` |
| `Screenshot 2026-09-29 233900.png` | `2f641a310ebcdbe6436afc2a8754c25750b46f0f6ae0a53d9a849d1c93a44db8` |
| `Screenshot 2026-10-21 095802.png` | `79ba2358053e67dd362082a86fb116ff7c5f215f60f26ee7b1dce719aeb2979d` |
