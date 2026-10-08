const calendar = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York'
});
const fullDate = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric', month: 'short', day: '2-digit', timeZone: 'America/New_York'
});
const dayNumber = date => {
  const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000;
};

export function publicationLabel(value, now = new Date()) {
  const published = new Date(value);
  if (!Number.isFinite(published.getTime()) || !Number.isFinite(now.getTime())) return null;
  const days = dayNumber(now) - dayNumber(published);
  if (days === 0) return 'Updated today';
  if (days > 0 && days < 31) return `Updated ${days}d ago`;
  return `Updated ${fullDate.format(published)}`;
}

export function mountPublicationLabel(header) {
  const label = header.querySelector('[data-last-updated]');
  if (!label) return () => {};
  const refresh = () => {
    const text = publicationLabel(label.getAttribute('datetime'));
    if (text && label.textContent !== text) label.textContent = text;
  };
  const menu = header.querySelector('.site-menu');
  refresh();
  // Refresh long-lived tabs whenever the menu is opened, without a timer.
  menu?.addEventListener('toggle', refresh);
  return () => menu?.removeEventListener('toggle', refresh);
}
