# Portfolio continuation — 6 October 2026

Repository: `StoneDerek/stonederek.github.io`. Live URL: https://stonederek.github.io/. A push to `main` runs the existing GitHub Pages workflow; check deployment before reporting a change as live.

## Selected behavior

The user selected **Short drift**, rejected the separate About pull handle, and explicitly rejected keeping Home/About/Projects visible on Projects. These choices supersede the persistent-navigation and rightward-handle recommendations in the older design studies.

- Section changes use a 180ms fade and 12px text drift through Astro ClientRouter. The dropdown stays anchored. Gallery artwork fades without sliding across the page. Reduced motion removes animated travel.
- Home/About/Projects starts hidden on Projects. Upward scroll intent reveals it; downward intent hides it. The full-screen gallery reads vertical wheel and touch intent because there is no vertical document scroll. The thumbnail rail keeps its existing scrolling behavior. Home/About show the links at the top and reveal them on upward scrolling away from the top.
- A normal left swipe on the main artwork selects the next project. A much longer leftward swipe enters resistance, crosses a visual detent, and opens About on release. A temporary text cue appears during resistance. There is no dedicated handle or new gesture button. Backtracking disarms the gesture, and pointer cancellation never navigates.
- The About threshold is 86% of gallery width, with a 220px minimum. Resistance begins at 68% of that distance, beyond an ordinary half-width project swipe. Crossing adds a small 12px release; backing off by more than 24px disarms it. Speed alone never changes sections. Thumbnail drags do not trigger About.
- The full dropdown, project articles and Tile settle, gallery gestures, email, LinkedIn, favicon colors, publication date, and résumé placeholder remain available.
- Home remains an introduction without gallery previews. Home uses light purple (`#ded3ff`) and About light blue (`#cde9ff`). All six projects and Home/About prose still use placeholders.

## Continue here

Use the current production source and these decisions as the starting point. `design/light-section-motion.html` and `design/section-motion.html` are historical comparisons. Their visible About handle, rightward pull, and persistent Projects navigation were rejected; do not treat them as current requirements or present them as the active design.

The shared route bootstrap is `src/scripts/section-navigation.js`. Scroll reveal is in `section-links.js`, and the pure direction/resistance helpers are in `section-state.js`. Page controllers release listeners, timers, animations, pointer capture, and article snapshots on route swaps. Article fragment updates preserve Astro's history state. The offline export uses its own route bridge and the same gesture controller.

Replace placeholder content only when the user supplies or approves factual copy. Publishing changes has been authorized in this conversation; use the GitHub connector with an expected-head check and confirm the existing GitHub Pages workflow succeeds.

## Verification

Run `npm test`, `npm run build`, and `npm run export:preview`. The export bundles production Home, About, Projects, and résumé pages into one offline review file. The automated suite covers article geometry/cleanup, interrupted navigation, menu reversals, focus restoration, scroll reveal, section direction, resistance, cancellation, and backtracking.

Browser verification passed at 1440×900, 390×844, and 320×568, covering native and fallback section transitions, normal versus deliberate gallery swipes, upward reveal in the non-scrolling gallery, Back/Forward, direct article links, and navigation during Tile settle. Reduced motion, the offline preview, and emulated touch passed with no browser errors. The fallback was also checked during animation: the document and artwork do not translate, the dropdown stays centered, and only content uses the short drift. All 49 automated tests and the production build passed. Physical iOS Safari has not been checked.
