# Portfolio continuation

## Approved Art publication - October 24, 2026

Derek approved publication of the completed update and all six supplied images to the public StoneDerek/stonederek.github.io repository and website. This supersedes the historical publication blockers below. The release is based on current main, retaining the published hyphen replacements and physical dropdown clipping repair. The five updated artwork photos, overprint difference cover, Art formatting, light appearance, and elapsed-time caption animation remain as approved. The preview delivery issue was handled separately with an interactive in-chat presentation.

## Current Art release

Derek requested use of the five new artwork photographs and the overprint difference image as the gallery cover, followed by publication to the existing portfolio. This supplies the publication permission that was pending in the historical notes below. The authenticated GitHub account and repository owner are both StoneDerek; the existing public destination is StoneDerek/stonederek.github.io.

The production article now uses full-resolution quality-94 WebPs derived from Stippling.png, Broken Line.png, Hatching.png, stamps.png, and Watercolor.png, in that order. The gallery and thumbnail use overprint-difference-2550x3300-300dpi.png. All five works retain labels 01–05, prose formatting, footnotes, and the established light layout and magenta-red accents. The earlier caption and preview repairs are included.

Validation: 141 unit tests, 23 production-DOM flow tests, two standalone-export checks, and the production build pass. Chromium verified the difference cover, all five loaded photographs, section navigation, and retained text formatting. The saved standalone preview is about 2.6 MB.

A direct push to main was rejected by automatic approval review. The release is prepared as one reviewable commit on `codex/art-release`, with only the final photos included in its history. A normal Git push of that review branch could not authenticate. The connected GitHub app accepted the thumbnail and five image blobs, each verified against its local Git SHA, but automatic approval review rejected the remaining `watercolors.webp` upload because it did not accept the exact payload and public destination as explicitly authorized. No remote branch, pull request, tree, commit, or deployment has been created for this release; main and the live site remain unchanged. The completed preview is saved as Library version 75. Resume the remaining upload and pull-request publication only after the requested explicit approval of the six supplied images and public `StoneDerek/stonederek.github.io` destination.

## About caption timing and Art caption color

The previous position-only caption renderer is superseded. About ↔ Signal studies now uses a reversible 180ms clock that starts with click/keyboard/released-swipe navigation, before selection changes. The initial implementation still used fractional drag position as its target; that was incorrect and is now removed. During a held gesture, a selected-panel change triggers a complete entrance or exit. The caption receives only a boolean visibility target, never a position or fractional reveal. Holding the pointer still cannot stall either animation, and changing drag speed cannot change its elapsed-time frames. Entry and exit share the same glyph substitutions and continuously changing widths. Partial reversals continue from the visible progress and need only the remaining fraction of the clock. Pointer capture, selection-based interaction, reduced motion, direct entry, and ordinary project-to-project scrambling are preserved. The first project's caption keeps its own color throughout the About transition.

Art's centered gallery caption now uses its magenta-red accent `#c20f53` at rest, as requested. Its existing white hover/focus treatment remains.

Validation: 141 unit tests, 23 production-DOM flow tests, production build, two export checks, and whitespace checks pass. Tests cover early entry/exit before selection, symmetric timing/glyphs/geometry, interruption without restarting, complete entry/exit while a drag is held stationary, identical frames under different drag speeds, and caption color. These regression checks replace the prior test that incorrectly required position-dependent progress. Earlier Chromium checks confirm intermediate widths remain centered, the first-project color stays constant, the endpoints settle, and Art is magenta-red when neither hovered nor focused. Browser frame sampling has gaps even in QA slow playback, so exact timing and interrupted-motion conclusions come from deterministic tests; physical-device feel remains unverified. Public publication remains pending under the existing restriction below.

## Art photo/text pairing and overprint cover

The current Art layout pairs each numbered work's photo and prose in two columns at 1000px and wider. Photos stay visible alongside longer descriptions within their section. Smaller screens use one centered column up to 38rem, with the image and prose sharing the same edges. The introduction follows the same desktop columns. A horizontal section navigator replaces the wide left sidebar; numbering, wording, emphasis, footnotes, and article photo framing remain intact.

Art now uses magenta-red `#c20f53`, with matching inline links, footnote numbers, and numbered headings. Interface text is white; article prose is explicitly dark on white. The supplied monochrome `overprint-1056x816.png` is the temporary gallery cover and thumbnail source, as requested. Its original bytes are copied to `public/art/collection/overprint.png`. It fills the gallery frame; the article still contains exactly the five original JPEGs, uncropped and ungraded. The initial cover caption was white; the caption-color follow-up above supersedes that choice.

