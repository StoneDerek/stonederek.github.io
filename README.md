# Derek Stone portfolio

A single full-screen horizontal gallery: Home → About → projects → Links. Built with Astro, CSS, and small browser scripts; published as a static GitHub Pages site.

## Navigation model

Home and About are real gallery panels, followed by three project previews, two remaining placeholder projects, and the Art collection as the final project. All share one track, thumbnail strip, header, gesture controller, and persistent app instance. Home and About have labeled thumbnails and native vertical reading areas; project covers keep their artwork, title scramble, and article controls. Links remains a hidden end panel without its own thumbnail or dropdown entry.

The separate white navigation row, About return button, page-to-gallery handoff, Astro document router, and outgoing section snapshots are removed. Selecting Home or About slides to that panel. The dropdown can open a project article over the currently drawn panel; only after the article covers it does the gallery select the article's return slide. Closing reveals that project. Selecting Home or About from an article closes onto the requested content panel.

| Address | Destination |
| --- | --- |
| `/` | Home panel |
| `/about/` | About panel |
| `/about/#interests` | About, scrolled to a section |
| `/projects/` | First project cover |
| `/projects/#slide=<slug>` | A project cover |
| `/projects/#project=<slug>` | A project article |
| `/projects/#links` | Hidden Links panel |
| `/resume/` | Permanent résumé route |

All three main entry routes render the same `src/components/Portfolio.astro` component. Direct entry still works without a prior visit to Home. After startup, internal navigation uses the existing app and the History API instead of fetching or swapping documents. Back/Forward restores the appropriate panel or article; About anchors retain normal URLs. Ordinary menu anchors also retain useful real destinations for opening links in another tab.

`src/data/gallery-panels.js` prepends Home and About to project data. `src/scripts/gallery-location.js` owns route parsing and formatting, including the standalone preview's address format. Invalid project slugs fall back to the project gallery. Home and About never become project articles.

## Reading and controls

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

## Content and appearance

Home prose lives in `src/components/HomeContent.astro`; it contains Derek’s supplied introduction, preserving the italic research areas, bold interests, and Rose-Hulman link. The climbing photograph at `public/art/home/climbing.webp` retains the supplied 1536 × 2048 framing. It sits beside the introduction on desktop and below it on phones, loads eagerly on Home, and stays lazy on direct About or project entry. About stays in `src/components/AboutContent.astro` and retains its placeholder copy. The first three projects preview acoustic drone detection with CNN spectrogram analysis, an academic-advising RAG chatbot, and 2D lightning simulation with a probabilistic potential model. Their covers are reproducible technical illustrations (a synthetic-audio STFT, a planned RAG workflow, and a separate lattice-growth calculation); their copy describes project directions without claiming measured results. The drone project uses the six-section case-study layout. Two fictional placeholders remain, and Art contains Derek’s own work and edited copy from his supplied draft.

Direct Home entry reveals the introduction over 800ms and the photograph over 900ms with a 140ms stagger. The photograph waits for decoding and layer preparation, then slides 16px while fading in. Rendering hints are released when it finishes. Returning Home through the gallery does not replay the entrance; reduced motion, hiding the page, and leaving the document finish it immediately. The navigation stays outside this animation.

Home uses its light-purple palette; About uses light blue; project covers keep their own palettes. The anchored header blends colors over 320ms. Its section label and title move together: forward navigation moves up, backward navigation moves down, and interrupted requests resume from their drawn positions.

Between About (panel 1) and the first project (panel 2), the centered caption uses one reversible 180ms clock. A click, key, or released swipe starts entry/exit with gallery movement, before the selection midpoint. During a held gesture, changing the selected panel triggers a complete entrance or exit. Slide position never sets animation progress: holding still, dragging slowly, and dragging quickly produce the same caption frames at equal elapsed times. The animation continues to completion even while the pointer remains held. Reversing changes the clock's direction from the visible state, so a partial entrance takes proportionally less time to disappear. Overlapping glyphs expand/contract continuously and rewind the same substitutions. The caption retains its project's color throughout. Interaction still waits for the selection midpoint, and an existing pointer target survives until release. Other project changes retain the timed scramble, using its 360ms default and 180–420ms gallery-settling bounds.

