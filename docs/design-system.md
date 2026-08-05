# Recall Design Bible

This is the permanent visual specification for Recall. Every landing page section, every
documentation page, and every component — present and future — follows this document. If an
implementation detail and this document ever disagree, this document is right and the
implementation is filed as a bug.

This is a visual specification, not an implementation plan. It describes what things should look
like and feel like. It does not prescribe React structure, CSS mechanics, or file layout.

---

## 1. Brand Personality

Recall is infrastructure, not a product you "experience." A developer reads it, uses it, and goes
back to work. The design's job is to get out of the way of that.

**Recall should feel:**

- Calm — nothing on the page competes for attention with the content.
- Precise — every word, every spacing value, every color is deliberate.
- Confident — it doesn't need to convince you with effects; the substance does the convincing.
- Minimal — reduced to what's necessary, not decorated up to what's impressive.
- High-signal — a page communicates one primary thing, clearly, immediately.
- Engineering-first — it looks like it was designed by people who write the tool, not by people
  who market it.

**Words it should evoke:** deterministic, evidence, local-first, precise, quiet, trustworthy,
composable, legible, structural, honest.

**Words it should never evoke:** magical, revolutionary, disruptive, seamless (as a marketing
word), delightful, playful, viral, gamified, immersive, cutting-edge, next-generation.

**The test for every design decision:** would this look at home on Vercel's marketing site, the
Anthropic or OpenAI developer docs, Linear's product pages, or Stripe's documentation? If instead
it looks at home on an Awwwards showcase, a crypto landing page, or an agency portfolio, it's
wrong for Recall — no exceptions, no matter how well-executed.

---

## 2. Design Principles

1. **Content before decoration.** If a visual element doesn't carry information, it's a candidate
   for deletion. Decoration is not neutral — it's a claim on the reader's attention that has to be
   earned.
2. **Whitespace creates hierarchy, not color or size.** The primary tool for saying "this matters
   more" is space around it, not a louder color or a bigger font. Reach for spacing before reaching
   for a new visual weight.
3. **Typography is the primary visual tool.** Recall has almost no illustration, no iconography-led
   storytelling, and a single accent color. Nearly all visual hierarchy is carried by type: size,
   weight, color (foreground vs. muted), and measure (line length).
4. **Motion explains, it doesn't entertain.** An animation exists to clarify a state change (a copy
   button confirming, a menu opening) or is not used at all. If a motion's purpose can't be stated
   in one sentence ("this shows the command was copied"), remove it.
5. **Engineering over marketing.** Prefer a precise technical sentence over a persuasive one. Prefer
   a real terminal command over an illustrated diagram. Prefer a comparison table over an adjective.
6. **Every pixel justifies itself.** Nothing ships because "it looks nice." Every spacing value,
   every border, every shadow has a stated reason it exists (see the sections below — each visual
   rule comes with its rationale, and that rationale is what should be defended in review, not the
   pixel value itself).
7. **One accent, used sparingly.** Color is not a palette to explore; it's a signal. When
   everything is emphasized, nothing is. The accent exists to mark the one interactive or important
   thing on a screen, not to decorate several things at once.
8. **Consistency beats novelty.** A documentation page and a marketing page should feel like the
   same product designed by the same team on the same day — not two different aesthetics stitched
   together. New sections reuse existing patterns before inventing new ones.
9. **Never block on being impressive.** Recall's credibility comes from being deterministic,
   evidence-backed, and local — the design should never overstate or gesture at capability the
   product doesn't have (see Section 16).

---

## 3. Color System

Recall's palette is intentionally small: near-black, near-white, a narrow range of grays, and
exactly one accent hue. This is a deliberate rejection of "trendy" multi-gradient, multi-accent
developer-tool palettes — the goal is a page that reads as text first, color second.

Colors are expressed as design tokens (semantic names), never as raw hex/rgb values inside a
component. A token's *value* can change; its *name and meaning* should not.

