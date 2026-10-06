// The icon URLs are prepared by the build. Write only a changed selection;
// repeated drag frames and settles do not make the browser reload its icon.
export function mountProjectFavicon(link) {
  let current = link?.getAttribute('href');
  return href => {
    if (!link || !href || href === current) return;
    link.setAttribute('href', href);
    current = href;
  };
}
