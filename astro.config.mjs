import { defineConfig } from 'astro/config';

// GitHub supplies this during Actions builds. Locally, use the intended user site.
const repository = process.env.GITHUB_REPOSITORY || 'StoneDerek/stonederek.github.io';
const [owner, name] = repository.split('/');
const userSite = name.toLowerCase() === `${owner.toLowerCase()}.github.io`;

export default defineConfig({
  output: 'static',
  site: process.env.PORTFOLIO_SITE || `https://${owner.toLowerCase()}.github.io`,
  base: process.env.PORTFOLIO_BASE || (userSite ? '/' : `/${name}/`),
});