Validation: 138 unit tests, 21 production-DOM flow checks, the production build, and two export checks pass. Chromium verified paired top alignment at 1363px and 1000px, matching stacked widths at 320px, 390px, 768px, and 999px, complete photographs, matching accent/link colors, dark prose, and no horizontal document overflow. The supplied cover and return to gallery were checked visually. No application console errors were observed. The export is about 2.2 MB. Public publication remains pending as described below.

## Essay-inspired Art typography

The user requested a space before inline footnotes and invited a formatting attempt inspired by https://metarationality.com/how-to-think. Markers now receive one separating space when the preceding text lacks whitespace; existing author-supplied spaces are retained without duplication. Brackets, note locations, focus, and backlinks keep their existing behavior.

Art now uses local Georgia serif text, a 38rem prose measure, italic numbered headings, more paragraph spacing, and smaller serif bottom notes. Its introduction aligns with the photo/text column on desktop and stacks on phones. Natural paragraph breaks were added to sections 01–03; a normalized text comparison verified unchanged wording and emphasis. Photos retain their full column width and original files. Other project typography and all gallery transitions remain unchanged.

Validation: 138 unit tests, 21 production-DOM flow checks (including the reported `light. [1]` spacing), the production build, and two standalone-export checks pass. Chromium verified the 608px desktop prose measure, serif bold/italics, spacing, and footnote round trip. A 390 × 844 sandbox verified the single-column phone layout, full-width photos, wrapped notes, and light appearance under a dark host. Neither view has document overflow or application console errors. Physical-device testing remains unverified.

## Formatting, light appearance, and caption follow-up

The works now use only 01–05 for section headings and navigation. The article restores Derek's PDF wording, bold, italics, inline links, and bracketed bottom notes [1]–[3], retaining only the approved removal of apologetic passages and the Steller’s jay spelling correction. Notes and their number backlinks scroll and focus within the article without replacing its URL. The previous invented titles and separate reference treatment are superseded.

The site explicitly declares only light appearance in document metadata and CSS. Dark selectors require the same appearance opt-in that is currently disabled. Chromium verified the light article, numbered headings, emphasis, and footnote jump in a 390 × 844 sandbox with a dark host page and no same-origin access.

The previous centered About/first-project caption followed the gallery's position from 1.35 to 1.70. The caption-timing follow-up above supersedes this implementation. Entry and return render identical glyphs and widths at identical positions; reversing a partial gesture reverses immediately. The ordinary project-to-project timed scramble remains. Unit checks cover early entry, mirrored return, interruptions, click spring samples, pointer retention, and reduced motion. The exported preview also passed Chromium forward/return endpoint checks; browser frame sampling was throttled, so timing conclusions come from the deterministic tests rather than that sample.

Validation: 138 unit tests, 21 production-DOM flow checks, two standalone-export checks, and the production build pass. The preview is saved as the same existing file. The original JPEGs remain unchanged. Public publication still awaits the separate permission below.

## Preview rendering repair

The downloadable preview now renders the unified portfolio directly, without its former iframe/srcdoc loader. The old startup crashed inside a sandbox because `projectMenuPreference` accessed an inaccessible parent window. Parent preference sharing is now guarded; direct or cross-origin previews keep the preference in their own document, including when browser storage is denied. Same-origin legacy preview sharing remains supported.

The export embeds preview-only WebP copies at up to 1440 × 1080, with no cropping or grading. All five original project JPEGs remain unchanged. The file is about 2.4 MB rather than 8.9 MB and includes visible Home markup before JavaScript runs. Navigation and history use a local hash bridge. Art, section jumps, photos, gallery return, the menu, and About were checked inside a 390 × 844 sandbox without same-origin access, as well as a regular desktop browser.

Validation: 138 unit tests, 21 production-DOM flow checks, two standalone-export checks, and the production build pass. The repaired file replaces the existing standalone preview. Public publication still awaits the separate permission described below; this repair does not retry the blocked push.

## Art collection

Publication is pending. The implementation is committed locally on `codex/art-collection`, and the standalone preview has been updated. Automatic approval review rejected the public GitHub push because it requires explicit user permission to publish the supplied photos to `StoneDerek/stonederek.github.io`. Do not retry the push until that permission is supplied. No pull request or deployment was created.

Art is now the final project (`/projects/#project=art`). Keep all five supplied photos in PDF order, full and uncropped. The JPEGs under `public/art/collection/` are unchanged copies of the attachments; a separate small thumbnail is used in the strip. No contrast or color grading has been applied. Future edited photos can replace those same paths.

The article keeps Derek’s personal observations and technique explanations, removes the approved apologetic remarks, and corrects Steller’s jay. The formatting follow-up above supersedes the first implementation's invented titles, rewritten prose, and reference layout. Dates are omitted because none were supplied. Its image-first sections use a wider art layout; other project articles reset to their existing layout and metadata.

