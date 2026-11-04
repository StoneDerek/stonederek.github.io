function normalizedBase(base = '/') {
  const path = new URL(base, 'https://portfolio.invalid').pathname;
  return `${path.replace(/\/+$/, '')}/`;
}

export function workAddress(slug = null, { base = '/' } = {}) {
  const path = `${normalizedBase(base)}projects/`;
  return slug ? `${path}#project=${encodeURIComponent(slug)}` : path;
}

export function workLinksAddress({ base = '/' } = {}) {
  return `${normalizedBase(base)}art/#links`;
}

// Work owns only its direct route. About anchors and the resume stay native.
export function resolveWorkLocation(address, projects, { base = '/' } = {}) {
  const url = new URL(address, 'https://portfolio.invalid');
  const path = url.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  if (path !== workAddress(null, { base }).replace(/\/$/, '')) return null;

  const hash = new URLSearchParams(url.hash.slice(1));
  const find = slug => slug && projects.find(project =>
    project.slug === slug || project.legacySlugs?.includes(slug));
  const project = find(hash.get('project'));
  if (project) return { view: 'article', slug: project.slug };
  if (hash.has('links')) return { view: 'legacy-links', slug: null };
  const slide = find(hash.get('slide'));
  if (slide) return { view: 'article', slug: slide.slug };
  return { view: 'grid', slug: null };
}
