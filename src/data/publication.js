// Evaluated during the static build, never as a visitor's live clock.
export function publicationDate(value = process.env.PORTFOLIO_PUBLISHED_AT || new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('PORTFOLIO_PUBLISHED_AT must be a valid date.');
  return {
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/New_York'
    }).format(date)
  };
}
