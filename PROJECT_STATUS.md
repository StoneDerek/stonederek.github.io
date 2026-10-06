# Portfolio continuation — 5 October 2026

The current source restores the Home/About work recovered from the earlier chat. The repository is `StoneDerek/stonederek.github.io`; the recovery is based on `ebe0ddf` (dynamic favicon). GitHub repository access has been enabled, and the user has authorized publishing these tested changes. Pushes to `main` run the existing GitHub Pages workflow; check its result before reporting a release as live.

## Current pages

- Home is a simple introduction with **Explore projects** and **More about me**. It has no gallery preview or project overview sections.
- Home uses a light purple accent (`#ded3ff`). About uses light blue (`#cde9ff`). Gallery accents still follow the selected artwork.
- The small Home/About/Projects switcher is present on Home and About. It hides after scrolling more than 8px, removes its links from keyboard navigation, and transfers focus to the main menu if necessary. Projects omits it.
- The full dropdown, project articles and tile transitions, gallery gestures, email, LinkedIn, favicon colors, publication date, and résumé placeholder remain available.
- Projects now identifies its gallery as **Projects**, and no longer announces Home as the current page.
- Home, About, and all six projects still use placeholder copy/artwork. This continuation does not invent portfolio accomplishments.

## Current transition study

`design/section-motion.html` is the editable source of the in-conversation comparison. It is an HTML fragment for the Visualize skill, not a production page. Render the fragment once with that skill's current `scripts/render.py` to inspect it; do not feed an already wrapped standalone file back into the renderer.

The last four-option study has been simplified to **Plain slide** and **Slim color edge**. Both push the old and new page in one continuous 360ms motion. The second adds only a narrow two-tone edge that moves with the new page. The menu remains stationary. Section order is Home → About → Projects: later sections enter from the right; earlier sections enter from the left. There is no automatic animation on load. Rapid requests retain the latest queued destination, and reduced motion switches immediately.

These are comparison options. They are not yet installed in the production page navigation. The website's existing project-article Tile settle is a separate interaction.

## Resume work here

1. Read this file and the current source before changing anything.
2. Keep the two-option transition study available for the user's judgment.
3. After the section motion is selected, integrate it into production navigation and the offline preview. Keep project gallery behavior and article transitions intact.
4. Replace placeholder project content only when the user supplies or approves the relevant factual copy.

## Verification and local use

Run `npm test`, `npm run build`, and `npm run export:preview`. The export bundles the production Home, About, Projects, and résumé pages into one offline review file, with scripts bundled through esbuild and fresh frames for route changes.

The continuation checks the 45 existing tests, production build, and browser navigation at 1440×900, 390×844, and 320×568. The two transition options are exercised at 1024px, 736px, 390px, and 320px, including direction, anchored menu position, reduced motion, queued navigation, and cleanup. Browser checks use Chromium; physical iOS Safari and Firefox have not been checked.

To apply the separately supplied patch to the GitHub checkout, first check that the working tree is clean, then run `git apply --check /path/to/portfolio-continuation.patch` and `git apply /path/to/portfolio-continuation.patch`. Review and commit the changes before publishing. A push to `main` runs the existing GitHub Pages workflow.
