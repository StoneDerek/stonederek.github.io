import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Deterministic technical illustrations. These are neither project results nor
// generated photographs. Keep the editable SVGs alongside the numerical code.
const root = fileURLToPath(new URL('../', import.meta.url));
const source = `${root}src/assets/project-covers`;
await mkdir(source, { recursive: true });
const W = 1920, H = 1200;
const random = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const text = (x, y, content, size = 19, fill = '#80616c', extra = '') =>
  `<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" fill="${fill}" ${extra}>${content}</text>`;
const svg = (body, background) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${background}"/>${body}</svg>`;
const line = (x1, y1, x2, y2, stroke, width = 1, extra = '') =>
  `<path d="M${x1},${y1}L${x2},${y2}" stroke="${stroke}" stroke-width="${width}" fill="none" ${extra}/>`;
const rect = (x, y, w, h, fill, stroke = 'none', radius = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;

async function save(name, content) {
  await writeFile(`${source}/${name}.svg`, content);
  const input = Buffer.from(content);
  await sharp(input).webp({ quality: 94 }).toFile(`${root}public/art/${name}.webp`);
  await sharp(input).resize(320, 200).webp({ quality: 87 }).toFile(`${root}public/thumbnails/${name}.webp`);
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < size / 2; j++) {
        const wr = Math.cos(angle * j), wi = Math.sin(angle * j);
        const a = start + j, b = a + size / 2;
        const tr = wr * re[b] - wi * im[b], ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

async function acoustic() {
  const rng = random(416), fs = 8192, seconds = 8, n = 1024, hop = 72;
  const audio = new Float64Array(fs * seconds);
  let phase = 0;
  for (let i = 0; i < audio.length; i++) {
    const t = i / fs;
    const fundamental = 171 + 9 * Math.sin(t * 1.3) + 17 / (1 + Math.exp(-(t - 3.6) * 8));
    phase += 2 * Math.PI * fundamental / fs;
    let value = (rng() - .5) * .48;
    for (let h = 1; h <= 20; h++) {
      value += Math.sin(phase * h + .15 * Math.sin(t * 13 + h)) / Math.pow(h, .72)
        * (.77 + .23 * Math.sin(2 * Math.PI * t * 37 + h * .3));
    }
    audio[i] = value;
  }
  const cols = Math.floor((audio.length - n) / hop) + 1, rows = n / 2;
  const powers = new Float64Array(cols * rows);
  let peak = -Infinity;
  for (let x = 0; x < cols; x++) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let j = 0; j < n; j++) re[j] = audio[x * hop + j] * (.5 - .5 * Math.cos(2 * Math.PI * j / (n - 1)));
    fft(re, im);
    for (let y = 0; y < rows; y++) {
      const db = 10 * Math.log10(re[y] ** 2 + im[y] ** 2 + 1e-10);
      powers[(rows - 1 - y) * cols + x] = db;
      peak = Math.max(peak, db);
    }
  }
  const stops = [[16, 13, 23], [38, 19, 36], [72, 25, 49], [111, 38, 58], [146, 53, 65]];
  const pixels = Buffer.alloc(cols * rows * 3);
  for (let i = 0; i < powers.length; i++) {
    const value = Math.max(0, Math.min(1, (powers[i] - peak + 63) / 63));
    const scaled = value * (stops.length - 1), a = Math.min(stops.length - 2, Math.floor(scaled)), t = scaled - a;
    for (let c = 0; c < 3; c++) pixels[i * 3 + c] = Math.round(stops[a][c] * (1 - t) + stops[a + 1][c] * t);
  }
  const heatmap = await sharp(pixels, { raw: { width: cols, height: rows, channels: 3 } }).png().toBuffer();
  let body = `<image x="115" y="120" width="1690" height="920" preserveAspectRatio="none" href="data:image/png;base64,${heatmap.toString('base64')}"/>`;
  for (let k = 0; k <= 8; k++) {
    const x = 115 + k * 1690 / 8;
    body += line(x, 120, x, 1040, '#77505c', 1, 'opacity=".22"');
    body += text(x, 1080, `${k}.0`, 17, '#8c626d', 'text-anchor="middle"');
  }
  for (let k = 0; k <= 4; k++) {
    const y = 1040 - k * 230;
    body += line(115, y, 1805, y, '#77505c', 1, 'opacity=".22"');
    body += text(92, y + 6, `${k}`, 17, '#8c626d', 'text-anchor="end"');
  }
  body += text(115, 87, 'SHORT-TIME FOURIER TRANSFORM', 18, '#946a76');
  body += text(1805, 87, 'SYNTHETIC HARMONIC AUDIO', 18, '#946a76', 'text-anchor="end"');
  body += text(64, 101, 'kHz', 16, '#946a76');
  body += text(1805, 1116, 'TIME / s', 16, '#946a76', 'text-anchor="end"');
  body += rect(115, 120, 1690, 920, 'none', '#54333f');
  await save('acoustic-drone-detection', svg(body, '#100d17'));
}

