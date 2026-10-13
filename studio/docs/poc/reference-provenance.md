# Reference evidence & Gemini synthesis — provenance

The attached sources from the conversation should be used as **design evidence**, not as proof of which code libraries the original sites used.

## Source recordings (also attached by user to the current conversation)

| User attachment | User/context description | Grounded design observations | Important uncertainty |
|---|---|---|---|
| `Screen Recording 2026-10-13 125935.mp4` | Cartier watch page | shrinking aperture/circle, editorial photo depth, rotating/watch left-right handoffs, full-width video | exact product rendering technology, original DOM/GSAP/Three code |
| `20261013-1225-27.9726038.mp4` | Cartier supplementary watch interaction | user-interactive watch viewpoint/configuration | cannot infer architecture from recording |
| `Screen Recording 2026-10-13 130210.mp4` | Aevion drone reference | linked product poses/metrics/scenes, fold, terrain, overlay annotations | source modelling/hotspot implementation unknown |
| `Screen Recording 2026-10-13 125444.mp4` | Morpho + Teatika references | 3D-to-video aperture transition, animated product representation/parts/materials, configurator illustrations | exact 3D materials/meshes unknown |
| `Screen Recording 2026-10-13 142839.mp4` | Olympic.no editorial scroll | editorial split, image entrance/exit, full-width imagery, subtle apparent depth | cannot conclude Lenis, parallax multiplier or easing constants from visuals alone |
| Other Montfort / Watches & Wonders discussions | Described by Gemini and user | atmosphere/depth stacking, curtain reveals | not all corresponding source video files directly attached in this turn |

Contact sheets from previous video inspection are in `references/`. They are observation aides, not replacements for playable original recordings. If Astra cannot access full videos in its execution environment, say so, test against contact sheets and ask for precise reattachment only when needed; do not pretend to have observed inaccessible motion.

## Original Gemini analysis included

`references/Gemini_five_website_analysis_original.txt` reproduces the supplied pasted text covering five references, seven instruments and a proposed intent payload. This source was authored by Gemini and supplied by the user; it is not independently verified evidence of exact original-site engineering.

## Gemini's subsequently supplied instrument architecture (user pasted in chat)

- A **DAW / VST rack metaphor**, ON/OFF with semantic macro dials, expandable full parameter ranges (88 keys).
- Twelve first-class instruments: inertia, stage lock, parallax window, dual orbit, glint sweep, part explode, aperture portal, mesh hotspot, soft rise, masked text stagger, depth sandwich, wireframe-to-solid/material representation.
- Universal **InstrumentDefinition** contract: name/categorisation, target actor, semantic macro controls, driver clock and routing, canvas proxy, implementation/compilation target. Treat this as a starting proposal, not magical universal compliance.
- Four-level framing: environment/physics, actors, instruments, compound beats. Relationships/cross-actor coupling are first-class even if not in original four tiers.
- Proposed additive property bus: static → scroll → user drag → damping. This is **not universally mathematically valid**, so choose per-property typed blend/arbitration and explicit handoffs.
- Empirical video intake: observed effect/timecode → capability differential versus manual → instrument contract change/new capability → production mapping, with evidence and convergence analysis.
- The core discovery is a **small sufficiently expressive vocabulary** of drivers, modulators, actors, relational couplings, states and instruments; **not** a catalogue of infinite completed compositions.
- Examples: phone rotation drives headline avoidance/wrap and glint; Cartier pinned watch handoff, Morpho aperture, Aevion linked product states, Olympic editorial instruments.
- Negative constraints: no separate form-ridden tabs, no technical prose in normal UI, no rewrites of core model for each instrument, protect persistence/undo/evidence.

## 2026-10-13 decision superseding earlier documents

The latest user instruction overrides the earlier 'mockups only first' gate for this one explicit experiment: **rebuild a playable Studio proof of concept now**, including the UI overhaul and representative integrated instruments, then the user determines whether its capabilities are evolutionarily better. The future hundreds-video research manual is on hold until tested.

Prior documents could describe an earlier graphite UI or generic website-builder architecture; those are historical, **not operative** for this PoC. Preserve useful engineering but reject conflicting workflow assumptions.
