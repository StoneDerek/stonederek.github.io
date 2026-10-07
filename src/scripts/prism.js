import { prismVertices, tracePrismRay } from './prism-optics.js';
import { ASCII_GLYPHS, PRISM_COLORS, asciiCell, nearestInk, logoStencil } from './prism-ascii.js';

// A small scene is sampled on a character grid. Glyphs are cached once per
// size; pointer updates are coalesced into a frame, with no idle animation loop.
export function mountPrism(host, { onInteraction = () => {} } = {}) {
  if (!host) return { setActive() {}, destroy() {} };
  const output = host.querySelector('canvas'), context = output.getContext('2d', { alpha: false });
  if (!context) return { setActive() {}, destroy() {} };
  const controls = [...host.querySelectorAll('[data-prism-control]')];
  const controller = new AbortController();
  const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: controller.signal });
  const scene = document.createElement('canvas'), sourceContext = scene.getContext('2d', { willReadFrequently: true });
  const atlas = document.createElement('canvas'), atlasContext = atlas.getContext('2d');
  const objects = { light: { x: .12, y: .6 }, prism: { x: .46, y: .44 } };
  let active = false, disposed = false, frame = 0, dirtySize = true, initialized = false, drag = null;
  let width = 1, height = 1, columns = 1, rows = 1, cellWidth = 1, cellHeight = 1, radius = 1, ratio = 1;
  let atlasWidth = 1, atlasHeight = 1, stencil, coverage, inks, luminance;

  function clampObject(name) {
    const object = objects[name], padding = name === 'prism' ? radius + 8 : 22;
    object.x = Math.max(padding / width, Math.min(1 - padding / width, object.x));
    object.y = Math.max(padding / height, Math.min(1 - padding / height, object.y));
  }
  function measure() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight - 28);
    columns = Math.max(28, Math.min(144, Math.floor(width / 6.2)));
    cellWidth = width / columns; rows = Math.max(8, Math.floor(height / (cellWidth * 2)));
    cellHeight = height / rows; radius = Math.min(width * .17, height * .18, 112);
    ratio = Math.min(2, window.devicePixelRatio || 1);
    output.width = Math.round(width * ratio); output.height = Math.round(height * ratio);
    output.style.height = `${height}px`;
    scene.width = columns * 3; scene.height = rows * 3;
    coverage = new Float32Array(columns * rows); inks = new Uint8Array(columns * rows);
    luminance = new Float32Array(columns * rows);
    stencil = logoStencil(columns, rows, columns * .78, (.44 * height + width * .11) / cellHeight, width >= 600 && rows >= 18 ? 2 : 1);
    if (!initialized) {
      objects.light.y = .44 + width * .124 / height;
      initialized = true;
    }
    Object.keys(objects).forEach(clampObject);
    atlasWidth = Math.ceil(cellWidth * ratio); atlasHeight = Math.ceil(cellHeight * ratio);
    atlas.width = atlasWidth * ASCII_GLYPHS.length; atlas.height = atlasHeight * PRISM_COLORS.length;
    atlasContext.font = `${cellWidth / .6 * ratio}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    atlasContext.textAlign = 'center'; atlasContext.textBaseline = 'middle';
    PRISM_COLORS.forEach((color, colorIndex) => {
      atlasContext.fillStyle = color;
      [...ASCII_GLYPHS].forEach((glyph, glyphIndex) => atlasContext.fillText(glyph,
        (glyphIndex + .5) * atlasWidth, (colorIndex + .5) * atlasHeight));
    });
    dirtySize = false;
  }
  function positionControls() {
    controls.forEach(control => {
      const name = control.dataset.prismControl, object = objects[name];
      const w = name === 'prism' ? Math.max(44, radius * Math.sqrt(3)) : 44;
      const h = name === 'prism' ? Math.max(44, radius * 1.5) : 44;
      control.style.width = `${w}px`; control.style.height = `${h}px`;
      control.style.transform = `translate(${object.x * width - w / 2}px, ${object.y * height - (name === 'prism' ? radius : h / 2)}px)`;
    });
  }
  function stroke(segment, color, thickness, alpha = 1) {
    sourceContext.strokeStyle = color; sourceContext.lineWidth = thickness; sourceContext.globalAlpha = alpha;
    sourceContext.beginPath(); sourceContext.moveTo(segment.from.x, segment.from.y);
    sourceContext.lineTo(segment.to.x, segment.to.y); sourceContext.stroke();
  }
  function drawScene() {
    sourceContext.setTransform(1, 0, 0, 1, 0, 0); sourceContext.clearRect(0, 0, scene.width, scene.height);
    sourceContext.setTransform(scene.width / width, 0, 0, scene.height / height, 0, 0);
    const light = { x: objects.light.x * width, y: objects.light.y * height };
    const center = { x: objects.prism.x * width, y: objects.prism.y * height };
    const vertices = prismVertices(center, radius), direction = { x: center.x - light.x, y: center.y - light.y };
    const reach = Math.hypot(width, height) * 3, beamWidth = Math.max(8, cellHeight * .8);
    const wavelengths = [.70, .63, .58, .53, .49, .45, .40];
    wavelengths.forEach((wavelength, i) => {
      // Illustrative Cauchy dispersion, not a calibrated material model.
      const segments = tracePrismRay(light, direction, vertices, 1.46 + .016 / wavelength ** 2, reach);
      segments.forEach((segment, j) => {
        if (!j) { if (i === 3) stroke(segment, PRISM_COLORS[1], beamWidth, .6); }
        else stroke(segment, segment.inside ? PRISM_COLORS[2] : PRISM_COLORS[i + 3],
          segment.inside ? beamWidth * .4 : beamWidth, segment.inside ? .4 : .8);
      });
    });
    sourceContext.globalAlpha = .075; sourceContext.fillStyle = '#77777e';
    sourceContext.beginPath(); vertices.forEach((vertex, i) => i ? sourceContext.lineTo(vertex.x, vertex.y) : sourceContext.moveTo(vertex.x, vertex.y));
    sourceContext.closePath(); sourceContext.fill();
    sourceContext.globalAlpha = 1; sourceContext.strokeStyle = PRISM_COLORS[0]; sourceContext.lineWidth = Math.max(3, cellWidth * .5); sourceContext.stroke();
    sourceContext.beginPath(); sourceContext.arc(light.x, light.y, Math.max(9, cellWidth * 1.5), 0, Math.PI * 2);
    sourceContext.globalCompositeOperation = 'destination-out'; sourceContext.fill();
    sourceContext.globalCompositeOperation = 'source-over'; sourceContext.stroke();
    sourceContext.beginPath(); sourceContext.arc(light.x, light.y, Math.max(2.5, cellWidth * .4), 0, Math.PI * 2);
    sourceContext.fillStyle = PRISM_COLORS[0]; sourceContext.fill();
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
    drawScene(); sample(); positionControls();
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
    let drawn = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      if (!stencil[index] && coverage[index] < .045) continue;
      const at = (dx, dy) => coverage[Math.max(0, Math.min(rows - 1, y + dy)) * columns + Math.max(0, Math.min(columns - 1, x + dx))];
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      const cell = asciiCell(coverage[index], luminance[index], gx, gy, Boolean(stencil[index]));
      if (cell.glyph === ' ') continue;
      context.drawImage(atlas, ASCII_GLYPHS.indexOf(cell.glyph) * atlasWidth, (cell.ink ?? inks[index]) * atlasHeight,
        atlasWidth, atlasHeight, x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      drawn++;
    }
    host.dataset.rendered = 'true';
    if (window.__PORTFOLIO_PRISM_PROFILE__) document.dispatchEvent(new CustomEvent('portfolio:prism-frame', {
      detail: { milliseconds: performance.now() - start, columns, rows, drawn }
    }));
  }
  function requestDraw() {
    if (active && !disposed && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }
  function finishDrag() {
    if (!drag) return;
    const finished = drag; drag = null;
    finished.control.removeAttribute('data-dragging');
    if (finished.control.hasPointerCapture(finished.id)) finished.control.releasePointerCapture(finished.id);
  }
  controls.forEach(control => {
    listen(control, 'pointerdown', event => {
      if (!active || !event.isPrimary || event.button !== 0 || drag) return;
      event.preventDefault(); event.stopPropagation(); onInteraction();
      if (dirtySize) measure();
      const rect = host.getBoundingClientRect(), object = objects[control.dataset.prismControl];
      drag = { control, id: event.pointerId, rect,
        offsetX: (event.clientX - rect.left) / width - object.x,
        offsetY: (event.clientY - rect.top) / height - object.y };
      control.focus({ preventScroll: true }); control.setPointerCapture(event.pointerId); control.dataset.dragging = '';
    });
    listen(control, 'pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const object = objects[control.dataset.prismControl];
      object.x = (event.clientX - drag.rect.left) / width - drag.offsetX;
      object.y = (event.clientY - drag.rect.top) / height - drag.offsetY;
      clampObject(control.dataset.prismControl); requestDraw();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => listen(control, type, event => {
      if (drag?.id === event.pointerId) { event.stopPropagation(); finishDrag(); }
    }));
    listen(control, 'keydown', event => {
      if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); finishDrag(); return; }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction || !active) return;
      event.preventDefault(); event.stopPropagation(); onInteraction();
      const object = objects[control.dataset.prismControl], distance = event.shiftKey ? 24 : 8;
      object.x += direction[0] * distance / width; object.y += direction[1] * distance / height;
      clampObject(control.dataset.prismControl); requestDraw();
    });
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
      else { finishDrag(); cancelAnimationFrame(frame); frame = 0; }
    },
    destroy() { disposed = true; finishDrag(); controller.abort(); resize.disconnect(); cancelAnimationFrame(frame); }
  };
}
