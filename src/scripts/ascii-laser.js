import { laserPuzzle, mirrorEndpoints, traceLaser } from './laser-optics.js';
import { ASCII_GLYPHS, ASCII_COLORS, asciiCell, nearestInk } from './ascii-grid.js';
import { mountTrophy } from './trophy-ascii.js';

// A small scene is sampled on a character grid. Glyphs are cached once per
// size; pointer updates are coalesced into a frame. The puzzle is idle between inputs.
export function mountLaser(host, { onInteraction = () => {} } = {}) {
  if (!host) return { setActive() {}, destroy() {} };
  const output = host.querySelector('canvas'), context = output.getContext('2d', { alpha: false });
  if (!context) return { setActive() {}, destroy() {} };
  const controls = [...host.querySelectorAll('[data-laser-control="mirror"]')];
  const status = host.querySelector('[data-laser-status]'), reset = host.querySelector('[data-laser-control="reset"]');
  const victory = host.querySelector('[data-laser-victory]'), viewTrophy = host.querySelector('[data-laser-control="trophy"]');
  const trophy = mountTrophy(host.querySelector('[data-trophy-canvas]'));
  const controller = new AbortController();
  const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: controller.signal });
  const scene = document.createElement('canvas'), sourceContext = scene.getContext('2d', { willReadFrequently: true });
  const atlas = document.createElement('canvas'), atlasContext = atlas.getContext('2d');
  const initialAngles = [Math.PI / 2, Math.PI / 6];
  let angles = [...initialAngles], won = false, backdropPress = false;
  let active = false, disposed = false, frame = 0, dirtySize = true, drag = null;
  let width = 1, height = 1, columns = 1, rows = 1, cellWidth = 1, cellHeight = 1, ratio = 1;
  let atlasWidth = 1, atlasHeight = 1, coverage, inks, luminance;

  function measure() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight - 44);
    columns = Math.max(28, Math.min(144, Math.floor(width / 6.2)));
    cellWidth = width / columns; rows = Math.max(8, Math.floor(height / (cellWidth * 2)));
    cellHeight = height / rows;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    output.width = Math.round(width * ratio); output.height = Math.round(height * ratio);
    output.style.height = `${height}px`;
    scene.width = columns * 3; scene.height = rows * 3;
    coverage = new Float32Array(columns * rows); inks = new Uint8Array(columns * rows);
    luminance = new Float32Array(columns * rows);
    atlasWidth = Math.ceil(cellWidth * ratio); atlasHeight = Math.ceil(cellHeight * ratio);
    atlas.width = atlasWidth * ASCII_GLYPHS.length; atlas.height = atlasHeight * ASCII_COLORS.length;
    atlasContext.font = `${cellWidth / .6 * ratio}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    atlasContext.textAlign = 'center'; atlasContext.textBaseline = 'middle';
    ASCII_COLORS.forEach((color, colorIndex) => {
      atlasContext.fillStyle = color;
      [...ASCII_GLYPHS].forEach((glyph, glyphIndex) => atlasContext.fillText(glyph,
        (glyphIndex + .5) * atlasWidth, (colorIndex + .5) * atlasHeight));
    });
    dirtySize = false;
  }
  function positionControls(puzzle) {
    controls.forEach((control, index) => {
      const mirror = puzzle.mirrors[index], size = Math.max(44, mirror.radius * 2 + 8);
      control.style.width = `${size}px`; control.style.height = `${size}px`;
      control.style.transform = `translate(${mirror.x - size / 2}px, ${mirror.y - size / 2}px)`;
      const angle = Math.round(((mirror.angle * 180 / Math.PI) % 180 + 180) % 180);
      control.setAttribute('aria-label', `Rotate ${index === 0 ? 'first' : 'second'} mirror, ${angle} degrees`);
    });
  }
  function stroke(segment, color, thickness, alpha = 1) {
    sourceContext.strokeStyle = color; sourceContext.lineWidth = thickness; sourceContext.globalAlpha = alpha;
    sourceContext.beginPath(); sourceContext.moveTo(segment.from.x, segment.from.y);
    sourceContext.lineTo(segment.to.x, segment.to.y); sourceContext.stroke();
  }
  function drawScene(puzzle, trace) {
    sourceContext.setTransform(1, 0, 0, 1, 0, 0); sourceContext.clearRect(0, 0, scene.width, scene.height);
    sourceContext.setTransform(scene.width / width, 0, 0, scene.height / height, 0, 0);
    trace.segments.forEach(segment => stroke(segment, ASCII_COLORS[9], Math.max(4, cellWidth * .8), .85));
    puzzle.walls.forEach(wall => stroke(wall, ASCII_COLORS[1], Math.max(8, cellWidth * 1.2)));
    puzzle.mirrors.forEach(mirror => {
      const [from, to] = mirrorEndpoints(mirror);
      stroke({ from, to }, ASCII_COLORS[0], Math.max(4, cellWidth * .6));
      sourceContext.beginPath(); sourceContext.arc(mirror.x, mirror.y, Math.max(2, cellWidth * .3), 0, Math.PI * 2);
      sourceContext.fillStyle = ASCII_COLORS[0]; sourceContext.fill();
    });
    const light = puzzle.source;
    sourceContext.globalAlpha = 1; sourceContext.strokeStyle = ASCII_COLORS[0]; sourceContext.lineWidth = Math.max(3, cellWidth * .5);
    sourceContext.beginPath(); sourceContext.arc(light.x, light.y, Math.max(9, cellWidth * 1.5), 0, Math.PI * 2);
    sourceContext.globalCompositeOperation = 'destination-out'; sourceContext.fill();
    sourceContext.globalCompositeOperation = 'source-over'; sourceContext.stroke();
    sourceContext.beginPath(); sourceContext.arc(light.x, light.y, Math.max(2.5, cellWidth * .4), 0, Math.PI * 2);
    sourceContext.fillStyle = ASCII_COLORS[0]; sourceContext.fill();
    sourceContext.strokeStyle = trace.hit ? ASCII_COLORS[9] : ASCII_COLORS[1];
    for (const radius of [puzzle.target.radius, puzzle.target.radius * .5]) {
      sourceContext.beginPath(); sourceContext.arc(puzzle.target.x, puzzle.target.y, radius, 0, Math.PI * 2); sourceContext.stroke();
    }
  }
  function sample() {
    const pixels = sourceContext.getImageData(0, 0, scene.width, scene.height).data;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      let alpha = 0, red = 0, green = 0, blue = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const offset = ((y * 3 + sy) * scene.width + x * 3 + sx) * 4, a = pixels[offset + 3];
        alpha += a; red += pixels[offset] * a; green += pixels[offset + 1] * a; blue += pixels[offset + 2] * a;
      }
      const index = y * columns + x;
      coverage[index] = alpha / (9 * 255);
      if (alpha) {
        red /= alpha; green /= alpha; blue /= alpha;
        inks[index] = nearestInk(red, green, blue);
        luminance[index] = (.2126 * red + .7152 * green + .0722 * blue) / 255;
      }
    }
  }
  function render() {
    frame = 0;
    if (!active || disposed || document.hidden) return;
    const start = performance.now();
    if (dirtySize) measure();
    const puzzle = laserPuzzle(width, height, angles), trace = traceLaser(puzzle);
    const newlyWon = trace.hit && !won;
    if (newlyWon) won = true;
    drawScene(puzzle, trace); sample(); positionControls(puzzle);
    if (host.dataset.solved !== String(won)) {
      host.dataset.solved = String(won);
      status.textContent = won ? 'Target reached.' : 'Drag the mirrors to reach the target.';
      viewTrophy.hidden = !won;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
    let drawn = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      if (coverage[index] < .045) continue;
      const at = (dx, dy) => coverage[Math.max(0, Math.min(rows - 1, y + dy)) * columns + Math.max(0, Math.min(columns - 1, x + dx))];
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      const cell = asciiCell(coverage[index], luminance[index], gx, gy);
      if (cell.glyph === ' ') continue;
      context.drawImage(atlas, ASCII_GLYPHS.indexOf(cell.glyph) * atlasWidth, (cell.ink ?? inks[index]) * atlasHeight,
        atlasWidth, atlasHeight, x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      drawn++;
    }
    host.dataset.rendered = 'true';
    if (window.__PORTFOLIO_LASER_PROFILE__) document.dispatchEvent(new CustomEvent('portfolio:laser-frame', {
      detail: { milliseconds: performance.now() - start, columns, rows, drawn, angles: [...angles], hit: trace.hit, won }
    }));
    if (newlyWon) showVictory();
  }
  function requestDraw() {
    if (active && !disposed && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }
  function finishDrag({ cancelled = true } = {}) {
    if (!drag) return;
    const finished = drag; drag = null;
    finished.control.dataset.skipClick = String(finished.moved || cancelled);
    finished.control.removeAttribute('data-dragging');
    if (finished.control.hasPointerCapture(finished.id)) finished.control.releasePointerCapture(finished.id);
  }
  function showVictory() {
    if (!active || !won || victory.open) return;
    onInteraction(); finishDrag(); backdropPress = false;
    victory.showModal(); trophy.start();
  }
  function closeVictory() { if (victory.open) victory.close(); trophy.stop(); backdropPress = false; }
  const outsideVictory = event => {
    const bounds = victory.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  listen(viewTrophy, 'click', showVictory);
  listen(host.querySelector('[data-victory-close]'), 'click', closeVictory);
  listen(victory, 'close', () => { trophy.stop(); backdropPress = false; });
  listen(victory, 'pointerdown', event => { backdropPress = event.target === victory && outsideVictory(event); });
  listen(victory, 'pointercancel', () => { backdropPress = false; });
  listen(victory, 'click', event => {
    // Releasing the mirror drag that won the puzzle must not dismiss its reward.
    if (backdropPress && event.target === victory && outsideVictory(event)) closeVictory();
    backdropPress = false;
  });
  controls.forEach((control, index) => {
    let touchClickUntil = 0;
    listen(control, 'pointerdown', event => {
      if (!active || !event.isPrimary || event.button !== 0 || drag) return;
      event.preventDefault(); event.stopPropagation(); onInteraction();
      if (dirtySize) measure();
      control.dataset.skipClick = 'false';
      drag = { control, id: event.pointerId, index, angle: angles[index], x: event.clientX, y: event.clientY, moved: false };
      control.focus({ preventScroll: true }); control.setPointerCapture(event.pointerId); control.dataset.dragging = '';
    });
    listen(control, 'pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 2;
      angles[drag.index] = drag.angle + (event.clientX - drag.x - event.clientY + drag.y) * Math.PI / 360;
      requestDraw();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => listen(control, type, event => {
      if (drag?.id !== event.pointerId) return;
      event.stopPropagation();
      const tap = type === 'pointerup' && event.pointerType === 'touch' && !drag.moved;
      finishDrag({ cancelled: type !== 'pointerup' });
      if (tap) {
        // Safari suppresses click after the captured pointerdown is cancelled.
        // Handle touch release and ignore a compatibility click on other engines.
        touchClickUntil = performance.now() + 600;
        angles[index] += 5 * Math.PI / 180; requestDraw();
      }
    }));
    listen(control, 'click', event => {
      if (!active || performance.now() < touchClickUntil || (event.detail && control.dataset.skipClick === 'true')) return;
      event.preventDefault(); event.stopPropagation(); onInteraction();
      angles[index] += 5 * Math.PI / 180; requestDraw();
    });
    listen(control, 'keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') touchClickUntil = 0;
      if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); finishDrag(); return; }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction || !active) return;
      event.preventDefault(); event.stopPropagation(); onInteraction();
      angles[index] += (direction[0] || direction[1]) * (event.altKey ? .25 : event.shiftKey ? 5 : 1) * Math.PI / 180;
      requestDraw();
    });
  });
  listen(reset, 'click', () => {
    if (!active) return;
    onInteraction(); finishDrag(); closeVictory(); angles = [...initialAngles]; won = false; requestDraw();
  });
  const resize = new ResizeObserver(() => { finishDrag(); dirtySize = true; requestDraw(); });
  resize.observe(host);
  // A capped-width scene can move without resizing when the viewport changes.
  listen(window, 'resize', () => { finishDrag(); dirtySize = true; requestDraw(); });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { finishDrag(); cancelAnimationFrame(frame); frame = 0; }
    else requestDraw();
  });
  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (active) requestDraw();
      else { finishDrag(); closeVictory(); cancelAnimationFrame(frame); frame = 0; }
    },
    destroy() { disposed = true; finishDrag(); closeVictory(); trophy.destroy(); controller.abort(); resize.disconnect(); cancelAnimationFrame(frame); }
  };
}
