# Derek Stone portfolio prototype

A full-screen, draggable image gallery with a slim thumbnail strip centered on the selected project, a bold full-height dropdown, a stationary centered project title, and manually selected colors for each image. The title jumbles into the next name in a wave from the side the image enters. Selecting it assembles an independent article with the Tile settle transition: small tiles grow outward from the click, arrive slightly offset, and align into the page. Returning to the gallery reverses the effect. The dropdown stays above both views and their transitions. Built with Astro, CSS, and a small amount of JavaScript. All six projects and their descriptions are fictional placeholders; the abstract artwork was created for this prototype.

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

The separately supplied `portfolio-preview.html` is a self-contained copy of the production build. Download it and open it in a browser; it needs no installation, server, or internet connection. The exported gallery uses a classic script rather than requiring module-script support. Some attachment and mobile file viewers can display the page without running its JavaScript. A notice remains visible if the gallery has not initialized; the native dropdown can still open in that state. For testing on a phone, a hosted GitHub Pages address opened in the browser provides a more useful check than an attachment preview. Regenerate the preview after changes with:

```sh
npm run build
npm run export:preview
```

## Replace the placeholders

Edit `src/data/projects.json`. Each item contains:

| Field | Purpose |
| --- | --- |
| `title`, `category`, `year`, `caption` | Project metadata and announcement text (the homepage shows the title) |
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

Edit `src/data/site.json` for the name, page title, description, and About text. The styling lives in `src/styles/portfolio.css`; the interaction lives in `src/scripts/carousel.js` and `src/scripts/project-transition.js`. `art-sources/` contains the editable originals of the temporary textures.

Before a real launch, replace the placeholder artwork and copy, remove the placeholder labels from the details and About dialogs, and add real project pages, résumé, and contact information as appropriate.

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

- Click a thumbnail or select a project from the dropdown. Images slide across the screen; the selected thumbnail settles in the center of the bottom strip, including at the first and last project.
- Click and drag the main image or the thumbnail strip. Both follow the pointer, then snap to a project when released. A short, quick flick adds momentum. Touch swipes work on both surfaces. While dragging, the large images shrink slightly into rounded cards over a constant white backdrop. Neighboring cards share one gap (up to 20px on desktop and about 10px on a typical phone). Zooming back to square, full-size images starts as soon as the drag is released and overlaps with the sliding animation. Text in the gallery cannot be selected during a gesture.
- Scroll over the strip with a vertical mouse wheel, horizontal wheel, or trackpad. The strip and main image move together, then settle on a project. Navigation stops at both ends; there are no repeated frames or looping.
- Click the top bar to smoothly expand a solid, full-height menu with bold project links and About at the bottom. Closing and interrupted opening gestures also animate. Arrow Up/Down and Home/End navigate its choices. Escape or an outside click closes it.
- Left/Right arrow keys browse images; Home/End select the first/last project. Rapid key presses advance the pending destination. Keyboard focus follows selection when navigating thumbnails and stays on the single title control when browsing from there.
- The project title stays at the center of the screen while images slide and shrink underneath it. When the focused image changes, its letters jumble into the new name in a directional wave: right-to-left for an image entering from the right, left-to-right for one entering from the left. Letters use steady slots while the overall width eases between names, with substitutions slowing as the title resolves. The wave takes about 360ms, adjusted to the remaining slide time during navigation. Rapid reversals continue from the letters and widths already visible. Accessible names use the real project title throughout, and reduced-motion preferences show the new title immediately. The 14px title has no text shadow. Its compact accent fill appears on hover or keyboard focus, with balanced side padding and a larger invisible tap area. A small SVG diagonal arrow indicates the project view, with no underline.
- Click the title or mobile View project control to assemble an independent white article with Tile settle. Phone tiles are 24px; larger screens adjust the size to keep at most 1,400 mask cells. One stationary article copy is revealed by moving tile masks. The article's text remains aligned even where tile openings overlap. The snapshot preserves the actual article position and fractional width, and the article keeps the same scrollbar space during and after the transition. The cover stays in the gallery, and articles can have their own optional media. Use Selected work or Escape to return; focus returns to the opening control. The transition preserves the current scroll position when closing a long article.
- Opening conceals the finished article before showing its container or measuring it. The snapshot enters the DOM hidden, with an explicit empty inset clip, and appears only when the first actual tiles are ready. Empty paths are filtered out so whitespace cannot become an invalid mask. Closing starts with a full inset clip so preparing its snapshot does not briefly expose the gallery.
- The dropdown remains above the article and tile layers, usable throughout. Its Work:/Project: prefix moves vertically through a clipped slot without shifting the project title. Changing projects also animates the dropdown title. Selecting a project from within an article opens that article; Selected work returns to the gallery. New navigation requests interrupt an in-progress transition and resolve to the latest request. Resizing finishes the transition immediately.
- About closes with its close button, Escape, or an outside click. Focus returns to the dropdown.
- Controls have slightly rounded corners and no borders. A thin accent outline stays fixed at the center of the thumbnail strip, with a small gap around its frame. Thumbnails slide underneath it, and its color follows the focused project. Thumbnails have a transparent fill so a second color cannot bleed through their rounded image edges. Keyboard focus uses a filled color change or a small marker. Large images have square corners at rest, including in project inspection.
- There is no automatic advancement. Reduced-motion preferences make title updates, programmatic selection, menu changes, and article transitions immediate, disable image scaling transitions, and preserve direct pointer dragging. Browsers without CSS path masking also switch articles immediately.
- Without JavaScript, the first image and centered title remain visible with a short explanation.

