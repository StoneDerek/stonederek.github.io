import { settleTiles, canAnimateTiles, captureProjectBackdrop } from './project-transition.js';
import { mountProjectMenu } from './project-menu.js';
import { mountSiteMenu } from './site-menu.js';
import { createProjectRequests } from './project-navigation.js';
import { mountProjectFavicon } from './favicon.js';
import { projectIndexFromHash } from './project-links.js';
import { createAboutSwipe, galleryFrame, settleProjectSwipe } from './section-state.js';
import { createMotionSpring } from './motion-spring.js';
import { createAboutHeader } from './about-header.js';
import { aboutPalette, homePalette } from '../data/section-palettes.js';

export function mountPortfolio({ sectionLinks = { hide() {} } } = {}) {
  const root = document.getElementById('portfolio');
  const data = document.getElementById('portfolio-data');
  if (!root || !data) return;
  const controller = new AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: controller.signal });
  let disposed = false;
  const aboutPreview = root.querySelector('[data-about-preview]');
  const endPanel = root.querySelector('[data-gallery-end]');
  const endReturn = root.querySelector('[data-end-return]');
  const projects = JSON.parse(data.textContent);
  const aboutHeader = createAboutHeader(projects[0].palette, aboutPalette);
  const updateFavicon = mountProjectFavicon(document.querySelector('[data-project-favicon]'));
  const slides = [...root.querySelectorAll('[data-slide]')];
  const slideImages = slides.map(slide => slide.querySelector('img'));
  const captionButton = root.querySelector('.caption-link');
  const caption = root.querySelector('.project-caption');
  const captionWord = captionButton.querySelector('.caption-word');
  const titleText = captionButton.querySelector('[data-title]');
  const titleMetrics = captionButton.querySelector('[data-title-metrics]');
  const thumbnails = [...root.querySelectorAll('[data-thumbnail]')];
  const rail = root.querySelector('.thumbnail-rail');
  const galleryTrack = root.querySelector('[data-gallery-track]');
  const stage = root.querySelector('[data-stage]');
  const menu = root.querySelector('[data-menu]');
  const menuToggle = menu.querySelector('summary');
  const menuChoices = [...menu.querySelectorAll('button, a[href], [data-projects-toggle]')];
  const menuProjects = [...menu.querySelectorAll('[data-menu-project]')];
  const projectsMenu = menu.querySelector('[data-projects-menu]');
  const projectsToggle = projectsMenu.querySelector('[data-projects-toggle]');
  const homeMenuButton = menu.querySelector('[data-menu-home]');
  const aboutMenuButton = menu.querySelector('[data-menu-about]');
  const siteHeader = root.querySelector('.site-header');
  const projectView = root.querySelector('[data-project-view]');
  const projectPage = projectView.querySelector('.project-page');
  const gallerySurfaces = [...root.querySelectorAll('.carousel, .filmstrip, .mobile-controls')];
  const endSurfaces = gallerySurfaces.filter(surface => !surface.classList.contains('carousel'));
  const workLabel = menu.querySelector('[data-menu-context="work"]');
  const projectLabel = menu.querySelector('[data-menu-context="project"]');
  const aboutLabel = menu.querySelector('[data-menu-context="about"]');
  const menuTitle = menu.querySelector('[data-menu-title]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const projectNavigation = mountProjectMenu(projectsMenu, reducedMotion, { signal: controller.signal });
  const visibleMenuChoices = () => menuChoices.filter(choice => choice === projectsToggle || !projectsMenu.contains(choice) || projectNavigation.expanded);
  const previousButton = root.querySelector('[data-step="-1"]');
  const nextButton = root.querySelector('[data-step="1"]');
  const captionHeading = root.querySelector('.project-caption h1');
  const mobileInspect = root.querySelector('.mobile-inspect');
  const detailMedia = root.querySelector('[data-detail-media]');
  const skipLink = root.querySelector('.skip-link');
  const last = projects.length - 1;
  const end = projects.length;
  const clamp = value => Math.max(0, Math.min(last, value));
  const clampPosition = value => Math.max(0, Math.min(end, value));
  const textNodes = new Map();
  const setText = (selector, value) => {
    if (!textNodes.has(selector)) textNodes.set(selector, root.querySelector(selector));
    const node = textNodes.get(selector);
    if (node.textContent !== String(value)) node.textContent = value;
  };
  const hasDialog = () => projectOpen || projectRequests.busy || aboutCommitting;
  let active = -1;
  let endOpen = false;
  let position = 0;
  let destination = 0;
  let stageWidth = 1;
  let galleryInset = 0;
  let lift = 0;
  let liftFrame = 0;
  let stride = 1;
  let animationFrame = 0;
  let motionVelocity = 0;
  let resizeFrame = 0;
  let wheelTimer = 0;
  let wheelPosition = null;
  let drag = null;
  let aboutTravel = 0;
  let aboutFrame = 0;
  let aboutVelocity = 0;
  let aboutCommitting = false;
  let aboutHeaderActive = false;
  let aboutWarmed = false;
  let suppressClickUntil = 0;
  let titleFrame = 0;
  let titleSlots = [];
  let slideEndsAt = 0;
  let projectOpen = false;
  let projectAbort = null;
  let projectOrigin = { x: .5, y: .5 };
  let projectReturnFocus = captionButton;
  let menuContext = 'home';
  let contextAnimations = [];
  let contextGeneration = 0;
  let menuTitleAnimation = null;
  let menuTitleGeneration = 0;
  let desiredMenuTitle = menuTitle.textContent;
  const titleMeasure = document.createElement('canvas').getContext('2d');
  let measuredFont = '';
  const glyphWidths = new Map();
  let renderedX = NaN;
  let renderedScroll = NaN;
  let focusedPosition = NaN;
  const thumbnailFocus = thumbnails.map(() => NaN);
  let renderedInset = NaN;
  let renderedScale = NaN;
  let renderedRadius = NaN;
  let renderedEndProgress = NaN;
  const menuNavigation = mountSiteMenu(menu, reducedMotion, { signal: controller.signal, onChange: updateMenuName });
  const projectRequests = createProjectRequests({
    getCurrent: () => ({ open: projectOpen, index: active }),
    open: openProject,
    close: () => transitionProject(false),
    cancel: () => projectAbort?.abort(),
    settled: restoreProjectFocus
  });

  function updateMenuName() {
    const location = menuContext === 'about' ? `About: ${siteHeader.dataset.owner}`
      : `${menuContext === 'project' ? 'Project' : 'Projects'}: ${endOpen ? 'Links' : projects[Math.max(0, active)].title}`;
    menuToggle.setAttribute('aria-label', `${menuNavigation.expanded ? 'Close' : 'Open'} navigation. ${location}`);
    homeMenuButton.removeAttribute('aria-current');
    aboutMenuButton.removeAttribute('aria-current');
    if (menuContext === 'about') aboutMenuButton.setAttribute('aria-current', 'page');
    const galleryLink = menu.querySelector('[data-menu-gallery]');
    if (menuContext === 'home') galleryLink.setAttribute('aria-current', 'page');
    else galleryLink.removeAttribute('aria-current');
    projectsMenu.dataset.current = String(menuContext !== 'about');
  }

  function setMenuContext(next, { immediate = false } = {}) {
    const context = typeof next === 'boolean' ? next ? 'project' : 'home' : next;
    if (menuContext === context && !immediate) return;
    const labels = [workLabel, projectLabel, aboutLabel];
    const selected = ['home', 'project', 'about'].indexOf(context);
    const generation = ++contextGeneration;
    const starts = labels.map(label => {
      const style = getComputedStyle(label);
      return { opacity: style.opacity, transform: style.transform };
    });
    contextAnimations.forEach(animation => animation.cancel());
    contextAnimations = [];
    menuContext = context;
    labels.forEach((label, i) => label.setAttribute('aria-hidden', String(i !== selected)));
    updateMenuName();
    const ends = labels.map((_, i) => ({ opacity: i === selected ? '1' : '0',
      transform: i === selected ? 'translateY(0)' : `translateY(${i < selected ? '-100%' : '100%'})` }));
    const finish = () => {
      if (generation !== contextGeneration) return;
      labels.forEach((label, i) => Object.assign(label.style, ends[i]));
      contextAnimations.forEach(animation => animation.cancel());
      contextAnimations = [];
    };
    if (immediate || reducedMotion.matches || typeof menuTitle.animate !== 'function') { finish(); return; }
    contextAnimations = labels.map((label, i) => label.animate([starts[i], ends[i]], {
      duration: i === selected ? 260 : 220,
      delay: (context === 'project' ? 100 : 50) + (i === selected ? 30 : 0),
      easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both'
    }));
    Promise.all(contextAnimations.map(animation => animation.finished.catch(() => {}))).then(finish);
  }

  async function setMenuTitle(title, { immediate = false } = {}) {
    if (desiredMenuTitle === title && !immediate) return;
    desiredMenuTitle = title;
    const generation = ++menuTitleGeneration;
    const style = getComputedStyle(menuTitle);
    const start = { opacity: style.opacity, transform: style.transform };
    menuTitleAnimation?.cancel();
    menuTitleAnimation = null;
    updateMenuName();
    if (immediate || reducedMotion.matches || typeof menuTitle.animate !== 'function') {
      menuTitle.textContent = title;
      menuTitle.style.opacity = '';
      menuTitle.style.transform = '';
      return;
    }
    menuTitleAnimation = menuTitle.animate([start, { opacity: 0, transform: 'translateY(-100%)' }], {
      duration: 120, easing: 'ease-in', fill: 'forwards'
    });
    await menuTitleAnimation.finished.catch(() => {});
    if (generation !== menuTitleGeneration) return;
    menuTitleAnimation.cancel();
    menuTitle.textContent = title;
    menuTitleAnimation = menuTitle.animate([
      { opacity: 0, transform: 'translateY(100%)' }, { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 200, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' });
    await menuTitleAnimation.finished.catch(() => {});
    if (generation !== menuTitleGeneration) return;
    menuTitleAnimation.cancel();
    menuTitleAnimation = null;
  }

  function announce() {
    setText('[data-announcement]', endOpen ? 'Professional links. End of selected work.'
      : `${projects[active].title}, project ${active + 1} of ${projects.length}. ${projects[active].caption}`);
  }

  function updateBounds(index) {
    previousButton.disabled = index <= 0;
    nextButton.disabled = index >= end;
    previousButton.setAttribute('aria-label', index >= end ? 'Back to last project' : 'Previous project');
    nextButton.setAttribute('aria-label', index >= last ? 'Show professional links' : 'Next project');
  }

  function updateGalleryIdentity({ immediate = false } = {}) {
    const project = projects[Math.max(0, active)];
    const palette = endOpen ? homePalette : project.palette;
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--ink', palette.ink);
    root.style.setProperty('--caption-color', palette.caption || palette.accent);
    menuProjects.forEach(button => {
      if (!endOpen && Number(button.dataset.menuProject) === active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    setMenuTitle(endOpen ? 'Links' : project.title, { immediate });
  }

  function updateEnd(progress, links) {
    const focused = document.activeElement;
    if (progress !== renderedEndProgress) {
      root.style.setProperty('--end-progress', String(progress));
      renderedEndProgress = progress;
    }
    if (endPanel.inert !== !links) endPanel.inert = !links;
    if (endPanel.getAttribute('aria-hidden') !== String(!links)) endPanel.setAttribute('aria-hidden', String(!links));
    if (caption.getAttribute('aria-hidden') !== String(links)) caption.setAttribute('aria-hidden', String(links));
    // Keep a held caption's pointer capture alive until its drag ends.
    const captionInert = links && drag?.capture !== captionButton;
    if (captionButton.inert !== captionInert) captionButton.inert = captionInert;
    const surfacesHidden = links || projectOpen || projectRequests.busy;
    endSurfaces.forEach(surface => {
      if (surface.inert !== surfacesHidden) surface.inert = surfacesHidden;
      if (surface.getAttribute('aria-hidden') !== String(surfacesHidden)) surface.setAttribute('aria-hidden', String(surfacesHidden));
    });
    if (!links && endPanel.contains(focused)) root.querySelector('.carousel').focus({ preventScroll: true });
    else if (links && !drag && [captionButton, rail, previousButton, nextButton, mobileInspect].some(node => node.contains(focused))) endReturn.focus({ preventScroll: true });
    if (endOpen === links) return;
    endOpen = links;
    root.dataset.atGalleryEnd = String(links);
    skipLink.href = links ? '#gallery-end' : '#project-caption';
    updateGalleryIdentity();
  }

  function finishTitle() {
    cancelAnimationFrame(titleFrame);
    titleFrame = 0;
    titleSlots = [];
    titleText.textContent = projects[active].title;
    titleMetrics.textContent = projects[active].title;
    captionWord.style.width = '';
    root.classList.remove('is-scrambling');
  }

  function scrambleTitle(next, { immediate = false, direction = 1 } = {}) {
    cancelAnimationFrame(titleFrame);
    titleFrame = 0;
    if (immediate || reducedMotion.matches) { finishTitle(); return; }
    // On a reversal, begin with the glyphs and widths currently on screen.
    const oldLetters = titleSlots.length
      ? titleSlots.map(slot => slot.glyph.textContent)
      : Array.from(titleText.textContent);
    const oldSizes = titleSlots.length ? titleSlots.map(slot => slot.size) : null;
    const oldWidth = captionWord.getBoundingClientRect().width;
    const font = getComputedStyle(titleText);
    const fontKey = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
    if (fontKey !== measuredFont) {
      titleMeasure.font = fontKey;
      measuredFont = fontKey;
      glyphWidths.clear();
    }
    const width = text => {
      if (!glyphWidths.has(text)) glyphWidths.set(text, titleMeasure.measureText(text).width);
      return glyphWidths.get(text);
    };
    const letters = Array.from(next);
    titleMetrics.textContent = next;
    const newWidth = titleMetrics.getBoundingClientRect().width;
    const count = Math.max(oldLetters.length, letters.length);
    const pool = [...new Set((oldLetters.join('') + next).toLowerCase().replace(/\s/g, ''))];
    const lowerPool = pool.map(letter => ({ letter, width: width(letter) }));
    const upperPool = pool.map(letter => ({ letter: letter.toUpperCase(), width: width(letter.toUpperCase()) }));
    const oldTotal = oldSizes ? oldWidth : oldLetters.reduce((total, letter) => total + width(letter), 0);
    const newTotal = letters.reduce((total, letter) => total + width(letter), 0);
    const fragment = document.createDocumentFragment();
    titleSlots = Array.from({ length: count }, (_, i) => {
      const slot = document.createElement('span');
      const glyph = document.createElement('span');
      slot.className = 'caption-slot';
      glyph.className = 'caption-glyph';
      slot.append(glyph);
      fragment.append(slot);
      const old = oldLetters[i] || '';
      const target = letters[i] || '';
      const oldSize = oldSizes ? oldSizes[i] || 0 : width(old) * oldWidth / (oldTotal || 1);
      const newSize = width(target) * newWidth / (newTotal || 1);
      // Increasing gallery position brings the image in from the right.
      const ordinal = (direction > 0 ? count - 1 - i : i) / Math.max(1, count - 1);
      glyph.textContent = old;
      return { slot, glyph, old, target, oldSize, newSize, size: oldSize,
        renderedX: NaN, renderedSize: NaN,
        pool: target && target === target.toUpperCase() ? upperPool : lowerPool,
        begin: ordinal * .2, resolve: .32 + ordinal * .5, nextChange: 0, swaps: 0 };
    });
    titleText.replaceChildren(fragment);
    const start = performance.now();
    const duration = slideEndsAt > start ? Math.max(180, Math.min(420, slideEndsAt - start)) : 360;
    let renderedWidth = NaN;
    root.classList.add('is-scrambling');
    const frame = now => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      if (progress === 1) { finishTitle(); return; }
      const blend = progress * progress * (3 - 2 * progress);
      let x = 0;
      for (let i = 0; i < titleSlots.length; i++) {
        const s = titleSlots[i];
        s.size = s.oldSize + (s.newSize - s.oldSize) * blend;
        if (x !== s.renderedX) {
          s.slot.style.left = `${x}px`;
          s.renderedX = x;
        }
        if (s.size !== s.renderedSize) {
          s.slot.style.width = `${s.size}px`;
          s.renderedSize = s.size;
        }
        x += s.size;
        let replacement;
        if (s.old === s.target || s.target === ' ' || progress >= s.resolve) {
          replacement = s.target;
        } else if (progress < s.begin) {
          replacement = s.old;
        } else if (elapsed >= s.nextChange) {
          const compatible = s.pool.filter(candidate => candidate.width <= s.size + .5);
          replacement = compatible.length ? compatible[(i * 5 + s.swaps * 3) % compatible.length].letter : s.target;
          s.swaps++;
          s.nextChange = elapsed + 28 + progress * progress * 90 + (i % 4) * 7;
        }
        if (replacement !== undefined && s.glyph.textContent !== replacement) s.glyph.textContent = replacement;
      }
      if (x !== renderedWidth) {
        captionWord.style.width = `${x}px`;
        renderedWidth = x;
      }
      titleFrame = requestAnimationFrame(frame);
    };
    // Lay out the starting slots before the next paint.
    frame(start);
  }

  function updateActive(index) {
    if (active === index) return;
    const previous = active;
    const focusedThumbnail = previous >= 0 && document.activeElement === thumbnails[previous];
    active = index;
    prepareImages(active);
    const project = projects[active];
    captionButton.dataset.project = String(active);
    captionButton.setAttribute('aria-label', `View ${project.title}`);
    captionHeading.setAttribute('aria-label', project.title);
    scrambleTitle(project.title, { immediate: previous < 0, direction: Math.sign(index - previous) });
    slides[active].setAttribute('aria-hidden', 'false');
    if (focusedThumbnail) thumbnails[active].focus({ preventScroll: true });
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === active);
      slide.setAttribute('aria-hidden', String(i !== active));
    });
    thumbnails.forEach((button, i) => {
      button.classList.toggle('is-active', i === active);
      button.setAttribute('aria-pressed', String(i === active));
      button.tabIndex = i === active ? 0 : -1;
    });
    updateGalleryIdentity({ immediate: previous < 0 });
    setText('[data-mobile-count]', `${String(active + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`);
    mobileInspect.setAttribute('aria-label', `View ${project.title}`);
    updateBounds(root.classList.contains('is-moving') ? Math.round(destination) : active);
  }

  function prepareImages(index) {
    // Fetch the destination and its neighbors before they slide into view.
    // Distant covers stay lazy; thumbnails are small and remain eager.
    for (let i = Math.max(0, index - 1); i <= Math.min(last, index + 1); i++) {
      if (slideImages[i].loading === 'lazy') slideImages[i].loading = 'eager';
    }
  }

  function render(value) {
    const frame = galleryFrame(value, projects.length);
    position = frame.position;
    const x = -position * (stageWidth - galleryInset);
    if (x !== renderedX) {
      galleryTrack.style.transform = `translateX(${x}px)`;
      renderedX = x;
    }
    const scroll = Math.min(last, position) * stride;
    if (scroll !== renderedScroll) {
      rail.scrollLeft = scroll;
      renderedScroll = scroll;
    }
    if (position !== focusedPosition) {
      thumbnails.forEach((button, i) => {
        const focus = Math.max(0, 1 - Math.abs(i - position));
        if (focus !== thumbnailFocus[i]) {
          button.style.setProperty('--focus', focus);
          thumbnailFocus[i] = focus;
        }
      });
      focusedPosition = position;
    }
    updateEnd(frame.endProgress, frame.links);
    updateActive(frame.project);
  }

  function presentCards(value) {
    lift = value;
    galleryInset = Math.min(20, stageWidth * .025) * lift;
    // The slide pitch removes one inset so neighboring cards share a single gap.
    const scale = 1 - 2 * galleryInset / stageWidth;
    const radius = Math.min(14, stageWidth * .03) * lift;
    if (galleryInset !== renderedInset) {
      galleryTrack.style.setProperty('--gallery-inset', `${galleryInset}px`);
      renderedInset = galleryInset;
    }
    if (scale !== renderedScale) {
      galleryTrack.style.setProperty('--gallery-scale', String(scale));
      renderedScale = scale;
    }
    if (radius !== renderedRadius) {
      galleryTrack.style.setProperty('--gallery-radius', `${radius}px`);
      renderedRadius = radius;
    }
    render(position);
  }

  function animateLift(target, { duration = 220 } = {}) {
    cancelAnimationFrame(liftFrame);
    liftFrame = 0;
    const from = lift;
    if (reducedMotion.matches || !duration || Math.abs(target - from) < .001) {
      root.classList.remove('is-lifting');
      presentCards(target);
      return;
    }
    root.classList.add('is-lifting');
    const start = performance.now();
    const frame = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = target === 0 ? progress * progress * (3 - 2 * progress) : 1 - (1 - progress) ** 3;
      presentCards(from + (target - from) * eased);
      if (progress < 1) liftFrame = requestAnimationFrame(frame);
      else { liftFrame = 0; root.classList.remove('is-lifting'); }
    };
    liftFrame = requestAnimationFrame(frame);
  }

  function stopAnimation() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    motionVelocity = 0;
    slideEndsAt = 0;
    root.classList.remove('is-moving');
  }

  function stopWheel() {
    clearTimeout(wheelTimer);
    wheelPosition = null;
  }

  function presentAbout(value) {
    aboutTravel = Math.max(0, Math.min(stageWidth, value));
    root.style.setProperty('--about-drag', `${aboutTravel}px`);
    aboutPreview.hidden = aboutTravel === 0;
    if (aboutTravel) {
      root.dataset.aboutSwipe = aboutCommitting ? 'entering' : 'preview';
      const progress = aboutTravel / stageWidth;
      const frame = aboutHeader(progress);
      root.style.setProperty('--accent', frame.accent);
      root.style.setProperty('--ink', frame.ink);
      root.style.setProperty('--about-menu-opacity', String(frame.labelOpacity));
      root.style.setProperty('--about-links-opacity', String(frame.linksOpacity));
      const context = frame.about ? 'about' : 'home';
      if (!aboutHeaderActive || menuContext !== context) {
        setMenuContext(context, { immediate: true });
        setMenuTitle(frame.about ? siteHeader.dataset.owner : projects[active].title, { immediate: true });
      }
      sectionLinks.previewAbout?.(progress);
      aboutHeaderActive = true;
    } else {
      if (aboutHeaderActive) {
        setMenuContext('home', { immediate: true });
        updateGalleryIdentity({ immediate: true });
        root.style.removeProperty('--about-menu-opacity');
        root.style.removeProperty('--about-links-opacity');
        sectionLinks.previewAbout?.(0);
        // Settle the cancelled swipe before restoring ordinary palette transitions.
        getComputedStyle(menu).backgroundColor;
        aboutHeaderActive = false;
      }
      delete root.dataset.aboutSwipe;
    }
  }

  function stopAbout({ reset = false } = {}) {
    cancelAnimationFrame(aboutFrame);
    aboutFrame = 0;
    aboutVelocity = 0;
    aboutCommitting = false;
    if (!reset) return;
    presentAbout(0);
  }

  function animateAbout(target, { commit = false, velocity = aboutVelocity } = {}) {
    stopAbout();
    aboutCommitting = commit;
    const from = aboutTravel;
    const finish = () => {
      aboutFrame = 0;
      aboutVelocity = 0;
      presentAbout(target);
      if (!commit || disposed) return;
      document.dispatchEvent(new CustomEvent('portfolio:section-navigate', {
        detail: { route: 'about', gallerySwipe: true }
      }));
    };
    if (reducedMotion.matches || Math.abs(target - from) < .001) { finish(); return; }
    const start = performance.now();
    const spring = createMotionSpring({ from: from / stageWidth, to: target / stageWidth,
      velocity: velocity / stageWidth, unit: stageWidth, response: commit ? 360 : 280 });
    const frame = now => {
      const state = spring.sample(now - start);
      aboutVelocity = state.velocity * stageWidth;
      presentAbout(state.position * stageWidth);
      if (!state.done) aboutFrame = requestAnimationFrame(frame);
      else finish();
    };
    aboutFrame = requestAnimationFrame(frame);
  }

  function cancelDrag() {
    if (drag?.capture.hasPointerCapture(drag.id)) drag.capture.releasePointerCapture(drag.id);
    drag = null;
    root.classList.remove('is-dragging');
  }

  function animateTo(value, { immediate = false, velocity = motionVelocity, response,
    focusThumbnail = false, announceSelection = true } = {}) {
    stopAnimation();
    destination = clampPosition(value);
    prepareImages(Math.round(destination));
    updateBounds(Math.round(destination));
    animateLift(0, { duration: immediate ? 0 : 280 });
    const from = position;
    const distance = Math.abs(destination - from);
    const finish = () => {
      render(destination);
      updateFavicon(endOpen ? endPanel.dataset.favicon : projects[active].favicon);
      root.classList.remove('is-moving');
      animationFrame = 0;
      motionVelocity = 0;
      slideEndsAt = 0;
      if (focusThumbnail) (endOpen ? endReturn : thumbnails[active]).focus({ preventScroll: true });
      if (announceSelection) announce();
    };
    if (immediate || reducedMotion.matches || distance < .001) { finish(); return; }
    const spring = createMotionSpring({ from, to: destination, velocity, unit: stageWidth, response });
    const start = performance.now();
    slideEndsAt = start + spring.duration;
    root.classList.add('is-moving');
    const frame = now => {
      const state = spring.sample(now - start);
      motionVelocity = state.velocity;
      render(state.position);
      if (!state.done) animationFrame = requestAnimationFrame(frame);
      else finish();
    };
    animationFrame = requestAnimationFrame(frame);
  }

  function select(index, options) {
    cancelDrag();
    stopAbout({ reset: true });
    stopWheel();
    animateTo(index, options);
  }

  function measure() {
    stageWidth = stage.clientWidth || 1;
    stride = thumbnails.length > 1 ? thumbnails[1].offsetLeft - thumbnails[0].offsetLeft : thumbnails[0].offsetWidth;
    const railPadding = Math.max(0, (rail.clientWidth - thumbnails[0].offsetWidth) / 2);
    const summaryHeight = menuToggle.getBoundingClientRect().height;
    rail.style.setProperty('--rail-padding', `${railPadding}px`);
    menu.style.setProperty('--menu-summary-height', `${summaryHeight}px`);
    // Changing padding can move the scroll position even if the target is equal.
    renderedScroll = NaN;
    if (menuNavigation.animating) animateMenu(menuNavigation.expanded);
    presentCards(lift);
  }

  function animateMenu(open, { focus = false, focusChoice = null } = {}) {
    menuNavigation.set(open, { focus });
    if (focusChoice !== null) visibleMenuChoices()[focusChoice]?.focus({ preventScroll: true });
  }
  function closeMenu(options) { animateMenu(false, options); }
  listen(menuToggle, 'click', event => {
    event.preventDefault();
    animateMenu(!menuNavigation.expanded);
  });
  listen(menuToggle, 'keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    event.stopPropagation();
    animateMenu(true, { focusChoice: event.key === 'ArrowDown' ? 0 : visibleMenuChoices().length - 1 });
  });
  listen(document, 'pointerdown', event => {
    if (menuNavigation.expanded && !menu.contains(event.target)) closeMenu();
  });
  listen(menu, 'focusout', event => {
    if (menuNavigation.expanded && event.relatedTarget && !menu.contains(event.relatedTarget)) closeMenu();
  });

  function fillProject(index) {
    select(index, { immediate: true, announceSelection: false });
    finishTitle();
    const project = projects[active];
    setText('[data-detail-title]', project.title);
    setText('[data-detail-category]', project.category);
    setText('[data-detail-year]', project.year);
    setText('[data-detail-description]', project.description);
    setText('[data-detail-note]', project.note);
    setText('[data-detail-number]', `${String(active + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`);
    const media = detailMedia;
    media.replaceChildren();
    const figures = document.createDocumentFragment();
    // Article media is explicitly supplied; the gallery cover is never inserted here.
    for (const item of project.articleMedia || []) {
      if (!item.src) continue;
      const figure = document.createElement('figure');
      figure.className = 'project-figure';
      const image = document.createElement('img');
      image.src = /^(https?:\/\/|\/)/.test(item.src) ? item.src : `${media.dataset.assetBase}${item.src}`;
      image.alt = item.alt || '';
      image.decoding = 'async';
      image.loading = figures.childElementCount ? 'lazy' : 'eager';
      if (item.width > 0) image.width = item.width;
      if (item.height > 0) image.height = item.height;
      figure.append(image);
      if (item.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = item.caption;
        figure.append(caption);
      }
      figures.append(figure);
    }
    media.append(figures);
    media.hidden = !media.childElementCount;
    projectView.scrollTop = 0;
  }

  function restoreProjectFocus() {
    if (disposed) return;
    if (projectRequests.pending) return;
    const target = menuNavigation.expanded
      ? menu.querySelector(projectOpen ? `[data-menu-project="${active}"]` : '[data-action="gallery"]')
      : projectOpen ? projectView.querySelector('[data-detail-title]')
      : endOpen ? endReturn
      : siteHeader.contains(projectReturnFocus) ? menuToggle : projectReturnFocus;
    (target?.isConnected ? target : captionButton).focus({ preventScroll: true });
  }

  async function transitionProject(opening, { replacing = false } = {}) {
    if (disposed) return;
    const scrollTop = projectView.scrollTop;
    const originalVisibility = projectPage.style.visibility;
    projectPage.style.visibility = 'hidden';
    projectAbort = new AbortController();
    // Move focus before making a surface inaccessible to keyboard and assistive technology.
    if (gallerySurfaces.some(surface => surface.contains(document.activeElement)) || projectView.contains(document.activeElement)) {
      menuToggle.focus({ preventScroll: true });
    }
    gallerySurfaces.forEach(surface => { surface.inert = true; surface.setAttribute('aria-hidden', 'true'); });
    projectView.inert = true;
    root.classList.add('has-project', 'is-project-transitioning');
    root.classList.toggle('is-project-opening', opening);
    root.classList.toggle('is-project-replacing', replacing);
    projectView.hidden = false;
    setMenuContext(opening);
    document.body.classList.add('dialog-open');
    try {
      await settleTiles(root, projectPage, {
        opening, origin: projectOrigin, scrollTop: opening ? 0 : scrollTop,
        signal: projectAbort.signal, reducedMotion: reducedMotion.matches
      });
    } finally {
      projectOpen = opening;
      projectView.hidden = !opening;
      projectView.inert = !opening;
      root.classList.remove('is-project-transitioning', 'is-project-opening', 'is-project-replacing');
      projectPage.style.visibility = originalVisibility;
      root.classList.toggle('has-project', opening);
      skipLink.href = opening ? '#detail-title' : '#project-caption';
      gallerySurfaces.forEach(surface => {
        surface.inert = opening;
        if (opening) surface.setAttribute('aria-hidden', 'true');
        else surface.removeAttribute('aria-hidden');
      });
      if (!disposed) document.body.classList.toggle('dialog-open', opening);
      projectAbort = null;
    }
  }

  async function openProject(request, { replacing }) {
    if (disposed) return;
    const backdrop = replacing && canAnimateTiles({ reducedMotion: reducedMotion.matches })
      ? captureProjectBackdrop(root, projectPage, { scrollTop: projectView.scrollTop }) : null;
    try {
      projectOrigin = request.origin || projectOrigin;
      projectReturnFocus = request.returnFocus || projectReturnFocus;
      fillProject(request.index);
      await transitionProject(true, { replacing });
    } finally {
      backdrop?.remove();
    }
  }

  function clickOrigin(event, button) {
    const box = button.getBoundingClientRect();
    const x = event.detail ? event.clientX : box.left + box.width / 2;
    const y = event.detail ? event.clientY : box.top + box.height / 2;
    return { x: Math.max(0, Math.min(1, x / document.documentElement.clientWidth)),
      y: Math.max(0, Math.min(1, y / (projectView.clientHeight || root.clientHeight || 1))) };
  }

  function requestProject(index, options = {}) {
    const pendingAbout = aboutCommitting && menuContext === 'about';
    cancelDrag();
    stopAbout({ reset: true });
    const selected = index === null ? null : clamp(index);
    const fragment = selected === null ? '' : `#project=${encodeURIComponent(projects[selected].slug)}`;
    if (window.__PORTFOLIO_PREVIEW_FRAGMENT__ !== undefined) {
      window.parent.postMessage({ type: 'portfolio-preview-fragment', fragment }, '*');
    } else {
      const address = new URL(window.location.href);
      address.hash = fragment;
      window.history.replaceState(window.history.state, '', address);
    }
    if (pendingAbout) {
      document.dispatchEvent(new CustomEvent('portfolio:section-navigate', {
        detail: { route: 'projects', fragment: fragment.slice(1), replace: true }
      }));
    }
    void projectRequests.request({ index: selected, ...options });
  }

  listen(root, 'click', event => {
    if (performance.now() < suppressClickUntil && event.detail !== 0 && (stage.contains(event.target) || rail.contains(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const thumbnail = event.target.closest('[data-thumbnail]');
    if (thumbnail && !hasDialog()) { select(Number(thumbnail.dataset.thumbnail), { focusThumbnail: true }); return; }
    const step = event.target.closest('[data-step]');
    if (step && !hasDialog()) { select(Math.round(destination) + Number(step.dataset.step)); return; }
    if (event.target.closest('[data-end-return]') && !hasDialog()) { select(last, { focusThumbnail: true }); return; }
    const choice = event.target.closest('[data-menu-project]');
    if (choice) {
      const index = Number(choice.dataset.menuProject);
      closeMenu({ focus: true });
      requestProject(index, { origin: clickOrigin(event, choice), returnFocus: choice });
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton?.dataset.action === 'project') {
      closeMenu();
      requestProject(Number(actionButton.dataset.project ?? active), {
        origin: clickOrigin(event, actionButton), returnFocus: actionButton
      });
    }
    if (actionButton?.dataset.action === 'gallery') {
      event.preventDefault();
      closeMenu({ focus: true });
      if (projectOpen || projectRequests.busy || aboutCommitting) requestProject(null);
      else if (endOpen || destination > last) select(last);
    }
  });

  function beginDrag(event, surface, unit) {
    if (!event.isPrimary || event.button !== 0 || hasDialog()) return;
    // A fresh press is intentional; only the click generated by the preceding drag is suppressed.
    suppressClickUntil = 0;
    if (event.target.closest('[data-end-link]')) return;
    const aboutEligible = surface === stage && position < .001 && !animationFrame;
    stopWheel();
    stopAnimation();
    stopAbout({ reset: !aboutEligible });
    destination = position;
    const capture = event.target.closest('button') || surface;
    const about = aboutEligible ? createAboutSwipe(stageWidth) : null;
    drag = {
      id: event.pointerId, surface, capture, unit,
      x: event.clientX, y: event.clientY, start: position,
      lastX: event.clientX, lastTime: performance.now(), velocity: 0, aboutVelocity: 0, moved: false,
      about,
      aboutStart: about?.distanceForTravel(aboutTravel) || 0,
      touch: surface === stage && (event.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches)
    };
    capture.setPointerCapture(event.pointerId);
    if (drag.about && !aboutWarmed && !window.__PORTFOLIO_PREVIEW_NAVIGATE__) {
      aboutWarmed = true;
      void fetch(aboutMenuButton.href, { signal: controller.signal }).catch(() => {});
    }
  }
  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId || aboutCommitting) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      drag.moved = true;
      root.classList.add('is-dragging');
      sectionLinks.hide();
      animateLift(1);
    }
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = (drag.lastX - event.clientX) / (elapsed * drag.unit);
    drag.lastX = event.clientX;
    drag.lastTime = now;
    if (drag.about) {
      const distance = dx + drag.aboutStart;
      const next = drag.about.move(distance);
      drag.aboutVelocity = (next.travel - aboutTravel) / elapsed;
      presentAbout(next.travel);
      if (distance > 0) {
        render(0);
        if (next.commit) {
          suppressClickUntil = performance.now() + 600;
          animateLift(0, { duration: 180 });
          animateAbout(stageWidth, { commit: true, velocity: drag.aboutVelocity });
        }
        return;
      }
      render(drag.start - distance / drag.unit);
      return;
    }
    const nextPosition = drag.start - dx / drag.unit;
    render(drag.surface === rail ? clamp(nextPosition) : nextPosition);
  }
  function endDrag(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    const finished = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (finished.capture.hasPointerCapture(event.pointerId)) finished.capture.releasePointerCapture(event.pointerId);
    if (aboutCommitting) return;
    const moving = performance.now() - finished.lastTime < 100 && !cancelled;
    if (aboutTravel > 0) {
      if (finished.moved) suppressClickUntil = performance.now() + 250;
      animateLift(0);
      animateAbout(0, { velocity: moving ? finished.aboutVelocity : 0 });
      return;
    }
    if (finished.moved) {
      suppressClickUntil = performance.now() + 250;
      const recentVelocity = moving ? finished.velocity : 0;
      const next = settleProjectSwipe({ start: finished.start, position, velocity: recentVelocity,
        deltaX: event.clientX - finished.x, unit: finished.unit, touch: finished.touch, cancelled });
      select(finished.surface === rail ? clamp(next) : next, { velocity: recentVelocity });
    } else if (Math.abs(position - Math.round(position)) > .001) {
      select(Math.round(position));
    }
  }
  listen(stage, 'pointerdown', event => beginDrag(event, stage, stageWidth));
  listen(rail, 'pointerdown', event => beginDrag(event, rail, stride));
  [stage, rail].forEach(surface => {
    listen(surface, 'selectstart', event => event.preventDefault());
    listen(surface, 'pointermove', moveDrag);
    listen(surface, 'pointerup', event => endDrag(event));
    listen(surface, 'pointercancel', event => endDrag(event, true));
    listen(surface, 'lostpointercapture', event => endDrag(event, true));
  });

  listen(rail, 'wheel', event => {
    if (event.ctrlKey || hasDialog() || drag) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    stopAbout({ reset: true });
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1;
    wheelPosition = clamp((wheelPosition ?? position) + delta * unit / stride);
    animateTo(wheelPosition, { response: 140, announceSelection: false });
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      const next = Math.round(wheelPosition);
      wheelPosition = null;
      animateTo(next);
    }, 160);
  }, { passive: false });

  listen(document, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (menuNavigation.expanded) {
      if ((event.key === 'Escape' || event.key === 'ArrowLeft') && projectNavigation.expanded && projectsMenu.contains(event.target)) {
        event.preventDefault(); projectNavigation.set(false, { focus: true }); return;
      }
      if (event.key === 'ArrowRight' && event.target === projectsToggle) {
        event.preventDefault(); projectNavigation.set(true); menuProjects[Math.max(0, active)]?.focus({ preventScroll: true }); return;
      }
      if (event.key === 'Escape') { event.preventDefault(); closeMenu({ focus: true }); return; }
      if (menu.contains(event.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const choices = visibleMenuChoices();
        const current = choices.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
          : Math.max(0, Math.min(choices.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
        choices[next]?.focus();
      }
      return;
    }
    if (projectOpen || projectRequests.busy) {
      if (event.key === 'Escape') { event.preventDefault(); requestProject(null); }
      return;
    }
    // The edge crossing commits to About. Keep its reveal steady while loading;
    // normal section links can still choose a different destination.
    if (aboutCommitting) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && aboutTravel > 0) {
      event.preventDefault(); cancelDrag(); stopAbout(); animateAbout(0); animateLift(0); return;
    }
    if (event.key === 'Escape' && endOpen) {
      event.preventDefault(); select(last, { focusThumbnail: true }); return;
    }
    const directions = { ArrowLeft: Math.round(destination) - 1, ArrowRight: Math.round(destination) + 1, Home: 0, End: end };
    if (!(event.key in directions)) return;
    event.preventDefault();
    select(directions[event.key], { focusThumbnail: rail.contains(event.target) });
  });

  listen(window, 'resize', () => {
    projectAbort?.abort();
    cancelDrag();
    stopAbout({ reset: true });
    animateLift(0);
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(measure);
  });
  listen(reducedMotion, 'change', () => {
    if (reducedMotion.matches) {
      projectAbort?.abort();
      setMenuContext(menuContext, { immediate: true });
      setMenuTitle(desiredMenuTitle, { immediate: true });
      projectNavigation.set(projectNavigation.expanded, { immediate: true });
    }
    if (reducedMotion.matches && titleFrame) finishTitle();
    if (reducedMotion.matches && liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
    if (reducedMotion.matches && animationFrame) animateTo(destination, { immediate: true });
    if (reducedMotion.matches && aboutFrame) animateAbout(aboutCommitting ? stageWidth : 0, { commit: aboutCommitting });
    if (reducedMotion.matches && menuNavigation.animating) menuNavigation.set(menuNavigation.expanded, { immediate: true });
  });
  listen(document, 'visibilitychange', () => {
    if (!document.hidden) return;
    projectAbort?.abort();
    cancelDrag();
    stopAbout({ reset: true });
    stopWheel();
    if (menuNavigation.animating) menuNavigation.set(menuNavigation.expanded, { immediate: true });
    if (animationFrame) animateTo(Math.round(destination), { immediate: true });
    if (titleFrame) finishTitle();
    if (liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
  });
  listen(document, 'astro:before-preparation', event => {
    closeMenu({ immediate: true });
    if (event.info?.gallerySwipe) return;
    cancelDrag();
    stopAbout({ reset: true });
  });
  listen(document, 'portfolio:preview-exit', () => closeMenu({ immediate: true }));
  measure();
  updateFavicon(projects[Math.max(0, active)].favicon);
  root.dataset.ready = 'true';
  const requestedIndex = projectIndexFromHash(window.__PORTFOLIO_PREVIEW_FRAGMENT__ ?? window.location.hash, projects);
  if (requestedIndex >= 0) requestProject(requestedIndex);
  listen(window, 'hashchange', () => {
    if (window.location.hash && !new URLSearchParams(window.location.hash.slice(1)).has('project')) return;
    const index = projectIndexFromHash(window.location.hash, projects);
    requestProject(index >= 0 ? index : null);
  });
  return () => {
    disposed = true;
    controller.abort();
    projectAbort?.abort();
    stopWheel();
    stopAnimation();
    stopAbout();
    [liftFrame, titleFrame, resizeFrame].forEach(cancelAnimationFrame);
    contextGeneration += 1;
    menuTitleGeneration += 1;
    contextAnimations.forEach(animation => animation.cancel());
    menuTitleAnimation?.cancel();
    menuNavigation.set(false, { immediate: true });
    projectNavigation.set(false, { immediate: true });
    if (drag?.capture.hasPointerCapture(drag.id)) drag.capture.releasePointerCapture(drag.id);
    drag = null;
    root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    document.body.classList.remove('dialog-open');
  };
}
