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

// This is the same leftward gallery drag, with a detent after an ordinary swipe.
// Velocity never arms it, and backing away disarms before pointer release.
export function createAboutSwipe(width) {
  const threshold = Math.max(220, width * .86);
  const entry = threshold * .68;
  let armed = false;
  return {
    threshold,
    move(leftwardDistance) {
      const distance = Math.max(0, leftwardDistance);
      if (distance >= threshold) armed = true;
      else if (distance < threshold - 24) armed = false;
      const resisted = Math.min(distance, entry) + Math.max(0, Math.min(distance, threshold) - entry) * .18;
      const travel = resisted + (armed ? 12 + Math.min(60, Math.max(0, distance - threshold)) * .45 : 0);
      return { armed, travel, progress: Math.max(0, Math.min(1, (distance - entry) / (threshold - entry))) };
    },
    release({ cancelled = false } = {}) { return armed && !cancelled; }
  };
}
