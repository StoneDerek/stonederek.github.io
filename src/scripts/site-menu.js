// Lay out the open menu once, then reveal its clip instead of reflowing the
// full-screen reading area on every animation frame.
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
    delete details.dataset.animating;
  };
  function set(open, { immediate = false, focus = false } = {}) {
    const current = ++generation;
    const boxHeight = details.getBoundingClientRect().height;
    const clip = animation && getComputedStyle(details).clipPath;
    const inset = clip && /^inset\(([^)]+)\)/.exec(clip)?.[1].split(' round ')[0].trim().split(/\s+/);
    const clippedBottom = inset ? parseFloat(inset[inset.length > 2 ? 2 : 0]) || 0 : 0;
    const fromHeight = boxHeight - clippedBottom;
    const wasClosed = !details.open;
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
      details.style.clipPath = '';
      body.style.opacity = '';
      body.style.transform = '';
      sync();
    };
    if (!open && !details.open) { finish(); return; }
    body.hidden = false;
    details.open = true;
    if (open && wasClosed) body.scrollTop = 0;
    details.style.height = '';
    const summaryHeight = toggle.getBoundingClientRect().height;
    details.style.setProperty('--menu-summary-height', `${summaryHeight}px`);
    const fullHeight = details.getBoundingClientRect().height;
    const toHeight = open ? fullHeight : summaryHeight;
    if (immediate || reducedMotion.matches || typeof details.animate !== 'function' || typeof body.animate !== 'function' || Math.abs(fromHeight - toHeight) < .5) {
      finish(); return;
    }
    details.dataset.animating = '';
    const reveal = height => `inset(0px 0px ${Math.max(0, fullHeight - height)}px 0px round 8px)`;
    animation = details.animate([{ clipPath: reveal(fromHeight) }, { clipPath: reveal(toHeight) }], {
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
