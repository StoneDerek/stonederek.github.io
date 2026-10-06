# Portfolio continuation — 6 October 2026

Repository: `StoneDerek/stonederek.github.io`. Live URL: https://stonederek.github.io/. A push to `main` runs the existing GitHub Pages workflow; check deployment before reporting a change as live.

## Selected behavior

The user selected **Short drift**, rejected the separate About pull handle, and explicitly rejected keeping Home/About/Projects visible on Projects. These choices supersede the persistent-navigation and separate-handle recommendations in the older design studies. The user corrected the About gesture to a rightward drag: Home → About → Projects retains its left-to-right section order.

- Section changes use a 180ms fade and 12px text drift through Astro ClientRouter. The dropdown stays anchored. Gallery artwork fades without sliding across the page. Reduced motion removes animated travel.
- Home/About/Projects starts hidden on Projects. Upward scroll intent reveals it; downward intent hides it. The full-screen gallery reads vertical wheel and touch intent because there is no vertical document scroll. The thumbnail rail keeps its existing scrolling behavior. Home/About show the links at the top and reveal them on upward scrolling away from the top.
- A normal left swipe on the main artwork selects the next project. From the settled first project only, a rightward drag uncovers the actual About content beneath the outgoing gallery. It follows the pointer nearly one-to-one, with a brief, gentle slowdown rather than a hard barrier. There is no handle or instructional text. Crossing the threshold starts entry immediately while the pointer is still held; release is not required. Before crossing, reversing or cancelling returns smoothly to Projects.
- The About threshold is 24% of gallery width, clamped to 72–240px (about 94px on a 390px phone). The smooth bump subtracts at most 5.6% of that threshold from visible travel; there is no positional jump. Thumbnail drags and gestures starting on any other project do not trigger About, even if the gesture reaches the first project. After the gallery moves offscreen, the already-revealed content hands off to the About route without another fade or drift.
- On touch/coarse-pointer devices, a short deliberate main-artwork swipe advances at least one project, even without flick momentum. The threshold is 15% of the gallery width, clamped to 24–56px. It works in both directions; tiny movements do not force a selection. Longer drags and existing momentum still work. Desktop and thumbnail-strip settling remain unchanged.
- The full dropdown, project articles and Tile settle, gallery gestures, email, LinkedIn, favicon colors, publication date, and résumé placeholder remain available.
- Home remains an introduction without gallery previews. Home uses light purple (`#ded3ff`) and About light blue (`#cde9ff`). All six projects and Home/About prose still use placeholders.

## Continue here

Use the current production source and these decisions as the starting point. `design/light-section-motion.html` and `design/section-motion.html` are historical comparisons. Their visible About handle and persistent Projects navigation were rejected; do not treat them as current requirements or present them as the active design.

The shared route bootstrap is `src/scripts/section-navigation.js`. Scroll reveal is in `section-links.js`, and the pure direction/resistance/settling helpers are in `section-state.js`. `src/components/AboutContent.astro` supplies both the real page and its inert, ID-prefixed gallery preview so their content and geometry stay aligned. Page controllers release listeners, timers, animations, pointer capture, and article snapshots on route swaps. Article fragment updates preserve Astro's history state. The offline export uses its own route bridge and the same gesture controller; gesture entry suppresses its second drift too.

Replace placeholder content only when the user supplies or approves factual copy. Publishing changes has been authorized in this conversation; use the GitHub connector with an expected-head check and confirm the existing GitHub Pages workflow succeeds.

## Verification

Run `npm test`, `npm run build`, and `npm run export:preview`. The export bundles production Home, About, Projects, and résumé pages into one offline review file. The automated suite covers article geometry/cleanup, interrupted navigation, menu reversals, focus restoration, scroll reveal, section direction, resistance, cancellation, and backtracking.

Browser verification passed at 1440×900, 390×844, and 320×568, covering ordinary Short drift, upward reveal, gallery swipes, the real About uncover, return before crossing, first-project-only eligibility, and navigation while the pointer remains held. Preview and actual About heading coordinates match at handoff; normal Back navigation restores Short drift. Native transitions, the CSS fallback, reduced motion, offline navigation, direct article links, and navigation during Tile settle passed with no browser errors. Emulated touch verifies slow 64px project swipes in both directions, cancellation below the About threshold, and About navigation before touch release. All 52 automated tests, the production build, and the offline export's inserted-script validation passed. Physical iOS Safari and subjective gesture feel on a real phone have not been checked.