async function advising() {
  const paper = '#edf2f6', blue = '#5c7d99', rule = '#bacbd8';
  let body = '';
  // Fine drafting marks, rather than the texture of a fabricated photograph.
  for (let x = 96; x < W; x += 48) for (let y = 96; y < H; y += 48) body += `<circle cx="${x}" cy="${y}" r=".85" fill="#d8e2e9"/>`;
  const doc = (x, y, title, tag) => {
    let s = rect(x + 11, y + 12, 340, 236, '#e2eaf0', rule, 3) + rect(x, y, 340, 236, '#f4f7f9', rule, 3);
    s += text(x + 25, y + 36, tag, 13, blue);
    s += text(x + 25, y + 79, title, 20, '#486983');
    s += line(x + 25, y + 99, x + 315, y + 99, rule);
    for (let i = 0; i < 4; i++) s += rect(x + 25, y + 121 + i * 23, [250, 278, 215, 245][i], 4, '#c6d5e1');
    return s;
  };
  body += text(170, 102, 'RETRIEVAL-AUGMENTED GENERATION', 18, blue);
  body += text(1750, 102, 'CONCEPT / SOURCE → RESPONSE', 17, blue, 'text-anchor="end"');
  body += doc(396, 166, 'Course catalog', '01 / SOURCE');
  body += doc(790, 141, 'Degree requirements', '02 / SOURCE');
  body += doc(1184, 166, 'Academic policies', '03 / SOURCE');
  // Route connectors around the central caption, leaving the canvas itself clear.
  body += `<g fill="none" stroke="${rule}" stroke-width="2"><path d="M566 421V450H1354V421"/><path d="M960 390V450H315V761H602V810"/></g>`;
  body += `<path d="m595 798 7 12 7-12" fill="${rule}"/>`;
  body += rect(377, 810, 450, 249, '#e4edf3', rule, 4);
  body += text(405, 850, 'RETRIEVED CONTEXT', 16, blue);
  for (let i = 0; i < 3; i++) {
    body += rect(404, 873 + i * 53, 395, 38, '#f4f7f9', '#c5d5e1', 2);
    body += text(420, 898 + i * 53, `0${i + 1} / Relevant source passage`, 16, blue);
  }
  body += line(839, 935, 1074, 935, '#9bb4c8', 2);
  body += `<path d="m1061 929 13 6-13 6" fill="none" stroke="#9bb4c8" stroke-width="2"/>`;
  body += text(960, 912, 'GROUNDING', 13, blue, 'text-anchor="middle"');
  body += rect(1094, 810, 450, 249, '#f6f8fa', rule, 4);
  body += text(1122, 850, 'ANSWER + CITATIONS', 16, blue);
  body += rect(1122, 883, 394, 63, '#e3edf4', 'none', 4);
  body += text(1140, 910, 'Which courses should', 18, '#486983');
  body += text(1140, 934, 'I consider next?', 18, '#486983');
  for (let i = 0; i < 3; i++) body += rect(1122, 970 + i * 17, [360, 394, 278][i], 4, '#c6d5e1');
  body += text(170, 1126, 'DOCUMENTS → RETRIEVAL → GROUNDED ANSWER', 17, blue);
  body += text(1750, 1126, 'PLANNED WORKFLOW', 16, blue, 'text-anchor="end"');
  await save('academic-advising-rag', svg(body, paper));
}

