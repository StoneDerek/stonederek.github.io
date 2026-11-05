# Reference notes

## Accent color: observations from the supplied Paradigm references

The useful lesson is how the accent is used, rather than the particular hue. It gives the site character through a few deliberate moments while most typography and surfaces stay neutral. The restrained surrounding layout lets those moments register without competing with them.

- Give the accent a specific role and repeat that role consistently.
- Do not color every available link, footnote, label, border, or control just to distribute the accent.
- Let imagery, spacing, and typography carry most of the page. The accent supports their hierarchy.
- Neutral text can remain neutral even when it is interactive; do not use color as the only interaction cue.
- A strong accent can work in a small area. A quieter accent used everywhere can still feel forced.
- Choose the portfolio's hue separately. This reference is not an instruction to copy green.

The user’s specific Art annotations distinguish neutral in-text links and note numbers from a blue-violet reference URL. That distinction is intentional, not a global recoloring rule.

## Typography: a primary face with a contrasting secondary role

Paradigm uses more than one typeface. In the supplied About statistics reference, the sentence and large figures use serif type, while “Founded” and “Investments” use a contrasting sans-serif treatment. The secondary type distinguishes the compact labels without taking over the composition. The predominance of one face helps the page hold together while the second adds a visible change of role.

This is a role-based observation from the reference, not a requirement to use one font everywhere or to restyle every label. The screenshot does not establish exact font families or a site-wide rule for secondary type.

## Light/dark control: placement research

There is no universal rule that a theme control belongs in a header or footer. The useful distinction is primary navigation versus a secondary display preference.

### Findings from primary sources

- Nielsen Norman Group's utility-navigation guidance allows secondary tools in bottom navigation. It emphasizes predictable placement and grouping tools where users expect to find them. This supports considering a footer; it does not prescribe a footer specifically for theme controls.
- NN/g's dark-mode research finds that users generally expect the site to follow the device setting automatically. A manual control should be an override, rather than a required first step.
- Chrome's dark-mode-toggle guidance likewise starts with the system preference and cautions against making a rarely used appearance preference a prominent persistent control. A separate settings surface is another option when settings need explanation.
- Google's theme-switch implementation demonstrates remembering a visitor's explicit choice and applying it before the page paints.

### Options for this portfolio

| Placement | Benefit | Tradeoff |
| --- | --- | --- |
| Plain footer action | Keeps the primary navigation focused and groups a secondary preference with other utilities | Less visible before someone reaches the footer |
| Small header action | Available immediately | Adds an element to the prominent header area |
| Inside a menu/settings surface | Keeps the page quieter and can accommodate more choices | Requires an extra action to find/change the preference |

The footer is the first candidate to review for this site, consistent with the user's suggestion. Keep the control compact, use the surrounding typography, and avoid a separate Appearance panel with redundant status text. Its label should clearly identify the change it performs. Apply the change immediately and retain the visitor's choice across pages.

These are research notes and placement tradeoffs, not authorization to add new controls, overlays, labels, or a new palette.

### Sources

- Nielsen Norman Group, [Utility Navigation: What It Is and How to Design It](https://www.nngroup.com/articles/utility-navigation/).
- Nielsen Norman Group, [Web Page Footers 101](https://www.nngroup.com/articles/footers/).
- Nielsen Norman Group, [Dark Mode: How Users Think About It and Issues to Avoid](https://www.nngroup.com/articles/dark-mode-users-issues/).
- Chrome for Developers, [Dark mode toggles](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-components/dark-mode-toggle).
- Google web.dev, [Building a theme switch component](https://github.com/GoogleChrome/web.dev/blob/main/src/site/content/en/blog/building-a-theme-switch-component/index.md).

## Why the whitespace works

This is a reading of the supplied Paradigm screenshots, informed by established composition principles. The screenshots do not reveal the designers’ process or prove a particular CSS grid, spacing scale, or mathematical ratio.

The important distinction is between space inside a group, space between groups, and space around the overall composition. Those distances have different jobs.

| Visible relationship in the reference | Design concept | What it communicates |
| --- | --- | --- |
| Captions sit close to images; labels sit close to their values | Gestalt proximity | These pieces belong together |
| Larger gaps separate card rows and distinguish the header from the content | Hierarchy and rhythm | These are separate groups or stages of the page |
| Image edges, captions, and subsequent rows share vertical anchors | Alignment and grid | The page has an underlying structure even where it is sparse |
| Investments and About concentrate content on the left and leave broad open regions | Asymmetric balance and negative space | Content and empty space balance without needing equal material on both sides |
| Writing uses a bounded reading column; About uses narrower left-aligned prose | Typographic measure and composition suited to the content | Reading width and placement are deliberate relationships, not a universal centering rule |
| Compact typography and tightly grouped details coexist with large open areas | Contrast of density | The open areas register because the content groups remain compact |

Some reference outer margins are relatively small. Its effect does not come from increasing every margin or inserting large gaps everywhere. A large blank region can work alongside content positioned close to an edge when the remaining alignments and groupings are coherent.

A spacing system can make those relationships repeatable. It cannot decide their visual balance automatically. Exact proportions still need optical judgment and iteration at the relevant viewport sizes. No golden-ratio claim or one-size-fits-all padding rule is established here.

### Primary-source grounding

- [NN/g: Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/) explains how varying whitespace connects related items and separates unrelated groups.
- [IBM Design Language: Layout overview](https://www.ibm.com/design/language/layout/overview/) explicitly connects positive/negative space with asymmetric balance, hierarchy, scale, rhythm and alignment.
- [Carbon: 2x Grid guidelines](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/guidelines) explains common alignment structures, hierarchy and layouts chosen for their content and purpose.
- [Carbon: Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) distinguishes detail-level spacing from larger density controls and allows asymmetrical fluid space.
- [Butterick: Page margins](https://practicaltypography.com/page-margins.html) connects margins with readable line length rather than one universally correct margin size.

For the portfolio, this is a research note about relationships and composition. It does not authorize changing spacing, adding content, centering everything, or applying a design-system spacing scale automatically.
