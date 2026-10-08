import { sectionTiming } from '../data/section-motion.js';

const contentSelector = '[data-section-motion], [data-section-art]';
let activeMotion;

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
      if (freeze) {
        copy.style.display = style.display;
        copy.style.visibility = style.visibility;
        copy.style.color = style.color;
        copy.style.backgroundColor = style.backgroundColor;
        copy.style.backdropFilter = style.backdropFilter;
        copy.style.webkitBackdropFilter = style.webkitBackdropFilter;
      }
    }
    if (original.tagName === 'CANVAS' && original.width && original.height) {
      copy.getContext('2d')?.drawImage(original, 0, 0);
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
  return { clone, restoreScroll() {
    scrollPositions.forEach((position, index) => {
      copies[index].scrollLeft = position.left;
      copies[index].scrollTop = position.top;
    });
  } };
}

window.addEventListener('pagehide', finishTouchSectionMotion);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) finishTouchSectionMotion();
});
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
    return { ...copyDrawing(element, { freeze: true }), rect };
  });
  const header = document.querySelector('.site-header');
  // Freeze page-scoped labels and both navigation rows before the swap.
  const headerDrawing = copyDrawing(header, { freeze: true });
  const headerRect = header.getBoundingClientRect();
  const canvas = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();

  return ({ projectFinished = Promise.resolve() } = {}) => {
    const host = document.querySelector('#portfolio, .profile-shell');
    const incoming = [...document.querySelectorAll(contentSelector)];
    const animations = [];
    const layers = [];
    document.documentElement.setAttribute('data-touch-section-motion', '');
    // One opaque outgoing drawing over the painted incoming page gives a true
    // crossfade. Fading both live trees would expose the canvas in the middle.
    const layer = document.createElement('div');
    layer.className = `section-outgoing section-outgoing-page${projectEntry ? ' section-outgoing-project-entry' : ''}`;
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    layer.style.backgroundColor = canvas;
    for (const drawing of drawings) {
      drawing.clone.style.left = `${drawing.rect.left}px`;
      drawing.clone.style.top = `${drawing.rect.top}px`;
      layer.append(drawing.clone);
    }
    host.append(layer);
    layers.push(layer);
    drawings.forEach(drawing => drawing.restoreScroll());
    if (!projectEntry) incoming.forEach(element => {
      if (element.matches('[data-section-art]')) return;
      const resting = getComputedStyle(element).transform;
      const frames = [
        { transform: `translateX(${direction * sectionTiming.distance}px) ${resting === 'none' ? '' : resting}` },
        { transform: resting }
      ];
      animations.push(element.animate(frames, {
        duration: sectionTiming.enter, easing: sectionTiming.easing, fill: 'both'
      }));
    });
    headerDrawing.clone.style.left = `${headerRect.left}px`;
    headerDrawing.clone.style.top = `${headerRect.top}px`;
    if (projectEntry) {
      const navigationLayer = document.createElement('div');
      navigationLayer.className = 'section-outgoing section-outgoing-navigation';
      navigationLayer.setAttribute('aria-hidden', 'true');
      navigationLayer.inert = true;
      navigationLayer.append(headerDrawing.clone);
      host.append(navigationLayer);
      layers.push(navigationLayer);
      animations.push(navigationLayer.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: sectionTiming.header, easing: sectionTiming.easing, fill: 'both'
      }));
    } else {
      layer.append(headerDrawing.clone);
      animations.push(layer.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: sectionTiming.enter, easing: sectionTiming.easing, fill: 'both'
      }));
    }
    headerDrawing.restoreScroll();

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
    // Its anchored header blends over the fully painted incoming navigation.
    Promise.allSettled([...animations.map(animation => animation.finished), projectFinished]).then(() => {
      if (activeMotion === motion) motion.finish();
    });
  };
}
