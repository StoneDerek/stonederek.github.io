// Fragment destinations cannot be selected at build time. Apply their state
// synchronously after the gallery markup, before the deferred app can paint it.
export function prepareArtEntry(root) {
  const address = new URL(window.__PORTFOLIO_PREVIEW_ADDRESS__ || window.location.href, 'https://portfolio.invalid');
  const collection = root.querySelector('[data-art-collection]');
  const puzzle = root.querySelector('[data-art-puzzle]');
  if (address.hash === '#links') {
    collection.hidden = true;
    puzzle.hidden = false;
    root.dataset.artView = 'puzzle';
    return;
  }
  const items = [...root.querySelectorAll('[data-art-item]')];
  const requested = Number(new URLSearchParams(address.hash.slice(1)).get('artwork'));
  if (!Number.isInteger(requested) || requested < 2 || requested > items.length) return;
  const index = requested - 1;
  root.dataset.artIndex = String(index);
  root.style.setProperty('--art-initial-index', index);
  const image = items[index].querySelector('img');
  root.style.setProperty('--art-initial-aspect', Number(image.getAttribute('width')) / Number(image.getAttribute('height')));
  root.querySelector('[data-art-title]').textContent = `Untitled #${requested}`;
  items.forEach((item, i) => {
    item.inert = i !== index;
    item.setAttribute('aria-hidden', String(i !== index));
    if (Math.abs(i - index) <= 1) item.querySelector('img').loading = 'eager';
  });
  const choices = [...root.querySelectorAll('[data-art-select]')];
  choices.forEach((choice, i) => {
    if (i === index) choice.setAttribute('aria-current', 'true');
    else choice.removeAttribute('aria-current');
    choice.tabIndex = i === index ? 0 : -1;
  });
  root.querySelectorAll('.case-study-section').forEach((chapter, i) => {
    chapter.hidden = i !== index;
    chapter.inert = i !== index;
    chapter.setAttribute('aria-hidden', String(i !== index));
  });
  root.querySelector('[data-art-announcement]').textContent = `Untitled #${requested}`;
  const rail = root.querySelector('[data-art-rail]');
  rail.scrollLeft = index * choices[0].offsetWidth;
}
