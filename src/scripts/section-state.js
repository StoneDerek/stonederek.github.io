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
  return {
    get hidden() { return hidden; },
    setHidden(value) { hidden = value; direction = 0; travel = 0; return hidden; },
    move(delta) {
      if (!Number.isFinite(delta) || delta === 0) return hidden;
      const next = Math.sign(delta);
      if (next !== direction) { direction = next; travel = 0; }
      travel += Math.abs(delta);
      if (travel >= (direction < 0 ? 24 : 36)) hidden = direction > 0;
      return hidden;
    }
  };
}

// A mostly one-to-one drag with a short, smooth slowdown, not a hard barrier.
// Crossing enters About immediately; no pointer release is needed.
export function createAboutSwipe(width) {
  const threshold = Math.min(240, Math.max(72, width * .24));
  const entry = threshold * .38;
  const span = threshold * .35;
  return {
    threshold,
    move(rightwardDistance) {
      const distance = Math.max(0, rightwardDistance);
      const t = Math.max(0, Math.min(1, (distance - entry) / span));
      const loss = span * .16 * t * t * (3 - 2 * t);
      return { travel: distance - loss, commit: distance >= threshold };
    }
  };
}

export function settleProjectSwipe({ start, position, velocity = 0, deltaX, unit, touch = false, cancelled = false }) {
  const momentum = cancelled ? 0 : Math.max(-.55, Math.min(.55, velocity * 180));
  const target = Math.round(position + momentum);
  if (!touch || cancelled || Math.abs(deltaX) < Math.max(24, Math.min(56, unit * .15))) return target;
  const direction = -Math.sign(deltaX);
  const next = Math.round(start) + direction;
  return direction > 0 ? Math.max(target, next) : Math.min(target, next);
}
