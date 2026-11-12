---
name: Leash
description: A spending firewall between an AI shopping agent and PayPal, styled like a bank.
colors:
  canvas: "#f2f0e9"
  surface: "#faf9f5"
  surface-2: "#e9e6dc"
  sunken: "#ebe8df"
  ink: "#0b2048"
  ink-2: "#3b4763"
  ink-3: "#5a6479"
  line: "#dedad0"
  line-strong: "#c9c4b5"
  hold-lime: "#b9f13f"
  hold-lime-text: "#4b6b00"
  hold-lime-soft: "rgba(185,241,63,0.35)"
  ok: "#096b60"
  ok-soft: "#dcefe9"
  bad: "#b0302a"
  bad-soft: "#f8e6e2"
  warn: "#875800"
  warn-soft: "#f6ead0"
  term: "#0b2048"
  canvas-dark: "#0b2048"
  surface-dark: "#102857"
  surface-2-dark: "#163165"
  sunken-dark: "#08193b"
  ink-dark: "#f2f0e9"
  ink-2-dark: "#c4c9d6"
  ink-3-dark: "#9ba4bc"
  line-dark: "#1d3a70"
  line-strong-dark: "#2a4a86"
  hold-lime-dark: "#b9f13f"
  ok-dark: "#5ad6c3"
  bad-dark: "#ff9385"
  warn-dark: "#f2c25c"
  term-dark: "#08193b"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "44px / 64px (sm) / 84px (lg)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.625
  figure:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 400
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.hold-lime}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-quiet:
    textColor: "{colors.ink-2}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  button-quiet-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  badge-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-bad:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-hold:
    backgroundColor: "{colors.hold-lime-soft}"
    textColor: "{colors.hold-lime-text}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-muted:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  chip-off:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  notice-bad:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  code-well:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.xl}"
    padding: "12px"
  terminal:
    backgroundColor: "{colors.term}"
    rounded: "{rounded.xl}"
    padding: "14px"
---

# Design System: Leash

## Overview

**Creative North Star: "The Quiet Ledger"**

Leash looks like a bank statement that happens to be live. Soft pearl paper (midnight in dark mode), Geist set tight and dark, money in tabular mono, and every line of the story separated by a single hairline rule. The system is calm on purpose: the product's whole claim is that nothing surprising happens to your money, so the interface never raises its voice. Density is moderate; panels hold ledgers, not decoration.

Color is spent like money. One neon lime marks the hold (the authorized but uncharged budget, and what is released back). Green and red appear only where money is decided: captured or blocked. Amber is the warning voice for injected text, allergens, and pending states. Everything else is ink on neutrals. The one expressive object is the hold itself, rendered as a slow, real-time 3D stack of coins cinched by an lime bank strap, with released coins lifting out.

The palette is user-set: deep midnight #0b2048, soft pearl #f2f0e9 and neon lime #b9f13f. Lime is used as a flat fill (primary buttons, the coin strap, step markers, progress) and as text only on midnight; on pearl, lime-coloured text uses the olive #4b6b00 so it stays readable. The neon never glows: no gradients, glows, or glassy fields. Light and dark themes are both first-class and swap through the same token names.

**Key Characteristics:**
- Cool neutral canvas with white cards; dark theme is deep midnight #0b2048.
- One accent (lime) bound to the hold; status colors bound to money decisions.
- Hairline ledgers: label left, mono figure right, a 1px rule between rows.
- Pill buttons and outline chips; status is a dot and a word, never a filled pill; 12px rounding on containers, no shadows.
- Geist for words, Geist Mono with tabular numerals for every figure and identifier.
- One 3D hero object (the hold), reused small as a settlement receipt.

## Colors

A restrained neutral palette with a single lime and three semantic status voices. Soft tints back only error and warning notices; status itself is colored text with a dot.

