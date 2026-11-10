---
name: Leash
description: A spending firewall between an AI shopping agent and PayPal, styled like a bank.
colors:
  canvas: "#f6f7f9"
  surface: "#ffffff"
  surface-2: "#f1f2f5"
  sunken: "#eef0f3"
  ink: "#0e1014"
  ink-2: "#4a505c"
  ink-3: "#656b77"
  line: "#e3e5ea"
  line-strong: "#d0d4db"
  hold-indigo: "#3d49d6"
  hold-indigo-soft: "#eceefc"
  ok: "#0c7a51"
  ok-soft: "#e6f3ed"
  bad: "#b5312a"
  bad-soft: "#fbebe9"
  warn: "#855600"
  warn-soft: "#faf1dc"
  term: "#0e1014"
  canvas-dark: "#0a0b0d"
  surface-dark: "#111317"
  surface-2-dark: "#181b20"
  sunken-dark: "#0d0f12"
  ink-dark: "#eceef1"
  ink-2-dark: "#a7adb9"
  ink-3-dark: "#8b919d"
  line-dark: "#22262d"
  line-strong-dark: "#30353e"
  hold-indigo-dark: "#8f98ff"
  ok-dark: "#4fc89b"
  bad-dark: "#f2806f"
  warn-dark: "#e9b64c"
  term-dark: "#07080a"
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
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
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
    backgroundColor: "{colors.hold-indigo-soft}"
    textColor: "{colors.hold-indigo}"
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

Leash looks like a bank statement that happens to be live. Cool neutral paper, Geist set tight and dark, money in tabular mono, and every line of the story separated by a single hairline rule. The system is calm on purpose: the product's whole claim is that nothing surprising happens to your money, so the interface never raises its voice. Density is moderate; panels hold ledgers, not decoration.

Color is spent like money. One indigo marks the hold (the authorized but uncharged budget, and what is released back). Green and red appear only where money is decided: captured or blocked. Amber is the warning voice for injected text, allergens, and pending states. Everything else is ink on neutrals. The one expressive object is the hold itself, rendered as a slow, real-time 3D stack of coins cinched by an indigo bank strap, with released coins lifting out.

The system explicitly refuses the neon "AI startup" look: no gradients, glows, or glassy purple fields. Light and dark themes are both first-class and swap through the same token names.

**Key Characteristics:**
- Cool neutral canvas with white cards; dark theme is near-black, not navy.
- One accent (indigo) bound to the hold; status colors bound to money decisions.
- Hairline ledgers: label left, mono figure right, a 1px rule between rows.
- Pill buttons, pill badges, pill chips; 12-16px rounding on containers.
- Geist for words, Geist Mono with tabular numerals for every figure and identifier.
- One 3D hero object (the hold), reused small as a settlement receipt.

## Colors

A restrained neutral palette with a single indigo and three semantic status voices, each paired with a soft tint for badges and notices.

