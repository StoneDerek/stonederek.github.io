# Derek Stone portfolio

An Astro portfolio with a serif masthead anchored by its left edge, native content pages, a two-column Work grid, and a continuous gallery containing only Derek’s five artworks. Engineering projects use temporary crops of the supplied screenshots. Their detail views and About each contain one lorem ipsum paragraph.

## Navigation model

| Address | Destination |
| --- | --- |
| `/` | Home introduction and supplied climbing photograph |
| `/projects/` | Three-project Work grid |
| `/projects/#project=<slug>` | One-paragraph project placeholder in the serif layout |
| `/projects/#slide=<slug>` | Compatible entry to the corresponding project article |
| `/about/` | One-paragraph About placeholder in the shared layout |
| `/about/#interests` | Compatibility anchor for the About paragraph |
| `/art/` | Unframed gallery of five individual artworks |
| `/art/#artwork=01` through `05` | Selected artwork with its description and related notes |
| `/art/#links` | Existing mirror puzzle and credits |
| `/projects/#links` | Compatible entry to the mirror puzzle |
| `/resume/` | Compatibility redirect to the current PDF; Resume links open the PDF directly |

Work shows Acoustic Drone Detection, RAG Chatbot, and 2D Lightning Simulation in that order. Each card uses Untitled #N on its first line and combines its existing subject and method on the second, both at 16px. More coming soon uses the secondary font. Art is not a Work card. Existing project slugs and their legacy aliases resolve to the same article content.

Art includes its descriptions and footnotes in the initial HTML. CSS centers the selected thumbnail and sizes the title, gallery, and footer before the app loads; an inline initializer applies direct artwork fragments before paint. The controller reuses that prose and retains fractional layout dimensions, so repeated Art navigation does not switch between a fallback layout and a corrected one.

Opening an article records the Work scroll position and triggering card. Closing or using browser Back restores that grid entry, including keyboard focus. A directly opened article closes to Work without sending the reader to a previous external page. Back and Forward restore reading positions. Each detail view contains one lorem ipsum paragraph and a plain `← Back` link in the secondary font. The project title stays available to screen readers and in the browser tab.

`SerifShell.astro` provides document metadata, masthead, navigation, main content, and footer. Desktop navigation occupies its own right column; smaller widths use a native menu, and the project grid becomes one column below 760px. `WorkContent.astro` supplies the grid, placeholder detail view, and routing metadata. `work-page.js` owns article/history state, while `work-location.js` resolves current and legacy addresses. Home keeps its supplied introduction; About and Work details share `PlaceholderParagraph.astro`. Their repeated large headings are visually hidden, Explore projects is a plain link, and native Home has no entrance animation. The name uses a fixed left-edge anchor; category suffixes extend to its right. Footer links and the existing update timestamp are grouped on the left without a divider.

The masthead displays plain **Derek_Stone**, with a smaller underscore and conditional /Work, /About and /Art suffixes. `interactions.css` supplies shared accent hover and keyboard-focus feedback. Floating navigation uses one pure black or white ink choice per whole image, shared across overlapping lines; image-edge clipping and accent underline/focus feedback remain. The compact secondary-type footer follows content, reaches the bottom of short pages and uses one viewport gutter across page layouts; viewport measurements exclude the scrollbar strip. Content-to-footer gaps are 96px on desktop and 64px on phones.

On mobile, the native Menu disclosure opens a full-width top panel with the same navigation links. The underlying page is softly blurred and tinted, with background interaction suspended until the menu closes. Escape, tapping the backdrop or activating a link dismisses it. Keyboard focus stays in the open menu, and widening to desktop or unmounting releases the menu state. The navigation can scroll within the panel on short screens.

The following controls describe the historical gallery controller retained for compatibility checks, using an explicitly labeled test fixture. Current Art and Work behavior is checked against the native pages and compiled offline app.

## Historical gallery controller reading and controls