| Token | Purpose | Why it exists |
| --- | --- | --- |
| **Primary background** | The page background. | Needs to be the single lowest-contrast surface on the page so everything else (text, cards, code) reads as "on top of" it. |
| **Secondary background** | A subtle surface used to separate a region (e.g. an alternating section, an inset panel) without introducing a border or shadow. | Gives layout structure at the surface level, before typography or spacing has to do all the work — used sparingly, never as decoration. |
| **Card** | Background for a bounded content unit (feature card, doc card, example card). | Distinct enough from the page background to read as "a discrete thing," subtle enough to never compete with the content inside it. |
| **Border** | Hairline dividers, card outlines, table rules, input outlines. | The primary structural tool instead of shadows — a 1px border is quieter and more precise than a drop shadow, and reads better in both themes. |
| **Muted** | Backgrounds for de-emphasized UI (disabled state fill, subtle hover fill, code inline background alternative). | A background that recedes — used when something needs a fill but must not draw the eye. |
| **Muted foreground** | Secondary/supporting text — captions, metadata, timestamps, helper text. | Establishes a clear two-level text hierarchy (primary text vs. everything else) without introducing a third color. |
| **Accent** | The single interactive/brand color: primary buttons, active nav state, links inside prose, focus indication paired with the ring. | Exists to answer exactly one question at a glance: "what can I click, and what's currently active?" Nothing else may use it. |
| **Success** | Confirmation states only (a command succeeded, a copy action completed, a check passed in a comparison table). | Needed sparingly for factual state, never for enthusiasm — a success color is a status report, not a celebration. |
| **Warning** | Non-blocking caution content in documentation (a callout about a deprecated flag, an alpha-status note). | Distinct from error — signals "read this carefully," not "something is broken." |
| **Error** | Failure states — a failed command in an example, a validation message, an error-exit-code callout in docs. | Reserved exclusively for genuine failure/danger; never reused for emphasis. |
| **Code background** | Background for code blocks, inline code, and terminal examples. | Deliberately distinct from both the page background and the card background — code is a *quoted, literal* thing and should read visually as a quotation, similar to how a blockquote differs from body text. |
| **Selection** | Text selection highlight (`::selection`). | An unstyled default text selection looks unfinished on a product this considered; the accent, at low opacity, quietly signals "this was designed," without doing more than any browser default already does. |
| **Focus ring** | Keyboard focus indicator on every interactive element. | Never optional, never subtle — see Section 13. Uses the accent color at full strength specifically because it must never be confused with a hover or muted state. |

### Light mode

- **Background:** near-white, not pure `#FFFFFF` — pure white next to near-black text produces
  more contrast than is comfortable for long reading sessions (documentation pages in particular).
- **Foreground:** near-black, not pure `#000000`, for the same reason in reverse.
- **Card / secondary background:** a whisper darker than the page background — just enough to
  read as a distinct surface under normal room lighting, without needing a border to notice it (a
  border is still present for definition at the edge, see Section 7).
- **Border:** a light, low-contrast gray — visible on close inspection, not visually "loud" from a
  normal reading distance.
- **Accent:** a single blue, chosen for: (a) sufficient contrast against both near-white and
  near-black text for buttons in either theme, (b) a hue that reads as "neutral technical," not
  "playful" (avoid saturated purples, pinks, or multi-hue gradients), (c) it is *not* the same blue
  as any well-known competing developer tool's primary brand color, to avoid visual confusion.

### Dark mode

Dark mode is not an inverted light mode — every value is independently tuned, not just flipped.

- **Background:** a near-black, not pure `#000000`. Pure black next to white text causes visible
  "halation" (a glow/vibration effect) for many readers, especially on OLED and high-contrast
  displays — a very dark gray avoids this while still reading as "dark mode," not "gray mode."
- **Foreground:** a near-white, not pure `#FFFFFF`, for the same halation reason.
- **Card / secondary background:** slightly lighter than the page background (the inverse
  relationship of light mode — in dark UI, elevated surfaces get *lighter*, matching how physical
  light behaves on a surface closer to a light source).
- **Border:** a mid-gray, tuned brighter than light mode's border relative to its own background,
  because dark surfaces need slightly more separation to read as distinct edges under typical
  screen brightness.
- **Accent:** the same hue as light mode, shifted lighter/more saturated so it maintains the same
  perceived intensity and passes the same contrast requirements against the dark background.

### Dark as the unset default

When a visitor has no saved theme preference, Recall defaults to dark. This is a considered choice
for a CLI/developer-tool product (the audience routinely works in dark terminals), not an
aesthetic default applied blindly — `prefers-color-scheme: light` and an explicit user choice are
always respected and persisted.

---

## 4. Typography

Typography carries almost the entire visual hierarchy of the product (Principle 3). Two type
families exist and no others are introduced without updating this document:

- **Sans** — the interface and prose typeface, used for everything except code.
- **Mono** — used exclusively for code, commands, file paths, flags, and technical identifiers
  referenced inline in prose (e.g. `.recall/manifest.json`, `--task`).

### Scale

| Role | Approximate size | Weight | Usage |
| --- | --- | --- | --- |
| Display / Hero headline | Largest on the page | Semibold | Marketing hero only — one per page, ever. |
| H1 | Large | Semibold | Page title — one per page. |
| H2 | Medium-large | Semibold | Major section heading. |
| H3 | Medium | Semibold | Subsection heading. |
| H4 | Slightly above body | Medium | Rare — a labeled group inside a subsection (e.g. a feature card title). |
| Body (default) | Base reading size | Regular | Prose, descriptions, documentation content. |
| Body (large) | Slightly above base | Regular | Hero subheading, section intros — used to slow the reader down at the top of a page. |
| Small / UI text | Below base | Regular/Medium | Navigation items, button labels, form labels. |
| Caption / metadata | Smallest | Regular | Timestamps, byline-style metadata, helper text under a field. |
| Code (inline) | Matches surrounding body size | Regular | Inline code references in prose. |
| Code (block) | Slightly below body | Regular | Terminal examples, JSON, config snippets. |

