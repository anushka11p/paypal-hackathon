---
target: the whole Leash page
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-11-11T18-40-58Z
slug: frontend-src-app-jsx
---
Method: dual-agent (A: design review · B: detector + browser)

Design health 25/40 (before redesign). Weakest: match with the real world (jargon), aesthetic/minimalist (repeated ledgers), help (no guidance).

Specificity: ~60% authored (hold object, money colour rules, settlement equation, agent log), ~40% template (hero block, 3-column grid, card wall).

Priority issues:
- [P0] The peak moment was off-screen and blocked lines were not tied to the attacks. Fixed: named traps, a verdict sentence, auto-scroll to results.
- [P0] The demo was not guided and used jargon. Fixed: numbered steps, a next-action line, plain-language labels, an active panel outline.
- [P1] The hero was template-shaped. Fixed: new headline, a money-story ledger, one primary action.
- [P1] Tunnel cards covered the title. Fixed: the title layer sits above the cards, the flight is shorter, and there is a skip link.
- [P2] The approval handoff was jarring. Fixed: a branded pretend-PayPal page with reassurance.
- [P3] Repetition. Fixed: 4 recent mandates, references and signature behind disclosures, no hero figcaption.

Detector: source scan clean. In the browser, footer type 10.5px and 11px tunnel card text (user-supplied components, left as is). AG Grid padding findings are false positives.
