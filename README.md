# Derek Stone portfolio

A single full-screen horizontal gallery: Home → About → projects → Links. Built with Astro, CSS, and small browser scripts; published as a static GitHub Pages site.

## Navigation model

Home and About are real gallery panels, followed by the five existing placeholder projects. All share one track, thumbnail strip, header, gesture controller, and persistent app instance. Home and About have labeled thumbnails and native vertical reading areas; project covers keep their artwork, title scramble, and article controls. Links remains a hidden end panel without its own thumbnail or dropdown entry.

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

- Swipe horizontally on Home, About, or project artwork to browse panels. Touch direction locks after the initial movement; vertical reading cannot become a horizontal drag mid-gesture.
- Click and drag across Home, About, project artwork, or the thumbnail strip to browse. Prose follows the drag instead of selecting text; links and buttons retain their normal click behavior. Home and About scroll vertically inside their own panels and retain their reading positions when revisited.
- The reading scrollbar becomes transparent during horizontal movement and returns when the panel settles. Its gutter stays in place, so text does not reflow during a drag.
- Click a thumbnail or use the dropdown to select a panel. A wheel or trackpad over the strip browses and settles the gallery. Nothing advances automatically.
- On phones, the 48px previous/next controls browse all panels. The center action continues to About from Home, continues to projects from About, and opens the article from a project cover. Bottom spacing accounts for the home indicator.
- Left/Right browses panels, Home selects Home, and End reaches Links. Thumbnail keyboard focus follows the selected thumbnail. Content panels outside the current selection are inert and absent from the accessibility tree.
- The dropdown retains its cat, independently remembered Projects disclosure, contact links, update date, keyboard navigation, and outside/Escape dismissal. It stays available over articles.
- Articles retain 490ms initial and replacement openings, a 420ms closing, and the existing stationary tile-mask implementation. An article replacement uses one opening over a preserved copy of the previous article, with no intermediate gallery close. Same-article selection preserves its reading position.
- Reduced motion makes programmatic selection, menu movement, title updates, and articles immediate. Pointer dragging stays direct. Hidden pages and cleanup release animation frames and article snapshots.

The hidden Links panel retains the local ASCII mirror puzzle, trophy, professional links, and compact Credits. The puzzle is idle when not visible; Reset restores its instructions. Credits dismiss on outside press or Escape.

## Content and appearance

Home prose now lives in `src/components/HomeContent.astro`; About stays in `src/components/AboutContent.astro`. Existing placeholder copy has not been rewritten, and Derek's separate drafts have not been inserted. All project artwork and data remain fictional placeholders. Signal studies still demonstrates the six-section case-study layout, facts, and local supporting illustration.

Home uses its light-purple palette; About uses light blue; project covers keep their own palettes. The anchored header blends colors over 320ms. Its section label and title move together: forward navigation moves up, backward navigation moves down, and interrupted requests resume from their drawn positions. Entering a project cover from Home or About reveals and measures its caption before scrambling blank glyphs into the title; project-to-project changes continue from the drawn glyphs and width. The thumbnail gap and SVG frame are aligned at layout and settling, including fractional display scales; drag frames do not measure layout. A short masked blur eases text into the background above the bottom controls. Credit links and descriptions share the same 13px type size. Dark mode remains deferred behind `appearanceEnabled` in `src/scripts/theme.js`: saved or system dark preferences do not change the visible light site.

Edit `src/data/projects.json`. Each item contains:

| Field | Purpose |
| --- | --- |
| `slug` | Stable project ID for direct URLs; use lowercase letters, numbers, and hyphens |
| `title`, `category`, `year`, `caption` | Project metadata and gallery announcement text |
| `description`, `note` | Text shown when clicking the centered project title |
| `image`, `thumbnail` | Image paths relative to `public/` |
| `imageAlt` | A useful description for screen readers |
| `articleMedia` | Optional article-only images: an array of `{ "src", "alt", "caption", "width", "height" }`; the gallery cover is not used automatically |
| `caseStudy.facts` | Optional project facts: an array of `{ "label", "value" }`, such as Role, Timeline, Team, and Tools |
| `caseStudy.sections` | Optional sections: an array of `{ "title", "paragraphs", "media" }`; paragraphs is an array of plain-text strings, and media uses the `articleMedia` image fields |
| `position` | CSS object position for cropping, such as `63% 50%` |
| `palette.accent` | Navigation, caption, controls, and thumbnail outline color |
| `palette.ink` | Text color on accent controls and in the white project view |
| `palette.caption` | Optional override for the centered title color on lighter images |

Use landscape images around 1920 × 1200 and smaller thumbnail copies around 320 × 200. Put them in `public/art/` and `public/thumbnails/`, then change the paths in the JSON. Use strong contrast between accent and ink, and check the caption against the image. There is no automatic palette extraction or slideshow timer.