The thumbnail gap and SVG frame are aligned at layout and settling, including fractional display scales; drag frames do not measure layout. Home and About use a clean lower edge without a blur or fade above the bottom controls. Credit links and descriptions share the same 13px type size. Dark mode remains deferred behind `appearanceEnabled` in `src/scripts/theme.js`. Dark CSS also requires `data-appearance-enabled`, and the document declares `color-scheme: only light` in CSS and metadata. Saved or system dark preferences do not change the visible light site.

Edit `src/data/projects.json`. Each item contains:

| Field | Purpose |
| --- | --- |
| `slug` | Stable project ID for direct URLs; use lowercase letters, numbers, and hyphens |
| `title`, `category`, `year`, `caption` | Full project metadata and gallery announcement text |
| `galleryTitle`, `galleryMethod` | Optional subject and method lines for the centered cover caption; the full `title` remains in accessible labels, navigation, and articles |
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

Use landscape images around 1920 × 1200 and smaller thumbnail copies around 320 × 200. Put them in `public/art/` and `public/thumbnails/`, then change the paths in the JSON. Use strong contrast between accent and ink, and check the caption against the image. The three project previews use the same accent for their centered caption, navigation, and thumbnail frame. Their subject and method appear on two lines, preserving the existing timed subject scramble. Cover construction and color rationale are recorded in `design/project-covers.md`; regenerate the editable SVGs, WebPs, and thumbnails with `node scripts/build-project-covers.mjs`. The script checks the compressed images throughout a central title region against a 4.5:1 contrast target. There is no automatic palette extraction or slideshow timer.

Article images can use paths relative to `public/` or absolute URLs. Omit `articleMedia` for a text-only article. Supplying image width and height reserves its layout space before it loads. Section images load lazily as the reader approaches them. The offline exporter embeds local article and section images, including images that only appear in project data; remote images still require a connection.

The case-study facts and sections are optional. Empty entries are omitted, and switching to a shorter project clears the previous article's content. On desktop, the section controls stay beside the reading column; on smaller screens they wrap above it. Choosing a section scrolls within the article and moves keyboard focus to its heading while keeping the direct project URL intact. Reduced motion makes the jump immediate.

Inline paragraph runs may be strings or objects with `text`, `bold`, `italic`, and an HTTP(S) `href`. The renderer creates text nodes and a small set of elements rather than accepting HTML. Numbered references render as bracketed links to notes at the bottom; each note number links back to its reference. These jumps preserve the article URL and move keyboard focus within the article. Captions and other project fields remain plain text.

Edit `src/data/site.json` for the name, header domain, email, LinkedIn URL, default title, and description. Styling lives in `src/styles/portfolio.css`; the shared app starts in `src/scripts/app.js` and uses `carousel.js`. Existing project transitions, menus, case-study rendering, and puzzle modules remain separate. The browser tab uses one static black-on-white `ds.` icon from `public/favicon.svg` across all pages, themes, and the offline preview. Navigation does not rewrite it or embed a separate icon for each panel.

## Art collection

Art is the final project at `/projects/#project=art`. Its gallery cover comes from Derek's supplied `overprint-2550x3300-300dpi(1).png`, whose actual dimensions are 1582 × 2048. The full-resolution WebP copy is `public/art/collection/overprint-cover.webp`; the gallery fills its frame with that image and uses a separate small WebP thumbnail. The article uses the five updated PNG photographs supplied on October 23, 2026, in the same order: Stippling, Broken Line, Hatching, stamps, and Watercolor. Production copies use quality-94 WebP at the supplied 2048 × 1536 dimensions, with no added color, contrast, perspective, or crop changes. Replace those same image paths to use future edited photos; update dimensions if their size changes.

The works are labeled only **01–05**, in the supplied PDF order. The article restores the draft's wording, bold, italics, inline links, and bottom notes **[1]–[3]**, while removing the approved apologetic passages and using the spelling Steller’s jay. The Cornell link, supplied quotation, and Valorant credit remain in their original numbered notes. No creation dates were supplied, so this collection omits the year instead of assigning one.