Rules governing the scale:

- Each step up the scale increases both size *and* weight together at the heading levels
  (H4→H1) — weight alone is never used to fake a size jump, and size alone is never used to fake
  emphasis a heavier weight should carry.
- No more than **three** distinct text sizes appear in the visible viewport of any single section.
  If a section needs a fourth, it's a sign the section is doing too much and should be split.
- Body text is never set smaller than the "Small / UI text" step — legibility is never sacrificed
  for density.

### Line height

- Headings: tight — line-height decreases as size increases, since large type needs
  proportionally less line spacing to read comfortably and tight leading reinforces a heading's
  visual weight.
- Body prose: generous — comfortable, "reading" line height, distinctly looser than heading
  line-height, tuned for sustained documentation reading rather than glanced UI text.
- UI text (buttons, nav, labels): snug — close to 1, since these are short single-line strings
  measured for alignment, not for reading flow.
- Code blocks: slightly looser than body prose — code needs visual room between lines so the eye
  can track indentation and match braces/brackets without the lines feeling cramped.

### Letter spacing

- Large headings (H1, hero): slightly tightened — big type has visually looser default spacing
  that tightening corrects for.
- Body text: default/untouched — deliberately not tightened or loosened; over-styled letter
  spacing on paragraph text is a common "designed too hard" tell this product avoids.
- All-caps labels (eyebrows, small category labels, badge text): slightly widened — all-caps text
  at default tracking reads as cramped; a small positive tracking value is required whenever text
  is set in all-caps, with no exceptions.
- Code: default/untouched — monospace fonts are metrically even by design; adjusting tracking on
  code actively hurts alignment.

### Paragraph and line-length rules

- **Maximum readable line length:** prose paragraphs are constrained to a comfortable reading
  measure — long enough to feel substantial, short enough that the eye never has to search for the
  start of the next line. This applies to marketing copy and documentation body text equally.
- **Headings** may run wider than body paragraphs, but a hero headline is still constrained to a
  maximum width well short of the full viewport — see Section 11.
- **Code blocks** are the one exception to the line-length rule: they scroll horizontally rather
  than wrap, so a long command or JSON line stays on one line and remains copy-paste accurate.

### Hierarchy rules

1. Every page has exactly one H1.
2. Heading levels are never skipped for visual effect (an H3 never appears directly under an H1
   without an H2 between them) — this is both a visual-consistency rule and an accessibility rule
   (Section 13).
3. Color, not size, is the *secondary* hierarchy signal: foreground text is "primary," muted
   foreground text is "supporting," and that is the entire color-based hierarchy — no third
   text color is introduced to create a middle tier.
4. Bold weight is reserved for true emphasis inside prose (a single key term or phrase) — never
   used to simulate a heading, and never applied to a full sentence or paragraph.

---

## 5. Layout System

### Container and content width

- A single, shared max-width container is used across marketing and documentation shells so both
  surfaces feel like one product. Documentation prose additionally constrains *text* to the
  narrower reading measure from Section 4 even inside the wider container (the sidebar and table
  of contents occupy the remaining width).