Article images can use paths relative to `public/` or absolute URLs. Omit `articleMedia` for a text-only article. Supplying image width and height reserves its layout space before it loads. Section images load lazily as the reader approaches them. The offline exporter embeds local article and section images, including images that only appear in project data; remote images still require a connection.

The case-study facts and sections are optional. Empty entries are omitted, and switching to a shorter project clears the previous article's content. On desktop, the section controls stay beside the reading column; on smaller screens they wrap above it. Choosing a section scrolls within the article and moves keyboard focus to its heading while keeping the direct project URL intact. Reduced motion makes the jump immediate. All body text and captions are inserted as plain text.

Edit `src/data/site.json` for the name, header domain, email, LinkedIn URL, default title, and description. Styling lives in `src/styles/portfolio.css`; the shared app starts in `src/scripts/app.js` and uses `carousel.js`. Existing project transitions, menus, case-study rendering, favicons, and puzzle modules remain separate.

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
npm run export:preview
```

The exported `portfolio-preview.html` embeds production pages, scripts, styles, gallery images, and local article media. It loads one persistent frame; section changes and Back/Forward use the production gallery controller without recreating the frame. Its outer URL uses hashes such as `#about?interests` and `#projects?project=signal-studies`. Email and LinkedIn still open their external destinations. Some attachment viewers disable scripts; open the downloaded file in a browser in that case.

## Résumé and update date

The bottom-right date reads Updated today or Updated Nd ago, based on the visitor's calendar day, and shows the full date, time, and timezone on hover or keyboard focus. After 30 days it shows a calendar date. `src/data/publication.js` stamps the static build; `publication-label.js` updates the relative label at local midnight and when the page becomes visible. The timestamp itself stays fixed between builds. Optionally supply an ISO timestamp in `PORTFOLIO_PUBLISHED_AT` to identify a specific release. It describes the site build used for deployment.

The footer contains `contact.stonederek@gmail.com`, `https://www.linkedin.com/in/derekstone0`, and the permanent résumé address `https://stonederek.github.io/resume/`. Email opens a mail client; LinkedIn and Résumé open separate tabs. No phone number, home address, contact form, or extra external services have been added.

The résumé page currently contains a simple availability notice, as requested. When the public résumé is ready, add a PDF as `public/resume.pdf`, commit it, and let GitHub Pages rebuild. Updating that same file keeps the menu address unchanged. The résumé page will then link to the PDF automatically, with a content hash in its internal PDF link to avoid reusing an older cached copy. The public `/resume/` address always stays the same. Check the public PDF for contact details and information you intend to share before adding it. The standalone preview includes the generated résumé page in a small document blob so its menu link also works offline; no résumé document is supplied with this revision.

## GitHub Pages

The existing repository is `StoneDerek/stonederek.github.io`, published at `https://stonederek.github.io/`. Pushes to `main` run **Deploy portfolio to GitHub Pages** using `.github/workflows/deploy.yml`. Repository Pages settings should use **GitHub Actions**. Review branches do not deploy automatically.

`astro.config.mjs` derives the base path for a user-site or project repository. `PORTFOLIO_SITE` and `PORTFOLIO_BASE` support a custom domain/base path. Dependencies are pinned in `package-lock.json`; no backend or paid services are required.

## Verification and performance

All 112 automated tests pass, covering panel/URL round trips, base paths, direct articles and About anchors, preview addresses, gallery settling, caption entry/measurement/reversals/cleanup, menu/request interruption, header-label reversals and cleanup, article masks and cleanup, palette contrast, deferred appearance, and the puzzle. The exporter also parses generated scripts to reject invalid embedded JavaScript.

The gallery revision preceding the caption-entry fix passed 60 Firefox and WebKit browser regression checks at 320px, 390px, and 1440px. These covered Home/About/project navigation without remounting, native vertical scrolling and retained positions, gesture axes, text-node handling, article entry/exit/replacement, browser history, direct URLs, keyboard navigation, reduced motion, and the single-frame offline preview. Each browser also passed 31 focused header-motion checks, including Home/About and About/first-project transitions in both directions; 32 mouse-drag/frame checks; and 11 checks for scrollbar visibility, stable reading width, the bottom fade, credit wording/type size, and article-to-Links motion. Fractional-scale screenshots checked frame rendering beyond CSS bounds alone. The caption-entry fix has simulated-layout regression tests and build/export validation; it has not had a fresh browser pass. Physical iOS Safari and subjective gesture feel on a real phone have not been checked.

The gallery retains its transform-only card movement, cached title measurements, lazy distant covers, image preloading near a destination, and temporary compositor hints. Tile masks merge settled row segments and update at most 60 times per second without changing their durations. The offline file embeds every local image regardless of native lazy loading. `npm run bench:transition` benchmarks mask generation rather than claiming browser paint or battery improvements.