- Swipe horizontally on Home, About, or project artwork to browse panels. Native touch direction locks during event dispatch, before a reading scroller can take over. Horizontal movement prevents native panning; vertical reading and pinch zoom stay native. Duplicate touch pointer events cannot cancel the swipe. The original card or caption stays available until release, including across the selection midpoint.
- Click and drag across Home, About, project artwork, or the thumbnail strip to browse. Prose follows the drag instead of selecting text; links and buttons retain their normal click behavior. Home and About scroll vertically inside their own panels and retain their reading positions when revisited.
- The reading scrollbar becomes transparent during horizontal movement and returns when the panel settles. Its gutter stays in place, so text does not reflow during a drag.
- Click a thumbnail or use the dropdown to select a panel. Touch dragging, a wheel, or a trackpad over the strip browses and settles the gallery. The strip uses controlled scrolling with native horizontal panning and scroll anchoring disabled, so it cannot scroll independently of the gallery. Nothing advances automatically.
- On phones, the 48px previous/next controls browse all panels. Home and About show a plain panel count between the arrows. Project covers keep the View project button and count, which open the article. Bottom spacing accounts for the home indicator.
- Left/Right browses panels, Home selects Home, and End reaches Links. Thumbnail keyboard focus follows the selected thumbnail. Content panels outside the current selection are inert and absent from the accessibility tree.
- The dropdown retains its cat, independently remembered Projects disclosure, contact links, update date, keyboard navigation, and outside/Escape dismissal. Its reveal animates clipping over a stable full-height layout instead of changing height every frame; rapid reversals continue from the visible clip. Reopening a fully closed menu starts at its navigation links, while reversing a close retains the reading position. It stays available over articles.
- Opening an article from the gallery or replacing an article retains its 490ms animation, 420ms closing, and stationary tile-mask implementation. Direct article links initialize the requested content before revealing the interface and skip the opening animation. An article replacement uses one opening over a preserved copy of the previous article, with no intermediate gallery close. Same-article selection preserves its reading position.
- Reduced motion makes programmatic selection, menu movement, title updates, and articles immediate. Pointer dragging stays direct. Hidden pages and cleanup release animation frames and article snapshots.

The hidden Links panel retains the local ASCII mirror puzzle, trophy, professional links, and compact Credits. The puzzle is idle when not visible; Reset restores its instructions. Credits dismiss on outside press or Escape.

## Legacy gallery content and appearance

Home prose lives in `src/components/HomeContent.astro`; it contains Derek’s supplied introduction, preserving the italic research areas, bold interests, and Rose-Hulman link. The climbing photograph at `public/art/home/climbing.webp` retains the supplied 1536 × 2048 framing. It sits beside the introduction on desktop and below it on phones, loads eagerly on Home, and stays lazy on direct About or project entry. About stays in `src/components/AboutContent.astro` and displays only the shared placeholder paragraph. The first three projects preview acoustic drone detection with CNN spectrogram analysis, an academic-advising RAG chatbot, and 2D lightning simulation with a probabilistic potential model. Their current 4:3 covers use exact crops of the supplied spectrogram, chatbot response, and lightning simulation screenshots. Source filenames, crop coordinates, and hashes are in `docs/project-cover-sources.md`; original uploads are not public assets. The previous generated technical illustrations remain available as historical assets. The former engineering case-study data remains in the legacy gallery data, but native Work details no longer render it. Art contains Derek’s own work and edited copy from his supplied draft.

The legacy-only Home entrance reveals the introduction over 800ms and the photograph over 900ms with a 140ms stagger. The photograph waits for decoding and layer preparation, then slides 16px while fading in. Rendering hints are released when it finishes. Returning Home through the gallery does not replay the entrance; reduced motion, hiding the page, and leaving the document finish it immediately. The navigation stays outside this animation.

Home uses its light-purple palette; About uses light blue; project covers keep their own palettes. The anchored header blends colors over 320ms. Its section label and title move together: forward navigation moves up, backward navigation moves down, and interrupted requests resume from their drawn positions.

Between About (panel 1) and the first project (panel 2), the centered caption uses one reversible 180ms clock. A click, key, or released swipe starts entry/exit with gallery movement, before the selection midpoint. During a held gesture, changing the selected panel triggers a complete entrance or exit. Slide position never sets animation progress: holding still, dragging slowly, and dragging quickly produce the same caption frames at equal elapsed times. The animation continues to completion even while the pointer remains held. Reversing changes the clock's direction from the visible state, so a partial entrance takes proportionally less time to disappear. Overlapping glyphs expand/contract continuously and rewind the same substitutions. The caption retains its project's color throughout. Interaction still waits for the selection midpoint, and an existing pointer target survives until release. Other project changes retain the timed scramble, using its 360ms default and 180–420ms gallery-settling bounds.

The thumbnail gap and SVG frame are aligned at layout and settling, including fractional display scales; drag frames do not measure layout. Home and About use a clean lower edge without a blur or fade above the bottom controls. Credit links and descriptions share the same 13px type size. A plain footer action switches light/dark and remembers the choice. The initial appearance follows the system preference until a choice is saved. The early theme initializer applies a remembered choice before painting. Dark surfaces and readable type use scoped theme variables; project screenshots and artwork photographs are never filtered or recolored.