The Art article's reading style takes inspiration from David Chapman's *How To Think Real Good*: local Georgia serif prose, clearer paragraph spacing, and smaller bottom notes. At 1000px and wider, each work pairs a full photo on the left with its description on the right, using the same columns as the introduction. The photo stays visible while longer text is read and remains contained within its section. Smaller screens use a centered column up to 38rem wide, with matching photo and prose widths. Photos remain complete in the article. The section navigator is a compact horizontal row above the collection. Natural paragraph breaks separate personal context, technique, and observations without changing the wording or emphasis. This styling is scoped to Art, including its introduction; other projects keep their existing typography. Inline footnote markers have one separating space, including `light. [1]`, and retain their existing jump/backlink behavior.

Art uses vibrant magenta `#c90062` for its controls, headings, section choices, inline links, and footnote numbers. Its resting centered gallery caption uses brighter pink `#ff2b9d`. The caption becomes white on its accent background when hovered or keyboard-focused. White interface text stays readable against that accent; article prose retains dark ink on white.

Project `eyebrow` is optional; `fit`, `imageWidth`, and `imageHeight` control a cover's framing and reserved size. `caseStudy.layout: "art"` groups each section's paragraphs in `.case-study-prose` for the paired layout. Section `mediaFirst` places photos before their descriptions in reading order; `references` is an optional array of `{ "label", "href" }` with HTTP(S) links. These options reset when another project opens. The existing placeholder articles keep their previous layout and labels.

The flow suite checks direct Art entry, 01–05 labels, emphasis, links, note targets/backlinks, the five photographs and their dimensions/order, section focus, returning to the Art cover, reaching Links, and replacing Art with both a structured and a shorter project. Desktop Chromium and a 390 × 844 frame verify the article, section navigation, complete photos, and gallery return. The current formatting and light appearance were also checked in a 390 × 844 sandbox with a dark host page and no same-origin access. The standalone preview embeds smaller WebP copies of all five photos; production WebPs retain the full supplied dimensions.

## Sharing previews

Home, About, Projects, and Résumé include page-specific descriptions, canonical URLs, Open Graph tags, and large-image card metadata. Their shared 1200 × 630 image is `public/social-preview.png`; the editable vector source is `src/assets/social-preview.svg`. After editing the vector, export its full canvas to that PNG. Keep the image dimensions and alternative text in `src/layouts/Layout.astro` in sync if the artwork changes.

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

The exported `portfolio-preview.html` contains the unified production document, scripts, styles, gallery images, and local article media directly, with no nested iframe or empty JavaScript-created document. It renders Home markup before scripts run. Preview-only WebP copies are bounded to 1440 × 1080 without cropping or recoloring; production originals are untouched. The Art version is about 2.4 MB, down from 8.9 MB. Section changes and Back/Forward use the same persistent production gallery controller and a local hash bridge, including `#about?interests` and `#projects?project=art`. Menu state stays inside the document if the viewer denies access to its parent or browser storage. Email and LinkedIn retain their external destinations. Run `node --test checks/preview-export.mjs` after exporting to check direct markup, inline scripts, image embedding, aspect ratios, and the file-size budget.

## Résumé and update date

The bottom-right date reads Updated today or Updated Nd ago, based on the visitor's calendar day, and shows the full date, time, and timezone on hover or keyboard focus. After 30 days it shows a calendar date. `src/data/publication.js` stamps the static build; `publication-label.js` updates the relative label at local midnight and when the page becomes visible. The timestamp itself stays fixed between builds. Optionally supply an ISO timestamp in `PORTFOLIO_PUBLISHED_AT` to identify a specific release. It describes the site build used for deployment.

The footer contains `contact.stonederek@gmail.com`, `https://www.linkedin.com/in/derekstone0`, and the permanent résumé address `https://stonederek.github.io/resume/`. Email opens a mail client; LinkedIn and Résumé open separate tabs. No phone number, home address, contact form, or extra external services have been added.

The résumé page currently contains a simple availability notice, as requested. When the public résumé is ready, add a PDF as `public/resume.pdf`, commit it, and let GitHub Pages rebuild. Updating that same file keeps the menu address unchanged. The résumé page will then link to the PDF automatically, with a content hash in its internal PDF link to avoid reusing an older cached copy. The public `/resume/` address always stays the same. Check the public PDF for contact details and information you intend to share before adding it. The standalone preview includes the generated résumé page in a small document blob so its menu link also works offline; no résumé document is supplied with this revision.

## GitHub Pages

The existing repository is `StoneDerek/stonederek.github.io`, published at `https://stonederek.github.io/`. Pushes to `main` run **Deploy portfolio to GitHub Pages** using `.github/workflows/deploy.yml`. Repository Pages settings should use **GitHub Actions**. Review branches do not deploy automatically.