- Full-bleed elements (a section's background color, a border) may span the full viewport width;
  content inside always respects the container.

### Grid

- Feature grids and card grids use a simple, even column grid — no asymmetric or masonry layouts.
  Asymmetry reads as "designed for visual interest," which conflicts with Principle 1.
- Column count reduces predictably at each breakpoint (see Section 14) rather than reflowing into
  a different visual arrangement — a 3-column grid becomes 2, then 1; it does not rearrange into an
  unrelated layout.

### Vertical rhythm

- A single base spacing unit governs all vertical spacing decisions (margins, padding, gaps). Every
  spacing value used anywhere in the product is a multiple of that unit — no arbitrary one-off
  pixel values.
- Related elements (a heading and the paragraph directly under it) sit close together. Unrelated
  elements (the end of one section and the start of the next) sit far apart. The *ratio* between
  "close" and "far" spacing is what creates perceived grouping — it should be large and obvious,
  not subtle.

### Section spacing

- Marketing sections are separated by generous vertical padding plus a hairline top border — the
  border is the primary section delimiter (quiet, precise), the padding is what gives each section
  room to breathe. Sections are never separated by a background color change alone unless that
  section is deliberately using the secondary background as a callout (see Section 3).
- Section spacing is consistent across the entire page — no section gets more or less breathing
  room than another because it "feels like it needs it." If one section needs more space, that's a
  content problem (too much crammed into it), not a spacing problem.

### Card spacing

- Internal card padding is generous relative to the card's content — a card should never feel like
  its content is touching the edges.
- Gaps between cards in a grid are visually equal to (or slightly less than) a card's internal
  padding, so the grid reads as a set of related, evenly-weighted units rather than isolated boxes
  floating at random distances from each other.

### Breakpoints

Named, not numbered, in this document (exact pixel values are an implementation detail):

- **Mobile** — single column, stacked navigation.
- **Tablet** — begins introducing 2-column grids, sidebar navigation may collapse to a toggle.
- **Laptop** — the primary authoring viewport; full grid columns, persistent sidebar.
- **Desktop / wide** — content width caps out; extra horizontal space becomes margin, not more
  columns or larger content — Recall's content width has a firm upper bound so line length never
  degrades on large monitors.

---

## 6. Buttons

Buttons are the only UI element permitted to use a filled background color as its primary visual
weight (aside from the accent nav/link states) — this scarcity is what makes a button read as
"the one important action" wherever it appears.

- **Primary** — solid fill using the foreground/inverse-background pairing (near-black button on
  light mode, near-white button on dark mode) or the accent, reserved for the single most
  important action in a given context (e.g. "Get started" in the hero). At most one primary button
  is visible in a given viewport at once.
- **Secondary** — outlined (border only, transparent/background-matching fill), used for the
  second-priority action next to a primary button, or as the only button in a lower-stakes context.
- **Ghost** — no border, no fill, text-only until interacted with — used for tertiary actions
  inside toolbars, card footers, or dense UI where a bordered button would add visual noise.
- **Link** — styled as inline or standalone text with an underline (or underline-on-hover),
  used when an action is conceptually "navigation" rather than "action" — e.g. "Read more" inside a
  card.

Rules across all variants:

- **Hover** — a subtle, immediate shift (a slight fill/opacity or border-color change). No scale
  transform, no shadow pop, no color hue change — hover confirms interactivity, it does not
  perform.
- **Focus** — the standard focus ring (Section 3, Section 13) on every button variant, always,
  including ghost and link. No button is ever styled to suppress its focus indicator.
- **Disabled** — reduced opacity plus a non-interactive cursor; disabled buttons never simply
  disappear or change their label — the user should understand the action exists but isn't
  currently available.
- **Loading** — a button showing a loading state keeps its exact footprint (no layout shift) and
  replaces or accompanies its label with a minimal, non-decorative spinner — never a skeleton
  animation or a progress bar for a discrete action.
- **Icon placement** — an icon inside a button sits before the label for actions that "go
  somewhere" or "do something" (e.g. an arrow before "Get started" is wrong; an icon like a
  terminal glyph before a CLI-related action is acceptable), and after the label specifically for
  directional/navigational cues (an arrow after "Read more"). A button never uses an icon *instead
  of* a label unless the icon is universally unambiguous (e.g. a close "×") and has an accessible
  label regardless (Section 13).

---

## 7. Cards

Cards are the primary way Recall groups related, scannable content: features, documentation
entries, examples, comparison rows.

- **Feature cards** (marketing): title, short description, optional small icon — no imagery, no
  illustration, no background pattern.
- **Documentation cards** (e.g. "next steps" links at the bottom of a doc page): title, one-line
  description, and a directional affordance (an arrow) indicating it navigates somewhere.
- **Example cards**: a title/description pair directly above a command block (Section 8) — the
  card exists to give the example a labeled, bounded context, not to decorate the command itself.
- **Comparison cards/tables**: used for structural before/after or product-vs-alternative content
  (e.g. the CLAUDE.md/AGENTS.md vs. Recall comparison) — rendered as a table when the data is
  tabular, not force-fit into a card grid.

Shared rules:

- **Corner radius** — small and consistent across every card type in the product. A larger,
  "friendly" radius reads as consumer/marketing; Recall's radius is closer to a technical
  interface's — noticeable, not soft.
- **Padding** — generous and identical across card types of the same visual size class, so a page
  with mixed card types (e.g. feature cards next to doc cards) still feels like one system.
- **Border** — every card has a 1px border by default. Borders are the primary way a card
  separates from its background — this product does not rely on shadows for that job in its
  resting state.
- **Shadow** — none at rest. A card is not "floating" above the page; it's a bordered region of
  the same flat surface. Shadow may be introduced only for a genuinely elevated, temporary UI
  element (a dropdown, a dialog) — never for a static content card.
- **Hover** — for cards that are entirely clickable (e.g. a documentation link card), hover is
  limited to a border-color shift toward the foreground color and, optionally, a very subtle
  background tint. No lift/scale transform, no shadow introduction on hover. A card that is not
  clickable has no hover state at all — hover styling is a promise of interactivity and must never
  be applied to a non-interactive card.

---

## 8. Code Blocks

