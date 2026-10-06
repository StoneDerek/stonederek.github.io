# Portfolio continuation — 5 October 2026

The repository is `StoneDerek/stonederek.github.io`. The recovered Home/About work was published on `main` as `d22588a`; its GitHub Pages build and deployment succeeded, and Home, About, and Projects served the updated pages. This branch adds a design study for review. Pushes to `main` run the existing GitHub Pages workflow; check its result before reporting a release as live.

## Current pages

- Home is a simple introduction with **Explore projects** and **More about me**. It has no gallery preview or project overview sections.
- Home uses a light purple accent (`#ded3ff`). About uses light blue (`#cde9ff`). Gallery accents still follow the selected artwork.
- The small Home/About/Projects switcher is present on Home and About. It hides after scrolling more than 8px, removes its links from keyboard navigation, and transfers focus to the main menu if necessary. Projects omits it.
- The full dropdown, project articles and tile transitions, gallery gestures, email, LinkedIn, favicon colors, publication date, and résumé placeholder remain available.
- Projects now identifies its gallery as **Projects**, and no longer announces Home as the current page.
- Home, About, and all six projects still use placeholder copy/artwork. This continuation does not invent portfolio accomplishments.

## Latest transition and navigation study

The user judged the full slide too heavy and asked for lighter motion. They also found the section switcher disappearing on arrival at Projects confusing. They are considering upward-scroll reveal and a deliberate swipe with a resistance bump to return to About.

`design/light-section-motion.html` is the latest editable comparison. It is an HTML fragment for the Visualize skill, not a production page. Render the fragment once with that skill's current `scripts/render.py` to inspect it; do not feed an already wrapped standalone file back into the renderer. `design/section-motion.html` retains the older full-slide study.

The five concepts are **Resistance pull**, **Soft replace** (140ms content fade), **Short drift** (180ms fade with only 12px text travel), **Heading cue** (160ms heading/selection cue), and **Accent only** (immediate content change with color/selection feedback). The menu stays anchored, and the section links remain present on Projects in these previews. No concept plays automatically on load. Rapid requests retain the latest destination; reduced motion removes animated travel and uses immediate navigation.

Resistance pull starts in Projects. Its visible About handle can be pulled right: content yields slightly, movement stiffens near the threshold, then releases after crossing it. Letting go before the threshold or backing away from it springs back; letting go after crossing opens About with a brief fade. The handle is also a normal keyboard/tap button. Ordinary swipes on the artwork select projects and never trigger section navigation. This is visual feedback rather than physical device vibration.

Direction remains a review point: the user described a leftward swipe back to About. With Home → About → Projects arranged left-to-right, the prototype uses a rightward page pull to reveal the section on the left. It does not commit that mapping to production.

Navigation recommendation under review: keep Home/About/Projects visible on entry to every section, and keep them available in the full-screen gallery. Upward-scroll reveal is suitable for prose pages and project articles, which scroll vertically; the gallery does not. Give the dropdown a visible Menu label and a distinct role through its direct project index, résumé, and contact links. References: [visible versus hidden navigation](https://www.nngroup.com/articles/hamburger-menus/) and [partially persistent headers](https://www.nngroup.com/articles/sticky-headers/).

These are comparison options, not installed in production navigation. The website's existing project-article Tile settle is a separate interaction.

## Resume work here

1. Read this file and the current source before changing anything.
2. Keep the five-option light-motion study available for the user's judgment. Discuss section-link visibility and pull direction before treating either as selected.
3. After the motion and navigation behavior are selected, integrate them into production navigation and the offline preview. Keep project gallery behavior and article transitions intact.
4. Replace placeholder project content only when the user supplies or approves the relevant factual copy.

## Verification and local use

Run `npm test`, `npm run build`, and `npm run export:preview`. The export bundles the production Home, About, Projects, and résumé pages into one offline review file, with scripts bundled through esbuild and fresh frames for route changes.

The published continuation passed the 45 existing tests, production build, and browser navigation at 1440×900, 390×844, and 320×568. The latest five-concept study passed Chromium checks at 1024px, 736px, 390px, and 320px, including content fit, anchored navigation, direct project links, rapid navigation, reduced motion, keyboard activation, resistance cancellation, crossing/backing away from the threshold, and independent gallery swipes. The actual concept picker also switched designs correctly. Physical iOS Safari and Firefox have not been checked.

To apply the separately supplied patch to the GitHub checkout, first check that the working tree is clean, then run `git apply --check /path/to/portfolio-continuation.patch` and `git apply /path/to/portfolio-continuation.patch`. Review and commit the changes before publishing. A push to `main` runs the existing GitHub Pages workflow.