### Primary
- **Hold Indigo** (`hold-indigo` #3d49d6 light / `hold-indigo-dark` #8f98ff dark): the PayPal hold and only the hold. Authorized amount, "Active hold" badge, released-to-you figures, the bank strap and released coins on the 3D object, the ring in the logo mark, focus rings, text selection (soft tint), and the AG Grid accent. Its soft tint (`hold-indigo-soft`, 12% alpha of the dark value in dark mode) backs hold badges and the field focus ring.

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
- **Terminal** (`term` #0e1014 / #07080a): the agent log pane, dark in both themes.

### Named Rules
**The Hold Owns Indigo Rule.** Indigo means "held or released back to you." If an element is not about the hold (or is not a focus ring), it is not indigo.

**The Money Decides Color Rule.** Green and red are reserved for outcomes on money and checks: captured/passed, blocked/vetoed. Warnings, pending states, and attack text use amber; neutral status uses the muted badge.

**The Zero Goes Grey Rule.** A ledger figure takes its semantic color only when nonzero; a zero amount drops to Ink 3.

**The Always-Dark Terminal Rule.** The agent log is dark in both themes and uses the dark-theme status values (amber #e9b64c, green #4fc89b, red #f2806f) on white-alpha text (30-85%).

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

Nearly flat. Depth comes from tonal layering (canvas, white card, sunken well) and hairlines. Cards carry one soft ambient shadow; nothing else is shadowed. In dark mode the shadow becomes a 3% white inner top highlight plus a deep diffuse drop. The modal scrim is Ink at 40%. The only real depth in the product is the 3D hold object, which casts its own soft radial ground shadow.

### Shadow Vocabulary
- **Card ambient, light** (`box-shadow: 0 1px 2px rgb(14 16 20 / 0.04), 0 8px 24px -12px rgb(14 16 20 / 0.08)`): cards and the modal.
- **Card ambient, dark** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.03) inset, 0 12px 32px -16px rgb(0 0 0 / 0.6)`): the same role in dark mode.

### Named Rules
**The One Shadow Rule.** There is a single shadow token and it belongs to cards. Buttons, badges, and fields never cast shadows; state is shown with fill, opacity, and a 1px press.

## Shapes

Two shape families. Interactive and status elements are full pills: buttons, badges, chips, segmented toggles, tabs, stepper steps, and status dots. Containers are softly rounded rectangles: 16px for cards and the modal, 12px for fields, notices, code wells, and the terminal, 8px/12px for AG Grid cells and wrapper, 6px for the focus outline. Borders are always 1px hairlines. The logo mark is a 9/32-rounded ink square holding an indigo ring, echoing the strap around the coins.

## Components

### Buttons
Quiet, confident pills that press rather than glow.
- **Shape:** full pill (9999px), 14px medium text, 8px icon gap, 16px Lucide icons.
- **Primary:** Ink fill with Canvas text (inverts in dark mode); 10px 16px, enlarged to 12px 20px for hero actions.
- **Secondary:** Card White with a Strong Hairline border and Ink text; hover to Hover Grey.
- **Quiet:** borderless Ink 2 text, 6px 12px; hover fills Hover Grey and darkens to Ink. Used for header actions and the modal close; icon-only on mobile with text from 640px.
- **Hover / Focus / Active:** primary hover drops to 90% opacity; all buttons translate down 1px on press; 150ms transitions; disabled at 40% opacity with a not-allowed cursor; focus is a 2px indigo outline at 2px offset.

### Chips
- **Style:** 12px medium pill, 4px 10px, Strong Hairline border, Ink 2 text, hover Hover Grey.
- **State:** selected fills Ink with Canvas text; selected warning chips (allergens) fill Amber. Segmented toggles (Clean / Poisoned) and modal tabs follow the same on/off logic inside a hairline pill track.

### Badges
- **Style:** 12px medium pill, 2px 8px, soft tint background with full-strength text: ok, bad, hold, warn, muted. Optional 14px leading icon. Badges carry decisions and statuses; they are never decorative labels.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Card White on Cool Paper.
- **Shadow Strategy:** the single card ambient shadow (see Elevation & Depth).
- **Border:** 1px Hairline.
- **Internal Padding:** 20px, 24px from 640px.
- Panel heads: 15px semibold title, optional 13px Ink 3 description, an aside (badge, toggle, or button) aligned right, 20px below.

### Inputs / Fields
- **Style:** 1px Strong Hairline, Card White, 12px radius, 10px 14px padding, 14px Ink text, Ink 3 placeholder. Money inputs use Figure type.
- **Focus:** border shifts to Hold Indigo with a 4px Hold Indigo soft ring.
- **Disabled:** inherits disabled controls while the agent runs.

### Navigation
A 56px sticky header on 85% Canvas with backdrop blur and a hairline bottom border: logo mark plus "Leash" left; right, a 12px Ink 3 health readout (1.5px status dots, green when real, amber when degraded, slash-separated) visible from 768px, then quiet buttons for audit log, reset, source, and theme toggle.

### Ledger Row (signature)
The system's core pattern. A label left (13px, Ink 2 or Ink 3) and a mono figure right, baseline-aligned, 10-12px vertical padding, separated by a 1px Hairline with the last row unruled. Used for the mandate rules, the PayPal hold, references, and the firewall line grid. Totals sit under a Strong Hairline.

### Stepper
Five pill steps joined by 20px Strong Hairline connectors. Current step fills Ink; completed steps show a green numbered dot with a check; future steps are Ink 3 with a hairline-ringed number.

### Hold Object (signature)
A Three.js stack of brushed grey coins cinched by an indigo bank strap. Released coins lift out and tint toward indigo. `loop` mode (hero) plays a 6s rest-release-settle cycle with slow auto-rotation and slight pointer parallax; `settle` mode (112px settlement receipt) plays once and holds the final captured/released split. Respects reduced motion (static pose) and pauses offscreen.

### Footer (user-pinned)
The HalftoneWordmarkFooter renders a dot-halftone "leash" wordmark (Geist 700) with link columns, fed the theme palette: light background #eceef2 with Ink and Hold Indigo dots, dark background #07080a with #d9dce2 ink and #8f98ff. It keeps its own internal type styling; treat it as a fixed asset, not a source of new rules.

### Code Well and Terminal
JSON and page-source excerpts sit in Sunken Well boxes (12px radius, hairline border, 11.5-12px mono, Ink 2; injected text in Amber). The agent log is an always-dark Terminal pane with a white-10% header rule and 12px mono lines.

## Do's and Don'ts

### Do:
- **Do** reserve Hold Indigo for the hold, released money, and focus.
- **Do** set every figure, ID, and hash in Geist Mono with tabular numerals.
- **Do** separate rows with 1px hairlines and introduce sections with a hairline top border instead of a new card.
- **Do** use pill shapes for anything clickable or status-bearing, and 12-16px rounding for containers.
- **Do** define every new color as a token in both light and dark themes so the toggle swaps it in one place.
- **Do** animate entrances with the single rise motion (6px up, 0.5s, cubic-bezier(0.16, 1, 0.3, 1)) and honor reduced motion.
- **Do** label simulated data as simulated, in the same quiet caption voice as real data.

### Don't:
- **Don't** use gradients, glows, neon, or glassy purple fields; this is the "AI startup" look the product refuses.
- **Don't** use green or red for anything that is not a money or check outcome; warnings are amber.
- **Don't** add a second accent hue or a second shadow.
- **Don't** add uppercase, letter-spaced eyebrow or kicker labels above headings; hierarchy is size, weight, and ink. (The user-pinned halftone footer's own mono caps column labels stay inside that component and are not a pattern to copy.)
- **Don't** add another 3D or illustrative hero object; the hold is the one expressive object.
- **Don't** set prose or in-app labels in mono.
