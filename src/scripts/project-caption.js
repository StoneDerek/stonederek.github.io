// The gallery caption owns its layout measurements and glyph animation.
export function mountProjectCaption(caption, root, reducedMotion, { endsAt = () => 0 } = {}) {
  const captionWord = caption.querySelector('.caption-word');
  const titleText = caption.querySelector('[data-title]');
  const titleMetrics = caption.querySelector('[data-title-metrics]');
  const button = caption.querySelector('.caption-link');
  const heading = caption.querySelector('h1');
  const arrow = caption.querySelector('.caption-arrow');
  const titleMeasure = caption.ownerDocument.createElement('canvas').getContext('2d');
  let desired = titleText.textContent;
  let titleFrame = 0;
  let titleSlots = [];
  let measuredFont = '';
  let destroyed = false;
  let project = -1;
  let interactive = false;
  let pointerHeld = false;
  let boundaryActive = false;
  let boundaryTitle = '';
  let boundarySlots = null;
  let boundaryProgress = 0;
  let boundaryTarget = 0;
  let boundaryTime = 0;
  const boundaryDuration = 180;
  const glyphWidths = new Map();

  function finish() {
    cancelAnimationFrame(titleFrame);
    titleFrame = 0;
    titleSlots = [];
    boundarySlots = null;
    if (boundaryActive) {
      boundaryProgress = boundaryTarget = Number(interactive);
      desired = boundaryProgress ? boundaryTitle : '';
    }
    titleText.textContent = desired;
    titleMetrics.textContent = desired;
    captionWord.style.width = '';
    button.style.opacity = desired ? '' : '0';
    if (arrow) arrow.style.opacity = '';
    if (!desired && !pointerHeld) caption.hidden = true;
    root.classList.remove('is-scrambling');
    syncInteraction();
  }

  function set(next, { immediate = false, direction = 1 } = {}) {
    if (destroyed) return;
    boundaryActive = false;
    if (arrow) arrow.style.opacity = '';
    boundarySlots = null;
    const entering = caption.hidden;
    // Hidden captions have no layout width. Reveal before measuring, then build
    // the initial glyph frame synchronously so no completed title flashes.
    caption.hidden = false;
    desired = next;
    cancelAnimationFrame(titleFrame);
    titleFrame = 0;
    if (immediate || reducedMotion.matches) { finish(); return; }
    // On a reversal, begin with the glyphs and widths currently on screen.
    const oldLetters = entering ? [] : titleSlots.length
      ? titleSlots.map(slot => slot.glyph.textContent)
      : Array.from(titleText.textContent);
    const oldSizes = !entering && titleSlots.length ? titleSlots.map(slot => slot.size) : null;
    const fromEmpty = !oldLetters.some(letter => letter);
    const toEmpty = next.length === 0;
    const oldWidth = entering ? 0 : captionWord.getBoundingClientRect().width;
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
    if (!count) { finish(); return; }
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
      const newSize = width(target) * newWidth / (newTotal || 1);
      const oldSize = oldSizes ? oldSizes[i] || 0 : width(old) * oldWidth / (oldTotal || 1);
      // Increasing gallery position brings the image in from the right.
      const ordinal = (direction > 0 ? count - 1 - i : i) / Math.max(1, count - 1);
      glyph.textContent = old;
      return { slot, glyph, old, target, oldSize, newSize, size: oldSize,
        renderedX: NaN, renderedSize: NaN,
        pool: target && target === target.toUpperCase() ? upperPool : lowerPool,
        begin: ordinal * (fromEmpty ? .68 : .2),
        disappear: .18 + ordinal * .64, resolve: .32 + ordinal * .5, nextChange: 0, swaps: 0 };
    });
    titleText.replaceChildren(fragment);
    const start = performance.now();
    const remaining = endsAt() - start;
    const duration = remaining > 0 ? Math.max(180, Math.min(420, remaining)) : 360;
    let renderedWidth = NaN;
    root.classList.add('is-scrambling');
    const frame = now => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      if (progress === 1) { finish(); return; }
      const blend = progress * progress * (3 - 2 * progress);
      let x = 0;
      for (let i = 0; i < titleSlots.length; i++) {
        const s = titleSlots[i];
        const alive = fromEmpty ? progress > s.begin : toEmpty ? progress < s.disappear : true;
        // New characters get their readable width when their scramble starts.
        // Existing project-to-project width interpolation stays continuous.
        s.size = fromEmpty ? alive ? s.newSize : 0
          : toEmpty ? alive ? s.oldSize : 0
          : s.oldSize + (s.newSize - s.oldSize) * blend;
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
        if (!alive) {
          replacement = '';
        } else if (progress === 0) {
          replacement = s.old;
        } else if (s.old === s.target || s.target === ' ' || progress >= s.resolve) {
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
      button.style.opacity = x > 0 ? '' : '0';
      syncInteraction();
      titleFrame = requestAnimationFrame(frame);
    };
    // Lay out the starting slots before the next paint.
    frame(start);
  }

  function drawBoundary(next, reveal) {
    // Floating-point accumulation must not pick different glyphs when the
    // same moment is reached by playing forward versus rewinding.
    reveal = Math.round(reveal * 1e6) / 1e6;
    if (reveal <= 0 || reveal >= 1) {
      const target = reveal >= 1 ? next : '';
      desired = target;
      titleSlots = [];
      boundarySlots = null;
      if (titleText.textContent !== target) titleText.textContent = target;
      titleMetrics.textContent = target;
      captionWord.style.width = '';
      button.style.opacity = target ? '' : '0';
      if (arrow) arrow.style.opacity = '';
      root.classList.remove('is-scrambling');
      caption.hidden = !target && !pointerHeld;
      return;
    }
    caption.hidden = false;
    titleSlots = [];
    desired = next;
    if (!boundarySlots || boundaryTitle !== next) {
      boundaryTitle = next;
      const font = getComputedStyle(titleText);
      titleMeasure.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
      const letters = Array.from(next);
      titleMetrics.textContent = next;
      const fullWidth = titleMetrics.getBoundingClientRect().width;
      const widths = letters.map(letter => titleMeasure.measureText(letter).width);
      const totalWidth = widths.reduce((a, b) => a + b, 0) || 1;
      const fragment = document.createDocumentFragment();
      boundarySlots = letters.map((letter, index) => {
        const slot = document.createElement('span');
        const glyph = document.createElement('span');
        slot.className = 'caption-slot'; glyph.className = 'caption-glyph';
        slot.append(glyph); fragment.append(slot);
        return { slot, glyph, letter, size: widths[index] * fullWidth / totalWidth,
          threshold: (letters.length - 1 - index) / Math.max(1, letters.length - 1) * .65,
          pool: letters.filter((candidate, i) => candidate !== ' ' && widths[i] <= widths[index] + .5) };
      });
      titleText.replaceChildren(fragment);
    }
    let x = 0;
    for (let i = 0; i < boundarySlots.length; i++) {
      const s = boundarySlots[i];
      const local = Math.max(0, Math.min(1, (reveal - s.threshold) / .35));
      const blend = local * local * (3 - 2 * local);
      // Overlapping glyphs grow/shrink continuously, keeping the visible run
      // centered without the old one-character width jumps. Rewinding the
      // clock draws exactly the same substitutions and geometry.
      const size = s.size * blend;
      const glyph = local <= 0 ? '' : local >= .75 || s.letter === ' ' ? s.letter
        : s.pool[(i + Math.floor(local * 5)) % s.pool.length] || s.letter;
      if (s.glyph.textContent !== glyph) s.glyph.textContent = glyph;
      s.glyph.style.opacity = String(blend);
      const left = `${x}px`, width = `${size}px`;
      if (s.slot.style.left !== left) s.slot.style.left = left;
      if (s.slot.style.width !== width) s.slot.style.width = width;
      x += size;
    }
    const width = `${x}px`;
    if (captionWord.style.width !== width) captionWord.style.width = width;
    button.style.opacity = x ? '' : '0';
    if (arrow) arrow.style.opacity = String(Math.min(1, reveal * 3));
    root.classList.add('is-scrambling');
  }

  function advanceBoundary(now) {
    const step = Math.max(0, now - boundaryTime) / boundaryDuration;
    boundaryProgress += Math.max(-step, Math.min(step, boundaryTarget - boundaryProgress));
    if (Math.abs(boundaryTarget - boundaryProgress) < .00001) boundaryProgress = boundaryTarget;
    boundaryTime = now;
    drawBoundary(boundaryTitle, boundaryProgress);
    syncInteraction();
  }

  function boundaryFrame(now) {
    titleFrame = 0;
    advanceBoundary(now);
    if (Math.abs(boundaryTarget - boundaryProgress) > .00001) titleFrame = requestAnimationFrame(boundaryFrame);
  }

  function setBoundaryVisible(next, visible, { immediate = false } = {}) {
    const now = performance.now();
    if (!boundaryActive) {
      cancelAnimationFrame(titleFrame);
      titleFrame = 0;
      boundaryProgress = caption.hidden || !titleText.textContent ? 0 : 1;
      boundaryTime = now;
      boundaryActive = true;
    } else advanceBoundary(now);
    boundaryTitle = next;
    // Only complete entrance/exit destinations are accepted. Drag position
    // can trigger a selection change, but cannot scrub or stall this clock.
    boundaryTarget = visible ? 1 : 0;
    if (immediate || reducedMotion.matches) {
      boundaryProgress = boundaryTarget = Number(interactive);
      cancelAnimationFrame(titleFrame);
      titleFrame = 0;
    }
    drawBoundary(next, boundaryProgress);
    if (Math.abs(boundaryTarget - boundaryProgress) > .00001 && !titleFrame) {
      titleFrame = requestAnimationFrame(boundaryFrame);
    }
  }

  function syncInteraction() {
    const accessible = interactive && titleText.textContent.length > 0;
    const inert = !accessible && !pointerHeld;
    if (caption.inert !== inert) caption.inert = inert;
    if (button.inert !== inert) button.inert = inert;
    if (caption.getAttribute('aria-hidden') !== String(!accessible)) {
      caption.setAttribute('aria-hidden', String(!accessible));
    }
  }

  return {
    set,
    finish,
    present(state, { title, immediate = false, holdPointer = false } = {}) {
      if (destroyed) return;
      interactive = state.interactive;
      pointerHeld = holdPointer;
      if (state.boundaryVisible !== null && state.boundaryVisible !== undefined &&
        (boundaryActive || !state.boundaryVisible || project < 0)) {
        setBoundaryVisible(title, state.boundaryVisible, { immediate });
        button.dataset.project = String(state.project);
        button.setAttribute('aria-label', `View ${title}`);
        heading.setAttribute('aria-label', title);
        project = state.project;
        syncInteraction();
        return;
      }
      if (boundaryActive) {
        boundaryActive = false;
        cancelAnimationFrame(titleFrame);
        titleFrame = 0;
        boundarySlots = null;
      }
      if (state.visible || state.links) {
        if (project !== state.project || desired !== title) {
          const direction = Math.sign(state.project - project) || 1;
          set(title, { immediate: immediate || state.links, direction });
          button.dataset.project = String(state.project);
          button.setAttribute('aria-label', `View ${title}`);
          heading.setAttribute('aria-label', title);
          project = state.project;
        } else caption.hidden = false;
        if (!state.visible && !pointerHeld) caption.hidden = true;
      } else if (caption.hidden) {
        project = -1;
      } else if (desired) {
        // Depart through the same clock as entry, rather than hiding the label
        // immediately when the selected panel changes back to Home/About.
        set('', { immediate, direction: -1 });
      } else if (!titleFrame) finish();
      syncInteraction();
    },
    pause() { cancelAnimationFrame(titleFrame); titleFrame = 0; boundaryTime = performance.now(); },
    hide() {
      if (!caption.hidden || titleFrame || titleSlots.length) finish();
      caption.hidden = true;
      project = -1;
      boundaryActive = false;
    },
    get animating() { return titleFrame !== 0; },
    destroy() { finish(); destroyed = true; }
  };
}
