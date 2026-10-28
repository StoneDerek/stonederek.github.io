export function projectMediaSource(src, base = '/') {
  return /^(https?:\/\/|\/|data:image\/)/.test(src) ? src : `${base}${src}`;
}

export function renderProjectMedia(host, items = [], { base = '/', eager = true } = {}) {
  const doc = host.ownerDocument;
  const figures = doc.createDocumentFragment();
  for (const item of items) {
    if (!item.src) continue;
    const figure = doc.createElement('figure');
    figure.className = 'project-figure';
    const image = doc.createElement('img');
    image.src = projectMediaSource(item.src, base);
    image.alt = item.alt || '';
    image.decoding = 'async';
    image.loading = eager && !figures.childElementCount ? 'eager' : 'lazy';
    if (item.width > 0) image.width = item.width;
    if (item.height > 0) image.height = item.height;
    figure.append(image);
    if (item.caption) {
      const caption = doc.createElement('figcaption');
      caption.textContent = item.caption;
      figure.append(caption);
    }
    figures.append(figure);
  }
  host.replaceChildren(figures);
  host.hidden = !host.childElementCount;
}

export function mountProjectCaseStudy(host, { base = '/', reducedMotion } = {}) {
  const doc = host.ownerDocument;
  const element = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const controller = new AbortController();
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-case-study-jump], [data-article-jump]');
    if (!button || !host.contains(button)) return;
    const heading = host.querySelector(`#${button.dataset.caseStudyJump || button.dataset.articleJump}`);
    if (!heading) return;
    event.preventDefault();
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }, { signal: controller.signal });

  function render(project) {
    const { facts = [], sections = [], footnotes = [] } = project.caseStudy || {};
    const slug = project.slug.replace(/[^\w-]/g, '-');
    const appendInline = (parent, content) => {
      for (const run of Array.isArray(content) ? content : [content]) {
        if (typeof run === 'string') { parent.append(doc.createTextNode(run)); continue; }
        if (!run || typeof run !== 'object') continue;
        if (Number.isInteger(run.footnote) && footnotes.some(note => note.number === run.footnote)) {
          const marker = element('span', 'project-noteref');
          const link = element('a', '', String(run.footnote));
          link.id = `project-ref-${slug}-${run.footnote}`;
          link.href = `#project-note-${slug}-${run.footnote}`;
          link.dataset.articleJump = `project-note-${slug}-${run.footnote}`;
          link.setAttribute('role', 'doc-noteref');
          link.setAttribute('aria-label', `Footnote ${run.footnote}`);
          marker.append('[', link, ']');
          if (parent.textContent && !/\s$/.test(parent.textContent)) parent.append(' ');
          parent.append(marker);
          continue;
        }
        let node = doc.createTextNode(run.text || '');
        for (const [enabled, tag] of [[run.bold, 'strong'], [run.italic, 'em']]) {
          if (!enabled) continue;
          const wrapper = element(tag); wrapper.append(node); node = wrapper;
        }
        if (/^https?:\/\//.test(run.href || '')) {
          const link = element('a');
          link.href = run.href;
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.append(node); node = link;
        }
        parent.append(node);
      }
    };
    host.dataset.layout = project.caseStudy?.layout === 'art' ? 'art' : '';
    const content = doc.createDocumentFragment();
    const entries = facts.filter(fact => fact.label && fact.value);
    if (entries.length) {
      const list = element('dl', 'case-study-facts');
      for (const fact of entries) {
        const entry = element('div');
        entry.append(element('dt', '', fact.label), element('dd', '', fact.value));
        list.append(entry);
      }
      content.append(list);
    }
    const chapters = sections.filter(section => section.title &&
      (section.paragraphs?.some(Boolean) || section.media?.some(item => item.src)));
    if (chapters.length) {
      const layout = element('div', 'case-study-layout');
      const contents = element('nav', 'case-study-contents');
      contents.setAttribute('aria-label', 'Project sections');
      contents.append(element('p', 'case-study-contents-label', 'On this page'));
      const choices = element('div', 'case-study-choices');
      const body = element('div', 'case-study-body');
      chapters.forEach((chapter, index) => {
        const id = `project-section-${project.slug.replace(/[^\w-]/g, '-')}-${index + 1}`;
        const section = element('section', 'case-study-section');
        section.setAttribute('aria-labelledby', id);
        const heading = element('h2', '', chapter.title);
        heading.id = id;
        heading.tabIndex = -1;
        const number = element('span', 'case-study-number', String(index + 1).padStart(2, '0'));
        number.setAttribute('aria-hidden', 'true');
        if (chapter.title !== number.textContent) section.append(number);
        section.append(heading);
        const media = element('div', 'case-study-media');
        renderProjectMedia(media, chapter.media, { base, eager: false });
        if (!media.hidden && chapter.mediaFirst) {
          media.classList.add('case-study-media-first');
          section.append(media);
        }
        const prose = host.dataset.layout === 'art' ? element('div', 'case-study-prose') : section;
        for (const paragraph of chapter.paragraphs || []) {
          if (!paragraph) continue;
          const text = element('p');
          appendInline(text, paragraph);
          prose.append(text);
        }
        if (prose !== section && prose.childElementCount) section.append(prose);
        if (!media.hidden && !chapter.mediaFirst) section.append(media);
        const references = element('div', 'case-study-references');
        for (const reference of chapter.references || []) {
          if (!reference.label || !/^https?:\/\//.test(reference.href || '')) continue;
          const link = element('a', '', reference.label);
          link.href = reference.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          references.append(link);
        }
        if (references.childElementCount) section.append(references);
        body.append(section);
        const choice = element('button', '', chapter.title);
        choice.type = 'button';
        choice.dataset.caseStudyJump = id;
        choice.setAttribute('aria-controls', id);
        choices.append(choice);
      });
      if (footnotes.length) {
        const notes = element('div', 'project-footnotes');
        notes.setAttribute('role', 'doc-endnotes');
        notes.setAttribute('aria-label', 'Footnotes');
        for (const note of footnotes) {
          const entry = element('div', 'project-footnote');
          entry.id = `project-note-${slug}-${note.number}`;
          entry.tabIndex = -1;
          for (const [index, paragraph] of (note.paragraphs || []).entries()) {
            const text = element('p');
            if (index === 0) {
              const back = element(note.backlink === false ? 'span' : 'a', 'footnote-number', String(note.number));
              if (note.backlink !== false) {
                back.href = `#project-ref-${slug}-${note.number}`;
                back.dataset.articleJump = `project-ref-${slug}-${note.number}`;
                back.setAttribute('role', 'doc-backlink');
                back.setAttribute('aria-label', `Back to reference ${note.number}`);
              }
              text.append('[', back, '] ');
            }
            appendInline(text, paragraph);
            entry.append(text);
          }
          notes.append(entry);
        }
        body.append(notes);
      }
      contents.append(choices);
      layout.append(contents, body);
      content.append(layout);
    }
    host.replaceChildren(content);
    host.hidden = !host.childElementCount;
  }
  return { render, destroy() { controller.abort(); } };
}