Initial validation: 136 unit tests and 20 production-DOM flows passed. Desktop and 390 × 844 browser checks covered the photos, section links, and returning to the final cover. The repaired export and latest validation are described above. Physical-device testing remains unverified.

## Current performance and reliability checkpoint

Use `README.md` and the current source for the active navigation model: Home → About → five placeholder project panels → Art → hidden Links, in one persistent gallery. The earlier section-navigation notes below describe superseded implementations.

The reliability pass fixes interrupted swipes on resize/visibility changes, an incorrect return URL when closing an article before it finishes opening, and intermediate thumbnail-wheel positions entering browser history. Initial cover loading now follows the actual entry panel and adjacent covers. Content, artwork, palettes, and animation timings are preserved.

The tab icon is now a single static black-on-white `ds.` SVG on all routes and in the offline preview. Palette-specific icon payloads, theme/icon mutations, and preview favicon messages/observers are removed. Card lift updates only track geometry; selection metadata changes only when selection changes. Preserve the existing animation timings and appearance. Resizing explicitly re-renders the current position so changes to thumbnail sizing still align the rail.

Validation: 136 unit tests plus 18 production-DOM flow tests, production build, and offline export. The flow suite covers routes, controls, touch cancellation, menu focus, articles, history, anchors, preview navigation, compiled local references, image warming, a stable favicon, selection-update counts, and settled resizing. The representative simulated project swipe now makes one selection-attribute write instead of 103; this does not measure real-device speed. `npm run test:flows` builds then runs that suite. The deployment workflow runs both test suites before publishing. Fresh desktop Chromium and 390 × 844 browser-frame checks cover project dragging, articles, menu navigation, mobile controls, and offline navigation/history. Physical-device verification remains outstanding.

## Historical checkpoint — 7 October 2026

Repository: `StoneDerek/stonederek.github.io`. Live URL: https://stonederek.github.io/. A push to `main` runs the existing GitHub Pages workflow; check deployment before reporting a change as live.

## Latest checkpoint

PR #5 is merged at `a6759f654acc41b2e7d05c978ed68a67f524b577`. The follow-up replaces the prism with a two-mirror ASCII laser puzzle and adds Credits at the gallery end. Links remains an unannounced Easter egg; neither Links nor Credits appears in the dropdown or as a project thumbnail. Draft PR #6 uses branch `codex/ascii-laser-credits`, based on commit `24edaebaae927f4aa1d7ba1fb0fc8e08e11a4194`. The follow-up adds verified touch activation, cancelled-drag click suppression, and mirror-angle accessible labels to that draft. It is not deployed.

The beam has a fixed horizontal source. Mirror drags use half a degree per pixel; tap/click and Enter/Space turn five degrees. Arrow keys turn one degree, Shift turns five, and Alt turns a quarter degree. A successful path shows exactly “You got a trophy!” and a 2.4-second ASCII trophy spin. The earned trophy persists until Reset; reduced motion uses a static trophy. Capture is released on cancellation, Escape, resize, hiding, or cleanup. Touch release handles Safari's missing compatibility click without applying a second turn on other engines.

`src/scripts/laser-optics.js` traces finite reflecting segments, clips rays to scene boundaries, detects the circular target, absorbs rays at the blocker so both mirrors are required, and caps repeated reflections. `ascii-laser.js` draws only on input/resize and during the short trophy spin. `ascii-grid.js` keeps the `ds.` stencil dark. Credits is a native disclosure that fits small screens, supports Escape/outside dismissal, and credits https://asciigenerators.com/ as rendering inspiration. The code does not import or fetch that site.

The landscape concept is still a possible future direction; no separate landscape interaction has been implemented. Preserve the user's preference for a simple puzzle and hidden discovery when extending this page.

## Selected behavior

The user selected **Short drift**, rejected the separate About pull handle, and explicitly rejected keeping Home/About/Projects visible on Projects. These choices supersede the persistent-navigation and separate-handle recommendations in the older design studies. The user corrected the About gesture to a rightward drag: Home → About → Projects retains its left-to-right section order.

