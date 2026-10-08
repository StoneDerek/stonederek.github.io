# Derek Stone portfolio

An identity-led homepage, an expanded About page, and a dedicated full-screen project gallery. Built with Astro, CSS, and small browser scripts; published as a static GitHub Pages site.

## Pages and content

- `/`: an introduction-only layout with Explore projects and More about me links below the prose. All prose uses Latin filler text; there are no gallery previews or project overview rows.
- `/about/`: five expanded sections with obvious filler headings and paragraphs. Derek will write the actual copy. Edit `src/components/AboutContent.astro` and `src/pages/index.astro` to replace the filler. The shared About component also supplies the inert preview uncovered by the gallery's edge gesture.
- `/projects/`: the existing draggable gallery, project-specific palettes, thumbnail strip, title scramble, and tile-settle articles. All five gallery entries and their abstract artwork are still fictional placeholders, clearly identified as such.
- `/projects/#project=signal-studies`: a direct article link. Menu project links on Home and About open the corresponding article. Unknown slugs leave the gallery available.
- Swiping beyond the final project reveals the hidden Links page, with an ASCII laser puzzle, professional links, and Credits. It has no dropdown entry or extra project thumbnail.
- `/resume/`: the permanent résumé route.

`src/components/SiteHeader.astro` shares the original animated dropdown and cat across all three main pages. Home and About show Home/About/Projects at the top and reveal the links when scrolling upward elsewhere. Projects starts with those links hidden; upward scrolling reveals them, and downward scrolling hides them. In the full-screen gallery, vertical wheel or touch intent controls this reveal even though the page itself does not scroll. The old About popup has been replaced by the full page. The homepage shows the introduction followed by its two links on desktop and phones.

Home and the résumé PDF link use a light-purple default accent (`#ded3ff`); About uses a light-blue accent (`#cde9ff`). Change the `--default-*` variables and `.about-shell` overrides in `src/styles/portfolio.css` to adjust them. The tab icons use the corresponding palettes. The gallery keeps each project's own palette.

## Try it locally

Use Node.js 24 or newer:

```sh
npm ci
npm run dev
```

Open the local address printed by Astro. To check the production version:

```sh
npm run build
npm run preview
```

The separately supplied `portfolio-preview.html` contains all three main production pages, their bundled scripts, every gallery image, and the résumé notice. Download it and open it in a browser; internal routes work offline with back/forward navigation. Each page runs in a fresh frame so gallery listeners are released on navigation. LinkedIn opens an external website and email opens your mail client. The preview uses classic scripts, and its tab icon follows the displayed project. Some attachment viewers disable scripts; open the file in a browser in that case. Regenerate it with:

```sh
npm run build
npm run export:preview
```

The live pages share one minified, cacheable stylesheet. Section navigation warms the thumbnail strip in parallel but waits only for the selected cover, its centered thumbnail, and the first article image when present. Slow neighboring thumbnails do not delay the route. The short trophy spin caps its expensive rendering at 60 draws per second while preserving its 2.4-second duration on faster displays. The offline exporter embeds each shared stylesheet and script only once, then expands them into each fresh route frame. After a completed About edge swipe, it prepares the destination behind the revealed page and replaces the old frame only after loading and a paint opportunity. A newer navigation cancels the prepared frame. Native navigation skips the redundant browser snapshot for this already completed reveal.

## Replace the placeholders

Edit `src/data/projects.json`. Each item contains:

| Field | Purpose |
| --- | --- |
| `title`, `category`, `year`, `caption` | Project metadata and gallery announcement text |
| `description`, `note` | Text shown when clicking the centered project title |
| `image`, `thumbnail` | Image paths relative to `public/` |
| `imageAlt` | A useful description for screen readers |
| `articleMedia` | Optional article-only images: an array of `{ "src", "alt", "caption", "width", "height" }`; the gallery cover is not used automatically |
| `position` | CSS object position for cropping, such as `63% 50%` |
| `palette.accent` | Navigation, caption, controls, and thumbnail outline color |
| `palette.ink` | Text color on accent controls and in the white project view |
| `palette.caption` | Optional override for the centered title color on lighter images |

Use landscape images around 1920 × 1200 and smaller thumbnail copies around 320 × 200. Put them in `public/art/` and `public/thumbnails/`, then change the paths in the JSON. Use strong contrast between accent and ink, and check the caption against the image. There is no automatic palette extraction or slideshow timer.

