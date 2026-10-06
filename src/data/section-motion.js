export const sectionTiming = { exit: 90, enter: 180, header: 180, artwork: 180, distance: 8, easing: 'cubic-bezier(.2,0,0,1)' };

// Clear the outgoing text before revealing a differently arranged page.
const old = { name: 'section-fade-out', duration: `${sectionTiming.exit}ms`, easing: 'ease-in' };
const entry = { duration: `${sectionTiming.enter}ms`, delay: `${sectionTiming.exit}ms`, easing: sectionTiming.easing };
const drift = { old, new: { name: 'section-drift-in', ...entry } };
const fade = { old, new: { name: 'section-fade-in', ...entry } };

export const shortDrift = { forwards: drift, backwards: drift };
export const sectionFade = { forwards: fade, backwards: fade };

// The canvas changes continuously while differently arranged text clears.
const artwork = {
  old: { name: 'section-fade-out', duration: `${sectionTiming.artwork}ms`, easing: 'linear' },
  new: { name: 'section-fade-in', duration: `${sectionTiming.artwork}ms`, easing: 'linear' }
};
export const artworkFade = { forwards: artwork, backwards: artwork };
