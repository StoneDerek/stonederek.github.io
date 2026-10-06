// Animate the native disclosure, then fully remove its body from layout/paint.
// Measuring before cancellation lets a rapid reversal continue from its frame.
export function mountSiteMenu(details, reducedMotion, { onChange = () => {}, signal } = {}) {
  const toggle = details.querySelector('summary');
  const body = details.querySelector('.menu-body');
  let expanded = details.open;
  let animation = null;
  let contentAnimation = null;
  let generation = 0;
  const sync = () => {
    details.dataset.expanded = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    body.inert = !expanded;
  };
  const cancel = () => {
    if (animation) { animation.onfinish = null; animation.cancel(); animation = null; }
    contentAnimation?.cancel();
    contentAnimation = null;
  };
  function set(open, { immediate = false, focus = false } = {}) {
    const current = ++generation;
    const fromHeight = details.getBoundingClientRect().height;
    const style = details.open && !body.hidden ? getComputedStyle(body) : null;
    const fromOpacity = style?.opacity || '0';
    const fromTransform = style?.transform || 'translateY(-6px)';
    cancel();
    expanded = open;
    if (focus || (!open && body.contains(document.activeElement))) toggle.focus({ preventScroll: true });
    sync();
    onChange();
    const finish = () => {
      if (current !== generation) return;
      // Hide before discarding opacity's fill: no exposed divider frame.
      body.hidden = !open;
      details.open = open;
      cancel();
      details.style.height = '';
      body.style.opacity = '';
      body.style.transform = '';
      sync();
    };
    if (!open && !details.open) { finish(); return; }
    body.hidden = false;
    details.open = true;
    details.style.height = '';
    const summaryHeight = toggle.getBoundingClientRect().height;
    details.style.setProperty('--menu-summary-height', `${summaryHeight}px`);
    const toHeight = open ? details.getBoundingClientRect().height : summaryHeight;
    if (immediate || reducedMotion.matches || typeof details.animate !== 'function' || typeof body.animate !== 'function' || Math.abs(fromHeight - toHeight) < .5) {
      finish(); return;
    }
    details.style.height = `${fromHeight}px`;
    animation = details.animate([{ height: `${fromHeight}px` }, { height: `${toHeight}px` }], {
      duration: open ? 340 : 240, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both'
    });
    contentAnimation = body.animate([
      { opacity: fromOpacity, transform: fromTransform },
      { opacity: open ? '1' : '0', transform: open ? 'translateY(0)' : 'translateY(-4px)' }
    ], { duration: open ? 240 : 170, delay: open ? 50 : 0, easing: 'ease-out', fill: 'both' });
    animation.onfinish = finish;
  }
  details.addEventListener('toggle', event => {
    if (event.target !== details || animation) return;
    expanded = details.open;
    body.hidden = !expanded;
    details.style.height = '';
    sync();
    onChange();
  }, { signal });
  body.hidden = !expanded;
  sync();
  return { get expanded() { return expanded; }, get animating() { return Boolean(animation); }, set };
}