Code is core content for a CLI product, not a supporting visual — it should be given at least as
much design care as prose.

- **Terminal / CLI examples** — rendered as a single command or short sequence, always prefixed
  with a visual `$` (or equivalent) marker distinguishing typed input from output, using the code
  background token (Section 3), monospace type, and a copy button (below). No fake terminal
  chrome (no traffic-light window dots, no fake title bar) — Recall's command blocks represent a
  command to run, not a simulated application window.
- **JSON** — syntax-highlighted using a small, low-contrast highlighting palette layered on top of
  the code background — punctuation and keys are visually quieter than string/number values, so the
  *data* stands out over the *structure*. Highlighting colors are muted, never neon/high-saturation
  — they support reading, they don't decorate.
  block itself.
- **Markdown** (shown as literal source, e.g. explaining `.recall/`'s file format) — rendered the
  same as any other code block; Markdown source is not rendered as if it were the formatted output.
- **Copy button** — present on every standalone code/command block, positioned consistently (top
  right of the block), icon-only with an accessible label, switching to a brief confirmation state
  (a checkmark, using the success token) for a short, fixed duration after a successful copy — see
  Section 10 for exact motion rules.
- **Prompt blocks** (a full "ask your agent this" style example, if used in documentation) are
  visually distinguished from command blocks — a command block represents something the *user*
  types into a terminal; a prompt block represents something typed into an agent's chat interface.
  These must never look identical, or a reader will be unsure which surface a given block belongs
  to.
- **Inline code** — set in monospace at the surrounding text's size, on a subtle background fill
  (not the full code-block background token — a lighter-touch treatment reserved for short inline
  references like a flag name or file path), with no border.

---

## 9. Icons

Icons are used to **support** a label, never to **replace** meaning or to decorate a section for
visual variety.

**Where icons appear:**

- Inside buttons, when they clarify the action's nature (Section 6).
- Next to short UI labels where the icon reinforces an already-present text label (e.g. a small
  document glyph next to "Docs" in navigation, if used at all — and only ever paired with text,
  never alone in primary navigation).
- In the theme toggle, mobile menu toggle, and copy-to-clipboard affordance — functional,
  single-purpose UI controls where an icon is the established convention.
- In callout blocks in documentation (Section 12), to distinguish an info/warning/error callout at
  a glance, always paired with the callout's text content.

**Where icons never appear:**

- As decoration next to marketing headlines or section titles.
- As a substitute for a real product screenshot, diagram, or data visualization — Recall does not
  use an icon to gesture at a capability; it shows the real output (a real command, real JSON, a
  real comparison table).
- In feature grids as large, illustrative "hero" icons — a feature card's weight comes from its
  title and description (Section 4's typography-first principle), not from an icon rendered at a
  large size above it. A small, optional icon may accompany a feature card title at UI scale; it is
  never the dominant visual element of the card.
- Stacked, scattered, or floating as ambient background decoration anywhere on the site (this
  overlaps directly with Section 16's prohibitions).

**Style:** a single, consistent icon set across the entire product — never mixing icon families
or visual styles on the same page. Icons are line-based (stroke, not filled), matching the
product's overall "precise line, not solid shape" visual language (borders over shadows, outlined
secondary buttons over filled ones, stroke icons over filled glyphs).

**Stroke weight:** a consistent, moderate stroke width across every icon instance — never mixing
a thin decorative icon with a bold functional one on the same page.

**Size:** icons are sized relative to the text they sit next to (aligned to a UI text line-height),
never rendered dramatically larger than their accompanying label except in the rare, deliberate
case of a full-page empty/error state illustration substitute — which Recall currently has no need
for and should not introduce without updating this document.

---

## 10. Motion

Motion is used exactly where it clarifies a state change, and nowhere else (Principle 4).

**Allowed animations:**

- Micro-interactions confirming an action: a copy button flipping to a checkmark, a theme toggle
  changing icon.
- Opening/closing of transient UI: mobile navigation menu, a dropdown, a dialog, a docs sidebar
  collapsing on small viewports.
- A subtle color/opacity transition on hover for interactive elements (buttons, links, clickable
  cards) — confirming that the element responded to the pointer.
- A table-of-contents "active section" indicator moving as the reader scrolls through a
  documentation page — this is functional wayfinding, not decoration.

**Forbidden animations:**

- Any animation on page load that delays the reader from seeing content (fade-ins, staggered
  reveals, "typing" text effects on headlines).
- Scroll-triggered reveal animations on marketing sections (content fading/sliding in as the user
  scrolls) — every section is visible and fully rendered immediately; scrolling reveals content by
  virtue of scrolling, not by virtue of an animation permitting it to appear.
- Parallax of any kind.
- Looping/ambient animation (a pulsing glow, a slowly moving gradient, an animated background) —
  see Section 16.
- Hover effects that move, scale, rotate, or tilt an element (cards lifting, buttons growing).
  Recall's hover language is limited to color/opacity/border shifts (Sections 6 and 7).
- Decorative page-load "hero" animations (animated terminal typing out a command automatically,
  animated counters, animated illustrations).

**Duration and easing:** every motion in the product is short and quick to settle — long enough to
be perceptible as a state change, short enough to never feel like the interface is making the user
wait. Easing is smooth and standard (ease-out for things appearing/responding, ease-in-out for
things toggling between two states) — never a bouncy, elastic, or springy easing curve, which reads
as playful rather than precise.

**Page transitions:** none. Navigating between pages is instant, with no shared-element
transition, no fade-through, no loading-bar animation for a normal navigation. If a genuinely slow
operation exists (unlikely for a static content site), it gets a plain, minimal loading indicator,
not a branded transition.

**Reduced motion:** every animation in this section is disabled (or reduced to an instant
state-change with no transition) when the visitor has requested reduced motion at the OS level.
This is not an enhancement to add later — it is a baseline requirement for every motion rule
above, with no exceptions.

---

## 11. Hero Design

The hero is the single highest-leverage section on the site — most visitors will read it and
nothing else. Its job is to state what Recall is and let the reader act on that in under a few
seconds.

**Visual hierarchy (top to bottom):**

1. A short eyebrow label (small, muted-foreground or accent-colored, all-caps or sentence case,
   sitting clearly above the headline with a small, tight gap — it is a label *for* the headline,
   not an independent piece of content).
2. The headline — the single largest piece of text on the entire site.
3. The supporting description — one to two sentences, set at the "body large" scale from Section
   4, in muted-foreground color to keep it clearly secondary to the headline.
4. The CTA row — primary and secondary buttons, side by side.
5. The command example — the literal `npx recall-context init` command, in a command block
   (Section 8), positioned last so the reader's eye lands on it as the natural "next action" after
   reading the pitch and deciding to act.

**Spacing:** the hero has the most generous vertical spacing on the page — more top/bottom padding
than any other section — because it needs to feel like a deliberate opening statement, not another
item in a list of sections. Spacing *between* the hero's internal elements follows the same "close
means related" rule from Section 5: the eyebrow sits close to the headline; the CTA row sits
further from the description than the description sits from the headline, since the CTA is a
distinct, actionable unit rather than a continuation of the pitch.

**Headline width:** the headline is width-constrained well short of the full container — long
enough to hold the full statement on two lines at most on a typical desktop viewport, short enough
that it never approaches paragraph-length line width. A headline that wraps to more than two lines
on a normal desktop viewport is too long and should be shortened, not left to wrap further.

**Maximum text width:** the supporting description is constrained to the same reading-measure rule
as body prose (Section 4) — even though the hero has more available horizontal space than a
documentation paragraph, the description is not stretched to fill it.

**CTA positioning:** the primary and secondary CTAs sit directly beneath the description, aligned
to the same left edge as the headline and description (the hero is left-aligned, not centered —
centered hero text reads as consumer-marketing; left-aligned reads as a technical statement being
made directly to the reader). The primary CTA leads (appears first, reading-order-wise); the
secondary CTA (GitHub) sits immediately after it at the same vertical position, not stacked below.

**Terminal/command positioning:** the command block sits below the CTA row, not beside it and not
above the headline. It is visually the "proof" that follows the claim — the reader reads the
promise, sees the two ways to act on it (primary CTA, GitHub), and then sees exactly what running
it looks like. The command block is width-constrained to a modest fixed measure (noticeably
narrower than the full container) so it reads as a single, precise artifact rather than stretching
to fill the layout.

**What the hero explicitly does not include:** a product screenshot, an illustration, a background
gradient/pattern, an animated terminal typing effect, a video, or any social-proof element (star
count, download count, logo wall) — see Section 16.

---

## 12. Documentation Style

Documentation is a different *mode* of the same product, not a different product skin — shared
color tokens, shared type scale, shared component patterns (buttons, code blocks, cards) — but its
information density and navigation model differ deliberately from marketing pages.

**How documentation differs from marketing:**

- Marketing pages are read top-to-bottom, once. Documentation pages are scanned, searched, and
  returned to — the design optimizes for *finding* information over *narrating* it.
- Marketing uses generous whitespace and large type to slow the reader down and make a small
  amount of content feel considered. Documentation uses a denser, still-comfortable rhythm so a
  long reference page doesn't require excessive scrolling to convey a complete picture.
- Marketing rarely nests content more than one level; documentation is expected to have real
  hierarchy (H2s containing H3s containing code examples and callouts) and must display that
  hierarchy clearly via the sidebar and table of contents, not just via in-page headings.

**Typography:** the same sans/mono pairing and the same type scale as marketing (Section 4), but
documentation body copy sits at the "body (default)" size throughout — documentation prose is
never set at the "body large" marketing scale, since sustained reference reading benefits from a
slightly more compact, information-dense measure than a landing page's persuasive copy does.

**Spacing:** vertical rhythm within a doc page is tighter than a marketing section's rhythm
(Section 5) — related paragraphs, code examples, and their explanations sit close together so the
page reads as a continuous technical document rather than a series of separated "sections" the way
a marketing page's feature blocks do. Spacing *between* top-level H2 sections on a doc page is
still clearly larger than spacing within a section, preserving the same "close means related"
principle at a tighter scale.

**Sidebar:** persistent on wide viewports, showing the full page tree for the current documentation
section with the current page clearly indicated (via the accent color and/or a left-edge
indicator, not a filled background block that would compete with the accent's function elsewhere).
Collapses to an accessible toggle on narrower viewports (Section 14) rather than disappearing
without an equivalent.

**Navigation:** in addition to the sidebar, every doc page has previous/next navigation at the
bottom (simple bordered cards, following the documentation-card pattern from Section 7) and a
table of contents for the current page's own headings, typically alongside the content on wide
viewports. Breadcrumb-style context (which section a page belongs to) is conveyed by the sidebar's
tree structure rather than a separate breadcrumb component, to avoid two overlapping navigation
systems.

**Code examples:** identical visual treatment to Section 8, with one addition — documentation code
blocks may include a small language/context label (e.g. "bash", "json") in the block's header row,
since a reader jumping directly to a mid-page example benefits from that context that a marketing
page's single, obviously-a-terminal-command block doesn't need.

**Callouts:** a bordered, background-tinted block (using the muted background plus a colored
left-edge accent matching the callout's type — info uses the accent token, warning uses the
warning token, error/danger uses the error token) with a small icon (Section 9) and a label,
reserved for genuinely important asides — a required prerequisite, a note about alpha-status
behavior, a warning about a destructive command. Callouts are used sparingly; a documentation page
with more than one or two callouts usually means the content itself needs restructuring rather
than more callouts.

---

## 13. Accessibility

Accessibility is a design requirement, not a post-launch audit item — every rule above is written
to already comply with the rules below.

- **Contrast** — every foreground/background text pairing used anywhere in the product (both
  themes) meets WCAG AA contrast at minimum for body text, and AA for large text/UI components.
  The muted-foreground token is calibrated to still clear the minimum contrast requirement against
  its background — "muted" means de-emphasized, not illegible.
- **Keyboard** — every interactive element (buttons, links, the theme toggle, the mobile nav
  toggle, the search trigger, every sidebar/TOC link) is reachable and operable via keyboard alone,
  in a logical order, with no keyboard trap.
- **Focus order** — visual layout order and keyboard tab order match. A reader tabbing through the
  hero reaches the primary CTA before the secondary CTA, matching their left-to-right visual
  positioning (Section 11); a documentation page's tab order follows sidebar → content → table of
  contents (or the equivalent logical reading order for the current layout), never an order that
  visually "jumps around" the page.
- **Reduced motion** — every rule in Section 10 already specifies its reduced-motion behavior;
  there is no motion anywhere in the product that ignores this preference.
- **Screen readers** — icon-only controls (copy button, theme toggle, mobile menu toggle) always
  carry an accessible label describing their action ("Copy command," "Switch to dark theme," "Open
  menu"), not just a visual glyph. Decorative elements (an eyebrow's leading mark, a purely visual
  divider) are hidden from assistive technology rather than announced as meaningless content.
  Heading structure (Section 4, rule 2) exists precisely so screen-reader users can navigate the
  page by heading level, the same way a sighted user scans by visual hierarchy.
- **Touch targets** — every interactive element has a comfortably tappable area on touch devices,
  even where its visible content (an icon, a short label) is smaller — spacing around small
  controls (the copy button, nav toggles) accounts for this rather than relying on the visible
  glyph size alone.
- **Focus ring visibility** — restated from Section 3/6: the focus ring is never removed, dimmed,
  or replaced with a subtler alternative for aesthetic reasons, on any element, in any state.

---

## 14. Responsive Rules

These describe how the product should *look and behave* at each size — not how to implement it.

**Desktop / wide:** full multi-column feature grids, persistent documentation sidebar and table of
contents visible simultaneously alongside content, hero and section content sitting within the
capped maximum content width (Section 5) with visible margin on either side rather than stretching
to the edges of very large monitors.

**Laptop:** the primary reference viewport — everything described in this document at its intended
proportions. Grids remain multi-column; sidebar remains persistent; nothing is yet abbreviated or
hidden.

**Tablet:** feature and card grids reduce column count (e.g. three columns becomes two) rather than
shrinking card content to preserve three columns. The documentation sidebar may become a
collapsible panel behind a visible toggle rather than permanently persistent, but the table of
contents, when present, typically remains visible or easily reachable. Navigation may begin
collapsing secondary items behind a menu if the header would otherwise crowd.

**Mobile:** single-column throughout — feature grids, comparison content, and card grids all stack
vertically. Header navigation collapses entirely behind a mobile menu toggle (Section 9). The hero
remains left-aligned (not re-centered for mobile) and its command block scales down to the full
available width rather than staying at its desktop fixed measure. The documentation sidebar and
table of contents both move behind explicit toggles; only the current page's content is visible by
default. Touch targets throughout meet Section 13's requirement regardless of how compact the
surrounding layout becomes. Horizontal scrolling is permitted only for code blocks (Section 4) —
never for page layout itself.

Across every breakpoint: content never disappears, only its arrangement changes. If something is
hidden behind a toggle on mobile, an equivalent, reachable control exists — nothing is
desktop-only.

---

## 15. Component Philosophy

**When to create a new component:** only when an existing component genuinely cannot express the
new need — a new visual pattern that will be reused at least twice, or a structurally distinct
piece of UI (e.g. "callout" is a new component because nothing else in the system combines an
icon, a label, a colored edge, and body text). A one-off visual tweak to a single instance is not
sufficient justification for a new component; it's a sign the existing component needs a variant,
or the content needs to change to fit the existing pattern.

**When to reuse:** by default. Before designing a new visual treatment, check whether Section 6
(buttons), Section 7 (cards), Section 8 (code blocks), or Section 12 (callouts) already covers the
need. A new documentation page's "next steps" links reuse the documentation card pattern exactly —
they do not get a bespoke treatment because they appear on a new page.

**Naming conventions:** component names describe *what the thing is*, not *where it's used* or
*what it looks like* — `FeatureCard`, not `HomePageBox3`; `CommandBlock`, not `GrayCodeThing`. A
name should remain accurate even if the component is later reused somewhere its original name
didn't anticipate.

**Visual consistency rules:**

- A given pattern (button variant, card type, callout type) looks and behaves identically
  everywhere it appears — a secondary button in the docs sidebar looks exactly like a secondary
  button in the marketing hero, down to the pixel.
- New sections and new pages are built by composing existing components and this document's rules
  first. A genuinely new visual idea is added to this document *before* it's implemented broadly,
  so it becomes a documented system rule rather than a one-off that quietly drifts the product's
  visual language over time.
- If two similar-but-not-identical patterns emerge in the product (e.g. two slightly different card
  border-radius values), that is treated as a bug to reconcile against this document, not as two
  legitimate variants.

---

## 16. Things Recall Never Does

These are not style preferences — they are hard constraints, because each one either misrepresents
the product or works against the calm, precise, evidence-backed identity defined in Section 1.

- **No glassmorphism** — no frosted/translucent blurred panels. Recall's surfaces are opaque and
  bordered (Section 7), not "floating glass."
- **No floating blobs** — no ambient decorative gradient shapes drifting or sitting behind content.
- **No background videos** — nothing auto-plays behind or around content, ever.
- **No meaningless gradients** — a gradient is not used purely for visual richness. If a gradient
  ever appears, it must serve an actual functional purpose (e.g. a fade-to-transparent edge on a
  horizontally scrolling code block, purely to hint at truncated content) — decorative hero
  gradients, button gradients, and background gradients are not used.
- **No fake dashboards** — no illustrated "product UI" mockups showing a dashboard, chart, or
  interface Recall does not actually have. Every visual "screenshot"-like element in the product
  must be a real, accurate representation of real output (a real terminal command, real generated
  Markdown/JSON).
- **No stock illustrations** — no generic developer/tech illustration art, no abstract vector
  people, no isometric-office-scene graphics.
- **No fake testimonials** — no quotes, avatars, or company logos representing users or customers
  unless they are real, verified, and the person/company has explicitly agreed to be featured.
- **No fake GitHub stars, download counts, or adoption numbers** — no social-proof metric is
  displayed anywhere on the site unless it is real, currently accurate, and sourced live or updated
  deliberately — never a hardcoded, aspirational, or estimated number.
- **No inflated performance claims** — no unqualified "10x faster," "instant," or unverified speed
  claims. If a performance statement is made, it is specific, true, and ideally sourced (e.g. "a
  local, deterministic scan" is factual; "blazing fast" is not).
- **No "AI magic"** — Recall does not describe its own behavior in mystified, black-box language.
  Every claim about what Recall does is explainable in plain, literal terms (this mirrors the
  product's own design principle of evidence-backed, explainable output — the marketing site must
  hold itself to the same standard the product does).

**The underlying rule beneath all of the above: everything on the site must be factual.** If a
sentence, a number, a visual, or an implied capability cannot be verified against what Recall
actually does today, it does not ship — regardless of how effective it might be as marketing.
