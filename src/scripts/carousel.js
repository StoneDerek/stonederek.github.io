import { settleTiles, canAnimateTiles, captureProjectBackdrop, articleRevealOrigin } from './project-transition.js';
import { mountProjectMenu } from './project-menu.js';
import { mountSiteMenu } from './site-menu.js';
import { mountMenuLabel } from './menu-label.js';
import { mountProjectCaption } from './project-caption.js';
import { createProjectRequests } from './project-navigation.js';
import { resolveGalleryLocation, galleryAddress, sectionForPanel } from './gallery-location.js';
import { firstProjectPanel } from '../data/gallery-panels.js';
import { galleryFrame, galleryCaptionFrame, settleProjectSwipe } from './section-state.js';
import { createMotionSpring } from './motion-spring.js';
import { mountLaser } from './ascii-laser.js';
import { linksPalette } from '../data/section-palettes.js';
import { sectionTiming } from '../data/section-motion.js';
import { readHeaderPalette, blendHeaderPalette, stopHeaderPalette } from './header-palette.js';
import { mountProjectCaseStudy, renderProjectMedia } from './project-case-study.js';
import { mountSwipeInput } from './swipe-input.js';

export function mountPortfolio() {
  const root = document.getElementById('portfolio');
  const data = document.getElementById('portfolio-data');
  if (!root || !data) return;
  const controller = new AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: controller.signal });
  let disposed = false;
  const endPanel = root.querySelector('[data-gallery-end]');
  const endReturn = root.querySelector('[data-end-return]');
  const credits = root.querySelector('[data-credits]');
  const panels = JSON.parse(data.textContent);
  const readAddress = () => new URL(window.__PORTFOLIO_PREVIEW_ADDRESS__ || window.location.href, 'https://portfolio.invalid');
  const initial = resolveGalleryLocation(readAddress(), panels);
  let lastAddress = readAddress().pathname + readAddress().hash;
  let pendingPanel = null;
  const slides = [...root.querySelectorAll('[data-slide]')];
  const slideImages = slides.map(slide => slide.querySelector('img'));
  const captionButton = root.querySelector('.caption-link');
  const caption = root.querySelector('.project-caption');
  const thumbnails = [...root.querySelectorAll('[data-thumbnail]')];
  const rail = root.querySelector('.thumbnail-rail');
  const thumbnailGroup = thumbnails[0].parentElement;
  const selectionFrame = root.querySelector('.selection-frame');
  const selectionOutline = selectionFrame.querySelector('[data-selection-outline]');
  const galleryTrack = root.querySelector('[data-gallery-track]');
  const stage = root.querySelector('[data-stage]');
  const menu = root.querySelector('[data-menu]');
  const menuToggle = menu.querySelector('summary');
  const menuChoices = [...menu.querySelectorAll('button, a[href], [data-projects-toggle], [data-publication-date]')];
  const menuProjects = [...menu.querySelectorAll('[data-menu-project]')];
  const projectsMenu = menu.querySelector('[data-projects-menu]');
  const projectsToggle = projectsMenu.querySelector('[data-projects-toggle]');
  const homeMenuButton = menu.querySelector('[data-menu-home]');
  const aboutMenuButton = menu.querySelector('[data-menu-about]');
  const siteHeader = root.querySelector('.site-header');
  const projectView = root.querySelector('[data-project-view]');
  const projectPage = projectView.querySelector('.project-page');
  const gallerySurfaces = [...root.querySelectorAll('.carousel, .filmstrip, .mobile-controls')];
  const endSurfaces = gallerySurfaces.filter(surface => surface.classList.contains('filmstrip') || surface.classList.contains('mobile-controls'));
  const contextLabel = menu.querySelector('[data-menu-context]');
  const menuTitle = menu.querySelector('[data-menu-title]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const contextMotion = mountMenuLabel(contextLabel, reducedMotion);
  const menuTitleMotion = mountMenuLabel(menuTitle, reducedMotion);
  const projectNavigation = mountProjectMenu(projectsMenu, reducedMotion, { signal: controller.signal, persist: true });
  const visibleMenuChoices = () => menuChoices.filter(choice => choice === projectsToggle || !projectsMenu.contains(choice) || projectNavigation.expanded);
  const previousButton = root.querySelector('[data-step="-1"]');
  const nextButton = root.querySelector('[data-step="1"]');
  const mobileInspect = root.querySelector('.mobile-inspect');
  const mobilePanelCount = root.querySelector('[data-mobile-panel-count]');
  const detailMedia = root.querySelector('[data-detail-media]');
  const caseStudy = mountProjectCaseStudy(root.querySelector('[data-detail-case-study]'), {
    base: detailMedia.dataset.assetBase, reducedMotion
  });
  const skipLink = root.querySelector('.skip-link');
  const last = panels.length - 1;
  const end = panels.length;
  const clamp = value => Math.max(0, Math.min(last, value));
  const clampPosition = value => Math.max(0, Math.min(end, value));
  const textNodes = new Map();
  const setText = (selector, value) => {
    if (!textNodes.has(selector)) textNodes.set(selector, root.querySelector(selector));
    const node = textNodes.get(selector);
    if (node.textContent !== String(value)) node.textContent = value;
  };
  const hasDialog = () => projectOpen || projectRequests.busy;
  let active = -1;
  let endOpen = false;
  let position = initial.panel;
  let destination = position;
  let stageWidth = 1;
  let galleryInset = 0;
  let lift = 0;
  let liftFrame = 0;
  let stride = 1;
  let railCenterPadding = 0;
  let animationFrame = 0;
  let motionVelocity = 0;
  let resizeFrame = 0;
  let wheelTimer = 0;
  let wheelPosition = null;
  let drag = null;
  const swipeInputs = [];
  let dragFrame = 0;
  let pendingDrag = null;
  let suppressClickUntil = 0;
  let slideEndsAt = 0;
  const captionMotion = mountProjectCaption(caption, root, reducedMotion, { endsAt: () => slideEndsAt });
  let projectOpen = false;
  let articleIndex = -1;
  let projectAbort = null;
  let projectOrigin = { x: .5, y: .5 };
  let projectReturnFocus = captionButton;
  let menuContext = null;
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
    getCurrent: () => ({ open: projectOpen, index: articleIndex }),
    open: openProject,
    close: request => {
      if (request.panel !== undefined) select(request.panel, { immediate: true, history: false });
      return transitionProject(false);
    },
    cancel: () => projectAbort?.abort(),
    settled: () => {
      if (pendingPanel !== null) {
        const target = pendingPanel; pendingPanel = null;
        select(target, { immediate: true, history: false });
      }
      if (!projectOpen) setMenuContext(sectionForPanel(active) === 'projects' ? 'gallery' : sectionForPanel(active));
      restoreProjectFocus();
    }
  });
  const laser = mountLaser(endPanel.querySelector('[data-laser-experiment]'), { onInteraction: () => {
    if (endOpen && animationFrame) animateTo(end, { immediate: true, announceSelection: false });
    // Input coordinates must not inherit a remaining card-lift transform.
    animateLift(0, { duration: 0 });
  } });
  listen(document, 'pointerdown', event => {
    if (credits.open && !credits.contains(event.target)) credits.open = false;
  }, { capture: true });
  listen(credits, 'keydown', event => {
    if (event.key !== 'Escape' || !credits.open) return;
    event.preventDefault(); event.stopPropagation(); credits.open = false;
    credits.querySelector('summary').focus({ preventScroll: true });
  });

  function updateMenuName() {
    const location = menuContext === 'home' ? 'Home: Introduction'
      : menuContext === 'about' ? `About: ${siteHeader.dataset.owner}`
      : menuContext === 'project' ? `Project: ${panels[Math.max(firstProjectPanel, articleIndex)].title}`
      : `Projects: ${endOpen ? 'Links' : panels[Math.max(0, active)].title}`;
    menuToggle.setAttribute('aria-label', `${menuNavigation.expanded ? 'Close' : 'Open'} navigation. ${location}`);
    const section = menuContext === 'project' || menuContext === 'gallery' ? 'projects' : menuContext;
    for (const [route, link] of [['home', homeMenuButton], ['about', aboutMenuButton], ['projects', menu.querySelector('[data-menu-gallery]')]]) {
      if (section === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    projectsMenu.dataset.current = String(section === 'projects');
    siteHeader.dataset.page = section || 'home';
  }

  function setMenuContext(next, { immediate = false, direction } = {}) {
    const section = sectionForPanel(active);
    const context = typeof next === 'boolean' ? next ? 'project' : section === 'projects' ? 'gallery' : section : next;
    if (menuContext === context && !immediate) return;
    const order = ['home', 'about', 'gallery', 'project'];
    direction ??= Math.sign(order.indexOf(context) - order.indexOf(menuContext)) || 1;
    menuContext = context;
    updateMenuName();
    contextMotion.set({ home: 'Home:', about: 'About:', gallery: 'Projects:', project: 'Project:' }[context], { immediate, direction });
  }

  function setMenuTitle(title, options) {
    updateMenuName();
    return menuTitleMotion.set(title, options);
  }

  function announce() {
    setText('[data-announcement]', endOpen ? 'Professional links. End of selected work.'
      : panels[active].kind === 'project'
        ? `${panels[active].title}, project ${active - firstProjectPanel + 1} of ${panels.length - firstProjectPanel}. ${panels[active].caption}`
        : `${panels[active].title}. Panel ${active + 1} of ${panels.length}.`);
  }

  function updateBounds(index) {
    previousButton.disabled = index <= 0;
    nextButton.disabled = index >= end;
    previousButton.setAttribute('aria-label', index >= end ? 'Back to last project' : 'Previous panel');
    nextButton.setAttribute('aria-label', index >= last ? 'Show professional links' : 'Next panel');
  }

  function updateGalleryIdentity({ immediate = false, index = active, links = endOpen, direction = 1 } = {}) {
    const from = readHeaderPalette(siteHeader);
    const project = panels[Math.max(0, index)];
    const palette = links ? linksPalette : project.palette;
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--ink', palette.ink);
    // An article can change identity while its outgoing gallery drawing stays put.
    if (index === active && links === endOpen) root.style.setProperty('--caption-color', palette.caption || palette.accent);
    if (!immediate) blendHeaderPalette(siteHeader, from, { duration: 320 });
    menuProjects.forEach(button => {
      if (!links && Number(button.dataset.menuProject) === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    setMenuTitle(links ? 'Links' : project.kind === 'home' ? 'Introduction' : project.kind === 'about' ? siteHeader.dataset.owner : project.title, { immediate, direction });
  }

  function updateEnd(progress, links) {
    if (progress > 0) laser.prepare();
    const focused = document.activeElement;
    if (progress !== renderedEndProgress) {
      root.style.setProperty('--end-progress', String(progress));
      renderedEndProgress = progress;
    }
    if (endPanel.inert !== !links) endPanel.inert = !links;
    if (endPanel.getAttribute('aria-hidden') !== String(!links)) endPanel.setAttribute('aria-hidden', String(!links));
    const surfacesHidden = links || projectOpen || projectRequests.busy;
    laser.setActive(links && !projectOpen && !projectRequests.busy);
    if (!links && credits.open) credits.open = false;
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
    updateGalleryIdentity({ direction: projectOpen || projectRequests.busy ? -1 : links ? 1 : -1 });
  }

  function updateActive(index) {
    if (active === index) return;
    const previous = active;
    const direction = projectOpen || projectRequests.busy ? -1 : Math.sign(index - previous) || 1;
    const focusedThumbnail = previous >= 0 && document.activeElement === thumbnails[previous];
    if (!drag?.nativeTouch && previous >= 0 && slides[previous].contains(document.activeElement)) root.querySelector('.carousel').focus({ preventScroll: true });
    active = index;
    prepareImages(active);
    const panel = panels[active];
    if (focusedThumbnail) thumbnails[active].focus({ preventScroll: true });
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === active);
      slide.setAttribute('aria-hidden', String(i !== active));
      // Keep a native touch's original target alive through the midpoint.
      slide.inert = i !== active && slide !== drag?.originSlide;
    });
    thumbnails.forEach((button, i) => {
      button.classList.toggle('is-active', i === active);
      button.setAttribute('aria-pressed', String(i === active));
      button.tabIndex = i === active ? 0 : -1;
    });
    if (!projectOpen && !projectRequests.busy) setMenuContext(panel.kind === 'project' ? 'gallery' : panel.kind, { immediate: previous < 0, direction });
    updateGalleryIdentity({ immediate: previous < 0, direction });
    const count = `${String(active + 1).padStart(2, '0')} / ${String(panels.length).padStart(2, '0')}`;
    setText('[data-mobile-count]', count);
    setText('[data-mobile-panel-count]', count);
    const hasProjectAction = panel.kind === 'project';
    if (!hasProjectAction && mobileInspect.contains(document.activeElement)) root.querySelector('.carousel').focus({ preventScroll: true });
    mobileInspect.hidden = !hasProjectAction;
    mobilePanelCount.hidden = hasProjectAction;
    if (hasProjectAction) mobileInspect.setAttribute('aria-label', `View ${panel.title}`);
    if (!projectOpen) skipLink.href = panel.kind === 'home' ? '#home-title' : panel.kind === 'about' ? '#about-title' : '#project-caption';
    updateBounds(root.classList.contains('is-moving') ? Math.round(destination) : active);
  }

  function prepareImages(index) {
    // Fetch the destination and its neighbors before they slide into view.
    // Distant covers stay lazy; thumbnails are small and remain eager.
    for (let i = Math.max(0, index - 1); i <= Math.min(last, index + 1); i++) {
      if (slideImages[i]?.loading === 'lazy') slideImages[i].loading = 'eager';
    }
  }

  function positionTrack() {
    const x = -position * (stageWidth - galleryInset);
    if (x !== renderedX) {
      galleryTrack.style.transform = `translateX(${x}px)`;
      renderedX = x;
    }
  }

  function render(value) {
    const frame = galleryFrame(value, panels.length);
    const initialRender = active < 0;
    position = frame.position;
    positionTrack();
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
    const captionFrame = galleryCaptionFrame(frame, firstProjectPanel);
    captionMotion.present(captionFrame, {
      title: panels[captionFrame.project].title,
      immediate: initialRender,
      holdPointer: drag?.capture === captionButton || Boolean(drag?.nativeTouch && captionButton.contains(drag.target))
    });
    const panel = String(frame.links ? end : active);
    const kind = frame.links ? 'links' : panels[active].kind;
    if (root.dataset.panel !== panel) root.dataset.panel = panel;
    if (root.dataset.panelKind !== kind) root.dataset.panelKind = kind;
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
    // Lift changes geometry only. Keep selection, captions and accessibility
    // updates on the gallery's movement clock instead of running them twice.
    // A pending pointer sample will position the track with this new inset.
    if (!dragFrame) positionTrack();
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

  listen(document, 'portfolio:theme-change', () => {
    projectAbort?.abort();
    stopHeaderPalette(siteHeader);
  });

  function restorePanelAccess() {
    if (slides.some((slide, i) => i !== active && slide.contains(document.activeElement))) {
      root.querySelector('.carousel').focus({ preventScroll: true });
    }
    slides.forEach((slide, i) => { slide.inert = i !== active; });
  }

  function cancelDrag() {
    stopDragFrame();
    if (drag?.capture?.hasPointerCapture(drag.id)) drag.capture.releasePointerCapture(drag.id);
    drag = null;
    swipeInputs.forEach(input => input.reset());
    restorePanelAccess();
    root.classList.remove('is-dragging');
  }

  function animateTo(value, { immediate = false, velocity = motionVelocity, response,
    focusThumbnail = false, announceSelection = true, history = true, settled = () => {} } = {}) {
    stopAnimation();
    destination = clampPosition(value);
    prepareImages(Math.round(destination));
    updateBounds(Math.round(destination));
    animateLift(0, { duration: immediate ? 0 : 280 });
    const from = position;
    const distance = Math.abs(destination - from);
    const finish = () => {
      render(destination);
      alignSelectionFrame();
      root.classList.remove('is-moving');
      animationFrame = 0;
      motionVelocity = 0;
      slideEndsAt = 0;
      if (focusThumbnail) (endOpen ? endReturn : thumbnails[active]).focus({ preventScroll: true });
      if (announceSelection) announce();
      if (history && !projectOpen && !projectRequests.busy) writeAddress(destination);
      settled();
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
    stopWheel();
    animateTo(index, options);
  }

  function measure() {
    stageWidth = stage.clientWidth || 1;
    const pixels = window.devicePixelRatio || 1;
    const gap = Math.max(1, Math.round(4 * pixels));
    const contentWidth = parseFloat(getComputedStyle(root).getPropertyValue('--thumb-width'));
    const contentHeight = rail.clientHeight - 14;
    rail.style.setProperty('--thumb-gap', `${gap / pixels}px`);
    rail.style.setProperty('--thumb-box-width', `${(Math.round(contentWidth * pixels) + 2 * gap) / pixels}px`);
    rail.style.setProperty('--thumb-box-height', `${(Math.round(contentHeight * pixels) + 2 * gap) / pixels}px`);
    thumbnailGroup.style.paddingTop = '0px';
    stride = parseFloat(getComputedStyle(thumbnails[0]).width);
    railCenterPadding = Math.max(0, (rail.clientWidth - stride) / 2);
    const summaryHeight = menuToggle.getBoundingClientRect().height;
    rail.style.setProperty('--rail-padding', `${railCenterPadding}px`);
    menu.style.setProperty('--menu-summary-height', `${summaryHeight}px`);
    // Changing padding can move the scroll position even if the target is equal.
    renderedScroll = NaN;
    if (menuNavigation.animating) animateMenu(menuNavigation.expanded);
    presentCards(lift);
    // A resize can change the thumbnail stride without moving the gallery.
    render(position);
    alignSelectionFrame();
  }

  function alignSelectionFrame() {
    if (active < 0 || endOpen || drag || Math.abs(position - Math.round(position)) > .001) return;
    const scrollLeft = rail.scrollLeft;
    rail.style.setProperty('--rail-padding', `${railCenterPadding}px`);
    thumbnailGroup.style.paddingTop = '0px';
    rail.scrollLeft = scrollLeft;
    let tile = thumbnails[active].getBoundingClientRect();
    // Native button backgrounds also round fractional layout origins in
    // Firefox. Adjust layout rather than translating a half-pixel button.
    rail.style.setProperty('--rail-padding', `${railCenterPadding + Math.round(tile.left) - tile.left}px`);
    thumbnailGroup.style.paddingTop = `${Math.ceil(tile.top) - tile.top}px`;
    rail.scrollLeft = scrollLeft;
    tile = thumbnails[active].getBoundingClientRect();
    const strip = selectionFrame.parentElement.getBoundingClientRect();
    const pixels = window.devicePixelRatio || 1;
    const left = Math.round(tile.left * pixels), top = Math.round(tile.top * pixels);
    const border = Math.max(1, Math.round(2 * pixels));
    const width = Math.round(tile.width * pixels) + 2 * border;
    const height = Math.round(tile.height * pixels) + 2 * border;
    const frameLeft = (left - border) / pixels, frameTop = (top - border) / pixels;
    const anchorLeft = Math.floor(frameLeft), anchorTop = Math.floor(frameTop);
    const viewportWidth = Math.ceil(width / pixels + frameLeft - anchorLeft);
    const viewportHeight = Math.ceil(height / pixels + frameTop - anchorTop);
    const offsetX = (frameLeft - anchorLeft) * pixels, offsetY = (frameTop - anchorTop) * pixels;
    // Use whole painted pixels for the tile, its gap, and the SVG outline.
    // No measurements or SVG updates run during horizontal drag frames.
    Object.assign(selectionFrame.style, {
      left: `${anchorLeft - strip.left}px`, top: `${anchorTop - strip.top}px`, bottom: 'auto',
      width: `${viewportWidth}px`, height: `${viewportHeight}px`, transform: 'none'
    });
    // Integer CSS anchors also avoid Firefox rounding an SVG viewport origin.
    selectionFrame.setAttribute('viewBox', `0 0 ${viewportWidth * pixels} ${viewportHeight * pixels}`);
    const rounded = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
    const radius = Math.round(8 * pixels);
    selectionOutline.setAttribute('d', rounded(offsetX, offsetY, width, height, radius + border)
      + rounded(offsetX + border, offsetY + border, width - 2 * border, height - 2 * border, radius));
    selectionOutline.dataset.border = String(border);
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
    const project = panels[index];
    setText('[data-detail-title]', project.title);
    setText('[data-detail-category]', project.category);
    setText('[data-detail-year]', project.year);
    setText('[data-detail-description]', project.description);
    setText('[data-detail-note]', project.note);
    setText('[data-detail-number]', `${String(index - firstProjectPanel + 1).padStart(2, '0')} / ${String(panels.length - firstProjectPanel).padStart(2, '0')}`);
    // Article images are supplied explicitly; the gallery cover stays in the gallery.
    renderProjectMedia(detailMedia, project.articleMedia, { base: detailMedia.dataset.assetBase });
    caseStudy.render(project);
    projectView.scrollTop = 0;
  }

  function restoreProjectFocus() {
    if (disposed) return;
    if (projectRequests.pending) return;
    const target = menuNavigation.expanded
      ? menu.querySelector(projectOpen ? `[data-menu-project="${articleIndex}"]` : '[data-action="gallery"]')
      : projectOpen ? projectView.querySelector('[data-detail-title]')
      : endOpen ? endReturn
      : pendingPanel !== null || panels[active].kind !== 'project' ? slides[active].querySelector('h1')
      : siteHeader.contains(projectReturnFocus) ? menuToggle : projectReturnFocus;
    const focus = target?.isConnected && !target.closest('[inert]') ? target : panels[active].kind === 'project' ? captionButton : menuToggle;
    if (focus.tagName === 'H1') focus.tabIndex = -1;
    focus.focus({ preventScroll: true });
  }

  async function transitionProject(opening, { replacing = false, sectionEntry = false } = {}) {
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
    setMenuContext(opening, { immediate: sectionEntry });
    document.body.classList.add('dialog-open');
    try {
      await settleTiles(root, projectPage, {
        opening, replacing, origin: projectOrigin, scrollTop: opening ? 0 : scrollTop,
        signal: projectAbort.signal, reducedMotion: reducedMotion.matches
      });
    } finally {
      projectOpen = opening;
      projectView.hidden = !opening;
      projectView.inert = !opening;
      root.classList.remove('is-project-transitioning', 'is-project-opening', 'is-project-replacing');
      projectPage.style.visibility = originalVisibility;
      root.classList.toggle('has-project', opening);
      root.dataset.article = opening ? String(articleIndex) : '';
      skipLink.href = opening ? '#detail-title' : panels[active].kind === 'home' ? '#home-title' : panels[active].kind === 'about' ? '#about-title' : '#project-caption';
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
    const outgoing = backdrop?.animate?.([{ opacity: 1 }, { opacity: 0 }], {
      duration: sectionTiming.feedback, easing: 'ease-in', fill: 'both'
    });
    try {
      projectOrigin = request.origin || projectOrigin;
      projectReturnFocus = request.returnFocus || projectReturnFocus;
      stopWheel();
      stopAnimation();
      cancelAnimationFrame(liftFrame);
      captionMotion.pause();
      liftFrame = 0;
      root.classList.remove('is-lifting');
      const direction = replacing ? Math.sign(request.index - articleIndex) || 1 : 1;
      articleIndex = request.index;
      fillProject(request.index);
      updateGalleryIdentity({ index: articleIndex, links: false, immediate: request.sectionEntry, direction });
      if (replacing) projectOrigin = articleRevealOrigin(projectPage.querySelector('[data-detail-title]').getBoundingClientRect(),
        document.documentElement.clientWidth, projectView.clientHeight);
      await transitionProject(true, { replacing, sectionEntry: request.sectionEntry });
      // The solid article now conceals the gallery. Select its return slide here,
      // so opening never jumps to the cover but closing reveals the right project.
      if (!disposed) {
        select(request.index, { immediate: true, announceSelection: false, history: false });
        captionMotion.finish();
      }
    } finally {
      outgoing?.cancel();
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

  function writeAddress(index, { article = false, replace = false, anchor = '' } = {}) {
    const address = galleryAddress(index, panels, { base: root.dataset.base, article, anchor });
    if (address !== lastAddress) {
      lastAddress = address;
      if (window.__PORTFOLIO_PREVIEW_ADDRESS__ !== undefined) {
        window.__PORTFOLIO_PREVIEW_ADDRESS__ = address;
        window.parent.postMessage({ type: 'portfolio-preview-address', address, replace }, '*');
      } else {
        const state = { ...window.history.state, portfolio: true };
        window.history[replace ? 'replaceState' : 'pushState'](state, '', address);
      }
    }
    document.title = `${siteHeader.dataset.owner} - ${article ? panels[index].title : sectionForPanel(index) === 'home' ? 'Portfolio' : sectionForPanel(index) === 'about' ? 'About' : 'Projects'}`;
  }

  function navigatePanel(index, { skipHistory = false, immediate = false, focusThumbnail = false, focusContent = false } = {}) {
    const target = Math.round(clampPosition(index));
    if (menuNavigation.expanded) closeMenu({ focus: true });
    if (!skipHistory) writeAddress(target);
    if (projectOpen || projectRequests.busy) {
      pendingPanel = target;
      return projectRequests.request({ index: null, panel: target });
    }
    pendingPanel = null;
    select(target, { immediate, focusThumbnail, history: false, settled: () => {
      if (focusContent) (endOpen ? endReturn : slides[active].querySelector('[data-profile-scroll]') || captionButton).focus({ preventScroll: true });
    } });
    return Promise.resolve();
  }

  function requestProject(index, options = {}) {
    cancelDrag();
    const selected = index === null ? null : Math.max(firstProjectPanel, Math.round(clamp(index)));
    if (selected !== null) pendingPanel = null;
    // During opening, the outgoing panel stays visible until the article covers
    // it. Closing must address the article's return cover, not that old panel.
    const returnPanel = pendingPanel ?? (hasDialog() ? articleIndex : Math.round(position));
    if (!options.skipHistory) writeAddress(selected === null ? returnPanel : selected, {
      article: selected !== null, replace: selected === null
    });
    return projectRequests.request({ index: selected, ...options });
  }

  function scrollAnchor(anchor, { focus = true } = {}) {
    const target = document.getElementById(anchor);
    if (!target) return;
    const scroller = target.closest('[data-profile-scroll]');
    if (scroller && scroller.closest('[data-slide]') !== slides[active]) return;
    if (scroller) scroller.scrollTo({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 110, behavior: 'instant' });
    else if (target === projectView.querySelector('[data-detail-title]')) projectView.scrollTop = 0;
    if (focus) { if (!target.hasAttribute('tabindex')) target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }

  function followAddress() {
    const address = readAddress();
    const key = address.pathname + address.hash;
    if (key === lastAddress) return;
    lastAddress = key;
    const route = resolveGalleryLocation(address, panels);
    const pending = route.article === null
      ? navigatePanel(route.panel, { skipHistory: true, immediate: Boolean(route.anchor) })
      : requestProject(route.article, { skipHistory: true });
    Promise.resolve(pending).then(() => {
      if (lastAddress !== key) return;
      if (route.anchor) scrollAnchor(route.anchor);
      document.title = `${siteHeader.dataset.owner} - ${route.article === null ? route.panel === 0 ? 'Portfolio' : route.panel === 1 ? 'About' : 'Projects' : panels[route.article].title}`;
    });
  }

  listen(root, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (performance.now() < suppressClickUntil && event.detail !== 0 && (stage.contains(event.target) || rail.contains(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const thumbnail = event.target.closest('[data-thumbnail]');
    if (thumbnail && !hasDialog()) { navigatePanel(Number(thumbnail.dataset.thumbnail), { focusThumbnail: true }); return; }
    const step = event.target.closest('[data-step]');
    if (step && !hasDialog()) { navigatePanel(Math.round(destination) + Number(step.dataset.step)); return; }
    if (event.target.closest('[data-end-return]') && !hasDialog()) { navigatePanel(last, { focusThumbnail: true }); return; }
    const choice = event.target.closest('[data-menu-project]');
    if (choice) {
      event.preventDefault();
      const index = Number(choice.dataset.menuProject);
      closeMenu({ focus: true });
      requestProject(index, { origin: clickOrigin(event, choice), returnFocus: choice });
      return;
    }
    const routeLink = event.target.closest('a[data-site-route]');
    if (routeLink && (!routeLink.target || routeLink.target === '_self')) {
      event.preventDefault();
      const route = routeLink.dataset.siteRoute;
      const target = route === 'home' ? 0 : route === 'about' ? 1 : projectOpen || projectRequests.busy ? Math.max(firstProjectPanel, articleIndex) : firstProjectPanel;
      navigatePanel(target, { focusContent: event.detail === 0 });
      return;
    }
    const anchorLink = event.target.closest('a[href^="#"]');
    if (anchorLink && (anchorLink.closest('[data-profile-scroll]') || anchorLink === skipLink)) {
      event.preventDefault();
      let anchor; try { anchor = decodeURIComponent(anchorLink.hash.slice(1)); } catch { return; }
      scrollAnchor(anchor);
      if (anchorLink !== skipLink) writeAddress(active, { anchor });
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton?.dataset.action === 'project') {
      if (panels[active].kind !== 'project') return;
      closeMenu();
      requestProject(Number(actionButton.dataset.project ?? active), {
        origin: clickOrigin(event, actionButton), returnFocus: actionButton
      });
    }
    if (actionButton?.dataset.action === 'gallery') {
      event.preventDefault();
      closeMenu({ focus: true });
      if (projectOpen || projectRequests.busy) requestProject(null);
      else if (endOpen || destination > last) select(last);
    }
  });

  function beginDrag(event, surface, unit) {
    if (!event.isPrimary || event.button !== 0 || hasDialog() || drag) return false;
    // A fresh press is intentional; only the click generated by the preceding drag is suppressed.
    suppressClickUntil = 0;
    if (event.target.closest('[data-end-link], [data-laser-control]')) return false;
    const profile = event.target.closest('[data-profile-scroll]');
    if (profile && event.target.closest('a, button, summary, input, textarea, select, [contenteditable]')) return false;
    stopDragFrame();
    stopWheel();
    stopAnimation();
    destination = position;
    const capture = event.nativeTouch ? null : event.target.closest('button') || surface;
    const pointerTouch = event.pointerType === 'touch';
    drag = {
      id: event.pointerId, surface, capture, unit, profile, target: event.target,
      nativeTouch: Boolean(event.nativeTouch), originSlide: event.nativeTouch ? event.target.closest('[data-slide]') : null,
      x: event.clientX, y: event.clientY, start: position,
      lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false, axis: null, pointerTouch,
      touch: surface === stage && pointerTouch
    };
    // Mouse drags can leave the reading area; touch capture waits for a
    // horizontal gesture so native vertical scrolling can still take over.
    if (capture && (!profile || !pointerTouch)) capture.setPointerCapture(event.pointerId);
    return true;
  }
  function stopDragFrame() {
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    pendingDrag = null;
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
    // Mouse input can arrive several times per paint. Follow its latest sample
    // directly, retaining input time for velocity instead of adding smoothing.
    pendingDrag = { pointerId: event.pointerId, clientX: event.clientX,
      clientY: event.clientY, time: performance.now() };
    if (!dragFrame) dragFrame = requestAnimationFrame(flushDragFrame);
  }
  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.pointerTouch && drag.axis !== 'x') return;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || (!drag.pointerTouch && Math.abs(dx) < Math.abs(dy))) return;
      if (drag.capture && !drag.capture.hasPointerCapture(drag.id)) drag.capture.setPointerCapture(drag.id);
      drag.moved = true;
      root.classList.add('is-dragging');
      animateLift(1);
    }
    const now = event.time;
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = (drag.lastX - event.clientX) / (elapsed * drag.unit);
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const nextPosition = drag.start - dx / drag.unit;
    render(drag.surface === rail ? clamp(nextPosition) : nextPosition);
  }
  function endDrag(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    if (cancelled) stopDragFrame();
    else flushDragFrame();
    if (!drag || drag.id !== event.pointerId) return;
    const finished = drag;
    drag = null;
    restorePanelAccess();
    root.classList.remove('is-dragging');
    if (finished.capture?.hasPointerCapture(event.pointerId)) finished.capture.releasePointerCapture(event.pointerId);
    const moving = performance.now() - finished.lastTime < 100 && !cancelled;
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
  [stage, rail].forEach(surface => {
    swipeInputs.push(mountSwipeInput(surface, {
      start: event => beginDrag(event, surface, surface === stage ? stageWidth : stride),
      move: queueDrag, end: endDrag, signal: controller.signal
    }));
    listen(surface, 'selectstart', event => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target?.closest('a, button, summary, input, textarea, select, [contenteditable]')) event.preventDefault();
    });
  });

  listen(rail, 'wheel', event => {
    if (event.ctrlKey || hasDialog() || drag) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1;
    wheelPosition = clamp((wheelPosition ?? position) + delta * unit / stride);
    animateTo(wheelPosition, { response: 140, announceSelection: false, history: false });
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      const next = Math.round(wheelPosition);
      wheelPosition = null;
      animateTo(next);
    }, 160);
  }, { passive: false });

  listen(document, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (root.querySelector('dialog[open]')) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"], [data-laser-control], [data-credits]')) return;
    if (menuNavigation.expanded) {
      if ((event.key === 'Escape' || event.key === 'ArrowLeft') && projectNavigation.expanded && projectsMenu.contains(event.target)) {
        event.preventDefault(); projectNavigation.set(false, { focus: true }); return;
      }
      if (event.key === 'ArrowRight' && event.target === projectsToggle) {
        event.preventDefault(); projectNavigation.set(true); menuProjects[Math.max(0, active - firstProjectPanel)]?.focus({ preventScroll: true }); return;
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
    if (event.key === 'Escape' && endOpen) {
      event.preventDefault(); select(last, { focusThumbnail: true }); return;
    }
    const directions = { ArrowLeft: Math.round(destination) - 1, ArrowRight: Math.round(destination) + 1, Home: 0, End: end };
    if (!(event.key in directions)) return;
    event.preventDefault();
    navigatePanel(directions[event.key], { focusThumbnail: rail.contains(event.target), focusContent: !rail.contains(event.target) });
  });

  listen(window, 'resize', () => {
    projectAbort?.abort();
    const interrupted = Boolean(drag) || wheelPosition !== null;
    const target = Math.round(drag ? position : destination);
    cancelDrag();
    stopWheel();
    if (interrupted) animateTo(target, { velocity: 0 });
    else animateLift(0);
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(measure);
  });
  listen(reducedMotion, 'change', () => {
    if (reducedMotion.matches) {
      projectAbort?.abort();
      setMenuContext(menuContext, { immediate: true });
      menuTitleMotion.finish();
      projectNavigation.set(projectNavigation.expanded, { immediate: true });
    }
    if (reducedMotion.matches && captionMotion.animating) captionMotion.finish();
    if (reducedMotion.matches && liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
    if (reducedMotion.matches && animationFrame) animateTo(destination, { immediate: true });
    if (reducedMotion.matches && menuNavigation.animating) menuNavigation.set(menuNavigation.expanded, { immediate: true });
  });
  listen(document, 'visibilitychange', () => {
    if (!document.hidden) return;
    projectAbort?.abort();
    const interrupted = Boolean(drag) || wheelPosition !== null || Boolean(animationFrame);
    const target = Math.round(drag ? position : destination);
    cancelDrag();
    stopWheel();
    if (menuNavigation.animating) menuNavigation.set(menuNavigation.expanded, { immediate: true });
    if (interrupted) animateTo(target, { immediate: true });
    if (captionMotion.animating) captionMotion.finish();
    if (liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
  });
  measure();
  updateBounds(position);
  const entryDone = initial.article !== null
    ? requestProject(initial.article, { skipHistory: true, sectionEntry: true }) : Promise.resolve();
  writeAddress(initial.panel, { article: initial.article !== null, anchor: initial.anchor, replace: true });
  if (initial.anchor) scrollAnchor(initial.anchor, { focus: false });
  root.dataset.ready = 'true';
  listen(window, 'popstate', followAddress);
  listen(window, 'hashchange', followAddress);
  listen(window, 'message', event => {
    if (event.source !== window.parent || event.data?.type !== 'portfolio-preview-navigate') return;
    window.__PORTFOLIO_PREVIEW_ADDRESS__ = event.data.address;
    followAddress();
  });
  const cleanup = () => {
    disposed = true;
    stopHeaderPalette(siteHeader);
    laser.destroy();
    caseStudy.destroy();
    credits.open = false;
    controller.abort();
    projectAbort?.abort();
    stopWheel();
    stopAnimation();
    stopDragFrame();
    [liftFrame, resizeFrame].forEach(cancelAnimationFrame);
    captionMotion.destroy();
    contextMotion.destroy();
    menuTitleMotion.destroy();
    menuNavigation.set(false, { immediate: true });
    projectNavigation.set(false, { immediate: true, remember: false });
    if (drag?.capture?.hasPointerCapture(drag.id)) drag.capture.releasePointerCapture(drag.id);
    drag = null;
    root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    document.body.classList.remove('dialog-open');
  };
  cleanup.entryDone = entryDone;
  return cleanup;
}