Article images can use paths relative to `public/` or absolute URLs. Omit `articleMedia` for a text-only article. Supplying image width and height reserves its layout space before it loads.

Edit `src/data/site.json` for the name, header domain, email, LinkedIn URL, default page title, and description. Section navigation uses Astro ClientRouter and a 180ms fade with 8px text drift. The dropdown stays anchored, and gallery artwork fades without lateral travel. Browser Back/Forward uses the same navigation, and each page releases its listeners and animations before swapping. Reduced motion disables section travel. The exported offline preview uses fresh route frames and the same gesture controller.

Section navigation blends the outgoing page and both header rows over the fully painted incoming page for 180ms. Touch, desktop, and offline navigation share this timing; the outgoing drawing is inert and removed when the blend finishes. Gallery header colors blend over 320ms between selections. The selected navigation fill retains its strong tint, and hovering another tab uses a lighter tint of the current section's accent. Home and About use a 96% opaque navigation surface so scrolling text does not compete with the labels. The About edge gesture continues to drive its palette directly from swipe position. Reduced motion, hidden pages, and page cleanup release timed blends.

The styling lives in `src/styles/portfolio.css`; the interaction lives in `src/scripts/carousel.js`, `src/scripts/site-menu.js`, `src/scripts/project-menu.js`, `src/scripts/project-navigation.js`, `src/scripts/project-transition.js`, and `src/scripts/favicon.js`. The hidden-page puzzle uses `ascii-laser.js`, `laser-optics.js`, and `ascii-grid.js`. `art-sources/` contains the editable originals of the temporary textures.

## Navigation and résumé link

The dropdown header reads `stonederek.github.io`; `.✦ ݁˖ Derek Stone` appears at the bottom of the open menu. The menu and lower navigation row inherit the same 13px size and 18px line height from the shared header. The domain header is bold; project choices, contact links, name, and version date use regular weight. The four-line decorative cat uses the same font as the menu, with its supplied spacing preserved in a left-aligned preformatted block. Section dividers are 1px; navigation-row dividers are a lighter .5px. Link arrows sit 4px from the text and appear only on mouse hover or visible keyboard focus. Projects uses a plus/minus disclosure marker.

The header icon sits at the right of the second text row, aligned with the current location or Menu label. Opening and closing crossfade that label in place. Home opens the introduction page, About opens the expanded About page, and Projects expands a nested list with a View gallery link. The revealed Projects link opens the gallery or closes the current article. On Projects, View gallery in the dropdown closes an article using the existing transition. Choosing a project opens its article directly. When an article is already open, the next one assembles over a stationary copy of the current article, using only the opening transition. The copy keeps the old scroll position, geometry, and palette until handoff, then is removed. Reselecting the same article preserves its scroll position. Projects, View gallery, Selected work, or Escape uses the closing transition to return to the gallery. Home and About navigate to their own pages. The disclosure remembers its expansion across Home, About, gallery, articles, reloads, and offline preview frames, so repeated project browsing does not require expanding it again. The entire body can scroll on short screens while the header stays available; the contact footer remains below the navigation. At the end of a collapse the entire body is hidden before animation fills are removed. Closed native disclosures also have explicit CSS hiding; menu paint is contained inside its rounded box.

The browser-tab icon keeps the existing `ds.` mark and uses the selected project's accent background and ink color. `src/data/project-icons.js` prepares six SVG data URLs from `public/favicon.svg` during the static build. The browser swaps a cached URL after a gallery selection settles or a project is selected directly. Initialization also applies the first palette. Duplicate selections skip the link write; sliding frames do not update the favicon. The six encoded URLs total 2,328 bytes, with no canvas, added image requests, animation timer, or blob-URL lifecycle. The original static SVG remains the fallback. Browser tab UI controls whether and when a live icon change becomes visible; desktop and mobile favicon rendering have not been visually tested.

The bottom-right date reads Updated today or Updated Nd ago, based on the visitor's calendar day, and shows the full date, time, and timezone on hover or keyboard focus. After 30 days it shows a calendar date. `src/data/publication.js` stamps the static build; `publication-label.js` updates the relative label at local midnight and when the page becomes visible. The timestamp itself stays fixed between builds. Optionally supply an ISO timestamp in `PORTFOLIO_PUBLISHED_AT` to identify a specific release. It describes the site build used for deployment.

The footer contains `contact.stonederek@gmail.com`, `https://www.linkedin.com/in/derekstone0`, and the permanent résumé address `https://stonederek.github.io/resume/`. Email opens a mail client; LinkedIn and Résumé open separate tabs. No phone number, home address, contact form, or extra external services have been added.

