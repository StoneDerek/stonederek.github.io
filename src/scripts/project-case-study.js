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
    const button = event.target.closest('[data-case-study-jump]');
    if (!button || !host.contains(button)) return;
    const heading = host.querySelector(`#${button.dataset.caseStudyJump}`);
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }, { signal: controller.signal });

  function render(project) {
    const { facts = [], sections = [] } = project.caseStudy || {};
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
        section.append(number, heading);
        for (const paragraph of chapter.paragraphs || []) {
          if (paragraph) section.append(element('p', '', paragraph));
        }
        const media = element('div', 'case-study-media');
        renderProjectMedia(media, chapter.media, { base, eager: false });
        if (!media.hidden) section.append(media);
        body.append(section);
        const choice = element('button', '', chapter.title);
        choice.type = 'button';
        choice.dataset.caseStudyJump = id;
        choice.setAttribute('aria-controls', id);
        choices.append(choice);
      });
      contents.append(choices);
      layout.append(contents, body);
      content.append(layout);
    }
    host.replaceChildren(content);
    host.hidden = !host.childElementCount;
  }
  return { render, destroy() { controller.abort(); } };
}
