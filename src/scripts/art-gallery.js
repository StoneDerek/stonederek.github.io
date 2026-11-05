import { mountProjectCaseStudy } from './project-case-study.js';
import { mountProjectImageViewer } from './project-image-viewer.js';
import { mountSwipeInput } from './swipe-input.js';
import { mountLaser } from './ascii-laser.js';

export function mountArtGallery(root = document.querySelector('[data-art-root]')) {
  if (!root) return () => {};
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const project = JSON.parse(root.querySelector('#art-data').textContent);
  const base = root.dataset.base || '/';
  const preview = view.__PORTFOLIO_PREVIEW_ADDRESS__ !== undefined;
  const readAddress = () => preview ? view.__PORTFOLIO_PREVIEW_ADDRESS__ : view.location.href;
  const items = [...root.querySelectorAll('[data-art-item]')];
  const choices = [...root.querySelectorAll('[data-art-select]')];
  const steps = [...root.querySelectorAll('[data-art-step]')];
  const stage = root.querySelector('[data-art-stage]');
  const count = root.querySelector('[data-art-count]');
  const collection = root.querySelector('[data-art-collection]');
  const puzzle = root.querySelector('[data-art-puzzle]');
  const details = root.querySelector('[data-art-details]');
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new view.AbortController();
  const listen = (target, event, handler, options) => target.addEventListener(event, handler, { ...options, signal: controller.signal });
  const caseStudy = mountProjectCaseStudy(details, { base, reducedMotion });
  // The gallery supplies the original photos. Reuse the established rich-text
  // renderer below it without repeating all five images in the document.
  caseStudy.render({ ...project, caseStudy: {
    ...project.caseStudy,
    sections: project.caseStudy.sections.map(section => ({ ...section, media: [] })),
    footnotes: project.caseStudy.footnotes.filter(note => note.number !== 0)
  } });
  details.querySelector('.case-study-contents')?.remove();
  const chapters = [...details.querySelectorAll('.case-study-section')];
  const notes = [...details.querySelectorAll('.project-footnote')];
  const imageViewer = mountProjectImageViewer(root, root, { reducedMotion });
  let selected = 0;
  let disposed = false;
  let laser = null;
  let gesture = null;
  let suppressClickUntil = 0;

  const clamp = value => Math.max(0, Math.min(items.length - 1, value));
  const number = index => String(index + 1).padStart(2, '0');

  function writeAddress(hash, { replace = false } = {}) {
    const address = `${base}art/${hash}`;
    const previous = view.history.state;
    const state = previous && typeof previous === 'object' ? previous : {};
    if (preview && typeof view.__PORTFOLIO_PREVIEW_SET_ADDRESS__ === 'function') {
      view.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address, replace, state });
    } else view.history[replace ? 'replaceState' : 'pushState'](state, '', address);
  }

  function showArtwork(index, { write = false } = {}) {
    index = clamp(index);
    if (index !== selected || !puzzle.hidden) {
      imageViewer.close({ restoreFocus: false, immediate: true });
      caseStudy.closeSources();
    }
    selected = index;
    root.dataset.artIndex = String(index);
    root.dataset.artView = 'gallery';
    collection.hidden = false;
    puzzle.hidden = true;
    laser?.setActive(false);
    items.forEach((item, i) => { item.hidden = i !== index; });
    choices.forEach((button, i) => {
      if (i === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    chapters.forEach((chapter, i) => { chapter.hidden = i !== index; });
    const references = new Set([...chapters[index].querySelectorAll('[data-article-jump]')].map(link => link.dataset.articleJump));
    notes.forEach(note => { note.hidden = !references.has(note.id); });
    const footnotes = details.querySelector('.project-footnotes');
    if (footnotes) footnotes.hidden = !references.size;
    for (const button of steps) {
      const next = index + Number(button.dataset.artStep);
      button.disabled = next < 0 || next >= items.length;
      if (button.hasAttribute('data-art-peek')) {
        button.hidden = button.disabled;
        if (!button.disabled) {
          const source = items[next].querySelector('img');
          button.querySelector('img').src = source.getAttribute('src');
          button.setAttribute('aria-label', `Show artwork ${number(next)}`);
        }
      }
    }
    const image = items[index].querySelector('img');
    image.loading = 'eager';
    if (items[index + 1]) items[index + 1].querySelector('img').loading = 'eager';
    count.textContent = `${number(index)} / ${String(items.length).padStart(2, '0')}`;
    if (write) writeAddress(`#artwork=${number(index)}`);
  }

  function showPuzzle() {
    imageViewer.close({ restoreFocus: false, immediate: true });
    collection.hidden = true;
    puzzle.hidden = false;
    root.dataset.artView = 'puzzle';
    laser ||= mountLaser(puzzle.querySelector('[data-laser-experiment]'));
    laser.prepare();
    laser.setActive(true);
    puzzle.focus({ preventScroll: true });
  }

  function followAddress() {
    if (disposed) return;
    const url = new URL(readAddress(), view.location.href);
    if (url.hash === '#links') { showPuzzle(); return; }
    const requested = Number(new URLSearchParams(url.hash.slice(1)).get('artwork'));
    showArtwork(Number.isInteger(requested) && requested > 0 && requested <= items.length ? requested - 1 : 0);
  }

  // Skip navigation changes focus, not the artwork encoded in the address.
  listen(root.closest('.serif-site') || root, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      !event.target.closest?.('.serif-skip-link')) return;
    event.preventDefault();
    const target = puzzle.hidden ? stage : puzzle;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });

  listen(root, 'click', event => {
    if (!event.target.closest?.('[data-image-open]') || view.performance.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
  listen(root, 'click', event => {
    if (event.defaultPrevented) return;
    const choice = event.target.closest?.('[data-art-select]');
    const step = event.target.closest?.('[data-art-step]');
    if (choice || step) {
      const index = choice ? Number(choice.dataset.artSelect) : clamp(selected + Number(step.dataset.artStep));
      if (index !== selected) showArtwork(index, { write: true });
      if (step?.disabled || step?.hidden) stage.focus({ preventScroll: true });
    }
    if (event.target.closest?.('[data-art-return]')) {
      showArtwork(selected, { write: true });
      stage.focus({ preventScroll: true });
    }
  });
  listen(root, 'keydown', event => {
    if (event.defaultPrevented || doc.querySelector('dialog[open]') ||
      !event.target.closest?.('.art-gallery') || event.altKey || event.metaKey || event.ctrlKey) return;
    const index = event.key === 'ArrowRight' ? selected + 1 : event.key === 'ArrowLeft' ? selected - 1 :
      event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (index === null) return;
    event.preventDefault();
    if (clamp(index) !== selected) showArtwork(index, { write: true });
    if (doc.activeElement?.disabled) stage.focus({ preventScroll: true });
  });
  const swipe = mountSwipeInput(stage, {
    signal: controller.signal,
    start(event) {
      if (event.button !== 0 || root.querySelector('dialog[open]') || event.target.closest?.('[data-art-step]')) return false;
      gesture = { x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId };
      return true;
    },
    move(event) {
      if (!gesture) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { gesture = null; return; }
      if (Math.abs(dx) > 8) {
        gesture.moved = true;
        if (Number.isFinite(gesture.pointerId) && !stage.hasPointerCapture(gesture.pointerId)) stage.setPointerCapture(gesture.pointerId);
        event.preventDefault?.();
      }
    },
    end(event, cancelled) {
      if (!gesture) return;
      const dx = event.clientX - gesture.x;
      const moved = gesture.moved;
      const pointerId = gesture.pointerId;
      gesture = null;
      if (Number.isFinite(pointerId) && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
      if (cancelled) return;
      if (moved) suppressClickUntil = view.performance.now() + 350;
      if (Math.abs(dx) < Math.max(32, Math.min(64, stage.clientWidth * .12))) return;
      const index = clamp(selected + (dx < 0 ? 1 : -1));
      if (index !== selected) showArtwork(index, { write: true });
    }
  });
  listen(view, 'blur', () => { gesture = null; swipe.reset(); });
  listen(root, 'click', event => {
    const credits = root.querySelector('[data-credits]');
    if (credits?.open && !credits.contains(event.target)) credits.open = false;
  });
  listen(root, 'keydown', event => {
    const credits = event.target.closest?.('[data-credits]');
    if (event.key === 'Escape' && credits?.open) {
      event.preventDefault(); credits.open = false; credits.querySelector('summary').focus();
    }
  });
  if (preview) listen(view, 'portfolio:preview-navigate', followAddress);
  else {
    listen(view, 'popstate', followAddress);
    listen(view, 'hashchange', followAddress);
  }
  followAddress();
  return () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    swipe.reset();
    imageViewer.destroy();
    caseStudy.destroy();
    laser?.destroy();
  };
}
