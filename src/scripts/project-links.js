export function projectIndexFromHash(hash, projects) {
  const slug = new URLSearchParams(hash.replace(/^#/, '')).get('project');
  return projects.findIndex(project => project.slug === slug);
}