Edit `src/data/projects.json` for project cards and retained legacy gallery data. Native Work details display `PlaceholderParagraph.astro` and embed only project titles, slugs, and aliases; they do not render the descriptions, notes, media, or case studies below. Each data item contains:

| Field | Purpose |
| --- | --- |
| `slug` | Stable project ID for direct URLs; use lowercase letters, numbers, and hyphens |
| `legacySlugs` | Optional previous slugs that still open this project; newly generated URLs use `slug` |
| `title`, `category`, `year`, `caption` | Full project metadata and gallery announcement text |
| `galleryTitle`, `galleryMethod` | Optional subject and method lines for the centered cover caption; `galleryTitle` also supplies the compact header label. The full `title` remains in accessible labels, the expanded project list, and articles |
| `description`, `note` | Text shown when clicking the centered project title |
| `image`, `thumbnail` | Image paths relative to `public/` |
| `imageAlt` | A useful description for screen readers |
| `articleMedia` | Optional article-only images: an array of `{ "src", "alt", "caption", "width", "height" }`; the gallery cover is not used automatically |
| `caseStudy.facts` | Optional project facts: an array of `{ "label", "value" }`, such as Role, Timeline, Team, and Tools |
| `caseStudy.sections` | Optional sections: an array of `{ "title", "paragraphs", "media" }`; each paragraph is a string or an array of inline runs, and media uses the `articleMedia` image fields |
| `caseStudy.footnotes` | Optional bottom notes: an array of `{ "number", "paragraphs" }`, referenced by an inline `{ "footnote": 1 }` run |
| `position` | CSS object position for cropping, such as `63% 50%` |
| `palette.accent` | Navigation, caption, controls, and thumbnail outline color |
| `palette.ink` | Text color on accent controls and in the white project view |
| `palette.caption` | Optional override for the centered title color on lighter images |

Native Work cards use a 4:3 image frame. The current supplied screenshot crops and 240 × 180 thumbnails are documented in `docs/project-cover-sources.md`. The older technical cover generator used 1920 × 1200 illustrations and remains available for historical source reproduction. Put them in `public/art/` and `public/thumbnails/`, then change the paths in the JSON. Use strong contrast between accent and ink, and check the caption against the image. The three project previews use the same accent for their centered caption, navigation, and thumbnail frame. Their subject and method appear on two lines, preserving the existing timed subject scramble. Cover construction and color rationale are recorded in `design/project-covers.md`; regenerate the editable SVGs, WebPs, and thumbnails with `node scripts/build-project-covers.mjs`. The script checks the compressed images throughout a central title region against a 4.5:1 contrast target. There is no automatic palette extraction or slideshow timer.

Article images can use paths relative to `public/` or absolute URLs. Omit `articleMedia` for a text-only article. Supplying image width and height reserves its layout space before it loads. Section images load lazily as the reader approaches them. The offline exporter embeds local article and section images, including images that only appear in project data; remote images still require a connection.

The case-study facts and sections are optional. Empty entries are omitted, and switching to a shorter project clears the previous article's content. On desktop, the section controls stay beside the reading column; on smaller screens they wrap above it. Choosing a section scrolls within the article and moves keyboard focus to its heading while keeping the direct project URL intact. Reduced motion makes the jump immediate.

Inline paragraph runs may be strings or objects with `text`, `bold`, `italic`, and an HTTP(S) `href`. The renderer creates text nodes and a small set of elements rather than accepting HTML. Numbered references render as bracketed links to notes at the bottom; each note number links back to its reference. These jumps preserve the article URL and move keyboard focus within the article. Captions and other project fields remain plain text.

Edit `src/data/site.json` for the name, header domain, email, LinkedIn URL, default title, and description. Styling lives in `src/styles/portfolio.css`; the shared app starts in `src/scripts/app.js` and uses `carousel.js`. Existing project transitions, menus, case-study rendering, and puzzle modules remain separate. The browser tab uses one static white-on-black `DS` icon from `public/favicon.svg`, with the same Georgia/Times serif font stack as the native pages, across all pages, themes, and the offline preview. Its URL includes a content hash so updates replace cached icons. Navigation does not rewrite it or embed a separate icon for each panel.

## Art collection

