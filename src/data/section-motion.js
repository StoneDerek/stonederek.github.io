const drift = { old: { name: 'section-fade-out', duration: '120ms', easing: 'ease-out' }, new: { name: 'section-drift-in', duration: '180ms', easing: 'cubic-bezier(.22,.7,.2,1)' } };
const fade = { old: { name: 'section-fade-out', duration: '120ms', easing: 'ease-out' }, new: { name: 'section-fade-in', duration: '180ms', easing: 'ease-out' } };

export const shortDrift = { forwards: drift, backwards: drift };
export const sectionFade = { forwards: fade, backwards: fade };
