// The icon URLs are prepared by the build. Write only a changed selection;
// repeated settles on the same project do not make the browser reload its icon.
export function mountProjectFavicon(link) {
  let current = link?.getAttribute('href');
  return href => {
    if (!link || !href || href === current) return;
    link.setAttribute('href', href);
    current = href;
  };
}
