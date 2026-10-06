import { sectionTiming } from '../data/section-motion.js';

const contentSelector = '[data-section-motion], [data-section-art]';
let activeMotion;

export const usesTouchSectionMotion = () => window.matchMedia('(pointer: coarse)').matches;

export function finishTouchSectionMotion() {
  activeMotion?.finish();
}

// Keep only the drawing of an outgoing element. Its duplicate controls must
// never become part of the new page's carousel, navigation, or accessibility tree.
function copyDrawing(element, { freeze = false } = {}) {
  const clone = element.cloneNode(true);
  const originals = [element, ...element.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  const scrollPositions = originals.map(original => ({ left: original.scrollLeft, top: original.scrollTop }));
  originals.forEach((original, index) => {
    const copy = copies[index];
    for (const attribute of [...copy.attributes]) {
      if (attribute.name === 'id' || attribute.name.startsWith('data-')) copy.removeAttribute(attribute.name);
    }
    if (freeze || original.getAnimations().length) {
      const style = getComputedStyle(original);
      copy.style.transform = style.transform;
      copy.style.translate = style.translate;
      copy.style.opacity = style.opacity;
    }
  });
  const style = getComputedStyle(element);
  for (const property of style) {
    if (property.startsWith('--')) clone.style.setProperty(property, style.getPropertyValue(property));
  }
  Object.assign(clone.style, {
    position: 'absolute', inset: '0 auto auto 0', margin: '0', maxWidth: 'none',
    transform: 'none', translate: 'none', color: style.color, font: style.font,
    width: `${element.getBoundingClientRect().width}px`, height: `${element.getBoundingClientRect().height}px`
  });
  return { clone, opacity: style.opacity, restoreScroll() {
    scrollPositions.forEach((position, index) => {
      copies[index].scrollLeft = position.left;
      copies[index].scrollTop = position.top;
    });
  } };
}

window.addEventListener('pagehide', finishTouchSectionMotion);
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
  if (event.matches) finishTouchSectionMotion();
});

export function captureTouchSectionMotion(direction, { projectEntry = false } = {}) {
  finishTouchSectionMotion();
  const drawings = [...document.querySelectorAll(contentSelector)].filter(element => {
    const style = getComputedStyle(element);
    return element.getClientRects().length && style.visibility !== 'hidden';
  }).map(element => {
    const rect = element.getBoundingClientRect();
    return { ...copyDrawing(element), rect, artwork: element.matches('[data-section-art]') };
  });
  const menu = document.querySelector('.site-menu');
  const menuStyle = getComputedStyle(menu);
  const label = document.querySelector('.menu-location');
  const previous = { backgroundColor: menuStyle.backgroundColor, color: menuStyle.color };
  // A label copy loses its page-scoped selectors when its routing attributes
  // are removed. Freeze those hidden rows as well as any running animation.
  const labelDrawing = copyDrawing(label, { freeze: true });

  return ({ projectFinished = Promise.resolve() } = {}) => {
    const host = document.querySelector('#portfolio, .profile-shell');
    const incoming = [...document.querySelectorAll(contentSelector)];
    const animations = [];
    const layers = [];
    document.documentElement.setAttribute('data-touch-section-motion', '');
    for (const artwork of [true, false]) {
      const layer = document.createElement('div');
      layer.className = `section-outgoing section-outgoing-${artwork ? 'art' : 'text'}`;
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      for (const drawing of drawings.filter(drawing => drawing.artwork === artwork)) {
        drawing.clone.style.left = `${drawing.rect.left}px`;
        drawing.clone.style.top = `${drawing.rect.top}px`;
        layer.append(drawing.clone);
        if (!projectEntry) animations.push(drawing.clone.animate([{ opacity: drawing.opacity }, { opacity: 0 }], {
          duration: artwork ? sectionTiming.artwork : sectionTiming.exit,
          easing: artwork ? 'linear' : 'ease-in', fill: 'both'
        }));
      }
      if (layer.childElementCount) {
        host.append(layer);
        layers.push(layer);
      }
    }
    drawings.forEach(drawing => drawing.restoreScroll());
    if (!projectEntry) incoming.forEach(element => {
      const artwork = element.matches('[data-section-art]');
      const resting = getComputedStyle(element).transform;
      const frames = artwork ? [{ opacity: 0 }, { opacity: 1 }] : [
        { opacity: 0, transform: `translateX(${direction * sectionTiming.distance}px) ${resting === 'none' ? '' : resting}` },
        { opacity: 1, transform: resting }
      ];
      animations.push(element.animate(frames, {
        duration: artwork ? sectionTiming.artwork : sectionTiming.enter,
        delay: artwork ? 0 : sectionTiming.exit,
        easing: artwork ? 'linear' : sectionTiming.easing, fill: 'both'
      }));
    });
    const nextMenu = document.querySelector('.site-menu');
    const nextStyle = getComputedStyle(nextMenu);
    animations.push(nextMenu.animate([previous, { backgroundColor: nextStyle.backgroundColor, color: nextStyle.color }],
      { duration: sectionTiming.header, easing: 'linear' }));
    const nextLabel = document.querySelector('.menu-location');
    nextLabel.parentElement.append(labelDrawing.clone);
    labelDrawing.clone.classList.add('section-outgoing-location');
    labelDrawing.clone.setAttribute('aria-hidden', 'true');
    labelDrawing.clone.inert = true;
    layers.push(labelDrawing.clone);
    // Match the desktop label's fade-through, keeping both drawings stationary.
    animations.push(labelDrawing.clone.animate([
      { opacity: labelDrawing.opacity }, { opacity: 0 }
    ],
      { duration: sectionTiming.exit, easing: 'ease-in', fill: 'both' }));
    animations.push(nextLabel.animate([
      { opacity: 0 }, { opacity: 1 }
    ],
      { duration: sectionTiming.enter, delay: sectionTiming.exit, easing: sectionTiming.easing, fill: 'both' }));

    const motion = { finish() {
      animations.forEach(animation => animation.cancel());
      layers.forEach(layer => layer.remove());
      if (activeMotion === motion) {
        document.documentElement.removeAttribute('data-touch-section-motion');
        activeMotion = undefined;
      }
    } };
    activeMotion = motion;
    // A direct project entry keeps the original section behind the tile reveal.
    // Only its anchored header uses the short section-label/palette transition.
    Promise.allSettled([...animations.map(animation => animation.finished), projectFinished]).then(() => {
      if (activeMotion === motion) motion.finish();
    });
  };
}