- Section changes use a 180ms fade and 12px text drift through Astro ClientRouter. The dropdown stays anchored. Gallery artwork fades without sliding across the page. Reduced motion removes animated travel.
- Home/About/Projects starts hidden on Projects. Upward scroll intent reveals it; downward intent hides it. The full-screen gallery reads vertical wheel and touch intent because there is no vertical document scroll. The thumbnail rail keeps its existing scrolling behavior. Home/About show the links at the top and reveal them on upward scrolling away from the top.
- A normal left swipe on the main artwork selects the next project. From the settled first project only, a rightward drag uncovers the actual About content beneath the outgoing gallery. It follows the pointer nearly one-to-one, with a brief, gentle slowdown rather than a hard barrier. There is no handle or instructional text. Crossing the threshold starts entry immediately while the pointer is still held; release is not required. Before crossing, reversing or cancelling returns smoothly to Projects.
- The About threshold is 38% of gallery width, clamped to 112–360px (about 148px on a 390px phone). The smooth bump subtracts at most 5.6% of that threshold from visible travel; there is no positional jump. Thumbnail drags and gestures starting on any other project do not trigger About, even if the gesture reaches the first project. After the gallery moves offscreen, the already-revealed content hands off to the About route without another fade or drift.
- A short deliberate swipe advances at least one project, even without flick momentum. Touch uses 15% of the gallery width, clamped to 24–56px; desktop uses 12%, clamped to 32–72px. It works in both directions; tiny movements do not force a selection. Longer drags and existing momentum still work. The Projects disclosure preference is shared across Home, About, gallery, articles, reloads, and offline preview frames.
- Re-grabbing a returning About preview resumes from its visible position, without applying the bump twice. A fresh title tap during that return opens the article. Losing pointer capture below the crossing returns safely rather than leaving the gallery stuck. A thumbnail wheel gesture clears any returning preview.
- Once the About crossing commits, gallery keys leave its reveal steady while the route loads. The dropdown stays usable: choosing a project or View gallery supersedes a pending About request, preserving the newest choice. Ordinary Home/About links also remain available.
- The full dropdown, project articles and Tile settle, gallery gestures, email, LinkedIn, favicon colors, publication date, and résumé placeholder remain available.
- Home remains an introduction without gallery previews. Home uses light purple (`#ded3ff`) and About light blue (`#cde9ff`). All six projects and Home/About prose still use placeholders.

## Continue here

Use the current production source and these decisions as the starting point. `design/light-section-motion.html` and `design/section-motion.html` are historical comparisons. Their visible About handle and persistent Projects navigation were rejected; do not treat them as current requirements or present them as the active design.

The shared route bootstrap is `src/scripts/section-navigation.js`. Scroll reveal is in `section-links.js`, and the pure direction/resistance/settling helpers are in `section-state.js`. `src/components/AboutContent.astro` supplies both the real page and its inert, ID-prefixed gallery preview so their content and geometry stay aligned. Page controllers release listeners, timers, animations, pointer capture, and article snapshots on route swaps. Article fragment updates preserve Astro's history state. The offline export uses its own route bridge and the same gesture controller; gesture entry suppresses its second drift too.

Replace placeholder content only when the user supplies or approves factual copy. Publishing changes has been authorized in this conversation; use the GitHub connector with an expected-head check and confirm the existing GitHub Pages workflow succeeds.

## Verification

Current validation: all 82 unit tests, the production build, preview export, and whitespace checks pass. Automated WebKit checks pass at 1440×900, 390×844, 320×568, and 844×390, plus the offline preview and reduced motion. Checks cover mouse dragging, native touch taps, keyboard activation and fine adjustment, two-mirror solving, trophy spin/settling, reset, Credits bounds/dismissal, idle/hidden rendering, and no horizontal overflow. Additional checks verify that a touch compatibility click cannot apply a second turn, Enter still works immediately after touch, resizing releases capture without causing a click turn, and shared Projects state survives Home/About/gallery navigation and reloads. No browser errors occurred. Chromium and physical-device checks were unavailable for this follow-up.

Run `npm test`, `npm run build`, and `npm run export:preview`. The export bundles production Home, About, Projects, and résumé pages into one offline review file. The automated suite covers article geometry/cleanup, interrupted navigation, menu reversals, focus restoration, scroll reveal, section direction, resistance, cancellation, and backtracking.

Earlier section-motion verification passed at 1440×900, 390×844, and 320×568, covering ordinary Short drift, upward reveal, gallery swipes, the real About uncover, return before crossing, first-project-only eligibility, and navigation while the pointer remains held. Preview and actual About heading coordinates match at handoff; normal Back navigation restores Short drift. Native transitions, the CSS fallback, reduced motion, offline navigation, direct article links, and navigation during Tile settle passed with no browser errors. Emulated touch verifies slow 64px project swipes in both directions, cancellation below the About threshold, and About navigation before touch release. Additional browser checks reproduce and verify lost-capture recovery, re-grabbing during return, fresh title taps, a steady reveal during a delayed About response, and a dropdown project choice superseding that response. All 53 automated tests, the production build, and the offline export's inserted-script validation passed. Physical iOS Safari and subjective gesture feel on a real phone have not been checked.
