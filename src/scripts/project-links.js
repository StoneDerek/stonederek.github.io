import { sectionFromPath } from './section-state.js';

export function projectIndexFromHash(hash, projects) {
  const slug = new URLSearchParams(hash.replace(/^#/, '')).get('project');
  return projects.findIndex(project => project.slug === slug);
}

export function projectSectionEntry(from, to, projects) {
  if (sectionFromPath(from.pathname) === 'projects' || sectionFromPath(to.pathname) !== 'projects') return -1;
  return projectIndexFromHash(to.hash, projects);
}
