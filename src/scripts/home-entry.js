// Serialized into Home's markup so the photo can pause before its first paint.
// Keep this function self-contained; the shared gallery remains mounted later.
export function prepareHomeEntrance(introduction) {
  const photo = introduction?.querySelector('.introduction-photo');
  const image = photo?.querySelector('img');
  const page = introduction?.ownerDocument;
  const view = page?.defaultView;
  if (!photo || !image || !view) return;
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let generation = 0;
  let frame = 0;

  const finish = () => {
    generation++;
    view.cancelAnimationFrame(frame);
    frame = 0;
    introduction.classList.remove('has-entry-motion');
    photo.removeAttribute('data-entry-pending');
  };
  const replay = () => {
    finish();
    if (motion?.matches || page.hidden) return;
    const current = generation;
    photo.setAttribute('data-entry-pending', '');
    // Restart the actual CSS, including its temporary compositing hint.
    void introduction.offsetWidth;
    introduction.classList.add('has-entry-motion');
    Promise.resolve().then(() => image.decode?.()).catch(() => {}).then(() => {
      if (current !== generation) return;
      // Give the browser a frame to prepare the decoded photo's layer.
      frame = view.requestAnimationFrame(() => {
        frame = view.requestAnimationFrame(() => {
          frame = 0;
          if (current === generation) photo.removeAttribute('data-entry-pending');
        });
      });
    });
  };

  photo.addEventListener('animationend', event => {
    if (event.target !== photo || event.animationName !== 'home-photo-rise') return;
    // A queued completion from an interrupted replay must not stop its successor.
    if (photo.getAnimations?.().some(animation => !['finished', 'idle'].includes(animation.playState))) return;
    finish();
  });
  introduction.addEventListener('portfolio:replay-home-entry', replay);
  motion?.addEventListener?.('change', () => { if (motion.matches) finish(); });
  page.addEventListener('visibilitychange', () => { if (page.hidden) finish(); });
  view.addEventListener('pagehide', finish);
  replay();
}