## Verification

The optimized Tile settle revision passes `npm run build`, `npm test` (24 tests), JavaScript syntax checks, and the self-contained preview export. Tests cover complete tile coverage at six phone/desktop viewport sizes, the cell budget, click-origin ordering, invalid measurements, reduced motion, pre-aborted transitions, and unsupported mask rendering. Controlled-frame regression checks also cover stationary article text, exact snapshot position and width, interruption cleanup, closing a scrolled article, concealed opening before the first tile frame, fully covered initial closing, a 60 Hz update budget on a 120 Hz display, and immediate cleanup when the tab is hidden. Geometry checks compare the merged mask with the previous individual tile rectangles throughout opening and closing, including corner clicks, landscape layouts, and backwards time samples. Fully settled masks collapse to one rectangle per row. The first-frame regression failed before the empty-path and visibility guards were corrected. These checks execute the animation against a small DOM fixture; they do not verify browser path rasterization. The cloud browser's URL policy prevents opening the local preview, so this revision has not been visually checked in a browser or on physical iOS Safari.

Previous revisions were checked in Chromium for finite endpoints, centered thumbnails at every selection, sliding through intermediate positions, interrupted keyboard input, live mouse dragging on both surfaces, suppression of accidental clicks after dragging, wheel input in both axes, project palettes, menu keyboard navigation, full-screen image inspection, and focus restoration. Checks also covered actual touch gestures, reduced motion, borderless controls, and the first-image fallback without JavaScript. Layouts were checked at 1440 × 900, 2048 × 1048, 1024 × 768, 390 × 844, 360 × 640, and 820 × 390. The self-contained preview ran without network requests.

The mobile controls revision was checked with touch emulation at 390 × 844, 360 × 640, 320 × 568, 430 × 932, 844 × 390, and 390 × 360. Checks covered repeated arrow taps, endpoint disabling, image and thumbnail gestures, inspection and focus return, thumbnail centering, short-screen menus, reduced motion, offline operation, and desktop navigation. These are Chromium checks; physical iOS Safari has not been tested.

The gallery motion revision was checked for intermediate menu heights and rapid reversal, image shrink and spacing during mouse/touch gestures, square images after settling and in inspection, a spaced accent outline without clipping, no accidental title selection or inspection after dragging, the hover arrow, keyboard focus, phone layouts, reduced motion, and the native menu without JavaScript.

The spacing revision was checked for one shared card gap, enlargement during the sliding phase, full-size square images before slide completion, interrupted gestures, mouse/touch navigation, and reduced motion.

The thumbnail outline is a stationary overlay and does not belong to any thumbnail. Its screen position was checked during mouse and touch dragging, arrow selection, and scrolling.

The latest revision was checked for a stationary title during real mouse and touch gestures, intermediate scrambled letters, correct accessible names, rapid interrupted updates, inspection during a title change, focus restoration, and immediate updates with reduced motion. White backgrounds and the browser theme were checked across all six projects. The thumbnail fill is transparent, and its rounded edges were visually inspected. The final production build and offline preview passed without browser errors or network requests. Phone layouts included 390 × 844, 320 × 568, and 844 × 390; the first title also remained visible without JavaScript.

## Performance

Tile geometry and timing are computed once per transition. Moving tiles retain their individual masks; adjoining full-size tiles merge into row segments with the same revealed area. Mask updates are limited to 60 per second on high-refresh displays, while elapsed time still controls the original 670ms opening and 420ms closing. The initial opening remains explicitly hidden, and closing starts fully covered. Finishing or interrupting a transition removes its snapshot and listeners. Hiding the tab finishes gallery motion and releases any tile snapshot immediately.

The gallery skips unchanged transforms, thumbnail emphasis, scroll positions, card properties, and text writes. Title scrambling caches glyph widths for the current font and measures replacement candidates before animation, avoiding canvas measurements inside its frame loop. Resize measurements read dimensions before writing styles. A compositor hint is enabled only during gallery motion, dragging, or image scaling. The first two gallery covers load eagerly; distant covers use native lazy loading, with destinations and neighbors promoted before navigation. Thumbnails remain eager. Optional article media is appended in one batch, with its first image eager and later images lazy. Artwork resolution and compression are unchanged.

Run `npm run bench:transition` to compare mask-generation JavaScript with the previous renderer at phone, desktop, and 4K sizes. A local run measured about 30% less mask-generation time and 34–36% shorter paths at 60 Hz. The benchmark includes geometry setup, warms both implementations, alternates measurement order, and reports the median of nine batches. It measures JavaScript and generated path length; browser paint, total page CPU, network savings, and phone battery use have not been measured. Native lazy-loading decisions depend on the browser, and the offline HTML preview still embeds every image.
