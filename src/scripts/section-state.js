const sections = ['home', 'about', 'projects'];

export function sectionFromPath(path) {
  const last = path.replace(/\/index\.html$/, '/').replace(/\/$/, '').split('/').pop();
  return last === 'about' || last === 'projects' ? last : 'home';
}

export function sectionDirection(from, to) {
  return Math.sign(sections.indexOf(to) - sections.indexOf(from));
}

// Accumulate intent, rather than reacting to every tiny reversal of a trackpad.
export function createScrollReveal({ hidden = false } = {}) {
  let direction = 0;
  let travel = 0;
  let touching = false;
  let revealedDuringTouch = false;
  return {
    get hidden() { return hidden; },
    beginTouch() {
      touching = true;
      revealedDuringTouch = false;
      direction = travel = 0;
    },
    endTouch() { touching = false; },
    setHidden(value) {
      direction = 0;
      travel = 0;
      hidden = value;
      revealedDuringTouch = touching && !hidden;
      return hidden;
    },
    move(delta) {
      if (!Number.isFinite(delta) || delta === 0) return hidden;
      // A finger's reversal must not undo its own reveal. The next gesture can
      // dismiss immediately; no clock or minimum visibility period is needed.
      if (delta > 0 && touching && revealedDuringTouch) return hidden;
      const next = Math.sign(delta);
      if (next !== direction) { direction = next; travel = 0; }
      travel += Math.abs(delta);
      if (travel >= (direction < 0 ? 24 : 36)) {
        hidden = direction > 0;
        if (!hidden && touching) revealedDuringTouch = true;
      }
      return hidden;
    }
  };
}

// The links space keeps the final project's index without inventing an article.
export function galleryFrame(value, projectCount) {
  const last = projectCount - 1;
  const position = Math.max(0, Math.min(projectCount, value));
  return { position, project: Math.min(last, Math.round(position)),
    endProgress: Math.max(0, position - last), links: position >= last + .5 };
}

export function settleProjectSwipe({ start, position, velocity = 0, deltaX, unit, touch = false, cancelled = false }) {
  const momentum = cancelled ? 0 : Math.max(-.55, Math.min(.55, velocity * 180));
  const target = Math.round(position + momentum);
  const threshold = touch ? Math.max(18, Math.min(42, unit * .1125)) : Math.max(24, Math.min(54, unit * .09));
  if (cancelled || Math.abs(deltaX) < threshold) return target;
  const direction = -Math.sign(deltaX);
  const next = Math.round(start) + direction;
  return direction > 0 ? Math.max(target, next) : Math.min(target, next);
}
