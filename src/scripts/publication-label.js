export function publicationLabel(iso, now = new Date(), timeZone) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const calendar = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', ...(timeZone ? { timeZone } : {}) });
  const day = value => {
    const parts = Object.fromEntries(calendar.formatToParts(value).map(part => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };
  const days = Math.max(0, Math.round((day(now) - day(date)) / 86400000));
  const full = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', ...(timeZone ? { timeZone } : {}) }).format(date);
  return { label: days === 0 ? 'Updated today' : days < 30 ? `Updated ${days}d ago` : `Updated ${calendar.format(date)}`, full: `Last updated ${full}` };
}

export function mountPublicationLabel(time = document.querySelector('[data-publication-date]')) {
  if (!time) return () => {};
  const doc = time.ownerDocument;
  const view = doc.defaultView;
  const controller = new view.AbortController();
  let hovered = time.matches(':hover');
  let focused = doc.activeElement === time;
  let value;
  let timer;
  const render = () => {
    if (!value) return;
    time.textContent = hovered || focused ? value.full : value.label;
    time.setAttribute('aria-label', value.full);
  };
  function update() {
    view.clearTimeout(timer);
    value = publicationLabel(time.dateTime);
    if (!value) return;
    render();
    if (!doc.hidden) {
      const next = new Date(); next.setHours(24, 0, 0, 100);
      timer = view.setTimeout(update, Math.max(100, next - Date.now()));
    }
  }
  const listen = (target, event, handler) => target.addEventListener(event, handler, { signal: controller.signal });
  listen(time, 'pointerenter', () => { hovered = true; render(); });
  listen(time, 'pointerleave', () => { hovered = false; render(); });
  listen(time, 'focus', () => { focused = true; render(); });
  listen(time, 'blur', () => { focused = false; render(); });
  listen(doc, 'visibilitychange', update);
  listen(view, 'pageshow', update);
  update();
  return () => { controller.abort(); view.clearTimeout(timer); };
}
