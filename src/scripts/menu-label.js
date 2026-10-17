// Both header columns use one upward text transition, including reversals.
export function mountMenuLabel(label, reducedMotion) {
  let desired = label.textContent;
  let animation = null;
  let generation = 0;
  let destroyed = false;
  const clear = () => { label.style.opacity = ''; label.style.transform = ''; };

  async function set(text, { immediate = false } = {}) {
    if (destroyed || (desired === text && !immediate)) return;
    desired = text;
    const current = ++generation;
    const instant = immediate || reducedMotion.matches || typeof label.animate !== 'function';
    const style = instant ? null : getComputedStyle(label);
    const start = style && { opacity: style.opacity, transform: style.transform };
    animation?.cancel();
    animation = null;
    if (instant) { label.textContent = text; clear(); return; }

    const outgoing = label.animate([start, { opacity: 0, transform: 'translateY(-100%)' }], {
      duration: 120, easing: 'ease-in', fill: 'forwards'
    });
    animation = outgoing;
    await outgoing.finished.catch(() => {});
    if (current !== generation || destroyed) return;
    outgoing.cancel();
    label.textContent = text;
    const incoming = label.animate([
      { opacity: 0, transform: 'translateY(100%)' }, { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 200, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' });
    animation = incoming;
    await incoming.finished.catch(() => {});
    if (current !== generation || destroyed) return;
    incoming.cancel();
    animation = null;
    clear();
  }

  return {
    set,
    finish: () => set(desired, { immediate: true }),
    destroy() {
      destroyed = true;
      generation += 1;
      animation?.cancel();
      animation = null;
      label.textContent = desired;
      clear();
    }
  };
}
