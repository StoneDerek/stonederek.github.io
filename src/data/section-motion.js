export const sectionTiming = { exit: 180, enter: 180, header: 180, artwork: 180, feedback: 90, distance: 8, easing: 'cubic-bezier(.2,0,0,1)' };

// Both drawings share one clock and easing, so their opacity stays complementary.
const old = { name: 'section-fade-out', duration: `${sectionTiming.exit}ms`, easing: sectionTiming.easing };
const entry = { duration: `${sectionTiming.enter}ms`, delay: '0ms', easing: sectionTiming.easing };
const drift = { old, new: { name: 'section-drift-in', ...entry } };
const fade = { old, new: { name: 'section-fade-in', ...entry } };

export const shortDrift = { forwards: drift, backwards: drift };
export const sectionFade = { forwards: fade, backwards: fade };

// Artwork uses the same interval without a directional drift.
const artwork = {
  old: { name: 'section-fade-out', duration: `${sectionTiming.artwork}ms`, easing: 'linear' },
  new: { name: 'section-fade-in', duration: `${sectionTiming.artwork}ms`, easing: 'linear' }
};
export const artworkFade = { forwards: artwork, backwards: artwork };
