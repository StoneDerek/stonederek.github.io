const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function paragraph(content, slug, notes) {
  let html = '';
  let text = '';
  for (const run of Array.isArray(content) ? content : [content]) {
    if (typeof run === 'string') { html += escape(run); text += run; continue; }
    if (!run || typeof run !== 'object') continue;
    if (Number.isInteger(run.footnote) && notes.some(note => note.number === run.footnote)) {
      const number = run.footnote;
      if (text && !/\s$/.test(text)) html += ' ';
      html += `<span class="project-noteref"><a id="project-ref-${slug}-${number}" href="#project-note-${slug}-${number}" data-article-jump="project-note-${slug}-${number}" role="doc-noteref" aria-label="Footnote ${number}">[${number}]</a></span>`;
      text += `[${number}]`;
      continue;
    }
    let inline = escape(run.text || '');
    if (run.bold) inline = `<strong>${inline}</strong>`;
    if (run.italic) inline = `<em>${inline}</em>`;
    if (/^https?:\/\//.test(run.href || '')) inline = `<a href="${escape(run.href)}" target="_blank" rel="noopener noreferrer">${inline}</a>`;
    html += inline;
    text += run.text || '';
  }
  return html;
}

// Native Art prose is present before the gallery controller loads. Keep its
// section/reference hooks compatible with the shared case-study interactions.
export function renderArtProse(project) {
  const slug = escape(project.slug.replace(/[^\w-]/g, '-'));
  const notes = (project.caseStudy.footnotes || []).filter(note => note.number > 0);
  const sections = project.caseStudy.sections.map((section, index) => {
    const id = `project-section-${slug}-${index + 1}`;
    const paragraphs = (section.paragraphs || []).filter(Boolean)
      .map(content => `<p>${paragraph(content, slug, notes)}</p>`).join('');
    return `<section class="case-study-section" aria-labelledby="${id}" aria-hidden="${index !== 0}"${index ? ' hidden inert' : ''}><h2 id="${id}" tabindex="-1" hidden>Untitled #${index + 1}</h2><div class="case-study-prose">${paragraphs}</div></section>`;
  }).join('');
  const footnotes = notes.map(note => {
    const paragraphs = (note.paragraphs || []).map((content, index) => {
      const number = note.backlink === false
        ? `<span class="footnote-number">[${note.number}]</span>`
        : `<a class="footnote-number" href="#project-ref-${slug}-${note.number}" data-article-jump="project-ref-${slug}-${note.number}" role="doc-backlink" aria-label="Back to reference ${note.number}">[${note.number}]</a>`;
      return `<p>${index === 0 ? `${number} ` : ''}${paragraph(content, slug, notes)}</p>`;
    }).join('');
    return `<div class="project-footnote" id="project-note-${slug}-${note.number}" tabindex="-1">${paragraphs}</div>`;
  }).join('');
  return `<div class="case-study-layout"><div class="case-study-body">${sections}<div class="project-footnotes" role="doc-endnotes" aria-label="Footnotes">${footnotes}</div></div></div>`;
}