`/art/` now uses the same serif masthead and navigation as the other native pages. Its unframed gallery contains only the five original artwork photographs. The selected artwork is titled **Untitled #1–#5**, with no subtitle or duplicate numeric labels. The stage is bounded to 52svh and 520px on desktop, and 42svh and 360px on phones; photographs use contain framing. The original continuous drag, momentum and spring settling are reused for the artwork track and thumbnail rail. The rail uses the available gallery width and supports clicking and dragging; wheel input over it scrolls the page. There are no standalone arrow buttons or visible counters. Keyboard arrows, Home/End, swipe, direct artwork hashes and Back/Forward remain available.

The selected work's original prose, bold, italics and inline links appear below the gallery. All three artwork notes stay together at the bottom in the secondary font, without separator rules; selecting an artwork does not filter them. Descriptions share an intrinsic grid row sized by the longest text, so the notes retain their vertical position as selections change. Inactive descriptions remain invisible, inert and hidden from assistive technology. A note's return link reveals the corresponding artwork before focusing its reference. Complete bracketed note markers use the accent without underlines; other in-text links use prose color and reference URLs use blue-violet. The artwork title starts 12px left of the selected photograph’s edge. The collection introduction is available in a disclosure at the top. The former overprint cover is not a gallery slide.

The image viewer has a flat toolbar in the secondary font with page-theme colors. Zoom uses 25% steps up to 400% of source size, with cursor-centered wheel zoom and touch pinch available inside the viewer. Clicking the percentage or pressing 1 displays actual size; Fit or 0 restores the fitted view. Dragging and arrow keys pan the magnified image, with focus and page history preserved on close.

The mirror puzzle remains separate and hidden at `/art/#links`; it is not an artwork and has no announced navigation entry. `/projects/#links` still reaches it. Existing `/art/#project=art` and `/art/#slide=art` aliases open the first artwork. Production photographs remain at their supplied full resolution; the offline export embeds smaller copies without cropping them.

## Sharing previews

Home, About, Projects, and Art include descriptions, canonical URLs, Open Graph tags, and large-image card metadata. The homepage shares as **Derek_Stone** with “A personal website for Derek Stone.” Edit `sharingTitle` and `description` in `src/data/site.json` to change that copy. The shared 1200 × 630 graphic uses the centered serif wordmark on the site’s dark background. Its editable source is `src/assets/social-preview.svg`; run `npm run build:social-preview` to export `public/social-preview.png`. The image URL includes a content hash so refreshed cards request the updated artwork. Image dimensions and alternative text are declared in `src/data/social-preview.js`.

Canonical and image URLs use the configured production origin and base path, including custom domains and project-repository hosting. Project links use URL fragments, so sharing services receive the Projects page's preview rather than an individual article's title or artwork. Existing browser-tab titles still follow navigation within the gallery. Actual sharing-service cards cannot be checked until this revision is deployed.

## Try it locally

Use Node.js 24 or newer:

```sh
npm ci
npm run dev
```

For production validation and a downloadable preview:

```sh
npm test
npm run build
npm run test:flows
npm run export:preview
```

The exported `portfolio-preview.html` starts with visible native Home markup and embeds Home, Work, About, Resume, the preserved Art gallery, scripts, styles, project data, and local images without an iframe. A local hash bridge switches the native pages and delegates same-page Work or Art navigation to its real controller. Back/Forward retain the controller's route and history state. Preview-only image copies are resized without cropping or recoloring; production images remain unchanged. Run `node --test checks/preview-export.mjs` after exporting to check markup, route switching, script validity, embedded images, original Art aspect ratios, and the size budget.

## Résumé and update date

The shared native footer and retained gallery menu include the existing publication date. It reads Updated today or Updated Nd ago, based on the visitor's calendar day, and replaces that text in place with the full date, time, and timezone on hover or keyboard focus. The short label returns when both hover and focus end; there is no tooltip. After 30 days it shows a calendar date. `src/data/publication.js` stamps the static build; `publication-label.js` updates the relative label at local midnight and when the page becomes visible. The timestamp itself stays fixed between builds. Optionally supply an ISO timestamp in `PORTFOLIO_PUBLISHED_AT` to identify a specific release. It describes the site build used for deployment.

The footer contains `contact.stonederek@gmail.com`, `https://www.linkedin.com/in/derekstone0`, and the permanent résumé address `https://stonederek.github.io/resume/`. Email opens a mail client; LinkedIn opens a separate tab and Resume opens the current PDF directly in a new tab. No phone number, home address, contact form, or extra external services have been added.

The permanent `/resume/` page links to `public/resume.pdf` when that file exists, using a content hash to avoid stale PDF caching. Without a PDF it displays the existing availability notice. Updating the PDF does not change the navigation address. The offline preview embeds the existing PDF and retains a useful Resume page.

