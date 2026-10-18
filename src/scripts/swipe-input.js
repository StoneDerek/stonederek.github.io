// Touch Events keep ownership explicit inside native reading scrollers. Pointer
// Events still handle mouse/pen and browsers without a native touch event path.
export function mountSwipeInput(surface, { start, move, end, signal, nativeTouch = 'ontouchstart' in window }) {
  const listen = (type, handler, options = {}) => surface.addEventListener(type, handler, { ...options, signal });
  let touch = null;
  const sample = point => ({
    isPrimary: true, button: 0, pointerType: 'touch', nativeTouch: true,
    pointerId: `touch-${point.identifier}`, target: touch.target,
    clientX: point.clientX, clientY: point.clientY
  });
  const cancel = () => {
    if (!touch) return;
    const last = sample(touch.last);
    touch = null;
    end(last, true);
  };
  const advance = (event, point) => {
    const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
    if (!touch.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
      touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (touch.axis === 'y') { cancel(); return; }
    if (touch.axis !== 'x') return;
    // This must happen during dispatch, before a scrollable ancestor takes the
    // gesture. Waiting for the render frame is too late on mobile Safari.
    if (!event.cancelable) { cancel(); return; }
    event.preventDefault();
    touch.last = point;
    move({ ...sample(point), axis: 'x' });
  };

  listen('pointerdown', event => {
    if (!nativeTouch || event.pointerType !== 'touch') start(event);
  });
  listen('pointermove', event => {
    if (!nativeTouch || event.pointerType !== 'touch') move(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(type, event => {
      if (!nativeTouch || event.pointerType !== 'touch') end(event, type !== 'pointerup');
    });
  }
  if (nativeTouch) {
    listen('touchstart', event => {
      if (event.touches.length !== 1) { cancel(); return; }
      if (touch) return;
      const point = event.touches[0];
      touch = { id: point.identifier, target: event.target, x: point.clientX, y: point.clientY, last: point, axis: null };
      if (!start(sample(point))) touch = null;
    }, { passive: true });
    listen('touchmove', event => {
      if (!touch) return;
      if (event.touches.length !== 1) { cancel(); return; }
      const point = [...event.touches].find(point => point.identifier === touch.id);
      if (!point) { cancel(); return; }
      advance(event, point);
    }, { passive: false });
    listen('touchend', event => {
      if (!touch) return;
      const point = [...event.changedTouches].find(point => point.identifier === touch.id);
      if (!point) return;
      if (point.clientX !== touch.last.clientX || point.clientY !== touch.last.clientY) advance(event, point);
      if (!touch) return;
      const last = sample(point);
      touch = null;
      end(last, false);
    }, { passive: false });
    listen('touchcancel', cancel, { passive: true });
  }
  signal?.addEventListener('abort', () => { touch = null; }, { once: true });
  return { reset() { touch = null; } };
}
