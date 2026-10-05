const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => 1 - (1 - value) ** 3;
const offsets = [[-14, -10], [13, -12], [-12, 13], [14, 10]];
const round = value => Math.round(value * 100) / 100;
const frameInterval = 1000 / 60;

// Keep phone tiles at 24px and bound the mask work on larger displays.
export function createTileCells(width, height, origin = { x: .5, y: .5 }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  const xOrigin = Number.isFinite(origin.x) ? clamp(origin.x) : .5;
  const yOrigin = Number.isFinite(origin.y) ? clamp(origin.y) : .5;
  let size = Math.max(24, Math.ceil(Math.sqrt(width * height / 1400)));
  while (Math.ceil(width / size) * Math.ceil(height / size) > 1400) size++;
  const farthest = Math.max(...[[0, 0], [0, 1], [1, 0], [1, 1]]
    .map(([x, y]) => Math.hypot(x - xOrigin, y - yOrigin)));
  const cells = [];
  for (let y = 0, row = 0; y < height; y += size, row++) {
    for (let x = 0, col = 0; x < width; x += size, col++) {
      const w = Math.min(size, width - x);
      const h = Math.min(size, height - y);
      const distance = Math.hypot((x + w / 2) / width - xOrigin, (y + h / 2) / height - yOrigin) / farthest;
      const order = clamp(distance + ((col * 7 + row * 13) % 5) * .012);
      cells.push({ x, y, w, h, order, group: Math.min(3, Math.floor(order * 4)) });
    }
  }
  return cells;
}

// Precompute geometry once. Full-size neighbors have the same rectangular
// union as one row segment, so only the moving tiles need individual paths.
export function createTileMask(cells, { opening, travel, duration }) {
  const rows = [];
  let row;
  let firstStart = Infinity;
  let lastEnd = 0;
  for (const cell of cells) {
    if (!row || row.y !== cell.y) {
      row = { y: cell.y, cells: [] };
      rows.push(row);
    }
    const start = (opening ? cell.order : 1 - cell.order) * travel;
    const [offsetX, offsetY] = offsets[cell.group];
    row.cells.push({ ...cell, start, end: start + duration, offsetX, offsetY,
      fullX: round(cell.x - .3), fullY: round(cell.y - .3),
      fullW: round(cell.w + .6), fullH: round(cell.h + .6) });
    firstStart = Math.min(firstStart, start);
    lastEnd = Math.max(lastEnd, start + duration);
  }
  return elapsed => {
    if (opening ? elapsed <= firstStart : elapsed >= lastEnd) return '';
    const paths = [];
    for (const row of rows) {
      let first = null;
      let last = null;
      const flush = () => {
        if (!first) return;
        const w = round(last.fullX + last.fullW - first.fullX);
        paths.push(`M${first.fullX} ${first.fullY}h${w}v${first.fullH}h${-w}Z`);
        first = last = null;
      };
      for (const cell of row.cells) {
        const full = opening ? elapsed >= cell.end : elapsed <= cell.start;
        if (full) { first ||= cell; last = cell; continue; }
        flush();
        if (opening ? elapsed <= cell.start : elapsed >= cell.end) continue;
        const progress = ease((elapsed - cell.start) / duration);
        const scale = opening ? progress : 1 - progress;
        const w = (cell.w + .6) * scale;
        const h = (cell.h + .6) * scale;
        const roundedW = round(w);
        const roundedH = round(h);
        if (roundedW <= 0 || roundedH <= 0) continue;
        // Move the mask over one stationary article, preserving aligned text.
        const shift = 1 - scale;
        const x = cell.x + (cell.w - w) / 2 + cell.offsetX * shift;
        const y = cell.y + (cell.h - h) / 2 + cell.offsetY * shift;
        paths.push(`M${round(x)} ${round(y)}h${roundedW}v${roundedH}h${-roundedW}Z`);
      }
      flush();
    }
    return paths.join(' ');
  };
}

export function settleTiles(root, page, { opening, origin, scrollTop = 0, signal, reducedMotion = false } = {}) {
  if (reducedMotion || signal?.aborted || globalThis.document?.hidden || !globalThis.CSS?.supports('clip-path', 'path("M0 0H1V1H0Z")')) {
    return Promise.resolve();
  }
  const travel = opening ? 420 : 240;
  const duration = opening ? 250 : 180;
  const total = travel + duration;
  const originalOpacity = page.style.opacity;
  const originalVisibility = page.style.visibility;

  return new Promise(resolve => {
    const layers = [];
    let frame = 0;
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      signal?.removeEventListener('abort', cleanup);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      layers.forEach(({ element }) => element.remove());
      page.style.opacity = originalOpacity;
      page.style.visibility = originalVisibility;
      resolve();
    };
    const onVisibilityChange = () => { if (document.hidden) cleanup(); };
    try {
      // Conceal the source before any layout reads or snapshot mounting. It still
      // participates in layout, so the copy can keep the exact article geometry.
      page.style.visibility = 'hidden';
      const width = document.documentElement.clientWidth;
      const height = page.parentElement.clientHeight;
      const cells = createTileCells(width, height, origin);
      if (!cells.length) { cleanup(); return; }
      const tileMask = createTileMask(cells, { opening, travel, duration });
      const bounds = page.getBoundingClientRect();
      const pageHeight = page.scrollHeight;
      const element = document.createElement('div');
      element.className = 'project-tile-layer';
      element.setAttribute('aria-hidden', 'true');
      element.inert = true;
      const copy = page.cloneNode(true);
      copy.style.visibility = 'visible';
      copy.style.opacity = originalOpacity;
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      copy.style.top = `${-scrollTop}px`;
      copy.style.left = `${bounds.left}px`;
      copy.style.width = `${bounds.width}px`;
      copy.style.minHeight = `${pageHeight}px`;
      element.append(copy);
      layers.push({ element });
      let wasVisible;
      const draw = elapsed => {
        // A degenerate path can briefly leave a new layer unclipped. Use simple
        // inset clips for empty/full initial states, and mount an opening hidden.
        const full = !opening && elapsed === 0;
        const path = full ? '' : tileMask(elapsed);
        const visible = full || Boolean(path);
        element.style.clipPath = full ? 'inset(0)'
          : visible ? `path("${path}")` : 'inset(50%)';
        if (visible !== wasVisible) {
          element.hidden = !visible;
          element.style.visibility = visible ? 'visible' : 'hidden';
          wasVisible = visible;
        }
      };
      draw(0);
      layers.forEach(({ element }) => root.append(element));
      page.style.opacity = '0';
      signal?.addEventListener('abort', cleanup, { once: true });
      document.addEventListener('visibilitychange', onVisibilityChange);
      const start = performance.now();
      let nextDrawAt = frameInterval;
      const tick = now => {
        if (finished) return;
        try {
          const elapsed = now - start;
          if (elapsed >= total) { cleanup(); return; }
          // Keep the expensive mask at 60 updates/sec on high-refresh displays.
          // Use wall-clock time so skipped frames never extend the transition.
          if (elapsed + .5 >= nextDrawAt) {
            draw(elapsed);
            nextDrawAt = (Math.floor((elapsed + .5) / frameInterval) + 1) * frameInterval;
          }
          frame = requestAnimationFrame(tick);
        } catch { cleanup(); }
      };
      frame = requestAnimationFrame(tick);
    } catch { cleanup(); }
  });
}