The résumé page currently contains a simple availability notice, as requested. When the public résumé is ready, add a PDF as `public/resume.pdf`, commit it, and let GitHub Pages rebuild. Updating that same file keeps the menu address unchanged. The résumé page will then link to the PDF automatically, with a content hash in its internal PDF link to avoid reusing an older cached copy. The public `/resume/` address always stays the same. Check the public PDF for contact details and information you intend to share before adding it. The standalone preview includes the generated résumé page in a small document blob so its menu link also works offline; no résumé document is supplied with this revision.

Before a real launch, replace the placeholder artwork and copy, remove the gallery placeholder labels once the entries contain real work, and add real project pages, résumé, and contact information as appropriate.

## Publish on GitHub Pages

The website is published at `https://stonederek.github.io/` from `StoneDerek/stonederek.github.io`. Push changes to `main` to run **Deploy portfolio to GitHub Pages** automatically. In **Settings → Pages**, the source should be **GitHub Actions**. The existing deployment workflow completed successfully for the October 5, 2026 arrow-icon revision.

For initial setup of another copy:

1. Create an empty **public** repository named `stonederek.github.io` under `StoneDerek`. Leave “Add a README” unchecked.
2. Extract this source package and open a terminal inside the `portfolio` folder.
3. Run:

```sh
git init -b main
git add .
git commit -m "Add portfolio carousel prototype"
git remote add origin https://github.com/StoneDerek/stonederek.github.io.git
git push -u origin main
```

4. In the repository, open **Settings → Pages** and set **Source → GitHub Actions**.
5. If the initial run happened before Pages was enabled, rerun **Deploy portfolio to GitHub Pages** from the Actions tab. Wait for the build and deployment jobs to finish, then open the website.

The workflow is included in `.github/workflows/deploy.yml`, and `package-lock.json` fixes the dependencies. Later pushes to `main` publish automatically. The configuration also handles a project repository such as `portfolio`, deriving the `/portfolio/` base path from GitHub's build environment.

For a custom domain, set `PORTFOLIO_SITE` in the workflow build environment and set `PORTFOLIO_BASE` to `/`, then configure the domain in GitHub Pages.

No backend or paid services are needed for this prototype.

## Interaction and accessibility

On phones, larger thumbnails sit above a reachable control row with 48px previous/next buttons, an explicit View project button, and a project counter. The arrows disable at the ends. The menu and return controls have larger touch targets, and the bottom controls leave space for the home indicator. The same layout stays available on touch devices in landscape.

