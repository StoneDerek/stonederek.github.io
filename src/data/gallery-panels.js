import { homePalette, aboutPalette } from './section-palettes.js';

export const firstProjectPanel = 2;

export function galleryPanels(projects) {
  return [
    { kind: 'home', slug: 'home', title: 'Home', palette: homePalette },
    { kind: 'about', slug: 'about', title: 'About', palette: aboutPalette },
    ...projects.map(project => ({ ...project, kind: 'project' }))
  ];
}