## GitHub Pages

The existing repository is `StoneDerek/stonederek.github.io`, published at `https://stonederek.github.io/`. Pushes to `main` run **Deploy portfolio to GitHub Pages** using `.github/workflows/deploy.yml`. Repository Pages settings should use **GitHub Actions**. Review branches do not deploy automatically.

`astro.config.mjs` derives the base path for a user-site or project repository. `PORTFOLIO_SITE` and `PORTFOLIO_BASE` support a custom domain/base path. Dependencies are pinned in `package-lock.json`; no backend or paid services are required.

## Verification and performance

Run `npm test` for the route, history, rendering-helper, input, image-zoom, and lifecycle unit suites. Run `npm run test:flows` to build and exercise both the preserved Art gallery and the real native Home, Work, About, and Resume markup. The Work suite checks current/legacy article links, direct entry, scroll and focus restoration through Back/Forward and Close, native About/Resume navigation, Art compatibility, and preview lifecycle handling. The DOM checks use Happy DOM with supplied geometry and timing; they do not establish browser rendering, physical-device gesture feel, canvas painting, or network performance. GitHub Pages runs the unit and built-page flow checks before deployment.

The remaining performance and browser notes below describe the earlier legacy gallery implementation.

Resizing or hiding the page during a held swipe now settles the nearest panel instead of leaving the track stranded between panels. Closing during an article opening uses that article's return-cover URL. Thumbnail wheel gestures write history only once they settle, keeping intermediate positions out of Back navigation. Initial cover loading is scoped to the entry panel and its neighbors; Home no longer explicitly requests two distant covers eagerly, and the existing controller warms covers as their destination approaches. Native lazy-loading thresholds still depend on the browser.

Card lift now updates track geometry without repeating the full selection, caption, and accessibility pass. Selection attributes change only when their values change; resizing still recalculates both the gallery position and thumbnail rail. A simulated project drag and settle drops from 103 writes to `data-panel`/`data-panel-kind` to one, with the same final position and no animation frames left running. This is a DOM-work measurement, not a frame-rate claim. Desktop Chromium and a 390 × 844 browser frame also verify project dragging, article entry/return, menu navigation, phone controls, and standalone-preview navigation/history. Physical-device performance remains unmeasured.

All 141 unit tests pass, covering panel/URL round trips, base paths, direct articles and About anchors, preview addresses, native touch ownership and pointer cancellation, gesture direction locking, tap preservation, final release coordinates, pinch/cancellation/reset/cleanup, panel and strip settling, early About caption entry, matching 180ms entry/exit, continuous widths, partial reversals, completion during stationary held gestures, speed-independent frames, timed project changes, caption measurement/cleanup, menu clipping/reversal/scroll reset, menu/request interruption, header-label reversals and cleanup, article masks and cleanup, palette contrast, deferred appearance, and the puzzle. The exporter also parses generated scripts to reject invalid embedded JavaScript.

The gallery revision preceding the caption-entry and card-fade fixes passed 60 Firefox and WebKit browser regression checks at 320px, 390px, and 1440px. These covered Home/About/project navigation without remounting, native vertical scrolling and retained positions, gesture axes, text-node handling, article entry/exit/replacement, browser history, direct URLs, keyboard navigation, reduced motion, and the single-frame offline preview. Each browser also passed 31 focused header-motion checks, including Home/About and About/first-project transitions in both directions; 32 mouse-drag/frame checks; and 11 checks for scrollbar visibility, stable reading width, the bottom fade, credit wording/type size, and article-to-Links motion. Fractional-scale screenshots checked frame rendering beyond CSS bounds alone. The current About caption change has deterministic regressions for the shared 180ms clock, continuous geometry, interrupted reversals, and click spring samples. Chromium checked intermediate centering, constant project color, endpoints, and Art’s resting accent color. Browser frame sampling had gaps, so exact timing and interrupted-motion claims rely on the deterministic checks. The card-fade fix has source/production-CSS scoping checks. The mobile input and menu fixes have event-dispatch and simulated-layout regression tests. Physical iOS Safari and subjective gesture feel on a real phone have not been checked.

The gallery retains its transform-only card movement, cached title measurements, lazy distant covers, image preloading near a destination, and temporary compositor hints. Tile masks merge settled row segments and update at most 60 times per second without changing their durations. The offline file embeds every local image regardless of native lazy loading. `npm run bench:transition` benchmarks mask generation rather than claiming browser paint or battery improvements.
