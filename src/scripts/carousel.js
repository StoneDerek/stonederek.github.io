export function mountPortfolio() {
  const root = document.getElementById('portfolio');
  const data = document.getElementById('portfolio-data');
  if (!root || !data) return;
  const projects = JSON.parse(data.textContent);
  const slides = [...root.querySelectorAll('[data-slide]')];
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
  const dialogs = [...root.querySelectorAll('dialog')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const previousButton = root.querySelector('[data-step="-1"]');
  const nextButton = root.querySelector('[data-step="1"]');
  const last = projects.length - 1;
  const clamp = value => Math.max(0, Math.min(last, value));
  const setText = (selector, value) => { root.querySelector(selector).textContent = value; };
  const hasDialog = () => dialogs.some(dialog => dialog.open);
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
  const titleMeasure = document.createElement('canvas').getContext('2d');

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
    titleMeasure.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
    const width = text => titleMeasure.measureText(text).width;
    const letters = Array.from(next);
    titleMetrics.textContent = next;
    const newWidth = titleMetrics.getBoundingClientRect().width;
    const count = Math.max(oldLetters.length, letters.length);
    const pool = [...new Set((oldLetters.join('') + next).toLowerCase().replace(/\s/g, ''))];
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
        begin: ordinal * .2, resolve: .32 + ordinal * .5, nextChange: 0, swaps: 0 };
    });
    titleText.replaceChildren(fragment);
    const start = performance.now();
    const duration = slideEndsAt > start ? Math.max(180, Math.min(420, slideEndsAt - start)) : 360;
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
        s.slot.style.left = `${x}px`;
        s.slot.style.width = `${s.size}px`;
        x += s.size;
        if (s.old === s.target || s.target === ' ' || progress >= s.resolve) {
          s.glyph.textContent = s.target;
        } else if (progress < s.begin) {
          s.glyph.textContent = s.old;
        } else if (elapsed >= s.nextChange) {
          const compatible = pool.filter(letter => width(s.target && s.target === s.target.toUpperCase()
            ? letter.toUpperCase() : letter) <= s.size + .5);
          let replacement = compatible.length ? compatible[(i * 5 + s.swaps * 3) % compatible.length] : s.target;
          if (s.target && s.target === s.target.toUpperCase()) replacement = replacement.toUpperCase();
          s.glyph.textContent = replacement;
          s.swaps++;
          s.nextChange = elapsed + 28 + progress * progress * 90 + (i % 4) * 7;
        }
      }
      captionWord.style.width = `${x}px`;
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
    const project = projects[active];
    root.style.setProperty('--accent', project.palette.accent);
    root.style.setProperty('--ink', project.palette.ink);
    root.style.setProperty('--caption-color', project.palette.caption || project.palette.accent);
    captionButton.dataset.project = String(active);
    captionButton.setAttribute('aria-label', `View ${project.title}`);
    root.querySelector('.project-caption h1').setAttribute('aria-label', project.title);
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
    root.querySelectorAll('[data-menu-project]').forEach(button => {
      if (Number(button.dataset.menuProject) === active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    setText('[data-menu-title]', project.title);
    setText('[data-mobile-count]', `${String(active + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`);
    root.querySelector('.mobile-inspect').setAttribute('aria-label', `View ${project.title}`);
    updateBounds(root.classList.contains('is-moving') ? Math.round(destination) : active);
  }

  function render(value) {
    position = clamp(value);
    galleryTrack.style.transform = `translate3d(${-position * (stageWidth - galleryInset)}px, 0, 0)`;
    rail.scrollLeft = position * stride;
    thumbnails.forEach((button, i) => button.style.setProperty('--focus', Math.max(0, 1 - Math.abs(i - position))));
    updateActive(Math.round(position));
  }

  function presentCards(value) {
    lift = value;
    galleryInset = Math.min(20, stageWidth * .025) * lift;
    // The slide pitch removes one inset so neighboring cards share a single gap.
    galleryTrack.style.setProperty('--gallery-inset', `${galleryInset}px`);
    galleryTrack.style.setProperty('--gallery-scale', String(1 - 2 * galleryInset / stageWidth));
    galleryTrack.style.setProperty('--gallery-radius', `${Math.min(14, stageWidth * .03) * lift}px`);
    render(position);
  }

  function animateLift(target, { duration = 220 } = {}) {
    cancelAnimationFrame(liftFrame);
    liftFrame = 0;
    const from = lift;
    if (reducedMotion.matches || !duration || Math.abs(target - from) < .001) {
      presentCards(target);
      return;
    }
    const start = performance.now();
    const frame = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = target === 0 ? progress * progress * (3 - 2 * progress) : 1 - (1 - progress) ** 3;
      presentCards(from + (target - from) * eased);
      if (progress < 1) liftFrame = requestAnimationFrame(frame);
      else liftFrame = 0;
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
    rail.style.setProperty('--rail-padding', `${Math.max(0, (rail.clientWidth - thumbnails[0].offsetWidth) / 2)}px`);
    menu.style.setProperty('--menu-summary-height', `${menuToggle.getBoundingClientRect().height}px`);
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

  function openDialog(type, index = active) {
    closeMenu();
    const dialog = root.querySelector(`[data-dialog="${type}"]`);
    if (type === 'project') {
      select(index, { immediate: true, announceSelection: false });
      const project = projects[active];
      const image = root.querySelector('[data-detail-image]');
      image.src = slides[active].querySelector('img').src;
      image.alt = project.imageAlt;
      setText('[data-detail-title]', project.title);
      setText('[data-detail-category]', project.category);
      setText('[data-detail-year]', project.year);
      setText('[data-detail-description]', project.description);
      setText('[data-detail-note]', project.note);
      setText('[data-detail-number]', `${String(active + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`);
    }
    if (type === 'project') finishTitle();
    dialogReturnFocus = type === 'about' ? menuToggle : captionButton;
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('dialog-open');
  }

  root.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.detail !== 0 && (stage.contains(event.target) || rail.contains(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const thumbnail = event.target.closest('[data-thumbnail]');
    if (thumbnail) { select(Number(thumbnail.dataset.thumbnail), { focusThumbnail: true }); return; }
    const step = event.target.closest('[data-step]');
    if (step) { select(Math.round(destination) + Number(step.dataset.step)); return; }
    const choice = event.target.closest('[data-menu-project]');
    if (choice) { select(Number(choice.dataset.menuProject)); closeMenu({ focus: true }); return; }
    if (event.target.closest('[data-close]')) { event.target.closest('dialog').close(); return; }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton?.dataset.action === 'project') {
      openDialog('project', Number(actionButton.dataset.project ?? active));
      if (actionButton.classList.contains('mobile-inspect')) dialogReturnFocus = actionButton;
    }
    if (actionButton?.dataset.action === 'about') openDialog('about');
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
    if (hasDialog() || event.altKey || event.ctrlKey || event.metaKey) return;
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
    const directions = { ArrowLeft: Math.round(destination) - 1, ArrowRight: Math.round(destination) + 1, Home: 0, End: last };
    if (!(event.key in directions)) return;
    event.preventDefault();
    select(directions[event.key], { focusThumbnail: rail.contains(event.target) });
  });

  dialogs.forEach(dialog => {
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      dialogReturnFocus?.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  });
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(measure);
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && titleFrame) finishTitle();
    if (reducedMotion.matches && liftFrame) animateLift(drag?.moved ? 1 : 0, { duration: 0 });
    if (reducedMotion.matches && animationFrame) animateTo(destination, { immediate: true });
    if (reducedMotion.matches && menuAnimation) animateMenu(menuDesiredOpen);
  });
  measure();
  root.dataset.ready = 'true';
}
