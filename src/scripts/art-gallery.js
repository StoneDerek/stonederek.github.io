import { mountProjectCaseStudy } from './project-case-study.js';
import { mountProjectImageViewer } from './project-image-viewer.js';
import { mountSwipeInput } from './swipe-input.js';
import { createMotionSpring } from './motion-spring.js';
import { settleProjectSwipe } from './section-state.js';
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
  const stage = root.querySelector('[data-art-stage]');
  const track = root.querySelector('[data-art-track]');
  const rail = root.querySelector('[data-art-rail]');
  const thumbnailGroup = root.querySelector('[data-art-thumbnails]');
  const selectionFrame = root.querySelector('[data-art-selection-frame]');
  const title = root.querySelector('[data-art-title], [data-detail-title]');
  const announcement = root.querySelector('[data-art-announcement]');
  const collection = root.querySelector('[data-art-collection]');
  const puzzle = root.querySelector('[data-art-puzzle]');
  const details = root.querySelector('[data-art-details]');
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new view.AbortController();
  const listen = (target, event, handler, options) => target.addEventListener(event, handler,
    { ...options, signal: controller.signal });
  const caseStudy = mountProjectCaseStudy(details, { base, reducedMotion });
  caseStudy.render({ ...project, caseStudy: {
    ...project.caseStudy,
    sections: project.caseStudy.sections.map(section => ({ ...section, media: [] })),
    footnotes: project.caseStudy.footnotes.filter(note => note.number !== 0)
  } });
  details.querySelector('.case-study-contents')?.remove();
  const chapters = [...details.querySelectorAll('.case-study-section')];
  chapters.forEach((chapter, i) => {
    const heading = chapter.querySelector('h2');
    if (heading) { heading.textContent = `Untitled #${i + 1}`; heading.hidden = true; }
    chapter.querySelector('.case-study-number')?.remove();
  });
  const imageViewer = mountProjectImageViewer(root, root, { reducedMotion });
  const clamp = value => Math.max(0, Math.min(items.length - 1, value));
  const number = index => String(index + 1).padStart(2, '0');
  const swipeInputs = [];
  let selected = -1;
  let position = 0;
  let destination = 0;
  let stageWidth = 1;
  let slideWidth = 1;
  let stride = 1;
  let railCenterPadding = 0;
  let lift = 0;
  let liftFrame = 0;
  let galleryInset = 0;
  let animationFrame = 0;
  let motionVelocity = 0;
  let animationHistory = false;
  let drag = null;
  let dragFrame = 0;
  let pendingDrag = null;
  let resizeFrame = 0;
  let suppressClickUntil = 0;
  let resolvedAddress = null;
  let disposed = false;
  let laser = null;

  function writeAddress(index) {
    const address = `${base}art/#artwork=${number(index)}`;
    const current = new URL(readAddress(), view.location.href);
    if (`${current.pathname}${current.hash}` === address) return;
    const previous = view.history.state;
    const state = previous && typeof previous === 'object' ? previous : {};
    resolvedAddress = address;
    if (preview && typeof view.__PORTFOLIO_PREVIEW_SET_ADDRESS__ === 'function') {
      view.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address, replace: false, state });
    } else view.history.pushState(state, '', address);
  }

  function closeOverlays() {
    imageViewer.close({ restoreFocus: false, immediate: true });
    caseStudy.closeSources();
  }

  function restorePanelAccess() {
    if (items.some((item, i) => i !== selected && item.contains(doc.activeElement))) stage.focus({ preventScroll: true });
    items.forEach((item, i) => { item.inert = i !== selected; });
  }

  function updateActive(index) {
    if (selected === index) return;
    const previous = selected;
    const focusedThumbnail = previous >= 0 && doc.activeElement === choices[previous];
    if (!drag?.nativeTouch && previous >= 0 && items[previous].contains(doc.activeElement)) stage.focus({ preventScroll: true });
    closeOverlays();
    selected = index;
    root.dataset.artIndex = String(index);
    title.textContent = `Untitled #${index + 1}`;
    alignArtworkTitle(index);
    items.forEach((item, i) => {
      item.hidden = false;
      item.classList.toggle('is-active', i === index);
      item.setAttribute('aria-hidden', String(i !== index));
      // A native touch must retain its original target through the midpoint.
      item.inert = i !== index && item !== drag?.originSlide;
    });
    choices.forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      if (i === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
      button.tabIndex = i === index ? 0 : -1;
    });
    if (focusedThumbnail) choices[index].focus({ preventScroll: true });
    chapters.forEach((chapter, i) => {
      chapter.hidden = i !== index;
      chapter.inert = i !== index;
      chapter.setAttribute('aria-hidden', String(i !== index));
    });
    for (let i = Math.max(0, index - 1); i <= Math.min(items.length - 1, index + 1); i++) {
      items[i].querySelector('img').loading = 'eager';
    }
  }

  function alignArtworkTitle(index = selected) {
    if (index < 0) return;
    const width = parseFloat(items[index].querySelector('img').style.width);
    if (width > 0) root.style.setProperty('--art-title-inset', `${Math.max(0, (stageWidth - width) / 2)}px`);
  }

  function positionTrack() {
    track.style.transform = `translate3d(${(stageWidth - slideWidth) / 2 - position * (slideWidth - galleryInset)}px, 0, 0)`;
    const maxInset = Math.min(20, slideWidth * .025);
    items.forEach((item, i) => {
      const focus = Math.max(0, 1 - Math.abs(i - position));
      item.style.setProperty('--art-slide-shift', `${-i * galleryInset}px`);
      item.style.setProperty('--art-image-scale', 1 - 2 * maxInset / slideWidth * Math.max(lift, 1 - focus));
    });
  }

  function render(value) {
    position = clamp(value);
    positionTrack();
    rail.scrollLeft = position * stride;
    root.dataset.artPosition = String(position);
    choices.forEach((button, i) => button.style.setProperty('--focus', Math.max(0, 1 - Math.abs(i - position))));
    updateActive(Math.round(position));
  }

  // Reuse the original gallery's inset, radius and elapsed-time lift curve.
  function presentCards(value) {
    lift = value;
    galleryInset = Math.min(20, slideWidth * .025) * lift;
    track.style.setProperty('--art-gallery-radius', `${Math.min(14, slideWidth * .03) * lift}px`);
    positionTrack();
  }

  function animateLift(target, { duration = 220 } = {}) {
    view.cancelAnimationFrame(liftFrame);
    liftFrame = 0;
    const from = lift;
    if (reducedMotion.matches || !duration || Math.abs(target - from) < .001) {
      root.classList.remove('is-lifting');
      presentCards(target);
      return;
    }
    const start = view.performance.now();
    root.classList.add('is-lifting');
    const frame = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = target === 0 ? progress * progress * (3 - 2 * progress) : 1 - (1 - progress) ** 3;
      presentCards(from + (target - from) * eased);
      if (progress < 1) liftFrame = view.requestAnimationFrame(frame);
      else { liftFrame = 0; root.classList.remove('is-lifting'); }
    };
    liftFrame = view.requestAnimationFrame(frame);
  }

  function alignSelectionFrame() {
    if (!selectionFrame || selected < 0 || drag || Math.abs(position - Math.round(position)) > .001) return;
    const scrollLeft = rail.scrollLeft;
    thumbnailGroup.style.paddingInline = `${railCenterPadding}px`;
    thumbnailGroup.style.paddingTop = '0px';
    rail.scrollLeft = scrollLeft;
    let tile = choices[selected].getBoundingClientRect();
    thumbnailGroup.style.paddingInline = `${railCenterPadding + Math.round(tile.left) - tile.left}px`;
    thumbnailGroup.style.paddingTop = `${Math.ceil(tile.top) - tile.top}px`;
    rail.scrollLeft = scrollLeft;
    tile = choices[selected].getBoundingClientRect();
    const strip = selectionFrame.parentElement.getBoundingClientRect();
    const pixels = view.devicePixelRatio || 1;
    const border = Math.max(1, Math.round(2 * pixels));
    Object.assign(selectionFrame.style, {
      left: `${(Math.round(tile.left * pixels) - border) / pixels - strip.left}px`,
      top: `${(Math.round(tile.top * pixels) - border) / pixels - strip.top}px`,
      width: `${(Math.round(tile.width * pixels) + 2 * border) / pixels}px`,
      height: `${(Math.round(tile.height * pixels) + 2 * border) / pixels}px`,
      borderWidth: `${border / pixels}px`,
      borderRadius: `${(Math.round(8 * pixels) + border) / pixels}px`,
      transform: 'none'
    });
  }

  function measure() {
    stageWidth = stage.clientWidth || stage.getBoundingClientRect().width || 1;
    slideWidth = items[0].getBoundingClientRect().width || items[0].offsetWidth || stageWidth;
    const stageHeight = stage.clientHeight || stage.getBoundingClientRect().height || 1;
    items.forEach(item => {
      const button = item.querySelector('[data-image-open]');
      const image = button.querySelector('img');
      const style = view.getComputedStyle(item);
      const availableWidth = Math.max(1, slideWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
      const width = image.naturalWidth || Number(image.getAttribute('width'));
      const height = image.naturalHeight || Number(image.getAttribute('height'));
      if (!width || !height) return;
      const fit = Math.min(availableWidth / width, stageHeight / height);
      image.style.width = `${width * fit}px`;
      image.style.height = `${height * fit}px`;
    });
    const pixels = view.devicePixelRatio || 1;
    const gap = Math.max(1, Math.round(4 * pixels));
    const contentWidth = parseFloat(view.getComputedStyle(root).getPropertyValue('--art-thumb-width')) || 80;
    const contentHeight = Math.max(1, rail.clientHeight - 14);
    rail.style.setProperty('--art-thumb-gap', `${gap / pixels}px`);
    rail.style.setProperty('--art-thumb-box-width', `${(Math.round(contentWidth * pixels) + 2 * gap) / pixels}px`);
    rail.style.setProperty('--art-thumb-box-height', `${(Math.round(contentHeight * pixels) + 2 * gap) / pixels}px`);
    const first = choices[0].getBoundingClientRect();
    const width = choices[0].offsetWidth || first.width || parseFloat(view.getComputedStyle(choices[0]).width) || 1;
    const second = choices[1]?.getBoundingClientRect();
    const offset = choices[1] ? choices[1].offsetLeft - choices[0].offsetLeft : 0;
    const columnGap = parseFloat(view.getComputedStyle(thumbnailGroup).columnGap) || 0;
    stride = offset > 0 ? offset : second && second.left > first.left ? second.left - first.left : width + columnGap;
    railCenterPadding = Math.max(0, ((rail.clientWidth || rail.getBoundingClientRect().width) - width) / 2);
    rail.style.setProperty('--art-rail-padding', `${railCenterPadding}px`);
    thumbnailGroup.style.paddingInline = `${railCenterPadding}px`;
    presentCards(lift);
    render(position);
    alignArtworkTitle();
    alignSelectionFrame();
  }

  function stopAnimation() {
    view.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    motionVelocity = 0;
    root.classList.remove('is-moving');
  }

  function stopDragFrame() {
    view.cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    pendingDrag = null;
  }

  function cancelDrag() {
    stopDragFrame();
    const cancelled = drag;
    drag = null;
    if (cancelled?.capture?.hasPointerCapture(cancelled.id)) cancelled.capture.releasePointerCapture(cancelled.id);
    swipeInputs.forEach(input => input.reset());
    restorePanelAccess();
    root.classList.remove('is-dragging');
  }

  function animateTo(value, { immediate = false, velocity = motionVelocity, response,
    history = true, focusThumbnail = false, announce = true } = {}) {
    stopAnimation();
    destination = clamp(value);
    animationHistory = history;
    animateLift(0, { duration: immediate ? 0 : 280 });
    const from = position;
    const finish = () => {
      animationFrame = 0;
      motionVelocity = 0;
      render(destination);
      alignSelectionFrame();
      restorePanelAccess();
      root.classList.remove('is-moving');
      root.dataset.artSettled = String(Math.abs(position - Math.round(position)) < .001);
      if (focusThumbnail) choices[selected].focus({ preventScroll: true });
      if (announce && announcement) announcement.textContent = `Untitled #${selected + 1}, artwork ${selected + 1} of ${items.length}`;
      if (history) writeAddress(selected);
    };
    if (immediate || reducedMotion.matches || Math.abs(destination - from) < .001) { finish(); return; }
    const spring = createMotionSpring({ from, to: destination, velocity, unit: slideWidth, response });
    const start = view.performance.now();
    root.classList.add('is-moving');
    root.dataset.artSettled = 'false';
    const frame = now => {
      const state = spring.sample(now - start);
      motionVelocity = state.velocity;
      render(state.position);
      if (!state.done) animationFrame = view.requestAnimationFrame(frame);
      else finish();
    };
    animationFrame = view.requestAnimationFrame(frame);
  }

  function revealGallery() {
    const wasPuzzle = !puzzle.hidden;
    collection.hidden = false;
    puzzle.hidden = true;
    root.dataset.artView = 'gallery';
    laser?.setActive(false);
    if (wasPuzzle) measure();
  }

  function select(index, options) {
    cancelDrag();
    revealGallery();
    animateTo(index, options);
  }

  function showPuzzle() {
    cancelDrag(); stopAnimation(); closeOverlays();
    animateLift(0, { duration: 0 });
    render(Math.round(position));
    root.dataset.artSettled = 'true';
    collection.hidden = true;
    puzzle.hidden = false;
    root.dataset.artView = 'puzzle';
    laser ||= mountLaser(puzzle.querySelector('[data-laser-experiment]'));
    laser.prepare(); laser.setActive(true);
    puzzle.focus({ preventScroll: true });
  }

  function followAddress() {
    if (disposed) return;
    const url = new URL(readAddress(), view.location.href);
    const address = `${url.pathname}${url.hash}`;
    if (address === resolvedAddress) return;
    resolvedAddress = address;
    if (url.hash === '#links') { showPuzzle(); return; }
    const requested = Number(new URLSearchParams(url.hash.slice(1)).get('artwork'));
    const index = Number.isInteger(requested) && requested > 0 && requested <= items.length ? requested - 1 : 0;
    select(index, { immediate: true, history: false });
  }

  function beginDrag(event, surface, unit) {
    if (!event.isPrimary || event.button !== 0 || doc.querySelector('dialog[open]') || drag || !puzzle.hidden) return false;
    suppressClickUntil = 0;
    stopDragFrame(); stopAnimation();
    destination = position;
    const capture = event.nativeTouch ? null : event.target.closest('button') || surface;
    const pointerTouch = event.pointerType === 'touch';
    drag = {
      id: event.pointerId, surface, capture, unit, target: event.target,
      nativeTouch: Boolean(event.nativeTouch), originSlide: event.nativeTouch ? event.target.closest('[data-art-item]') : null,
      x: event.clientX, y: event.clientY, start: position, lastX: event.clientX,
      lastTime: view.performance.now(), velocity: 0, moved: false, axis: null,
      pointerTouch, touch: surface === stage && pointerTouch
    };
    if (capture && !pointerTouch) capture.setPointerCapture(event.pointerId);
    return true;
  }

  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.pointerTouch && drag.axis !== 'x') return;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || !drag.pointerTouch && Math.abs(dx) < Math.abs(dy)) return;
      if (drag.capture && !drag.capture.hasPointerCapture(drag.id)) drag.capture.setPointerCapture(drag.id);
      drag.moved = true;
      root.classList.add('is-dragging');
      root.dataset.artSettled = 'false';
      animateLift(1);
    }
    const elapsed = Math.max(1, event.time - drag.lastTime);
    drag.velocity = (drag.lastX - event.clientX) / (elapsed * drag.unit);
    drag.lastX = event.clientX;
    drag.lastTime = event.time;
    render(drag.start - dx / drag.unit);
  }

  function flushDragFrame() {
    const latest = pendingDrag;
    stopDragFrame();
    if (latest) moveDrag(latest);
  }

  function queueDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (event.axis) drag.axis = event.axis;
    if (drag.pointerTouch && !drag.axis) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) drag.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
    }
    if (drag.axis === 'y') return;
    if (Math.abs(event.clientX - drag.x) > 8) event.preventDefault?.();
    pendingDrag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, time: view.performance.now() };
    if (!dragFrame) dragFrame = view.requestAnimationFrame(flushDragFrame);
  }

  function endDrag(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    if (cancelled) stopDragFrame();
    else flushDragFrame();
    const finished = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (finished.capture?.hasPointerCapture(event.pointerId)) finished.capture.releasePointerCapture(event.pointerId);
    restorePanelAccess();
    if (finished.moved) {
      suppressClickUntil = view.performance.now() + 250;
      const moving = view.performance.now() - finished.lastTime < 100 && !cancelled;
      const velocity = moving ? finished.velocity : 0;
      const next = cancelled ? Math.round(finished.start) : settleProjectSwipe({
        start: finished.start, position, velocity, deltaX: event.clientX - finished.x,
        unit: finished.unit, touch: finished.touch
      });
      select(clamp(next), { velocity, history: !cancelled });
    } else if (Math.abs(position - Math.round(position)) > .001) {
      select(Math.round(position), { history: !cancelled });
    } else root.dataset.artSettled = 'true';
  }

  listen(details, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const backlink = event.target.closest?.('[role="doc-backlink"][data-article-jump]');
    if (!backlink || !details.contains(backlink)) return;
    const reference = doc.getElementById(backlink.dataset.articleJump);
    const index = chapters.indexOf(reference?.closest('.case-study-section'));
    if (index >= 0 && chapters[index].hidden) select(index, { immediate: true });
  }, { capture: true });
  listen(root.closest('.serif-site') || root, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      !event.target.closest?.('.serif-skip-link')) return;
    event.preventDefault();
    const target = puzzle.hidden ? stage : puzzle;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  listen(root, 'click', event => {
    if (event.detail === 0 || !event.target.closest?.('[data-image-open], [data-art-select]') || view.performance.now() >= suppressClickUntil) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, { capture: true });
  listen(root, 'click', event => {
    if (event.defaultPrevented) return;
    const choice = event.target.closest?.('[data-art-select]');
    if (choice) select(Number(choice.dataset.artSelect));
    if (event.target.closest?.('[data-art-return]')) {
      select(Math.max(0, selected));
      stage.focus({ preventScroll: true });
    }
  });
  listen(root, 'keydown', event => {
    if (event.defaultPrevented || doc.querySelector('dialog[open]') || !event.target.closest?.('.art-gallery') ||
      event.altKey || event.metaKey || event.ctrlKey) return;
    const start = Math.round(destination);
    const index = event.key === 'ArrowRight' ? start + 1 : event.key === 'ArrowLeft' ? start - 1 :
      event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (index === null) return;
    event.preventDefault();
    select(clamp(index), { focusThumbnail: rail.contains(event.target) });
  });
  for (const surface of [stage, rail]) {
    swipeInputs.push(mountSwipeInput(surface, {
      start: event => beginDrag(event, surface, surface === stage ? slideWidth : stride),
      move: queueDrag, end: endDrag, signal: controller.signal
    }));
    listen(surface, 'selectstart', event => event.preventDefault());
    listen(surface, 'dragstart', event => event.preventDefault());
  }
  function settleInterrupted({ immediate = false } = {}) {
    const target = Math.round(drag ? drag.start : destination);
    const history = !drag && animationHistory;
    cancelDrag();
    if (!puzzle.hidden) { stopAnimation(); return; }
    animateTo(target, { immediate, velocity: 0, history });
  }
  listen(view, 'blur', () => settleInterrupted());
  listen(view, 'resize', () => {
    settleInterrupted();
    view.cancelAnimationFrame(resizeFrame);
    resizeFrame = view.requestAnimationFrame(() => { resizeFrame = 0; measure(); });
  });
  listen(reducedMotion, 'change', event => {
    if (event.matches && animationFrame) settleInterrupted({ immediate: true });
    if (event.matches && liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
  });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) settleInterrupted({ immediate: true }); });
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
  measure();
  followAddress();
  return () => {
    if (disposed) return;
    disposed = true;
    cancelDrag(); stopAnimation();
    view.cancelAnimationFrame(liftFrame);
    view.cancelAnimationFrame(resizeFrame);
    controller.abort();
    imageViewer.destroy(); caseStudy.destroy(); laser?.destroy();
  };
}
