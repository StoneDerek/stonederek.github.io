// Native details keeps the project list usable without JavaScript. With scripts,
// animate its height and preserve the currently drawn frame on rapid reversals.
export function mountProjectMenu(details, reducedMotion, { signal } = {}) {
  const toggle = details.querySelector('[data-projects-toggle]');
  const panel = details.querySelector('[data-projects-panel]');
  let expanded = details.open;
  let animation = null;
  let generation = 0;
  const sync = () => {
    details.dataset.expanded = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    panel.inert = !expanded;
  };
  function set(open, { immediate = false, focus = false } = {}) {
    const current = ++generation;
    const from = details.open ? panel.getBoundingClientRect().height : 0;
    const opacity = details.open ? getComputedStyle(panel).opacity : '0';
    if (animation) { animation.onfinish = null; animation.cancel(); animation = null; }
    if (focus || (!open && panel.contains(document.activeElement))) toggle.focus({ preventScroll: true });
    expanded = open;
    sync();
    if (!open && !details.open) return;
    details.open = true;
    panel.style.height = '';
    const to = open ? panel.scrollHeight : 0;
    const finish = () => {
      if (current !== generation) return;
      details.open = open;
      panel.style.height = '';
      if (animation) { animation.onfinish = null; animation.cancel(); animation = null; }
      sync();
    };
    if (immediate || reducedMotion.matches || typeof panel.animate !== 'function' || Math.abs(to - from) < .5) {
      finish(); return;
    }
    panel.style.height = `${from}px`;
    animation = panel.animate([
      { height: `${from}px`, opacity },
      { height: `${to}px`, opacity: open ? '1' : '0' }
    ], { duration: open ? 240 : 180, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' });
    animation.onfinish = finish;
  }
  toggle.addEventListener('click', event => { event.preventDefault(); set(!expanded); }, { signal });
  details.addEventListener('toggle', () => {
    if (animation) return;
    expanded = details.open;
    sync();
  }, { signal });
  sync();
  return { get expanded() { return expanded; }, set };
}
