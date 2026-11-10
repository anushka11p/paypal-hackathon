# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Primary audience for this build: PayPal AI Hackathon judges (PayPal developer advocates, engineers, product managers, sponsor engineers) evaluating a working demo and a 3-minute video. The product's end users are people who let an AI agent shop on their behalf and need a hard limit on what it can spend.

## Product Purpose
Leash is a spending firewall between an AI shopping agent and PayPal. The user writes a mandate in plain English; it is compiled into strict rules; PayPal authorizes a hold for exactly the budget; the agent shops and only proposes a cart; Leash checks every line with deterministic rules and a veto-only LLM intent check, captures only what passed, and releases the rest. Success: a judge sees a hijacked agent fail to move a single dollar it shouldn't.

## Positioning
The agent proposes; only Leash pays. The budget is a real PayPal authorization hold, not an app setting. The agent runs in a separate process with no payment credentials; the deterministic engine is the only thing that can approve money, and the LLM layer can only veto.

## Operating Context
Judged on technological implementation, design, impact, innovation and presentation. Viewed live in a browser and in a screen-recorded demo video. Runs against the PayPal sandbox or a clearly labelled payment simulator.

## Capabilities and Constraints
- Real: Groq LLM (openai/gpt-oss-120b) for policy compiler, shopping agent and intent evaluator; Channel3 live price search; PayPal Orders v2 AUTHORIZE + partial capture with final_capture, void; hash-chained audit trail; AG Grid event table.
- Currency is USD (the India-registered sandbox merchant rejects INR).
- The demo store (Bramble & Co.) and its two attack texts are simulated and must stay labelled as such.
- Sponsor tools in use: Channel3, AG Grid, Render.

## Brand Commitments
- Name: Leash. Line: "Let AI shop. Keep the leash." / "The agent proposes. Only Leash pays."
- User-set bar: Mercury (banking-grade calm, premium, trustworthy). One restrained 3D hero object. Light and dark themes with a toggle.
- Footer uses the HalftoneWordmarkFooter component (src/components/ui).

## Evidence on Hand
- 20/20 live attack runs: agent fooled every time, $0 of bad items approved (backend/trials/results.json).
- One live PayPal sandbox capture: authorization 9PC58272LM9624032, capture 6LX40761XE0335641, $80 COMPLETED.
- No customers, testimonials, pricing or production deployments exist; never invent them.

## Product Principles
- Show the mechanism working; never just claim it.
- Money states (held, captured, released, blocked) are always explicit and exact to the cent.
- Honesty about what is simulated is part of the trust.
- The agent can be fooled; the payment cannot.
