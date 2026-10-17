// The gallery caption owns its layout measurements and glyph animation.
export function mountProjectCaption(caption, root, reducedMotion, { endsAt = () => 0 } = {}) {
  const captionWord = caption.querySelector('.caption-word');
  const titleText = caption.querySelector('[data-title]');
  const titleMetrics = caption.querySelector('[data-title-metrics]');
  const button = caption.querySelector('.caption-link');
  const heading = caption.querySelector('h1');
  const titleMeasure = caption.ownerDocument.createElement('canvas').getContext('2d');
  let desired = titleText.textContent;
  let titleFrame = 0;
  let titleSlots = [];
  let measuredFont = '';
  let destroyed = false;
  let project = -1;
  let revealing = false;
  const glyphWidths = new Map();

  function finish() {
    cancelAnimationFrame(titleFrame);
    titleFrame = 0;
    titleSlots = [];
    titleText.textContent = desired;
    titleMetrics.textContent = desired;
    captionWord.style.width = '';
    button.style.opacity = '';
    revealing = false;
    root.classList.remove('is-scrambling');
  }

  function set(next, { immediate = false, direction = 1 } = {}) {
    if (destroyed) return;
    revealing = false;
    button.style.opacity = '';
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
      // An entry starts with blank glyphs in full-size slots. Zero-width slots
      // would clip the scramble and make the resolved title appear all at once.
      const oldSize = entering ? newSize : oldSizes ? oldSizes[i] || 0 : width(old) * oldWidth / (oldTotal || 1);
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
        if (progress === 0) {
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
      titleFrame = requestAnimationFrame(frame);
    };
    // Lay out the starting slots before the next paint.
    frame(start);
  }

  function reveal(next, progress) {
    cancelAnimationFrame(titleFrame);
    titleFrame = 0;
    titleSlots = [];
    desired = next;
    revealing = true;
    const letters = Array.from(next);
    const count = Math.floor(Math.max(0, Math.min(1, progress)) * letters.length);
    const pool = [...new Set(next.toLowerCase().replace(/\s/g, ''))];
    const phase = Math.floor(progress * 24);
    const displayed = letters.slice(letters.length - count).map((target, offset) => {
      const index = letters.length - count + offset;
      const ordinal = (letters.length - 1 - index) / Math.max(1, letters.length - 1);
      if (target === ' ' || progress >= .32 + ordinal * .5) return target;
      const glyph = pool[(index * 5 + phase * 3) % pool.length];
      return target === target.toUpperCase() ? glyph.toUpperCase() : glyph;
    }).join('');
    // Native text width grows with the actual number of drawn characters.
    // Full-width invisible placeholders would hide the count transition.
    if (titleText.textContent !== displayed) titleText.textContent = displayed;
    if (titleMetrics.textContent !== displayed) titleMetrics.textContent = displayed;
    captionWord.style.width = '';
    button.style.opacity = count ? '' : '0';
    if (count && progress < 1) root.classList.add('is-scrambling');
    else root.classList.remove('is-scrambling');
  }

  return {
    set,
    finish,
    present(state, { title, immediate = false, holdPointer = false } = {}) {
      if (destroyed) return;
      if (state.visible || state.links || holdPointer) {
        if (state.reveal !== null && !reducedMotion.matches && !state.links) {
          reveal(title, state.reveal);
          caption.hidden = false;
        } else if (project !== state.project) {
          const direction = Math.sign(state.project - project) || 1;
          set(title, { immediate: immediate || state.links, direction });
        } else {
          if (revealing) finish();
          caption.hidden = false;
        }
        if (project !== state.project) {
          button.dataset.project = String(state.project);
          button.setAttribute('aria-label', `View ${title}`);
          heading.setAttribute('aria-label', title);
          project = state.project;
        }
        if (!state.visible && !holdPointer) caption.hidden = true;
      } else {
        this.hide();
        project = -1;
      }
      // Crossing the selection midpoint must not remove a held drag target.
      const accessible = state.interactive && titleText.textContent.length > 0;
      const inert = !accessible && !holdPointer;
      if (caption.inert !== inert) caption.inert = inert;
      if (button.inert !== inert) button.inert = inert;
      if (caption.getAttribute('aria-hidden') !== String(!accessible)) {
        caption.setAttribute('aria-hidden', String(!accessible));
      }
    },
    pause() { cancelAnimationFrame(titleFrame); titleFrame = 0; },
    hide() {
      if (!caption.hidden || titleFrame || titleSlots.length || revealing) finish();
      caption.hidden = true;
      project = -1;
    },
    get animating() { return titleFrame !== 0 || revealing; },
    destroy() { finish(); destroyed = true; }
  };
}
