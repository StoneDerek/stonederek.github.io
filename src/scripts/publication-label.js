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

export function mountPublicationLabel() {
  const time = document.querySelector('[data-publication-date]');
  if (!time) return () => {};
  const controller = new AbortController();
  let timer;
  function update() {
    clearTimeout(timer);
    const value = publicationLabel(time.dateTime);
    if (!value) return;
    time.textContent = value.label;
    const tooltip = document.getElementById(time.getAttribute('aria-describedby'));
    if (tooltip) tooltip.textContent = value.full;
    if (!document.hidden) {
      const next = new Date(); next.setHours(24, 0, 0, 100);
      timer = setTimeout(update, Math.max(100, next - Date.now()));
    }
  }
  document.addEventListener('visibilitychange', update, { signal: controller.signal });
  window.addEventListener('pageshow', update, { signal: controller.signal });
  update();
  return () => { controller.abort(); clearTimeout(timer); };
}