- Click a thumbnail to browse the gallery. Images slide across the screen; the selected thumbnail settles in the center of the bottom strip, including at the first and last project. Choose Projects in the dropdown to expand the project list and open an article directly.
- Click and drag the main image or the thumbnail strip. Both follow the pointer, then snap to a project when released. A short, quick flick adds momentum. Touch swipes work on both surfaces. While dragging, the large images shrink slightly into rounded cards over the current theme’s canvas. Neighboring cards share one gap (up to 20px on desktop and about 10px on a typical phone). Zooming back to square, full-size images starts as soon as the drag is released and overlaps with the sliding animation. Text in the gallery cannot be selected during a gesture.
- Pointer movement draws the latest input sample once per animation frame, preserving its input time for release velocity. Releasing flushes an unpainted final sample before settling; cancellation, navigation, hiding the page, and cleanup discard pending movement. Card lift keeps full-size layout boxes and adjusts their spacing with transforms, avoiding repeated flex-width layout during a drag. The separate wheel/trackpad animation path is unchanged.
- Slow main-artwork swipes advance one project after about 36–42px on typical phones or 54px on desktop. The mobile threshold is 11.25% of width, clamped to 18–42px; desktop and thumbnail-strip settling use 9% of their drag unit, clamped to 24–54px. These distances are 25% shorter than before. Momentum and longer swipes remain available. Tiny movements and pointer cancellation do not force a project change.
- From the settled first project only, dragging the artwork right uncovers the actual About page. The gallery follows the pointer with a brief smooth slowdown through a soft bump, not a stiff rubber-band margin. There is no handle or instructional text. Crossing 38% of the gallery width (clamped to 112–360px) enters About while still dragging—no release step. Before crossing, releasing, reversing, or cancelling returns smoothly to Projects. Gestures starting on another project only browse projects, and thumbnail drags never enter About. The revealed content hands off to the real About route without a second fade or drift; ordinary section links keep Short drift.
- Re-grabbing a returning preview continues from the position on screen, and a fresh title tap during its return opens the article. Lost pointer capture returns safely. During a committed About load, gallery keys leave the reveal steady. The dropdown can still choose another project or return to the gallery, cancelling the pending About request so the latest choice wins.
- Scroll over the strip with a vertical mouse wheel, horizontal wheel, or trackpad. The strip and main image move together, then settle on a project. Navigation stops at both ends; there are no repeated frames or looping.
- Click the top bar to smoothly expand a solid, full-height menu with Home, About, and Projects. Closing and interrupted opening gestures also animate. Projects expands and collapses independently, preserving its currently drawn height on reversal. Arrow Up/Down and Home/End navigate visible choices, including contact and professional links. Hidden project links are skipped. Arrow Right opens Projects and focuses the current project; Arrow Left or Escape from within Projects closes it and returns focus to its summary. Escape elsewhere or an outside click closes the main menu. Native details keep both levels usable without JavaScript.
- Left/Right arrow keys browse images; Home selects the first project and End reaches the hidden Links page. Rapid key presses advance the pending destination. Keyboard focus follows selection when navigating thumbnails and stays on the single title control when browsing from there.
- On Links, drag either mirror to turn it, or tap/click it for a five-degree turn. Enter/Space also turns it; arrow keys adjust by one degree, Shift by five, and Alt by a quarter degree. The source points horizontally and does not track the mirrors. The initial scene is drawn as the end card starts entering, before the canvas becomes visible; interaction still begins after the halfway point. Reaching the target earns a short ASCII trophy spin and the exact message “You got a trophy!”. The solved puzzle shows only View trophy and Reset; Reset restores the drag instructions. The trophy stays earned until Reset. Reduced motion shows a static trophy. Rendering stops when idle or hidden, and the `ds.` lettering stays dark.
- Credits opens above its footer control, dismisses on an outside press or Escape, and closes when leaving Links. The initial ASCII rendering inspiration links to https://asciigenerators.com/; the puzzle and renderer run locally without loading that website.
- The project title stays at the center of the screen while images slide and shrink underneath it. When the focused image changes, its letters jumble into the new name in a directional wave: right-to-left for an image entering from the right, left-to-right for one entering from the left. Letters use steady slots while the overall width eases between names, with substitutions slowing as the title resolves. The wave takes about 360ms, adjusted to the remaining slide time during navigation. Rapid reversals continue from the letters and widths already visible. Accessible names use the real project title throughout, and reduced-motion preferences show the new title immediately. The 14px title has no text shadow. Its compact accent fill appears on hover or keyboard focus, with balanced side padding and a larger invisible tap area. A small SVG diagonal arrow indicates the project view, with no underline.
- Click the title or mobile View project control to assemble an independent white article with Tile settle. Phone tiles are 24px; larger screens adjust the size to keep at most 1,400 mask cells. One stationary article copy is revealed by moving tile masks. The article's text remains aligned even where tile openings overlap. The snapshot preserves the actual article position and fractional width, and the article keeps the same scrollbar space during and after the transition. The cover stays in the gallery, and articles can have their own optional media. Use Selected work or Escape to return; focus returns to the opening control. The transition preserves the current scroll position when closing a long article.
- Opening conceals the finished article before showing its container or measuring it. The snapshot enters the DOM hidden, with an explicit empty inset clip, and appears only when the first actual tiles are ready. Empty paths are filtered out so whitespace cannot become an invalid mask. Closing starts with a full inset clip so preparing its snapshot does not briefly expose the gallery.
- The dropdown remains above the article and tile layers, usable throughout. Its Projects:/Project: prefix moves vertically through a clipped slot without shifting the location title. Changing projects also animates the dropdown title. Selecting a project opens that article from either view; Projects or Selected work returns to the gallery. New navigation requests interrupt an in-progress transition and resolve to the latest request. Resizing finishes the transition immediately.
- About is a scrollable page with an on-page contents list, readable prose, and direct project links. Its section links hide on downward scrolling and return on upward scrolling.
- Controls have slightly rounded corners and no borders. A thin accent outline stays fixed at the center of the thumbnail strip, with a small gap around its frame. Thumbnails slide underneath it, and its color follows the focused project. Thumbnails have a transparent fill so a second color cannot bleed through their rounded image edges. Keyboard focus uses a filled color change or a small marker. Large images have square corners at rest, including in project inspection.
- There is no automatic advancement. Reduced-motion preferences make title updates, programmatic selection, menu changes, and article transitions immediate, disable image scaling transitions, and preserve direct pointer dragging. Browsers without CSS path masking also switch articles immediately.
- Without JavaScript, the first image and centered title remain visible with a short explanation.