`astro.config.mjs` derives the base path for a user-site or project repository. `PORTFOLIO_SITE` and `PORTFOLIO_BASE` support a custom domain/base path. Dependencies are pinned in `package-lock.json`; no backend or paid services are required.

## Verification and performance

There are 23 production-DOM flow tests, 141 unit tests, and two standalone-export checks. Run `npm run test:flows` to rebuild and exercise direct panel/article URLs, thumbnails, mobile controls, keyboard navigation, menu focus and dismissal, touch direction and cancellation, About caption entry/exit before selection, caption colors, About anchors and retained scroll positions, article replacement and interrupted closing, rapid requests, Back/Forward, offline navigation messages, local asset/reference integrity, image warming, the static favicon, selection-update counts, and settled resizing. These tests use Happy DOM with supplied geometry and timing; they do not establish browser rendering, real-device gesture feel, canvas rendering, or measured network performance. The existing GitHub Pages workflow runs both suites after building and before deployment.

Resizing or hiding the page during a held swipe now settles the nearest panel instead of leaving the track stranded between panels. Closing during an article opening uses that article's return-cover URL. Thumbnail wheel gestures write history only once they settle, keeping intermediate positions out of Back navigation. Initial cover loading is scoped to the entry panel and its neighbors; Home no longer explicitly requests two distant covers eagerly, and the existing controller warms covers as their destination approaches. Native lazy-loading thresholds still depend on the browser.

Card lift now updates track geometry without repeating the full selection, caption, and accessibility pass. Selection attributes change only when their values change; resizing still recalculates both the gallery position and thumbnail rail. A simulated project drag and settle drops from 103 writes to `data-panel`/`data-panel-kind` to one, with the same final position and no animation frames left running. This is a DOM-work measurement, not a frame-rate claim. Desktop Chromium and a 390 × 844 browser frame also verify project dragging, article entry/return, menu navigation, phone controls, and standalone-preview navigation/history. Physical-device performance remains unmeasured.

All 141 unit tests pass, covering panel/URL round trips, base paths, direct articles and About anchors, preview addresses, native touch ownership and pointer cancellation, gesture direction locking, tap preservation, final release coordinates, pinch/cancellation/reset/cleanup, panel and strip settling, early About caption entry, matching 180ms entry/exit, continuous widths, partial reversals, completion during stationary held gestures, speed-independent frames, timed project changes, caption measurement/cleanup, menu clipping/reversal/scroll reset, menu/request interruption, header-label reversals and cleanup, article masks and cleanup, palette contrast, deferred appearance, and the puzzle. The exporter also parses generated scripts to reject invalid embedded JavaScript.

The gallery revision preceding the caption-entry and card-fade fixes passed 60 Firefox and WebKit browser regression checks at 320px, 390px, and 1440px. These covered Home/About/project navigation without remounting, native vertical scrolling and retained positions, gesture axes, text-node handling, article entry/exit/replacement, browser history, direct URLs, keyboard navigation, reduced motion, and the single-frame offline preview. Each browser also passed 31 focused header-motion checks, including Home/About and About/first-project transitions in both directions; 32 mouse-drag/frame checks; and 11 checks for scrollbar visibility, stable reading width, the bottom fade, credit wording/type size, and article-to-Links motion. Fractional-scale screenshots checked frame rendering beyond CSS bounds alone. The current About caption change has deterministic regressions for the shared 180ms clock, continuous geometry, interrupted reversals, and click spring samples. Chromium checked intermediate centering, constant project color, endpoints, and Art’s resting accent color. Browser frame sampling had gaps, so exact timing and interrupted-motion claims rely on the deterministic checks. The card-fade fix has source/production-CSS scoping checks. The mobile input and menu fixes have event-dispatch and simulated-layout regression tests. Physical iOS Safari and subjective gesture feel on a real phone have not been checked.

The gallery retains its transform-only card movement, cached title measurements, lazy distant covers, image preloading near a destination, and temporary compositor hints. Tile masks merge settled row segments and update at most 60 times per second without changing their durations. The offline file embeds every local image regardless of native lazy loading. `npm run bench:transition` benchmarks mask generation rather than claiming browser paint or battery improvements.