### Primary
- **Hold Lime** (`hold-lime` #3d49d6 light / `hold-lime-dark` #8f98ff dark): the PayPal hold and only the hold. Authorized amount, "Active hold" badge, released-to-you figures, the bank strap and released coins on the 3D object, the ring in the logo mark, focus rings, text selection (soft tint), and the AG Grid accent. Its soft tint (`hold-lime-soft`, 12% alpha of the dark value in dark mode) backs hold badges and the field focus ring.

### Secondary
- **Captured Green** (`ok` #0c7a51 / #4fc89b): money approved and captured; passed checks; healthy connection dots; completed stepper steps.
- **Blocked Red** (`bad` #b5312a / #f2806f): money blocked, vetoed, or a broken chain; error notices. Struck-through amounts use a 60% red decoration.

### Tertiary
- **Warning Amber** (`warn` #855600 / #e9b64c): injected page text, allergen exclusions, "Awaiting approval", the Poisoned store toggle, degraded-mode dots. Never used for money outcomes.

### Neutral
- **Cool Paper** (`canvas` #f6f7f9 / #0a0b0d): page background and the frosted sticky header (85% with backdrop blur).
- **Card White** (`surface` #ffffff / #111317): cards, fields, secondary buttons, modal.
- **Hover Grey** (`surface-2` #f1f2f5 / #181b20): hover fill for secondary/quiet buttons and chips; muted badges.
- **Sunken Well** (`sunken` #eef0f3 / #0d0f12): code and JSON wells, page-source excerpts, AG Grid dark header.
- **Ink** (`ink` #0e1014 / #eceef1): primary text, primary button fill, active chip/tab/stepper fill.
- **Ink 2** (`ink-2` #4a505c / #a7adb9): secondary text, labels, ledger labels, lead paragraph.
- **Ink 3** (`ink-3` #656b77 / #8b919d): tertiary text, hints, zero-value figures, the dimmed second line of the hero headline.
- **Hairline** (`line` #e3e5ea / #22262d): every ledger rule, card border, section divider.
- **Strong Hairline** (`line-strong` #d0d4db / #30353e): field and secondary-button borders, inactive chip borders, the settlement total rule, stepper connectors.
- **Terminal** (`term` #0e1014 / #07080a): retained token; the agent log now renders as a Sunken Well in the active theme.

### Named Rules
**The Hold Owns Lime Rule.** Lime means "held or released back to you." If an element is not about the hold (or is not a focus ring), it is not lime.

**The Money Decides Color Rule.** Green and red are reserved for outcomes on money and checks: captured/passed, blocked/vetoed. Warnings, pending states, and attack text use amber; neutral status uses the muted badge.

**The Zero Goes Grey Rule.** A ledger figure takes its semantic color only when nonzero; a zero amount drops to Ink 3.

**The Quiet Log Rule.** The agent log is a Sunken Well in the active theme: Ink text, Ink 3 timestamps, Amber only for hidden instructions the agent read, green and red only for done and error. No icons, no dark block.

## Typography

**Display Font:** Geist (with ui-sans-serif, system-ui, -apple-system, Segoe UI)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, Menlo)

**Character:** One neo-grotesk family across the whole ramp, tightened at the top and left neutral below, paired with its own mono for figures. It reads as a financial product, not an editorial one.

### Hierarchy
- **Display** (500, 44px / 64px at sm / 84px at lg, line-height 1.0, -0.04em): the single hero headline. The second line drops to Ink 3 for the counter-phrase.
- **Headline** (500, 24px, -0.02em): section titles such as "Live demo".
- **Title** (600, 15px, -0.01em): panel heads; the brand name in the header.
- **Lead** (400, 17px, relaxed 1.625, max ~34rem): the hero promise paragraph only.
- **Body** (400, 15px): document base size.
- **Body small** (400, 14px): buttons, fields, ledger values, notices, explanatory lines.
- **Label** (500, 13px, Ink 2): form labels, ledger row labels, verdicts, stepper.
- **Caption** (400, 12px and 11px, Ink 3): hints, panel-head descriptions, references, column headers. Sentence case, no tracking.
- **Figure** (Geist Mono, tabular numerals, tight tracking): every dollar amount, count, ID, hash, and timestamp, at whatever size its context needs (up to 24px for settlement totals, 20px for the authorized hold).

### Named Rules
**The Mono Figures Rule.** Any number a user might compare or verify (money, quantities, PayPal IDs, hashes, times) is set in Geist Mono with tabular numerals. Words never are.

**The Sentence Case Rule.** Headings, labels, and column headers are sentence case with no added letter-spacing. Hierarchy comes from size, weight, and ink level, not caps.

## Layout

A centered container (max 1320px; 16px gutters, 24px from 640px) under a 56px sticky header. The hero is a two-column grid from 768px (1.05fr text / 1fr object, 32px gap), with the 3D object ordered first on mobile and capped at 260px there (540px on desktop). The demo is a 12-column grid from 1024px split 4 / 5 / 3 (mandate, store, hold), 16px gaps, with the hold card sticky at 80px from the top. Below the demo, full-width ledger sections (firewall, audit trail, isolation) stack with 56px gaps.

Rhythm is a 4px base: 8-12px inside rows, 20-24px card padding, 40px section top padding, 64px between major blocks. Sections are introduced by a hairline top border plus 24-40px padding rather than by boxes; only the three interactive demo panels and the modal are cards. Wide tables scroll horizontally inside their section (firewall grid min 780px) rather than reflowing.

## Elevation & Depth

Flat. Depth comes from tonal layering (canvas, white card, sunken well) and 1px hairlines; nothing casts a shadow. The modal scrim is Ink at 40%. The only real depth in the product is the 3D hold object, which casts its own soft radial ground shadow.

### Named Rules
**The No Shadow Rule.** Nothing in the interface casts a shadow. Cards are a white plane with a hairline; state is shown with ink level, underline, and a 1px press.

## Shapes

Two shape families. Buttons, chips and modal tabs are full pills; status is a 6px dot beside its word; toggles and the stepper are underlined text. Containers are softly rounded rectangles: 12px for cards, the modal, fields, notices, code wells, and the agent log, 8px/12px for AG Grid cells and wrapper, 6px for the focus outline. Borders are always 1px hairlines. The logo mark is a 9/32-rounded ink square holding an lime ring, echoing the strap around the coins.

## Components

### Buttons
Quiet, confident pills that press rather than glow.
- **Shape:** full pill (9999px), 14px medium text, 8px icon gap, 16px Lucide icons.
- **Primary:** Ink fill with Canvas text (inverts in dark mode); 10px 16px, enlarged to 12px 20px for hero actions.
- **Secondary:** Card White with a Strong Hairline border and Ink text; hover to Hover Grey.
- **Quiet:** borderless Ink 2 text, 6px 12px; hover fills Hover Grey and darkens to Ink. Used for header actions and the modal close; icon-only on mobile with text from 640px.
- **Hover / Focus / Active:** primary hover drops to 90% opacity; all buttons translate down 1px on press; 150ms transitions; disabled at 40% opacity with a not-allowed cursor; focus is a 2px lime outline at 2px offset.

### Chips
- **Style:** 12px medium pill, 4px 10px, Hairline border, Ink 3 text, hover to Ink 2.
- **State:** selected chips take an Ink border and Ink text (Amber for allergen chips); never a solid fill. The Clean / Poisoned toggle is underlined text: the selected word in Ink with a 1px Ink underline, the other in Ink 3.

### Badges
- **Style:** 12px medium text preceded by a 6px dot in currentColor: ok, bad, hold, warn, muted (Ink 3). No background, no icon. Used only for statuses (Signed, Settled, chain intact); lists of values such as categories or allergens are plain comma-separated text.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Card White on Cool Paper.
- **Shadow Strategy:** none.
- **Border:** 1px Hairline.
- **Internal Padding:** 20px, 24px from 640px.
- Panel heads: 15px semibold title, optional 13px Ink 3 description, an aside (badge, toggle, or button) aligned right, 20px below.

### Inputs / Fields
- **Style:** 1px Strong Hairline, Card White, 12px radius, 10px 14px padding, 14px Ink text, Ink 3 placeholder. Money inputs use Figure type.
- **Focus:** border shifts to Hold Lime with a 4px Hold Lime soft ring.
- **Disabled:** inherits disabled controls while the agent runs.

### Navigation
A 56px sticky header on 85% Canvas with backdrop blur and a hairline bottom border: logo mark plus "Leash" left; right, a 12px Ink 3 health readout (1.5px status dots, green when real, amber when degraded, slash-separated) visible from 768px, then quiet buttons for audit log, reset, source, and theme toggle.

### Ledger Row (signature)
The system's core pattern. A label left (13px, Ink 2 or Ink 3) and a mono figure right, baseline-aligned, 10-12px vertical padding, separated by a 1px Hairline with the last row unruled. Used for the mandate rules, the PayPal hold, references, and the firewall line grid. Totals sit under a Strong Hairline.

### Stepper
Five words in a row, 20px apart. The current step is Ink, medium weight, with a 1px Ink underline; completed steps are Ink 2; future steps are Ink 3. No numbers, dots, or checks.

### Hold Object (signature)
A Three.js stack of brushed grey coins cinched by an lime bank strap. Released coins lift out and tint toward lime. `loop` mode (hero) plays a 6s rest-release-settle cycle with slow auto-rotation and slight pointer parallax; `settle` mode (112px settlement receipt) plays once and holds the final captured/released split. Respects reduced motion (static pose) and pauses offscreen.

### Footer (user-pinned)
The HalftoneWordmarkFooter renders a dot-halftone "leash" wordmark (Geist 700) with link columns, fed the theme palette: light background #eceef2 with Ink and Hold Lime dots, dark background #07080a with #d9dce2 ink and #8f98ff. It keeps its own internal type styling; treat it as a fixed asset, not a source of new rules.

### Code Well and Terminal
JSON excerpts sit in Sunken Well boxes (12px radius, hairline border, 11.5-12px mono, Ink 2). Injected page text is a quote: 1px Amber rule on the left, mono Ink 2 text, an Ink 3 'Simulated …' attribution. The agent log is a Sunken Well with a hairline header rule and 12px mono lines (see the Quiet Log Rule).

## Do's and Don'ts

### Do:
- **Do** reserve Hold Lime for the hold, released money, and focus.
- **Do** set every figure, ID, and hash in Geist Mono with tabular numerals.
- **Do** separate rows with 1px hairlines and introduce sections with a hairline top border instead of a new card.
- **Do** use pills only for buttons and chips; show status as a dot and a word; round containers 12px.
- **Do** define every new color as a token in both light and dark themes so the toggle swaps it in one place.
- **Do** animate entrances with the single rise motion (6px up, 0.5s, cubic-bezier(0.16, 1, 0.3, 1)) and honor reduced motion.
- **Do** label simulated data as simulated, in the same quiet caption voice as real data.

### Don't:
- **Don't** use gradients, glows, or glassy fields, and never set lime text on pearl (use the olive text token).
- **Don't** use green or red for anything that is not a money or check outcome; warnings are amber.
- **Don't** add a second accent hue, any shadow, filled status pills, or icons inside data rows.
- **Don't** add uppercase, letter-spaced eyebrow or kicker labels above headings; hierarchy is size, weight, and ink. (The user-pinned halftone footer's own mono caps column labels stay inside that component and are not a pattern to copy.)
- **Don't** add another 3D or illustrative hero object; the hold is the one expressive object.
- **Don't** set prose or in-app labels in mono.

## 2026-11 revision: PayPal-scale type, glass, and a 3D world (user-set)

This revision is the owner's brief and overrides the older flat rules above where they conflict.

- **Scale.** Body is 17px. Headlines are bold (700) and centred: hero up to 96px, section heads 40-60px, panel heads 22px. Buttons are large pills (16px semibold; the hero action is 18px).
- **Glass.** Panels are glass planes: `--glass` fill, a bright 1px `--glass-edge`, `backdrop-filter: blur(30px) saturate(1.2)`, 28px radius, and `--glass-shadow` (inner top highlight plus a soft drop). The No Shadow Rule no longer applies to cards. Glass is kept dense enough (62-68%) that text stays AA over the 3D world.
- **3D world.** `World3D` pins one canvas behind the page between the tunnel and the footer: coins, a lime leash ring, a payment card, a padlock, a glass shield and a shopping bag drift and slide past on scroll. It never sits behind the tunnel or the footer, pauses off screen, and holds still under reduced motion.
- **3D cards.** `Tilt` leans a card toward the pointer (6-9 degrees) with a soft glare; children with `.pop` sit proud of the surface. Used for the hero statement, recent sessions and the three walls. Form panels do not tilt.
- **Fixed assets.** The perspective tunnel, the halftone footer and the mascot are user-pinned and unchanged.

## 2026-11 revision 2: PayPal colour scheme (user-set)

The midnight/pearl/lime palette above is replaced by PayPal's colours. Token names in `frontend/src/index.css` are the source of truth.

- **Light:** canvas #f5f7fa, cards white, ink #001435, lines #dbe2ea.
- **Dark:** canvas PayPal navy #001c64, surfaces #06287a / #0c3594, ink white.
- **Brand blue (`--brand`, fill):** #0070e0 in light, sky #6cc3ff in dark. The hold strap, leash ring, finished step markers, icon tiles, the active-panel outline.
- **Blue text (`--accent`):** #0064d2 in light, #6cc3ff in dark. Held and returned money.
- **Gold (`--cta`):** #ffc439 with #001435 text. Primary buttons and the current step marker only, like PayPal's own checkout button.
- **Money outcomes:** paid green #0a7a45 / #5fdc9e, refused red #c0261d / #ff9a8f. Warnings and traps are orange #9a4b00 / #ffb37a so they never read as the gold button.
- All text pairs pass WCAG AA in both themes.

## 2026-11 revision 3: clay cards

Cards moved from glass to clay at the user's request. The palette, type and layout are unchanged.

- **Material:** every panel is a solid slab (`--clay`: white in light, `#0a2f8a` in dark) with no blur or transparency. Depth comes from three shadows in `--clay-shadow`: a highlight inside the top edge, a blue-tinted shade inside the bottom edge, and a deep soft drop underneath.
- **Shape:** `--card-radius` is 36px (was 28px) for the `card` utility, the recent-session cards and the tilt glare. The status bar uses the `clay` utility with its own 28px radius.
- **Recent sessions:** each card's clay is tinted 8% toward its money-state colour (green settled, blue held, orange waiting, red revoked).
- **Unchanged:** the tunnel's listing cards, the footer and the mascot. The 3D world now shows around and between cards instead of through them.
