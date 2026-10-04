# Derek Stone portfolio prototype

A full-screen, draggable image gallery with a slim thumbnail strip centered on the selected project, a bold full-height dropdown, a stationary centered project title, and manually selected colors for each image. The title jumbles into the next name in a wave from the side the image enters. Selecting it opens a full-screen project view with an uncropped image and a description below it. Built with Astro, CSS, and a small amount of JavaScript. All six projects and their descriptions are fictional placeholders; the abstract artwork was created for this prototype.

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
| `position` | CSS object position for cropping, such as `63% 50%` |
| `palette.accent` | Navigation, caption, controls, and thumbnail outline color |
| `palette.ink` | Text color on accent controls and in the white project view |
| `palette.caption` | Optional override for the centered title color on lighter images |

Use landscape images around 1920 × 1200 and smaller thumbnail copies around 320 × 200. Put them in `public/art/` and `public/thumbnails/`, then change the paths in the JSON. Use strong contrast between accent and ink, and check the caption against the image. There is no automatic palette extraction or slideshow timer.

Edit `src/data/site.json` for the name, page title, description, and About text. The styling lives in `src/styles/portfolio.css`; the interaction lives in `src/scripts/carousel.js`. `art-sources/` contains the editable originals of the temporary textures.

Before a real launch, replace the placeholder artwork and copy, remove the placeholder labels from the details and About dialogs, and add real project pages, résumé, and contact information as appropriate.

## Publish on GitHub Pages

The intended address is `https://stonederek.github.io/`.

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

This package has not been published to GitHub. Deployment requires creating the repository and enabling Pages. No backend or paid services are needed for this prototype.

## Interaction and accessibility

On phones, larger thumbnails sit above a reachable control row with 48px previous/next buttons, an explicit View project button, and a project counter. The arrows disable at the ends. The menu and return controls have larger touch targets, and the bottom controls leave space for the home indicator. The same layout stays available on touch devices in landscape.

- Click a thumbnail or select a project from the dropdown. Images slide across the screen; the selected thumbnail settles in the center of the bottom strip, including at the first and last project.
- Click and drag the main image or the thumbnail strip. Both follow the pointer, then snap to a project when released. A short, quick flick adds momentum. Touch swipes work on both surfaces. While dragging, the large images shrink slightly into rounded cards over a constant white backdrop. Neighboring cards share one gap (up to 20px on desktop and about 10px on a typical phone). Zooming back to square, full-size images starts as soon as the drag is released and overlaps with the sliding animation. Text in the gallery cannot be selected during a gesture.
- Scroll over the strip with a vertical mouse wheel, horizontal wheel, or trackpad. The strip and main image move together, then settle on a project. Navigation stops at both ends; there are no repeated frames or looping.
- Click the top bar to smoothly expand a solid, full-height menu with bold project links and About at the bottom. Closing and interrupted opening gestures also animate. Arrow Up/Down and Home/End navigate its choices. Escape or an outside click closes it.
- Left/Right arrow keys browse images; Home/End select the first/last project. Rapid key presses advance the pending destination. Keyboard focus follows selection when navigating thumbnails and stays on the single title control when browsing from there.
- The project title stays at the center of the screen while images slide and shrink underneath it. When the focused image changes, its letters jumble into the new name in a directional wave: right-to-left for an image entering from the right, left-to-right for one entering from the left. Letters use steady slots while the overall width eases between names, with substitutions slowing as the title resolves. The wave takes about 360ms, adjusted to the remaining slide time during navigation. Rapid reversals continue from the letters and widths already visible. Accessible names use the real project title throughout, and reduced-motion preferences show the new title immediately. The 14px title has no text shadow. Its compact accent fill appears on hover or keyboard focus, with balanced side padding and a larger invisible tap area. A small diagonal arrow indicates inspection, with no underline. Click it at any time to open the currently focused project in a full-screen inspection view; its original image is fitted without cropping, with project copy below it on white. Use the back button or Escape to return to the gallery; focus returns to the same title control.
- About closes with its close button, Escape, or an outside click. Focus returns to the dropdown.
- Controls have slightly rounded corners and no borders. A thin accent outline stays fixed at the center of the thumbnail strip, with a small gap around its frame. Thumbnails slide underneath it, and its color follows the focused project. Thumbnails have a transparent fill so a second color cannot bleed through their rounded image edges. Keyboard focus uses a filled color change or a small marker. Large images have square corners at rest, including in project inspection.
- There is no automatic advancement. Reduced-motion preferences make title updates, programmatic selection, and menu changes immediate, disable image scaling transitions, and preserve direct pointer dragging.
- Without JavaScript, the first image and centered title remain visible with a short explanation.

## Verification

This revision was checked in Chromium for finite endpoints, centered thumbnails at every selection, sliding through intermediate positions, interrupted keyboard input, live mouse dragging on both surfaces, suppression of accidental clicks after dragging, wheel input in both axes, project palettes, menu keyboard navigation, full-screen image inspection, and focus restoration. Checks also covered actual touch gestures, reduced motion, borderless controls, and the first-image fallback without JavaScript. Layouts were checked at 1440 × 900, 2048 × 1048, 1024 × 768, 390 × 844, 360 × 640, and 820 × 390. The self-contained preview ran without network requests. GitHub deployment has not yet been run.

The mobile controls revision was checked with touch emulation at 390 × 844, 360 × 640, 320 × 568, 430 × 932, 844 × 390, and 390 × 360. Checks covered repeated arrow taps, endpoint disabling, image and thumbnail gestures, inspection and focus return, thumbnail centering, short-screen menus, reduced motion, offline operation, and desktop navigation. These are Chromium checks; physical iOS Safari has not been tested.

The gallery motion revision was checked for intermediate menu heights and rapid reversal, image shrink and spacing during mouse/touch gestures, square images after settling and in inspection, a spaced accent outline without clipping, no accidental title selection or inspection after dragging, the hover arrow, keyboard focus, phone layouts, reduced motion, and the native menu without JavaScript.

The spacing revision was checked for one shared card gap, enlargement during the sliding phase, full-size square images before slide completion, interrupted gestures, mouse/touch navigation, and reduced motion.

The thumbnail outline is a stationary overlay and does not belong to any thumbnail. Its screen position was checked during mouse and touch dragging, arrow selection, and scrolling.

The latest revision was checked for a stationary title during real mouse and touch gestures, intermediate scrambled letters, correct accessible names, rapid interrupted updates, inspection during a title change, focus restoration, and immediate updates with reduced motion. White backgrounds and the browser theme were checked across all six projects. The thumbnail fill is transparent, and its rounded edges were visually inspected. The final production build and offline preview passed without browser errors or network requests. Phone layouts included 390 × 844, 320 × 568, and 844 × 390; the first title also remained visible without JavaScript.
