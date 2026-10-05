import { settleTiles } from './project-transition.js';

export function mountPortfolio() {
  const root = document.getElementById('portfolio');
  const data = document.getElementById('portfolio-data');
  if (!root || !data) return;
  const projects = JSON.parse(data.textContent);
  const slides = [...root.querySelectorAll('[data-slide]')];
  const slideImages = slides.map(slide => slide.querySelector('img'));
  const captionButton = root.querySelector('.caption-link');
  const captionWord = captionButton.querySelector('.caption-word');
  const titleText = captionButton.querySelector('[data-title]');
  const titleMetrics = captionButton.querySelector('[data-title-metrics]');
  const thumbnails = [...root.querySelectorAll('[data-thumbnail]')];
  const rail = root.querySelector('.thumbnail-rail');
  const galleryTrack = root.querySelector('[data-gallery-track]');
  const stage = root.querySelector('[data-stage]');
  const menu = root.querySelector('[data-menu]');
  const menuToggle = menu.querySelector('summary');
  const menuBody = menu.querySelector('.menu-body');
  const menuChoices = [...menu.querySelectorAll('button')];
  const menuProjects = [...menu.querySelectorAll('[data-menu-project]')];
  const dialogs = [...root.querySelectorAll('dialog')];
  const siteHeader = root.querySelector('.site-header');
  const aboutDialog = root.querySelector('[data-dialog="about"]');
  const projectView = root.querySelector('[data-project-view]');
  const projectPage = projectView.querySelector('.project-page');
  const gallerySurfaces = [...root.querySelectorAll('.carousel, .filmstrip, .mobile-controls')];
  const workLabel = menu.querySelector('[data-menu-context="work"]');
  const projectLabel = menu.querySelector('[data-menu-context="project"]');
  const menuTitle = menu.querySelector('[data-menu-title]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const previousButton = root.querySelector('[data-step="-1"]');
  const nextButton = root.querySelector('[data-step="1"]');
  const captionHeading = root.querySelector('.project-caption h1');
  const mobileInspect = root.querySelector('.mobile-inspect');
  const detailMedia = root.querySelector('[data-detail-media]');
  const skipLink = root.querySelector('.skip-link');
  const last = projects.length - 1;
  const clamp = value => Math.max(0, Math.min(last, value));
  const textNodes = new Map();
  const setText = (selector, value) => {
    if (!textNodes.has(selector)) textNodes.set(selector, root.querySelector(selector));
    const node = textNodes.get(selector);
    if (node.textContent !== String(value)) node.textContent = value;
  };
  const hasDialog = () => projectOpen || projectBusy || dialogs.some(dialog => dialog.open);
  let active = -1;
  let position = 0;
  let destination = 0;
  let stageWidth = 1;
  let galleryInset = 0;
  let lift = 0;
  let liftFrame = 0;
  let stride = 1;
  let animationFrame = 0;
  let resizeFrame = 0;
  let wheelTimer = 0;
  let wheelPosition = null;
  let drag = null;
  let suppressClickUntil = 0;
  let dialogReturnFocus = null;
  let menuDesiredOpen = menu.open;
  let menuAnimation = null;
  let menuContentAnimation = null;
  let titleFrame = 0;
  let titleSlots = [];
  let slideEndsAt = 0;
  let projectOpen = false;
  let projectBusy = false;
  let projectAbort = null;
  let pendingProject = null;
  let projectOrigin = { x: .5, y: .5 };
  let projectReturnFocus = captionButton;
  let contextIsProject = false;
  let contextAnimations = [];
  let contextGeneration = 0;
  let menuTitleAnimation = null;
  let menuTitleGeneration = 0;
  let desiredMenuTitle = menuTitle.textContent;
  let aboutReturnFocus = true;
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

  function updateMenuName() {
    menuToggle.setAttribute('aria-label', `Portfolio navigation. ${contextIsProject ? 'Project' : 'Work'}: ${projects[Math.max(0, active)].title}`);
  }

  function setMenuContext(next, { immediate = false } = {}) {
    if (contextIsProject === next && !immediate) return;
    const generation = ++contextGeneration;
    const starts = [workLabel, projectLabel].map(label => {
      const style = getComputedStyle(label);
      return { opacity: style.opacity, transform: style.transform };
    });
    contextAnimations.forEach(animation => animation.cancel());
    contextAnimations = [];
    contextIsProject = next;
    workLabel.setAttribute('aria-hidden', String(next));
    projectLabel.setAttribute('aria-hidden', String(!next));
    updateMenuName();
    const ends = [
      { opacity: next ? '0' : '1', transform: next ? 'translateY(-100%)' : 'translateY(0)' },
      { opacity: next ? '1' : '0', transform: next ? 'translateY(0)' : 'translateY(100%)' }
    ];
    const finish = () => {
      if (generation !== contextGeneration) return;
      [workLabel, projectLabel].forEach((label, i) => Object.assign(label.style, ends[i]));
      contextAnimations.forEach(animation => animation.cancel());
      contextAnimations = [];
    };
    if (immediate || reducedMotion.matches || typeof menuTitle.animate !== 'function') { finish(); return; }
    contextAnimations = [workLabel, projectLabel].map((label, i) => label.animate([starts[i], ends[i]], {
      duration: i === Number(next) ? 260 : 220,
      delay: (next ? 100 : 50) + (i === Number(next) ? 30 : 0),
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
    setText('[data-announcement]', `${projects[active].title}, project ${active + 1} of ${projects.length}. ${projects[active].caption}`);
  }

  function updateBounds(index) {
    previousButton.disabled = index <= 0;
    nextButton.disabled = index >= last;
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
    root.style.setProperty('--accent', project.palette.accent);
    root.style.setProperty('--ink', project.palette.ink);
    root.style.setProperty('--caption-color', project.palette.caption || project.palette.accent);
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
    menuProjects.forEach(button => {
      if (Number(button.dataset.menuProject) === active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    setMenuTitle(project.title, { immediate: previous < 0 });
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
    position = clamp(value);
    const x = -position * (stageWidth - galleryInset);
    if (x !== renderedX) {
      galleryTrack.style.transform = `translateX(${x}px)`;
      renderedX = x;
    }
    const scroll = position * stride;
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
    updateActive(Math.round(position));
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
    slideEndsAt = 0;
    root.classList.remove('is-moving');
  }

  function stopWheel() {
    clearTimeout(wheelTimer);
    wheelPosition = null;
  }

  function animateTo(value, { immediate = false, duration, focusThumbnail = false, announceSelection = true } = {}) {
    stopAnimation();
    destination = clamp(value);
    prepareImages(Math.round(destination));
    updateBounds(Math.round(destination));
    animateLift(0, { duration: immediate ? 0 : 280 });
    const from = position;
    const distance = Math.abs(destination - from);
    const finish = () => {
      render(destination);
      root.classList.remove('is-moving');
      animationFrame = 0;
      slideEndsAt = 0;
      if (focusThumbnail) thumbnails[active].focus({ preventScroll: true });
      if (announceSelection) announce();
    };
    if (immediate || reducedMotion.matches || distance < .001) { finish(); return; }
    const length = duration ?? Math.min(800, 380 + distance * 85);
    const start = performance.now();
    slideEndsAt = start + length;
    root.classList.add('is-moving');
    const frame = now => {
      const progress = Math.min(1, (now - start) / length);
      const eased = 1 - (1 - progress) ** 3;
      render(from + (destination - from) * eased);
      if (progress < 1) animationFrame = requestAnimationFrame(frame);
      else finish();
    };
    animationFrame = requestAnimationFrame(frame);
  }

  function select(index, options) {
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
    if (menuAnimation) animateMenu(menuDesiredOpen);
    presentCards(lift);
  }

  function animateMenu(open, { focus = false, focusChoice = null } = {}) {
    const fromHeight = menu.getBoundingClientRect().height;
    const fromOpacity = menu.open ? getComputedStyle(menuBody).opacity : '0';
    const fromTransform = menu.open ? getComputedStyle(menuBody).transform : 'translateY(-6px)';
    if (menuAnimation) {
      menuAnimation.onfinish = null;
      menuAnimation.cancel();
    }
    menuContentAnimation?.cancel();
    menuAnimation = null;
    menuContentAnimation = null;
    menuDesiredOpen = open;
    menuToggle.setAttribute('aria-expanded', String(open));
    if (focus) menuToggle.focus({ preventScroll: true });
    menuBody.inert = !open;
    if (!open && !menu.open) return;
    // Keep native details open during collapse, so its contents remain visible until the animation ends.
    menu.open = true;
    menu.style.height = '';
    const summaryHeight = menuToggle.getBoundingClientRect().height;
    menu.style.setProperty('--menu-summary-height', `${summaryHeight}px`);
    const toHeight = open ? menu.getBoundingClientRect().height : summaryHeight;
    if (reducedMotion.matches || Math.abs(fromHeight - toHeight) < .5) {
      menu.open = open;
    } else {
      menu.style.height = `${fromHeight}px`;
      const animation = menu.animate([{ height: `${fromHeight}px` }, { height: `${toHeight}px` }], {
        duration: open ? 340 : 240, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'forwards'
      });
      menuAnimation = animation;
      menuContentAnimation = menuBody.animate([
        { opacity: fromOpacity, transform: fromTransform },
        { opacity: open ? '1' : '0', transform: open ? 'translateY(0)' : 'translateY(-4px)' }
      ], { duration: open ? 240 : 170, delay: open ? 50 : 0, easing: 'ease-out', fill: 'both' });
      animation.onfinish = () => {
        menu.open = open;
        menu.style.height = '';
        menuAnimation = null;
        animation.cancel();
        menuContentAnimation?.cancel();
        menuContentAnimation = null;
      };
    }
    if (focusChoice !== null) menuChoices[focusChoice].focus({ preventScroll: true });
  }
  function closeMenu(options) { animateMenu(false, options); }
  menuToggle.addEventListener('click', event => {
    event.preventDefault();
    animateMenu(!menuDesiredOpen);
  });
  menu.addEventListener('toggle', () => {
    if (menuAnimation) return;
    menuDesiredOpen = menu.open;
    menuToggle.setAttribute('aria-expanded', String(menu.open));
    menuBody.inert = !menu.open;
  });
  menuToggle.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    event.stopPropagation();
    animateMenu(true, { focusChoice: event.key === 'ArrowDown' ? 0 : menuChoices.length - 1 });
  });
  document.addEventListener('pointerdown', event => {
    if (menuDesiredOpen && !menu.contains(event.target)) closeMenu();
  });
  menu.addEventListener('focusout', event => {
    if (menuDesiredOpen && event.relatedTarget && !menu.contains(event.relatedTarget)) closeMenu();
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
    if (aboutDialog.open || pendingProject) return;
    const target = menuDesiredOpen
      ? menu.querySelector(projectOpen ? `[data-menu-project="${active}"]` : '[data-action="gallery"]')
      : projectOpen ? projectView.querySelector('[data-detail-title]')
      : siteHeader.contains(projectReturnFocus) ? menuToggle : projectReturnFocus;
    (target?.isConnected ? target : captionButton).focus({ preventScroll: true });
  }

  async function transitionProject(opening) {
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
      root.classList.remove('is-project-transitioning', 'is-project-opening');
      projectPage.style.visibility = originalVisibility;
      root.classList.toggle('has-project', opening);
      skipLink.href = opening ? '#detail-title' : '#project-caption';
      gallerySurfaces.forEach(surface => {
        surface.inert = opening;
        if (opening) surface.setAttribute('aria-hidden', 'true');
        else surface.removeAttribute('aria-hidden');
      });
      document.body.classList.toggle('dialog-open', opening || aboutDialog.open);
      projectAbort = null;
    }
  }

  async function runProjectRequests() {
    if (projectBusy) return;
    projectBusy = true;
    try {
      while (pendingProject) {
        const request = pendingProject;
        pendingProject = null;
        if (projectOpen && request.index !== active) await transitionProject(false);
        if (pendingProject) continue;
        if (request.index !== null && !projectOpen) {
          projectOrigin = request.origin || projectOrigin;
          projectReturnFocus = request.returnFocus || projectReturnFocus;
          fillProject(request.index);
          await transitionProject(true);
        }
      }
    } finally {
      projectBusy = false;
      restoreProjectFocus();
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
    closeAbout({ restoreFocus: false });
    pendingProject = { index: index === null ? null : clamp(index), ...options };
    projectAbort?.abort();
    void runProjectRequests();
  }

  function restoreHeader() {
    if (siteHeader.parentElement !== root) root.insertBefore(siteHeader, root.querySelector('.carousel'));
  }

  function closeAbout({ restoreFocus = true } = {}) {
    if (!aboutDialog.open) return;
    aboutReturnFocus = restoreFocus;
    restoreHeader();
    aboutDialog.close();
    document.body.classList.toggle('dialog-open', projectOpen || projectBusy);
  }

  function openAbout() {
    if (aboutDialog.open) return;
    closeMenu();
    dialogReturnFocus = menuToggle;
    aboutReturnFocus = true;
    // Native modals occupy the browser's top layer. Put navigation in that same layer.
    aboutDialog.append(siteHeader);
    aboutDialog.showModal();
    aboutDialog.scrollTop = 0;
    document.body.classList.add('dialog-open');
    aboutDialog.querySelector('[data-close]').focus({ preventScroll: true });
  }

  root.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.detail !== 0 && (stage.contains(event.target) || rail.contains(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const thumbnail = event.target.closest('[data-thumbnail]');
    if (thumbnail && !hasDialog()) { select(Number(thumbnail.dataset.thumbnail), { focusThumbnail: true }); return; }
    const step = event.target.closest('[data-step]');
    if (step && !hasDialog()) { select(Math.round(destination) + Number(step.dataset.step)); return; }
    const choice = event.target.closest('[data-menu-project]');
    if (choice) {
      const index = Number(choice.dataset.menuProject);
      if (projectOpen || projectBusy) requestProject(index, { origin: clickOrigin(event, choice), returnFocus: choice });
      else { closeAbout({ restoreFocus: false }); select(index); closeMenu({ focus: true }); }
      return;
    }
    if (event.target.closest('[data-close]')) { closeAbout(); return; }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton?.dataset.action === 'project') {
      closeMenu();
      requestProject(Number(actionButton.dataset.project ?? active), {
        origin: clickOrigin(event, actionButton), returnFocus: actionButton
      });
    }
    if (actionButton?.dataset.action === 'gallery') {
      if (projectOpen || projectBusy) requestProject(null);
      else { closeAbout({ restoreFocus: false }); closeMenu({ focus: true }); }
    }
    if (actionButton?.dataset.action === 'about') openAbout();
  });

  function beginDrag(event, surface, unit) {
    if (!event.isPrimary || event.button !== 0 || hasDialog()) return;
    // A fresh press is intentional; only the click generated by the preceding drag is suppressed.
    suppressClickUntil = 0;
    stopWheel();
    stopAnimation();
    destination = position;
    const capture = event.target.closest('button') || surface;
    drag = {
      id: event.pointerId, surface, capture, unit,
      x: event.clientX, y: event.clientY, start: position,
      lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false
    };
    capture.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      drag.moved = true;
      root.classList.add('is-dragging');
      animateLift(1);
    }
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = (drag.lastX - event.clientX) / (elapsed * drag.unit);
    drag.lastX = event.clientX;
    drag.lastTime = now;
    render(drag.start - dx / drag.unit);
  }
  function endDrag(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    const finished = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (finished.capture.hasPointerCapture(event.pointerId)) finished.capture.releasePointerCapture(event.pointerId);
    if (finished.moved) {
      suppressClickUntil = performance.now() + 250;
      const recentVelocity = performance.now() - finished.lastTime < 100 && !cancelled ? finished.velocity : 0;
      const momentum = Math.max(-.55, Math.min(.55, recentVelocity * 180));
      select(Math.round(position + momentum));
    } else if (Math.abs(position - Math.round(position)) > .001) {
      select(Math.round(position));
    }
  }
  stage.addEventListener('pointerdown', event => beginDrag(event, stage, stageWidth));
  rail.addEventListener('pointerdown', event => beginDrag(event, rail, stride));
  [stage, rail].forEach(surface => {
    surface.addEventListener('selectstart', event => event.preventDefault());
    surface.addEventListener('pointermove', moveDrag);
    surface.addEventListener('pointerup', event => endDrag(event));
    surface.addEventListener('pointercancel', event => endDrag(event, true));
  });

  rail.addEventListener('wheel', event => {
    if (event.ctrlKey || hasDialog() || drag) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1;
    wheelPosition = clamp((wheelPosition ?? position) + delta * unit / stride);
    animateTo(wheelPosition, { duration: 140, announceSelection: false });
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      const next = Math.round(wheelPosition);
      wheelPosition = null;
      animateTo(next);
    }, 160);
  }, { passive: false });

  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (menuDesiredOpen) {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu({ focus: true }); return; }
      if (menu.contains(event.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const current = menuChoices.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? menuChoices.length - 1
          : Math.max(0, Math.min(menuChoices.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
        menuChoices[next].focus();
      }
      return;
    }
    if (aboutDialog.open) return;
    if (projectOpen || projectBusy) {
      if (event.key === 'Escape') { event.preventDefault(); requestProject(null); }
      return;
    }
    const directions = { ArrowLeft: Math.round(destination) - 1, ArrowRight: Math.round(destination) + 1, Home: 0, End: last };
    if (!(event.key in directions)) return;
    event.preventDefault();
    select(directions[event.key], { focusThumbnail: rail.contains(event.target) });
  });

  dialogs.forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      restoreHeader();
      document.body.classList.toggle('dialog-open', projectOpen || projectBusy);
      if (aboutReturnFocus) dialogReturnFocus?.focus({ preventScroll: true });
    });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeAbout();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeAbout();
    });
  });
  window.addEventListener('resize', () => {
    projectAbort?.abort();
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(measure);
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      projectAbort?.abort();
      setMenuContext(contextIsProject, { immediate: true });
      setMenuTitle(desiredMenuTitle, { immediate: true });
    }
    if (reducedMotion.matches && titleFrame) finishTitle();
    if (reducedMotion.matches && liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
    if (reducedMotion.matches && animationFrame) animateTo(destination, { immediate: true });
    if (reducedMotion.matches && menuAnimation) animateMenu(menuDesiredOpen);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    projectAbort?.abort();
    stopWheel();
    if (animationFrame) animateTo(Math.round(destination), { immediate: true });
    if (titleFrame) finishTitle();
    if (liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
  });
  measure();
  root.dataset.ready = 'true';
}
