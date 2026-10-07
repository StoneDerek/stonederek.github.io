// The reward has its own small renderer, so spinning it never redraws the puzzle.
export function mountTrophy(canvas) {
  const context = canvas.getContext('2d', { alpha: false });
  const source = document.createElement('canvas'), paint = source.getContext('2d', { willReadFrequently: true });
  if (!context || !paint) return { start() {}, stop() {}, destroy() {} };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController(), faces = [];
  const face = (points, shade = 1) => faces.push({ points, shade });
  const segments = 24;
  const ring = (radius, y, i) => [radius * Math.cos(i * Math.PI * 2 / segments), y, radius * Math.sin(i * Math.PI * 2 / segments)];
  const bands = [[.82, -.8], [.7, -.35], [.26, .2], [.09, .28], [.09, .82], [.32, .82]];
  for (let band = 0; band < bands.length - 1; band++) for (let i = 0; i < segments; i++) {
    const [r1, y1] = bands[band], [r2, y2] = bands[band + 1];
    face([ring(r1, y1, i), ring(r1, y1, i + 1), ring(r2, y2, i + 1), ring(r2, y2, i)]);
  }
  face(Array.from({ length: segments }, (_, i) => ring(.68, -.8, i)), .1);
  for (let i = 0; i < segments; i++) {
    face([ring(.82, -.8, i), ring(.82, -.8, i + 1), ring(.68, -.8, i + 1), ring(.68, -.8, i)]);
  }
  for (const side of [-1, 1]) for (let i = 0; i < segments; i++) {
    const handle = (inset, index) => {
      const angle = index * Math.PI * 2 / segments;
      return [side * (1 + (.35 - inset) * Math.cos(angle)), -.3 + (.42 - inset) * Math.sin(angle), 0];
    };
    face([handle(0, i), handle(0, i + 1), handle(.12, i + 1), handle(.12, i)]);
  }
  const base = (x, y, z) => [x * .55, y, z * .38];
  face([base(-1, .82, -1), base(1, .82, -1), base(1, .82, 1), base(-1, .82, 1)]);
  for (const side of [-1, 1]) {
    face([base(side, .82, -1), base(side, .82, 1), base(side, 1.05, 1), base(side, 1.05, -1)]);
    face([base(-1, .82, side), base(1, .82, side), base(1, 1.05, side), base(-1, 1.05, side)]);
  }
  let active = false, frame = 0, started = 0, dirtySize = true;
  let width = 1, height = 1, columns = 1, rows = 1, cellWidth = 1, cellHeight = 1, ratio = 1;
  function measure() {
    width = Math.max(1, canvas.clientWidth); height = Math.max(1, canvas.clientHeight);
    columns = Math.max(28, Math.min(64, Math.floor(width / 4)));
    cellWidth = width / columns; rows = Math.max(8, Math.floor(height / (cellWidth * 2))); cellHeight = height / rows;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    source.width = columns * 3; source.height = rows * 3; dirtySize = false;
  }
  function render(now) {
    frame = 0;
    if (!active || document.hidden) return;
    const begin = performance.now();
    if (dirtySize) measure();
    const progress = reducedMotion.matches ? 1 : Math.min(1, (now - started) / 2400);
    const angle = .22 + Math.PI * 4 * (1 - (1 - progress) ** 3), c = Math.cos(angle), s = Math.sin(angle);
    const scale = Math.min(width * .29, height * .39);
    const project = ([x, y, z]) => {
      const rx = x * c + z * s, rz = z * c - x * s;
      return { x: width / 2 + rx * scale, y: height * .46 + (y + rz * .28) * scale, depth: rz - y * .28, rx, rz };
    };
    paint.setTransform(source.width / width, 0, 0, source.height / height, 0, 0);
    paint.clearRect(0, 0, width, height);
    const polygons = faces.map(({ points, shade }) => {
      const projected = points.map(project), average = key => projected.reduce((sum, point) => sum + point[key], 0) / projected.length;
      const lighting = shade * (.72 + .28 * Math.max(-1, Math.min(1, average('rx') * -.3 + average('rz') * .9)));
      return { projected, depth: average('depth'), lighting };
    }).sort((a, b) => a.depth - b.depth);
    for (const { projected, lighting } of polygons) {
      paint.fillStyle = `rgb(${245 * lighting}, ${190 * lighting}, ${60 * lighting})`;
      paint.beginPath(); projected.forEach((point, i) => i ? paint.lineTo(point.x, point.y) : paint.moveTo(point.x, point.y));
      paint.closePath(); paint.fill();
    }
    const pixels = paint.getImageData(0, 0, source.width, source.height).data, glyphs = ' .:-=+*#%@';
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.fillStyle = '#080808'; context.fillRect(0, 0, width, height);
    context.font = `${cellWidth / .6}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    context.textAlign = 'left'; context.textBaseline = 'middle'; context.fillStyle = '#ffd36e';
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < columns; x++) {
        let density = 0;
        for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
          const offset = ((y * 3 + sy) * source.width + x * 3 + sx) * 4;
          const brightness = (.2126 * pixels[offset] + .7152 * pixels[offset + 1] + .0722 * pixels[offset + 2]) / 255;
          density += pixels[offset + 3] / 255 * Math.max(0, (brightness - .1) / .72);
        }
        line += glyphs[Math.max(0, Math.min(9, Math.round(density)))];
      }
      context.fillText(line, 0, (y + .5) * cellHeight);
    }
    if (window.__PORTFOLIO_LASER_PROFILE__) document.dispatchEvent(new CustomEvent('portfolio:trophy-frame', {
      detail: { milliseconds: performance.now() - begin, progress }
    }));
    if (progress < 1) requestDraw();
  }
  function requestDraw() { if (active && !document.hidden && !frame) frame = requestAnimationFrame(render); }
  function stop() { active = false; cancelAnimationFrame(frame); frame = 0; }
  const resize = new ResizeObserver(() => { dirtySize = true; requestDraw(); }); resize.observe(canvas);
  reducedMotion.addEventListener('change', requestDraw, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestDraw();
  }, { signal: controller.signal });
  return {
    start() { active = true; dirtySize = true; started = performance.now(); requestDraw(); },
    stop,
    destroy() { stop(); controller.abort(); resize.disconnect(); }
  };
}
