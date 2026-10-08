export const ASCII_GLYPHS = ' .:-=+*#%@/\\|';
export const ASCII_COLORS = ['#151515', '#77777e', '#b4b4ba', '#d65062', '#dc8b48', '#b8a329',
  '#62a271', '#4f9eac', '#5f86cc', '#8b65c2'];
// Output inks share the same indices; sampling still uses the original scene.
export const ASCII_DARK_COLORS = ['#eeedf2', '#b1aabb', '#cbc7d4', '#f07588', '#eab779', '#ebd06b',
  '#83cd98', '#73cad7', '#89aaf3', '#b898ed'];
const rgb = ASCII_COLORS.map(hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)));

export function nearestInk(red, green, blue) {
  let selected = 0, distance = Infinity;
  rgb.forEach((color, i) => {
    const error = (red - color[0]) ** 2 + (green - color[1]) ** 2 + (blue - color[2]) ** 2;
    if (error < distance) { distance = error; selected = i; }
  });
  return selected;
}

export function asciiCell(coverage, luminance, gx = 0, gy = 0, masked = false) {
  // The lettering is an unlit stencil, never a colour sampled from the beam.
  if (masked) return { glyph: '#', ink: 0 };
  if (coverage < .045) return { glyph: ' ', ink: null };
  const density = Math.min(1, coverage * 1.9 * (1 - luminance));
  if (density < .045) return { glyph: ' ', ink: null };
  if (coverage < .6 && Math.hypot(gx, gy) > .35) {
    return { glyph: Math.abs(gx) > Math.abs(gy) * 2.4 ? '|' : Math.abs(gy) > Math.abs(gx) * 2.4 ? '-'
      : gx * gy > 0 ? '/' : '\\', ink: null };
  }
  return { glyph: ASCII_GLYPHS[Math.max(1, Math.min(9, Math.floor(density * 10)))], ink: null };
}

export function logoStencil(columns, rows, centerColumn, centerRow, scale = 1) {
  const letters = [
    '00001000000000',
    '00001000000000',
    '01111001111000',
    '10001010000000',
    '10001001110000',
    '10001000001011',
    '01111011110011'
  ];
  const stencil = new Uint8Array(columns * rows), width = letters[0].length * scale;
  const left = Math.max(0, Math.min(columns - width, Math.round(centerColumn - width / 2)));
  const top = Math.max(0, Math.min(rows - letters.length * scale, Math.round(centerRow - letters.length * scale / 2)));
  letters.forEach((line, y) => [...line].forEach((pixel, x) => {
    if (pixel !== '1') return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const column = left + x * scale + dx, row = top + y * scale + dy;
      if (column < columns && row < rows) stencil[row * columns + column] = 1;
    }
  }));
  return stencil;
}