async function lightning() {
  const rng = random(3127), nx = 161, ny = 105, count = nx * ny;
  const phi = new Float64Array(count), occupied = new Uint8Array(count), parents = new Int32Array(count).fill(-1);
  const frontier = new Set(), order = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) phi[y * nx + x] = y / (ny - 1);
  const neighbors = i => [i - nx, i + 1, i + nx, i - 1].filter(j => j > nx && j < count - nx && j % nx > 1 && j % nx < nx - 2);
  function add(i, parent = -1) {
    occupied[i] = 1; phi[i] = 0; parents[i] = parent; order.push(i); frontier.delete(i);
    for (const j of neighbors(i)) if (!occupied[j]) frontier.add(j);
  }
  add(nx * 2 + Math.floor(nx / 2));
  // A small potential-weighted lattice-growth demonstration: grounded growing
  // cluster, fixed top/bottom electrodes, linear side boundaries, eta = 1.2.
  for (let step = 0; step < 1650; step++) {
    for (let sweep = 0; sweep < (step === 0 ? 180 : 26); sweep++) {
      for (let parity = 0; parity < 2; parity++) {
        for (let y = 1; y < ny - 1; y++) for (let x = 1 + ((y + parity) & 1); x < nx - 1; x += 2) {
          const i = y * nx + x;
          if (!occupied[i]) phi[i] = .25 * (phi[i - 1] + phi[i + 1] + phi[i - nx] + phi[i + nx]);
        }
      }
    }
    const candidates = [...frontier], weights = candidates.map(i => Math.max(1e-15, phi[i] ** 1.2));
    let choice = rng() * weights.reduce((a, b) => a + b, 0), chosen = candidates.at(-1);
    for (let k = 0; k < candidates.length; k++) { choice -= weights[k]; if (choice <= 0) { chosen = candidates[k]; break; } }
    const attached = neighbors(chosen).filter(i => occupied[i]);
    add(chosen, attached[Math.floor(rng() * attached.length)]);
    if (Math.floor(chosen / nx) >= ny - 4) break;
  }
  const cell = 9.6, left = (W - (nx - 1) * cell) / 2, top = 100;
  const point = i => [left + i % nx * cell, top + Math.floor(i / nx) * cell];
  let body = '';
  // All plotted tones stay below the title's brightness. No bloom or glow.
  for (let y = 1; y < ny - 1; y += 3) for (let x = 1; x < nx - 1; x += 3) {
    const v = phi[y * nx + x], c = [18, 24, 17].map((base, k) => Math.round(base + v * [15, 20, 11][k]));
    body += rect(left + x * cell - 2, top + y * cell - 2, 4, 4, `rgb(${c.join(',')})`);
  }
  for (let k = 0; k <= 8; k++) {
    const y = top + k * 1000 / 8;
    body += line(left, y, W - left, y, '#243021', 1, 'stroke-dasharray="2 10"');
  }
  const visits = new Uint16Array(count);
  for (const i of order.toReversed()) { visits[i]++; if (parents[i] >= 0) visits[parents[i]] += visits[i]; }
  for (const i of order) {
    if (parents[i] < 0) continue;
    const [x, y] = point(i), [px, py] = point(parents[i]);
    const main = visits[i] > 25;
    body += line(px, py, x, y, main ? '#4a5635' : '#39492d', main ? 3.4 : 1.6, 'stroke-linecap="square"');
    if (!main && visits[i] === 1) body += rect(x - 1.4, y - 1.4, 2.8, 2.8, '#4a5635');
  }
  body += line(left, top, W - left, top, '#566343', 2);
  body += line(left, 1100, W - left, 1100, '#566343', 2);
  body += text(left, 73, 'POTENTIAL-WEIGHTED LATTICE GROWTH', 18, '#6d775b');
  body += text(W - left, 73, '2D / ILLUSTRATIVE RUN', 18, '#6d775b', 'text-anchor="end"');
  body += text(left, 1141, 'FIXED ELECTRODES · STOCHASTIC GROWTH', 16, '#6d775b');
  body += text(W - left, 1141, `η = 1.2 / ${order.length} CELLS`, 16, '#6d775b', 'text-anchor="end"');
  await save('lightning-potential-model', svg(body, '#0e140d'));
  console.log(`Lattice demonstration: ${order.length} cells, final y = ${Math.floor(order.at(-1) / nx)}.`);
}

await acoustic();
await advising();
await lightning();

const projects = JSON.parse(await readFile(`${root}src/data/projects.json`, 'utf8'));
const luminance = rgb => rgb.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  .reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
const hex = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
for (const project of projects.slice(0, 3)) {
  const { data, info } = await sharp(`${root}public/${project.image}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const fg = luminance(hex(project.palette.accent));
  let min = Infinity;
  // A generous central rectangle around the centered caption, including its
  // smaller method line. Axes and corner annotations sit outside this region.
  for (let y = H * .42; y < H * .58; y++) for (let x = W * .2; x < W * .8; x++) {
    const offset = (y * info.width + x) * info.channels;
    const bg = luminance([...data.subarray(offset, offset + 3)]);
    min = Math.min(min, (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05));
  }
  console.log(`${project.slug}: minimum title/image contrast ${min.toFixed(2)}:1`);
  if (min < 4.5) throw new Error(`Insufficient title contrast for ${project.slug}`);
}
