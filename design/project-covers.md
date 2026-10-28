# Project covers

The three project previews use reproducible technical illustrations, replacing
the generated photographs and glowing concept art. They remain placeholders:
none is presented as a recording, a finished interface, or a result from Derek's
project implementation. The project notes and alternative text explain this.

| Project | Illustration | Image family | Shared UI/title accent | UI ink |
| --- | --- | --- | --- | --- |
| Acoustic Drone Detection | Actual STFT of synthetic harmonic audio | Dark red-violet/burgundy | `#1aff78` green | `#18221b` |
| Academic Advising | Planned source → retrieval → answer schematic | Light, cool blue-gray | `#b52810` vermilion | `#ffffff` |
| 2D Lightning Simulation | Separate potential-weighted lattice-growth calculation | Dark yellow-green/olive | `#efc4ff` violet | `#211629` |

The reference's vivid green over a dark, mostly neutral photograph with burgundy
detail suggested the relationship: a restrained image palette and an accent
with a different hue, saturation, and brightness. These covers use opposing hue
families while controlling brightness independently for readable text. The
resting title, hovered title background, menu, mobile controls, and selected
thumbnail retain exactly the same accent within each project. The existing
hover/focus ink remains readable against that accent. Article prose uses the
page text color, independently of ink on colored controls.

Run `node scripts/build-project-covers.mjs` from the checkout. It uses the existing
`sharp` dependency and saves editable sources in `src/assets/project-covers/`,
1920 × 1200 production WebPs in `public/art/`, and 320 × 200 thumbnails in
`public/thumbnails/`. Seeded numerical calculations make regeneration repeatable.

The STFT uses 8 seconds of synthetic audio at 8192 Hz, a 1024-sample Hann window,
and a 72-sample hop. Its harmonics illustrate a representation only; they are
not evidence of a drone recording or classification performance. The lattice
uses a grounded growing cluster, fixed top/bottom electrodes, linear side
boundaries, relaxation of the discrete potential, and potential-weighted growth
with exponent 1.2. It illustrates the subject without pretending to reproduce
the project's eventual numerical method.

After WebP compression, the script measures every pixel in the central 60% × 16%
title region, including room for the smaller method line, against a minimum
4.5:1 title/image contrast target. Existing palette tests also check control and
selected-menu text through all color transitions. These numerical checks support
visual review; they are not a claim of a full accessibility audit.

Color references: [Adobe's color wheel](https://www.adobe.com/uk/creativecloud/design/discover/color-wheel.html)
and [W3C's image-background contrast technique](https://www.w3.org/WAI/WCAG21/Techniques/general/G18).