## Verification

Run `npm test`, `npm run build`, and `npm run export:preview`. All 106 automated tests pass, including article/menu cleanup, replacement timing, scroll intent, route direction, gesture boundaries, and deferred appearance startup. Palette tests retain coverage for readable contrast, cancellation, reduced motion, and hidden-page cleanup. The exporter validates the inserted scripts as well as the generated bundles.

Firefox and WebKit checks at 1440px, 390px, and 320px cover the 180ms painted section blend, inert outgoing drawings, direct article entry, route history, rapid article choices, timestamp keyboard access, reduced motion, and light appearance with saved/system dark preferences. Both browsers also pass downloaded-file preview navigation and article replacement with storage disabled, including a new route during frame loading or an active blend. Intermediate WebKit screenshots at 0ms, 45ms, 90ms, and 140ms show matching continuous header colors on desktop, touch, non-native, and offline paths. Native snapshots are deliberately skipped after frame inspection exposed an empty incoming drawing. Current Chromium automation was unavailable because its browser download failed.

Physical iOS Safari and subjective gesture feel on a real phone have not been checked. Home and About prose is Latin filler for Derek to replace, and the gallery entries remain placeholders.

## Performance

Tile geometry and timing are computed once per transition. Moving tiles retain their individual masks; adjoining full-size tiles merge into row segments with the same revealed area. Mask updates are limited to 60 per second on high-refresh displays, while elapsed time still controls the 670ms initial opening, 490ms article replacement, and 420ms closing. The initial opening remains explicitly hidden, and closing starts fully covered. Finishing or interrupting a transition removes its snapshot and listeners. Direct article switches temporarily retain one additional stationary page copy; that copy has no animation frame loop and is removed on completion or interruption. Reduced motion, hidden tabs, and browsers without path masking skip this extra copy. Hiding the tab finishes gallery motion and releases any tile snapshot immediately.

The gallery skips unchanged transforms, thumbnail emphasis, scroll positions, card properties, and text writes. Title scrambling caches glyph widths for the current font and measures replacement candidates before animation, avoiding canvas measurements inside its frame loop. Resize measurements read dimensions before writing styles. A compositor hint is enabled only during gallery motion, dragging, or image scaling. The first two gallery covers load eagerly; distant covers use native lazy loading, with destinations and neighbors promoted before navigation. Thumbnails remain eager. Optional article media is appended in one batch, with its first image eager and later images lazy. Artwork resolution and compression are unchanged.

Run `npm run bench:transition` to compare mask-generation JavaScript with the previous renderer at phone, desktop, and 4K sizes. A local run measured about 30% less mask-generation time and 34–36% shorter paths at 60 Hz. The benchmark includes geometry setup, warms both implementations, alternates measurement order, and reports the median of nine batches. It measures JavaScript and generated path length; browser paint, total page CPU, network savings, and phone battery use have not been measured. Native lazy-loading decisions depend on the browser, and the offline HTML preview still embeds every image.

## Appearance

The public site and offline preview use light mode while the website's content and remaining sections are developed. The appearance switch is omitted, and saved dark preferences or the operating system's dark setting do not change the visible site. Stored preferences are retained for later. The existing theme implementation is deferred behind `appearanceEnabled` in `src/scripts/theme.js`.

Navigation blends the outgoing and incoming page over the same 180ms interval, with no entry delay. Every browser keeps an inert, frozen outgoing page over the fully painted incoming page and fades that drawing away. Native snapshot animation is skipped because intermediate-frame checks exposed an empty incoming drawing in WebKit. The offline preview prepares its next frame underneath the current one before starting the same blend. A completed About edge swipe adds no second transition. Reduced motion switches immediately.

Article replacements start their tile reveal at the incoming heading, so the first moving tiles reveal content instead of starting underneath the dropdown. The outgoing article fades immediately over 90ms; replacements use a 490ms reveal while initial openings retain their 670ms timing. Arrow keys, End, and Tab can reach the update timestamp in every page menu. A live theme change finishes an active article or section snapshot immediately, releasing its temporary layers.
