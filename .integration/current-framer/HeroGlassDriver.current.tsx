import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useEffect, useMemo, useRef, useState } from "react"

/**
 * HeroGlassDriver — iGlass render-gated autoplay/scroll receiver.
 * Mirrors autoplay or drives scroll progress, keeping every DOM headline on the same clock,
 * and lets the authored motion path own every hold without a scroll gate.
 * Drives: 3 stacked DOM headlines (opacity swaps), dark→light background
 * (compositor-friendly: dark overlay opacity, not background-color animation),
 * and delayed CTA reveal (opacity + visibility + pointer-events).
 *
 * Threshold defaults derive from the calibrated motion path:
 *   H1 blur/fade out 0.250–0.300 · H2 hard-gated blur reveal 0.504–0.559
 *   H2 blur/fade out 0.650–0.700 · H3 hidden before p=0.760
 *   H3 near-side edge 0.760–0.772 · far-side edge from 0.772
 *   H3 reveal is monotonic while scrolling forward, then latches visible.
 *   bg lift + H1 reveal: node 111 arrival path → node 120 hold · CTA 0.95
 *
 * DUAL MOTION PATH (wide / compact) — ADR-0001 code-component fallback.
 * The desktop and mobile heroes are ONE Vercel app, ONE GLB, ONE bundle. Only
 * the authored motion path differs, and that path already travels inside the
 * URL as ?motion=<base64url>. This component renders exactly ONE iframe and
 * chooses its src once, at mount, from its OWN measured width — never from a
 * Framer breakpoint override, which would emit a duplicated subtree and risk a
 * second WebGL context loading behind display:none.
 *
 * The measurement is the stage element's width, NOT window.innerWidth, because
 * the R3F app's internal gate (SETTLE.desktopMinWidth = 810) reads its canvas
 * width. Measuring the same box makes parent and child agree by construction,
 * on canvas and on the published site alike. 810 is also Framer's own default
 * phone-breakpoint boundary, so all three authorities share one number.
 *
 * Selection runs once. There is deliberately no resize listener: a live
 * orientation change crossing 810 would otherwise swap src and reload the
 * scene mid-animation.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const seg = (p: number, a: number, b: number) =>
    b <= a ? (p < a ? 0 : 1) : clamp01((p - a) / (b - a))

const H1_REST_Y = 56
const H1_FOCUS_START = 0.12
const H1_FOCUS_END = 0.175
const H1_OUT_START = 0.25
const H1_OUT_END = 0.3
const H2_REST_Y = 32
const H2_REVEAL_START = 0.504
const H2_FOCUS_END = 0.559
const H2_OUT_START = 0.65
const H2_OUT_END = 0.7
const REVEAL_BLUR_PX = 12
const H3_CLIP_GUARD_PX = 3
const H3_HIDDEN_CLIP = "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)"
const H3_DIRECTION_EPSILON = 0.0005
const H3_REVEAL_START = 0.76
const H3_FOCUS_END = 0.815
const H3_EDGE_SWITCH = 0.772
const INTRO_END_FALLBACK = 0.077
const COMPACT_MAX_WIDTH_FALLBACK = 810

// COMPACT (phone) MOTION PATH — "Y Reg Finish v3".
// 16 nodes, speed 0.60, 31.25 s of playback, first authored hold at p≈0.0667.
// Baked here as a module constant rather than left to a property-control
// default: a Framer instance stores an explicit "" for String controls, so
// defaultProps never fires for them (ADR-0004), and a ~19.6 KB value cannot be
// written onto the instance through the MCP relay. Everything before ?motion=
// is byte-identical to the wide URL, so both paths share one glass material,
// bezel, OLED split, environment and crack-default registration.
const COMPACT_EMBED_URL =
    "https://iphone-animation-five.vercel.app/?tilt=18.0&settle=90%2C0%2C180&shift=0.098&vshift=-0.070&lift=0.080&pscale=1.50&size=1.69&spos=0.000%2C-1.331%2C0.592&srot=-64%2C72%2C90&sscale=2.80&glassreg=-0.030%2C0.090%2C0.071&light=0.939%2C1.240%2C2.786%2C0.626%2C2.785%2C-12.800%2C-14.900%2C12.200%2C11695.072%2C-10.300%2C4.100%2C4.100%2C11294.853&bezel=0.00%2C1.00%2C-4.00&oled=-0.50%2C0%2C1.000&glass=0.120%2C1.400%2C0.180%2C1.000%2C0.060&glassfx=0.0000%2C0.2300%2C0.2300%2C0.0400%2C-41.0000%2C0.0400%2C1.0000%2C0.7000%2C0.1200%2C0.7200%2C0.0550%2C0.7800%2C0.7800%2C1.0000%2C2.0000%2C8.0000%2C1.4000%2C0.0000%2C1.0000%2C0.7000&envp=studio&envb=0.00&crack=4.20%2C1.00%2C0.60%2C-0.04%2C1.00%2C1.00%2C0.60%2C-0.04%2C1.00&motion=eyJ0eXBlIjoiaWdsYXNzLW1vdGlvbi1wYXRoIiwidmVyc2lvbiI6MywibmFtZSI6IlkgUmVnIEZpbmlzaCB2MyIsInRyYWplY3RvcnkiOiJjdXJ2ZSIsImN1cnZlVHlwZSI6ImNhdG11bGxyb20iLCJ0ZW5zaW9uIjowLjUsImFyY0xlbmd0aCI6dHJ1ZSwiY29udGludW91cyI6ZmFsc2UsImdsb2JhbEVhc2UiOiJkZWNlbGVyYXRlIiwiZ2xvYmFsRWFzZVN0cmVuZ3RoIjowLjQyLCJnbGFzc091dEVhc2UiOiJkZWNlbGVyYXRlIiwiZ2xhc3NPdXRFYXNlU3RyZW5ndGgiOjAsImdsYXNzUmV0dXJuRWFzZSI6ImRlY2VsZXJhdGUiLCJnbGFzc1JldHVybkVhc2VTdHJlbmd0aCI6MCwiZ2xhc3NSZXR1cm5TcGFuIjoxLCJvcmllbnRhdGlvbk1vZGUiOiJxdWF0ZXJuaW9uIiwibG9va0F0IjpbMCwwLDBdLCJvcmllbnRhdGlvbk9mZnNldCI6WzAsMCwwXSwiYmFuayI6MCwic3BlZWQiOjAuNiwibG9vcCI6dHJ1ZSwibm9kZXMiOlt7InNsb3QiOjE5MiwiZHVyYXRpb24iOjAsImhvbGQiOjAsIm1vdGlvbk1vZGUiOiJpbmhlcml0IiwiZWFzZSI6ImNpbmVtYXRpYyIsImVhc2VTdHJlbmd0aCI6MSwiZGVwYXJ0dXJlRWFzZSI6ImFjY2VsZXJhdGUiLCJkZXBhcnR1cmVFYXNlU3RyZW5ndGgiOjEsInBvc2l0aW9uIjpbMCwtMC4wNSwwXSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjowLCJzZXR0bGVZIjoxODAsInNldHRsZVoiOjAsInNpemUiOjEuNiwic3Bvc1giOjAsInNwb3NZIjotMC4wNSwic3Bvc1oiOjAsInNyb3RYIjowLCJzcm90WSI6NzIsInNyb3RaIjo5MCwic3NjYWxlIjowLjgsInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuMzE5NDgwMDAwMDAwMDE1MTQsIm9sZWRMdW1pbmFuY2UiOjEsImxpZ2h0QW1iaWVudCI6MC4wNSwibGlnaHRLZXkiOjEuMiwibGlnaHRGaWxsIjowLjI1LCJsaWdodEVudmlyb25tZW50IjowLjUsImV4cCI6MSwibGlnaHRLZXlYIjo1LCJsaWdodEtleVkiOjEwLCJsaWdodEtleVoiOjUsImxpZ2h0S2V5VGVtcGVyYXR1cmUiOjY1MDAsImxpZ2h0RmlsbFgiOi02LCJsaWdodEZpbGxZIjozLCJsaWdodEZpbGxaIjo0LCJsaWdodEZpbGxUZW1wZXJhdHVyZSI6OTAwMCwiZ2xhc3NSZWdYIjotMC4wMywiZ2xhc3NSZWdZIjoyNSwiZ2xhc3NSZWdaIjotMS42OCwiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjAuMjYyNX19LHsic2xvdCI6MTg4LCJkdXJhdGlvbiI6MS4yNSwiaG9sZCI6MC4zLCJtb3Rpb25Nb2RlIjoiaW5oZXJpdCIsImVhc2UiOiJjaW5lbWF0aWMiLCJlYXNlU3RyZW5ndGgiOjEsImRlcGFydHVyZUVhc2UiOiJzaW5lIiwiZGVwYXJ0dXJlRWFzZVN0cmVuZ3RoIjoxLCJwb3NpdGlvbiI6WzAsLTAuMDUsMF0sInBvc2UiOnsic2hpZnQiOjAuMjIsInZzaGlmdCI6MCwic2V0dGxlWCI6MCwic2V0dGxlWSI6MTgwLCJzZXR0bGVaIjowLCJzaXplIjoxLjYsInNwb3NYIjowLCJzcG9zWSI6LTAuMDUsInNwb3NaIjowLCJzcm90WCI6MCwic3JvdFkiOjcyLCJzcm90WiI6OTAsInNzY2FsZSI6MC44LCJ0aWx0IjoxOCwibGlmdCI6MC4wOCwicHNjYWxlIjowLjgsInNoaW5lIjowLjMxOTQ4MDAwMDAwMDAxNTE0LCJvbGVkTHVtaW5hbmNlIjoxLCJsaWdodEFtYmllbnQiOjAuMDUsImxpZ2h0S2V5IjoxLjIsImxpZ2h0RmlsbCI6MC4yNSwibGlnaHRFbnZpcm9ubWVudCI6MC41LCJleHAiOjEsImxpZ2h0S2V5WCI6NSwibGlnaHRLZXlZIjoxMCwibGlnaHRLZXlaIjo1LCJsaWdodEtleVRlbXBlcmF0dXJlIjo2NTAwLCJsaWdodEZpbGxYIjotNiwibGlnaHRGaWxsWSI6MywibGlnaHRGaWxsWiI6NCwibGlnaHRGaWxsVGVtcGVyYXR1cmUiOjkwMDAsImdsYXNzUmVnWCI6LTAuMDMsImdsYXNzUmVnWSI6MC4wOSwiZ2xhc3NSZWdaIjotMS42OCwiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjAuMjYyNX19LHsic2xvdCI6MTg0LCJkdXJhdGlvbiI6MS42LCJob2xkIjowLjI1LCJtb3Rpb25Nb2RlIjoiY3VzdG9tIiwiZWFzZSI6InNpbmUiLCJlYXNlU3RyZW5ndGgiOjEsImRlcGFydHVyZUVhc2UiOiJzaW5lIiwiZGVwYXJ0dXJlRWFzZVN0cmVuZ3RoIjoxLCJwb3NpdGlvbiI6WzAsLTAuMTEsMF0sInBvc2UiOnsic2hpZnQiOjAuMjIsInZzaGlmdCI6MCwic2V0dGxlWCI6MCwic2V0dGxlWSI6MTgwLCJzZXR0bGVaIjowLCJzaXplIjoxLjYsInNwb3NYIjowLCJzcG9zWSI6LTAuMTEsInNwb3NaIjowLCJzcm90WCI6MCwic3JvdFkiOjQwLjU1LCJzcm90WiI6OTAsInNzY2FsZSI6MC42OSwidGlsdCI6MTgsImxpZnQiOjAuMDgsInBzY2FsZSI6MC44LCJzaGluZSI6MC4zMTk0ODAwMDAwMDAwMTUxNCwib2xlZEx1bWluYW5jZSI6MSwibGlnaHRBbWJpZW50IjowLjA1LCJsaWdodEtleSI6MS4yLCJsaWdodEZpbGwiOjAuMjUsImxpZ2h0RW52aXJvbm1lbnQiOjAuNSwiZXhwIjoxLCJsaWdodEtleVgiOjUsImxpZ2h0S2V5WSI6MTAsImxpZ2h0S2V5WiI6NSwibGlnaHRLZXlUZW1wZXJhdHVyZSI6NjUwMCwibGlnaHRGaWxsWCI6LTYsImxpZ2h0RmlsbFkiOjMsImxpZ2h0RmlsbFoiOjQsImxpZ2h0RmlsbFRlbXBlcmF0dXJlIjo5MDAwLCJnbGFzc1JlZ1giOi0wLjAzLCJnbGFzc1JlZ1kiOjAuMDksImdsYXNzUmVnWiI6MS4yNywiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjAuMjYyNX19LHsic2xvdCI6MTg1LCJkdXJhdGlvbiI6MS4yLCJob2xkIjowLCJtb3Rpb25Nb2RlIjoiY3VzdG9tIiwiZWFzZSI6ImRlY2VsZXJhdGUiLCJlYXNlU3RyZW5ndGgiOjEsImRlcGFydHVyZUVhc2UiOiJsaW5lYXIiLCJkZXBhcnR1cmVFYXNlU3RyZW5ndGgiOjAsInBvc2l0aW9uIjpbMCwtMC4xMSwwXSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjoxODAsInNldHRsZVkiOjAsInNldHRsZVoiOjE4MCwic2l6ZSI6MS42LCJzcG9zWCI6MCwic3Bvc1kiOi0wLjExLCJzcG9zWiI6MCwic3JvdFgiOjAsInNyb3RZIjo0MC41NSwic3JvdFoiOjkwLCJzc2NhbGUiOjAuNjksInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuMzE5NDgwMDAwMDAwMDE1MTQsIm9sZWRMdW1pbmFuY2UiOjEsImxpZ2h0QW1iaWVudCI6MC4wNSwibGlnaHRLZXkiOjEuMiwibGlnaHRGaWxsIjowLjI1LCJsaWdodEVudmlyb25tZW50IjowLjUsImV4cCI6MSwibGlnaHRLZXlYIjo1LCJsaWdodEtleVkiOjEwLCJsaWdodEtleVoiOjUsImxpZ2h0S2V5VGVtcGVyYXR1cmUiOjY1MDAsImxpZ2h0RmlsbFgiOi02LCJsaWdodEZpbGxZIjozLCJsaWdodEZpbGxaIjo0LCJsaWdodEZpbGxUZW1wZXJhdHVyZSI6OTAwMCwiZ2xhc3NSZWdYIjotMC4wMywiZ2xhc3NSZWdZIjowLjA5LCJnbGFzc1JlZ1oiOjAuNywiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjAuMDUyNDAwMjUwMDAwMDU2ODR9fSx7InNsb3QiOjE4NiwiZHVyYXRpb24iOjAuNCwiaG9sZCI6MCwibW90aW9uTW9kZSI6ImN1c3RvbSIsImVhc2UiOiJsaW5lYXIiLCJlYXNlU3RyZW5ndGgiOjAsImRlcGFydHVyZUVhc2UiOiJsaW5lYXIiLCJkZXBhcnR1cmVFYXNlU3RyZW5ndGgiOjAsInBvc2l0aW9uIjpbMCwtMC4xMSwwXSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjowLCJzZXR0bGVZIjoxODAsInNldHRsZVoiOjAsInNpemUiOjEuNiwic3Bvc1giOjAsInNwb3NZIjotMC4xMSwic3Bvc1oiOjAsInNyb3RYIjo3LjM3NTYzOTk0NTU4MTM4NWUtMTUsInNyb3RZIjo0MC41NSwic3JvdFoiOjkwLCJzc2NhbGUiOjAuNjksInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuMzE5NDgwMDAwMDAwMDE1MTQsIm9sZWRMdW1pbmFuY2UiOjEsImxpZ2h0QW1iaWVudCI6MC4wNSwibGlnaHRLZXkiOjEuMiwibGlnaHRGaWxsIjowLjI1LCJsaWdodEVudmlyb25tZW50IjowLjUsImV4cCI6MSwibGlnaHRLZXlYIjo1LCJsaWdodEtleVkiOjEwLCJsaWdodEtleVoiOjUsImxpZ2h0S2V5VGVtcGVyYXR1cmUiOjY1MDAsImxpZ2h0RmlsbFgiOi02LCJsaWdodEZpbGxZIjozLCJsaWdodEZpbGxaIjo0LCJsaWdodEZpbGxUZW1wZXJhdHVyZSI6OTAwMCwiZ2xhc3NSZWdYIjotMC4wMywiZ2xhc3NSZWdZIjowLjA5LCJnbGFzc1JlZ1oiOjAuMDcsImNyYWNrRXhpdFgiOjAuNiwiY3JhY2tFeGl0WSI6LTAuMDQsImNyYWNrU2V2ZXJpdHkiOjEsImNyYWNrU2hhcnBuZXNzIjoxLCJjcmFja09uIjpmYWxzZSwiY3JhY2tVc2VEZWZhdWx0Ijp0cnVlLCJwIjowfX0seyJzbG90IjoxMTIsImR1cmF0aW9uIjoxLjI1LCJob2xkIjowLCJtb3Rpb25Nb2RlIjoiaW5oZXJpdCIsImVhc2UiOiJjaW5lbWF0aWMiLCJlYXNlU3RyZW5ndGgiOjEsImRlcGFydHVyZUVhc2UiOiJhY2NlbGVyYXRlIiwiZGVwYXJ0dXJlRWFzZVN0cmVuZ3RoIjoxLCJwb3NpdGlvbiI6WzAsMC4wMSwwXSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjoxODAsInNldHRsZVkiOjAsInNldHRsZVoiOjE4MCwic2l6ZSI6MS42LCJzcG9zWCI6MCwic3Bvc1kiOjAuMDEsInNwb3NaIjowLCJzcm90WCI6LTY2LjAzLCJzcm90WSI6NzEuNTA5OTk5OTk5OTk5OTksInNyb3RaIjo4OS4zNDk5OTk5OTk5OTk5NSwic3NjYWxlIjowLjg5LCJ0aWx0IjoxOCwibGlmdCI6MC4wOCwicHNjYWxlIjowLjgsInNoaW5lIjowLjU1NDYzOTEzMDQzNTExNDcsIm9sZWRMdW1pbmFuY2UiOjEsImxpZ2h0QW1iaWVudCI6MC4wNSwibGlnaHRLZXkiOjEuMiwibGlnaHRGaWxsIjowLjI1LCJsaWdodEVudmlyb25tZW50IjowLjUsImV4cCI6MSwibGlnaHRLZXlYIjo1LCJsaWdodEtleVkiOjEwLCJsaWdodEtleVoiOjUsImxpZ2h0S2V5VGVtcGVyYXR1cmUiOjY1MDAsImxpZ2h0RmlsbFgiOi02LCJsaWdodEZpbGxZIjozLCJsaWdodEZpbGxaIjo0LCJsaWdodEZpbGxUZW1wZXJhdHVyZSI6OTAwMCwiZ2xhc3NSZWdYIjotMC4wMywiZ2xhc3NSZWdZIjowLjA5LCJnbGFzc1JlZ1oiOjAuMDcsImNyYWNrRXhpdFgiOjAuNiwiY3JhY2tFeGl0WSI6LTAuMDQsImNyYWNrU2V2ZXJpdHkiOjEsImNyYWNrU2hhcnBuZXNzIjoxLCJjcmFja09uIjpmYWxzZSwiY3JhY2tVc2VEZWZhdWx0Ijp0cnVlLCJwIjowfX0seyJzbG90IjoxMTIsImR1cmF0aW9uIjoxLjI1LCJob2xkIjowLCJtb3Rpb25Nb2RlIjoiaW5oZXJpdCIsImVhc2UiOiJjaW5lbWF0aWMiLCJlYXNlU3RyZW5ndGgiOjEsImRlcGFydHVyZUVhc2UiOiJhY2NlbGVyYXRlIiwiZGVwYXJ0dXJlRWFzZVN0cmVuZ3RoIjoxLCJwb3NpdGlvbiI6WzAsMC4wMSwwXSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjoxODAsInNldHRsZVkiOjAsInNldHRsZVoiOjE4MCwic2l6ZSI6MS42LCJzcG9zWCI6MCwic3Bvc1kiOjAuMDEsInNwb3NaIjowLCJzcm90WCI6LTY2LjAzLCJzcm90WSI6NzEuNTA5OTk5OTk5OTk5OTksInNyb3RaIjo4OS4zNDk5OTk5OTk5OTk5NSwic3NjYWxlIjowLjg5LCJ0aWx0IjoxOCwibGlmdCI6MC4wOCwicHNjYWxlIjowLjgsInNoaW5lIjowLjU1NDYzOTEzMDQzNTExNDcsIm9sZWRMdW1pbmFuY2UiOjEsImxpZ2h0QW1iaWVudCI6MC4wNSwibGlnaHRLZXkiOjEuMiwibGlnaHRGaWxsIjowLjI1LCJsaWdodEVudmlyb25tZW50IjowLjUsImV4cCI6MSwibGlnaHRLZXlYIjo1LCJsaWdodEtleVkiOjEwLCJsaWdodEtleVoiOjUsImxpZ2h0S2V5VGVtcGVyYXR1cmUiOjY1MDAsImxpZ2h0RmlsbFgiOi02LCJsaWdodEZpbGxZIjozLCJsaWdodEZpbGxaIjo0LCJsaWdodEZpbGxUZW1wZXJhdHVyZSI6OTAwMCwiZ2xhc3NSZWdYIjotMC4wMywiZ2xhc3NSZWdZIjowLjA5LCJnbGFzc1JlZ1oiOjAuMDcsImNyYWNrRXhpdFgiOjAuNiwiY3JhY2tFeGl0WSI6LTAuMDQsImNyYWNrU2V2ZXJpdHkiOjEsImNyYWNrU2hhcnBuZXNzIjoxLCJjcmFja09uIjpmYWxzZSwiY3JhY2tVc2VEZWZhdWx0Ijp0cnVlLCJwIjowfX0seyJzbG90IjoxMTMsImR1cmF0aW9uIjoxLjI1LCJob2xkIjowLCJtb3Rpb25Nb2RlIjoiaW5oZXJpdCIsImVhc2UiOiJjaW5lbWF0aWMiLCJlYXNlU3RyZW5ndGgiOjEsImRlcGFydHVyZUVhc2UiOiJhY2NlbGVyYXRlIiwiZGVwYXJ0dXJlRWFzZVN0cmVuZ3RoIjoxLCJwb3NpdGlvbiI6WzAsMC4wMSwwXSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjoxODAsInNldHRsZVkiOjAsInNldHRsZVoiOjE4MCwic2l6ZSI6MS42LCJzcG9zWCI6MCwic3Bvc1kiOjAuMDEsInNwb3NaIjowLCJzcm90WCI6LTY2LjAzLCJzcm90WSI6NzEuNTA5OTk5OTk5OTk5OTksInNyb3RaIjo4OS4zNDk5OTk5OTk5OTk5NSwic3NjYWxlIjowLjg5LCJ0aWx0IjoxOCwibGlmdCI6MC4wOCwicHNjYWxlIjowLjgsInNoaW5lIjowLjU1NDYzOTEzMDQzNTExNDcsIm9sZWRMdW1pbmFuY2UiOjEsImxpZ2h0QW1iaWVudCI6MC4wNSwibGlnaHRLZXkiOjEuMiwibGlnaHRGaWxsIjowLjI1LCJsaWdodEVudmlyb25tZW50IjowLjUsImV4cCI6MSwibGlnaHRLZXlYIjo1LCJsaWdodEtleVkiOjEwLCJsaWdodEtleVoiOjUsImxpZ2h0S2V5VGVtcGVyYXR1cmUiOjY1MDAsImxpZ2h0RmlsbFgiOi02LCJsaWdodEZpbGxZIjozLCJsaWdodEZpbGxaIjo0LCJsaWdodEZpbGxUZW1wZXJhdHVyZSI6OTAwMCwiZ2xhc3NSZWdYIjotMC4wMywiZ2xhc3NSZWdZIjowLjA5LCJnbGFzc1JlZ1oiOi0xLjMzLCJjcmFja0V4aXRYIjowLjYsImNyYWNrRXhpdFkiOi0wLjA0LCJjcmFja1NldmVyaXR5IjoxLCJjcmFja1NoYXJwbmVzcyI6MSwiY3JhY2tPbiI6ZmFsc2UsImNyYWNrVXNlRGVmYXVsdCI6dHJ1ZSwicCI6MC4xNX19LHsic2xvdCI6MTEyLCJkdXJhdGlvbiI6MS4yNSwiaG9sZCI6MCwibW90aW9uTW9kZSI6ImluaGVyaXQiLCJlYXNlIjoiY2luZW1hdGljIiwiZWFzZVN0cmVuZ3RoIjoxLCJkZXBhcnR1cmVFYXNlIjoiYWNjZWxlcmF0ZSIsImRlcGFydHVyZUVhc2VTdHJlbmd0aCI6MSwicG9zaXRpb24iOlswLDAuMDEsMF0sInBvc2UiOnsic2hpZnQiOjAuMjIsInZzaGlmdCI6MCwic2V0dGxlWCI6MTgwLCJzZXR0bGVZIjowLCJzZXR0bGVaIjoxODAsInNpemUiOjEuNiwic3Bvc1giOjAsInNwb3NZIjowLjAxLCJzcG9zWiI6MCwic3JvdFgiOi02Ni4wMywic3JvdFkiOjcxLjUwOTk5OTk5OTk5OTk5LCJzcm90WiI6ODkuMzQ5OTk5OTk5OTk5OTUsInNzY2FsZSI6MC44OSwidGlsdCI6MTgsImxpZnQiOjAuMDgsInBzY2FsZSI6MC44LCJzaGluZSI6MC41NTQ2MzkxMzA0MzUxMTQ3LCJvbGVkTHVtaW5hbmNlIjoxLCJsaWdodEFtYmllbnQiOjAuMDUsImxpZ2h0S2V5IjoxLjIsImxpZ2h0RmlsbCI6MC4yNSwibGlnaHRFbnZpcm9ubWVudCI6MC41LCJleHAiOjEsImxpZ2h0S2V5WCI6NSwibGlnaHRLZXlZIjoxMCwibGlnaHRLZXlaIjo1LCJsaWdodEtleVRlbXBlcmF0dXJlIjo2NTAwLCJsaWdodEZpbGxYIjotNiwibGlnaHRGaWxsWSI6MywibGlnaHRGaWxsWiI6NCwibGlnaHRGaWxsVGVtcGVyYXR1cmUiOjkwMDAsImdsYXNzUmVnWCI6LTAuMDMsImdsYXNzUmVnWSI6MC4wOSwiZ2xhc3NSZWdaIjowLjA3LCJjcmFja0V4aXRYIjowLjYsImNyYWNrRXhpdFkiOi0wLjA0LCJjcmFja1NldmVyaXR5IjoxLCJjcmFja1NoYXJwbmVzcyI6MSwiY3JhY2tPbiI6ZmFsc2UsImNyYWNrVXNlRGVmYXVsdCI6dHJ1ZSwicCI6MH19LHsic2xvdCI6MTE2LCJkdXJhdGlvbiI6MS4yNSwiaG9sZCI6MCwibW90aW9uTW9kZSI6ImluaGVyaXQiLCJlYXNlIjoiY2luZW1hdGljIiwiZWFzZVN0cmVuZ3RoIjoxLCJkZXBhcnR1cmVFYXNlIjoiYWNjZWxlcmF0ZSIsImRlcGFydHVyZUVhc2VTdHJlbmd0aCI6MSwicG9zaXRpb24iOlswLC0wLjE0LDQuNzYwNjM2MzI5NTkyNjZlLTE0XSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjoxODAsInNldHRsZVkiOjAsInNldHRsZVoiOjE4MCwic2l6ZSI6MS42LCJzcG9zWCI6MCwic3Bvc1kiOi0wLjE0LCJzcG9zWiI6NC43NjA2MzYzMjk1OTI2NmUtMTQsInNyb3RYIjotNy44MDk5OTk5OTk5OTk5OTcsInNyb3RZIjoyMS43MDk5OTk5OTk5OTk5OTcsInNyb3RaIjo3MC4zOCwic3NjYWxlIjowLjgsInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuNTU0NjM5MTMwNDM1MTE0Nywib2xlZEx1bWluYW5jZSI6MSwibGlnaHRBbWJpZW50IjowLjA1LCJsaWdodEtleSI6MS4yLCJsaWdodEZpbGwiOjAuMjUsImxpZ2h0RW52aXJvbm1lbnQiOjAuNSwiZXhwIjoxLCJsaWdodEtleVgiOjUsImxpZ2h0S2V5WSI6MTAsImxpZ2h0S2V5WiI6NSwibGlnaHRLZXlUZW1wZXJhdHVyZSI6NjUwMCwibGlnaHRGaWxsWCI6LTYsImxpZ2h0RmlsbFkiOjMsImxpZ2h0RmlsbFoiOjQsImxpZ2h0RmlsbFRlbXBlcmF0dXJlIjo5MDAwLCJnbGFzc1JlZ1giOi0wLjAzLCJnbGFzc1JlZ1kiOjAuMDksImdsYXNzUmVnWiI6MC4wNywiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjB9fSx7InNsb3QiOjExNiwiZHVyYXRpb24iOjEuMjUsImhvbGQiOjAsIm1vdGlvbk1vZGUiOiJpbmhlcml0IiwiZWFzZSI6ImNpbmVtYXRpYyIsImVhc2VTdHJlbmd0aCI6MSwiZGVwYXJ0dXJlRWFzZSI6ImFjY2VsZXJhdGUiLCJkZXBhcnR1cmVFYXNlU3RyZW5ndGgiOjEsInBvc2l0aW9uIjpbMCwtMC4xNCw0Ljc2MDYzNjMyOTU5MjY2ZS0xNF0sInBvc2UiOnsic2hpZnQiOjAuMjIsInZzaGlmdCI6MCwic2V0dGxlWCI6MTgwLCJzZXR0bGVZIjowLCJzZXR0bGVaIjoxODAsInNpemUiOjEuNiwic3Bvc1giOjAsInNwb3NZIjotMC4xNCwic3Bvc1oiOjQuNzYwNjM2MzI5NTkyNjZlLTE0LCJzcm90WCI6LTcuODA5OTk5OTk5OTk5OTk3LCJzcm90WSI6MjEuNzA5OTk5OTk5OTk5OTk3LCJzcm90WiI6NzAuMzgsInNzY2FsZSI6MC44LCJ0aWx0IjoxOCwibGlmdCI6MC4wOCwicHNjYWxlIjowLjgsInNoaW5lIjowLjU1NDYzOTEzMDQzNTExNDcsIm9sZWRMdW1pbmFuY2UiOjEsImxpZ2h0QW1iaWVudCI6MC4wNSwibGlnaHRLZXkiOjEuMiwibGlnaHRGaWxsIjowLjI1LCJsaWdodEVudmlyb25tZW50IjowLjUsImV4cCI6MSwibGlnaHRLZXlYIjo1LCJsaWdodEtleVkiOjEwLCJsaWdodEtleVoiOjUsImxpZ2h0S2V5VGVtcGVyYXR1cmUiOjY1MDAsImxpZ2h0RmlsbFgiOi02LCJsaWdodEZpbGxZIjozLCJsaWdodEZpbGxaIjo0LCJsaWdodEZpbGxUZW1wZXJhdHVyZSI6OTAwMCwiZ2xhc3NSZWdYIjotMC4wMywiZ2xhc3NSZWdZIjowLjA5LCJnbGFzc1JlZ1oiOjAuMDcsImNyYWNrRXhpdFgiOjAuNiwiY3JhY2tFeGl0WSI6LTAuMDQsImNyYWNrU2V2ZXJpdHkiOjEsImNyYWNrU2hhcnBuZXNzIjoxLCJjcmFja09uIjpmYWxzZSwiY3JhY2tVc2VEZWZhdWx0Ijp0cnVlLCJwIjowfX0seyJzbG90IjoxMTcsImR1cmF0aW9uIjoxLjI1LCJob2xkIjowLCJtb3Rpb25Nb2RlIjoiaW5oZXJpdCIsImVhc2UiOiJjaW5lbWF0aWMiLCJlYXNlU3RyZW5ndGgiOjEsImRlcGFydHVyZUVhc2UiOiJhY2NlbGVyYXRlIiwiZGVwYXJ0dXJlRWFzZVN0cmVuZ3RoIjoxLCJwb3NpdGlvbiI6WzAsLTAuMTQsNC43NjA2MzYzMjk1OTI2NmUtMTRdLCJwb3NlIjp7InNoaWZ0IjowLjIyLCJ2c2hpZnQiOjAsInNldHRsZVgiOjE4MCwic2V0dGxlWSI6MCwic2V0dGxlWiI6MTgwLCJzaXplIjoxLjYsInNwb3NYIjowLCJzcG9zWSI6LTAuMTQsInNwb3NaIjo0Ljc2MDYzNjMyOTU5MjY2ZS0xNCwic3JvdFgiOi03LjgwOTk5OTk5OTk5OTk5Nywic3JvdFkiOjIxLjcwOTk5OTk5OTk5OTk5Nywic3JvdFoiOjcwLjM4LCJzc2NhbGUiOjAuOCwidGlsdCI6MTgsImxpZnQiOjAuMDgsInBzY2FsZSI6MC44LCJzaGluZSI6MC41NTQ2MzkxMzA0MzUxMTQ3LCJvbGVkTHVtaW5hbmNlIjoxLCJsaWdodEFtYmllbnQiOjAuMDUsImxpZ2h0S2V5IjoxLjIsImxpZ2h0RmlsbCI6MC4yNSwibGlnaHRFbnZpcm9ubWVudCI6MC41LCJleHAiOjEsImxpZ2h0S2V5WCI6NSwibGlnaHRLZXlZIjoxMCwibGlnaHRLZXlaIjo1LCJsaWdodEtleVRlbXBlcmF0dXJlIjo2NTAwLCJsaWdodEZpbGxYIjotNiwibGlnaHRGaWxsWSI6MywibGlnaHRGaWxsWiI6NCwibGlnaHRGaWxsVGVtcGVyYXR1cmUiOjkwMDAsImdsYXNzUmVnWCI6LTAuMDMsImdsYXNzUmVnWSI6MC4wOSwiZ2xhc3NSZWdaIjotMS41LCJjcmFja0V4aXRYIjowLjYsImNyYWNrRXhpdFkiOi0wLjA0LCJjcmFja1NldmVyaXR5IjoxLCJjcmFja1NoYXJwbmVzcyI6MSwiY3JhY2tPbiI6ZmFsc2UsImNyYWNrVXNlRGVmYXVsdCI6dHJ1ZSwicCI6MC4xNX19LHsic2xvdCI6MTE2LCJkdXJhdGlvbiI6MS4yNSwiaG9sZCI6MCwibW90aW9uTW9kZSI6ImluaGVyaXQiLCJlYXNlIjoiY2luZW1hdGljIiwiZWFzZVN0cmVuZ3RoIjoxLCJkZXBhcnR1cmVFYXNlIjoiYWNjZWxlcmF0ZSIsImRlcGFydHVyZUVhc2VTdHJlbmd0aCI6MSwicG9zaXRpb24iOlswLC0wLjE0LDQuNzYwNjM2MzI5NTkyNjZlLTE0XSwicG9zZSI6eyJzaGlmdCI6MC4yMiwidnNoaWZ0IjowLCJzZXR0bGVYIjoxODAsInNldHRsZVkiOjAsInNldHRsZVoiOjE4MCwic2l6ZSI6MS42LCJzcG9zWCI6MCwic3Bvc1kiOi0wLjE0LCJzcG9zWiI6NC43NjA2MzYzMjk1OTI2NmUtMTQsInNyb3RYIjotNy44MDk5OTk5OTk5OTk5OTcsInNyb3RZIjoyMS43MDk5OTk5OTk5OTk5OTcsInNyb3RaIjo3MC4zOCwic3NjYWxlIjowLjgsInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuNTU0NjM5MTMwNDM1MTE0Nywib2xlZEx1bWluYW5jZSI6MSwibGlnaHRBbWJpZW50IjowLjA1LCJsaWdodEtleSI6MS4yLCJsaWdodEZpbGwiOjAuMjUsImxpZ2h0RW52aXJvbm1lbnQiOjAuNSwiZXhwIjoxLCJsaWdodEtleVgiOjUsImxpZ2h0S2V5WSI6MTAsImxpZ2h0S2V5WiI6NSwibGlnaHRLZXlUZW1wZXJhdHVyZSI6NjUwMCwibGlnaHRGaWxsWCI6LTYsImxpZ2h0RmlsbFkiOjMsImxpZ2h0RmlsbFoiOjQsImxpZ2h0RmlsbFRlbXBlcmF0dXJlIjo5MDAwLCJnbGFzc1JlZ1giOi0wLjAzLCJnbGFzc1JlZ1kiOjAuMDksImdsYXNzUmVnWiI6MC4wNywiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjB9fSx7InNsb3QiOjEyMCwiZHVyYXRpb24iOjEuMjUsImhvbGQiOjAsIm1vdGlvbk1vZGUiOiJpbmhlcml0IiwiZWFzZSI6ImNpbmVtYXRpYyIsImVhc2VTdHJlbmd0aCI6MSwiZGVwYXJ0dXJlRWFzZSI6ImFjY2VsZXJhdGUiLCJkZXBhcnR1cmVFYXNlU3RyZW5ndGgiOjEsInBvc2l0aW9uIjpbMCwtMC4yNSw0Ljc2MDYzNjMyOTU5MjY2ZS0xNF0sInBvc2UiOnsic2hpZnQiOjAuMjIsInZzaGlmdCI6MCwic2V0dGxlWCI6MTgwLCJzZXR0bGVZIjowLCJzZXR0bGVaIjoxODAsInNpemUiOjEuNiwic3Bvc1giOjAsInNwb3NZIjotMC4yNSwic3Bvc1oiOjQuNzYwNjM2MzI5NTkyNjZlLTE0LCJzcm90WCI6LTU5LjYyMDAwMDAwMDAwMDAzLCJzcm90WSI6NzEuOTk5OTk5OTk5OTk5OTcsInNyb3RaIjo5MCwic3NjYWxlIjowLjgsInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuNTU0NjM5MTMwNDM1MTE0Nywib2xlZEx1bWluYW5jZSI6MSwibGlnaHRBbWJpZW50IjowLjA1LCJsaWdodEtleSI6MS4yLCJsaWdodEZpbGwiOjAuMjUsImxpZ2h0RW52aXJvbm1lbnQiOjAuNSwiZXhwIjoxLCJsaWdodEtleVgiOjUsImxpZ2h0S2V5WSI6MTAsImxpZ2h0S2V5WiI6NSwibGlnaHRLZXlUZW1wZXJhdHVyZSI6NjUwMCwibGlnaHRGaWxsWCI6LTYsImxpZ2h0RmlsbFkiOjMsImxpZ2h0RmlsbFoiOjQsImxpZ2h0RmlsbFRlbXBlcmF0dXJlIjo5MDAwLCJnbGFzc1JlZ1giOi0wLjAzLCJnbGFzc1JlZ1kiOjAuMDksImdsYXNzUmVnWiI6MC4wNywiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjB9fSx7InNsb3QiOjEyMSwiZHVyYXRpb24iOjEuMjUsImhvbGQiOjAsIm1vdGlvbk1vZGUiOiJpbmhlcml0IiwiZWFzZSI6ImNpbmVtYXRpYyIsImVhc2VTdHJlbmd0aCI6MSwiZGVwYXJ0dXJlRWFzZSI6ImFjY2VsZXJhdGUiLCJkZXBhcnR1cmVFYXNlU3RyZW5ndGgiOjEsInBvc2l0aW9uIjpbMCwtMC4yNSw0Ljc2MDYzNjMyOTU5MjY2ZS0xNF0sInBvc2UiOnsic2hpZnQiOjAuMjIsInZzaGlmdCI6MCwic2V0dGxlWCI6MTgwLCJzZXR0bGVZIjowLCJzZXR0bGVaIjoxODAsInNpemUiOjEuNiwic3Bvc1giOjAsInNwb3NZIjotMC4yNSwic3Bvc1oiOjQuNzYwNjM2MzI5NTkyNjZlLTE0LCJzcm90WCI6LTU5LjYyMDAwMDAwMDAwMDAzLCJzcm90WSI6NzEuOTk5OTk5OTk5OTk5OTcsInNyb3RaIjo5MCwic3NjYWxlIjowLjgsInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuNTU0NjM5MTMwNDM1MTE0Nywib2xlZEx1bWluYW5jZSI6MSwibGlnaHRBbWJpZW50IjowLjA1LCJsaWdodEtleSI6MS4yLCJsaWdodEZpbGwiOjAuMjUsImxpZ2h0RW52aXJvbm1lbnQiOjAuNSwiZXhwIjoxLCJsaWdodEtleVgiOjUsImxpZ2h0S2V5WSI6MTAsImxpZ2h0S2V5WiI6NSwibGlnaHRLZXlUZW1wZXJhdHVyZSI6NjUwMCwibGlnaHRGaWxsWCI6LTYsImxpZ2h0RmlsbFkiOjMsImxpZ2h0RmlsbFoiOjQsImxpZ2h0RmlsbFRlbXBlcmF0dXJlIjo5MDAwLCJnbGFzc1JlZ1giOi0wLjAzLCJnbGFzc1JlZ1kiOjAuMDksImdsYXNzUmVnWiI6LTEuNSwiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjAuMTV9fSx7InNsb3QiOjEyMCwiZHVyYXRpb24iOjEuMjUsImhvbGQiOjAsIm1vdGlvbk1vZGUiOiJpbmhlcml0IiwiZWFzZSI6ImNpbmVtYXRpYyIsImVhc2VTdHJlbmd0aCI6MSwiZGVwYXJ0dXJlRWFzZSI6ImFjY2VsZXJhdGUiLCJkZXBhcnR1cmVFYXNlU3RyZW5ndGgiOjEsInBvc2l0aW9uIjpbMCwtMC4yNSw0Ljc2MDYzNjMyOTU5MjY2ZS0xNF0sInBvc2UiOnsic2hpZnQiOjAuMjIsInZzaGlmdCI6MCwic2V0dGxlWCI6MTgwLCJzZXR0bGVZIjowLCJzZXR0bGVaIjoxODAsInNpemUiOjEuNiwic3Bvc1giOjAsInNwb3NZIjotMC4yNSwic3Bvc1oiOjQuNzYwNjM2MzI5NTkyNjZlLTE0LCJzcm90WCI6LTU5LjYyMDAwMDAwMDAwMDAzLCJzcm90WSI6NzEuOTk5OTk5OTk5OTk5OTcsInNyb3RaIjo5MCwic3NjYWxlIjowLjgsInRpbHQiOjE4LCJsaWZ0IjowLjA4LCJwc2NhbGUiOjAuOCwic2hpbmUiOjAuNTU0NjM5MTMwNDM1MTE0Nywib2xlZEx1bWluYW5jZSI6MSwibGlnaHRBbWJpZW50IjowLjA1LCJsaWdodEtleSI6MS4yLCJsaWdodEZpbGwiOjAuMjUsImxpZ2h0RW52aXJvbm1lbnQiOjAuNSwiZXhwIjoxLCJsaWdodEtleVgiOjUsImxpZ2h0S2V5WSI6MTAsImxpZ2h0S2V5WiI6NSwibGlnaHRLZXlUZW1wZXJhdHVyZSI6NjUwMCwibGlnaHRGaWxsWCI6LTYsImxpZ2h0RmlsbFkiOjMsImxpZ2h0RmlsbFoiOjQsImxpZ2h0RmlsbFRlbXBlcmF0dXJlIjo5MDAwLCJnbGFzc1JlZ1giOi0wLjAzLCJnbGFzc1JlZ1kiOjAuMDksImdsYXNzUmVnWiI6MC4wNywiY3JhY2tFeGl0WCI6MC42LCJjcmFja0V4aXRZIjotMC4wNCwiY3JhY2tTZXZlcml0eSI6MSwiY3JhY2tTaGFycG5lc3MiOjEsImNyYWNrT24iOmZhbHNlLCJjcmFja1VzZURlZmF1bHQiOnRydWUsInAiOjB9fV19&mode=autoplay"

const HERO_FONT_FAMILY =
    '"Instrument Serif", "Instrument Serif Placeholder", Georgia, serif'
const HERO_FONT_STYLESHEET =
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
const HERO_FONT_LINK_ID = "iglass-instrument-serif-font"
type AutoplayPhase = "loading" | "playing" | "complete"
interface Props {
    embedUrl: string
    embedUrlCompact: string
    compactMaxWidth: number
    driveMode: "autoplay" | "scroll"
    scrollLength: number
    headline1: string
    headline2: string
    headline3: string
    fontSize: number
    headline1FontSize: number
    textLight: string
    textGrey: string
    darkBg: string
    lightBg: string
    bandTop: number
    ctaLabel: string
    ctaLink: string
    ctaBg: string
    ctaText: string
    bgEnd: number
    swap2Start: number
    swap2End: number
    ctaAt: number
    showP: boolean
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 900
 */
export default function HeroGlassDriver(props: Props) {
    const {
        embedUrl,
        embedUrlCompact,
        compactMaxWidth,
        driveMode,
        scrollLength,
        headline1,
        headline2,
        headline3,
        fontSize,
        headline1FontSize,
        textGrey,
        darkBg,
        lightBg,
        bandTop,
        ctaLabel,
        ctaLink,
        ctaBg,
        ctaText,
        swap2Start,
        swap2End,
        ctaAt,
        showP,
    } = props

    const isStatic = useIsStaticRenderer()
    const wrapRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const scrollSyncRef = useRef<() => void>(() => {})
    const pRef = useRef<number>(0)
    const [p, setP] = useState(0)
    const [introEnd, setIntroEnd] = useState(INTRO_END_FALLBACK)
    const [autoplayPhase, setAutoplayPhase] =
        useState<AutoplayPhase>("loading")
    // null = not yet measured. The iframe does not mount until this resolves,
    // so a phone never begins fetching the wide bundle.
    const [isCompact, setIsCompact] = useState<boolean | null>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const h3Ref = useRef<HTMLParagraphElement>(null)
    const edgeRef = useRef<{
        ax: number
        ay: number
        bx: number
        by: number
        p: number
        calibrated: boolean
        role: "near" | "far" | "legacy"
    } | null>(null)
    const edgeRafRef = useRef<number>(0)
    const h3PhaseRef = useRef<"waiting" | "revealing" | "latched">(
        "waiting"
    )
    const lastEdgePRef = useRef<number | null>(null)
    const lastClipRef = useRef<{ l: number; r: number } | null>(null)

    // ---- Path selection. Measured once, from this component's own stage box,
    // which is the same box the iframe fills and therefore the same width the
    // R3F app will read for its internal 810 gate.
    const compactThreshold =
        Number.isFinite(compactMaxWidth) && compactMaxWidth > 0
            ? compactMaxWidth
            : COMPACT_MAX_WIDTH_FALLBACK

    useEffect(() => {
        if (isStatic || typeof window === "undefined") return
        const stage = stageRef.current
        const measured = stage
            ? stage.getBoundingClientRect().width
            : window.innerWidth
        // A zero-width box means layout has not settled; fall back to the
        // window rather than latching a wrong choice.
        const width = measured > 0 ? measured : window.innerWidth
        setIsCompact(width < compactThreshold)
    }, [isStatic, compactThreshold])

    // Property-control strings arrive as an explicit "" rather than undefined,
    // so the authored compact path is a `||` fallback in code, not a
    // defaultValue. A URL typed into the panel overrides the bundled one; a
    // blank field means "use the bundled compact path".
    const activeEmbedUrl = isCompact
        ? embedUrlCompact || COMPACT_EMBED_URL
        : embedUrl

    const runtimeEmbedUrl = useMemo(() => {
        try {
            const url = new URL(activeEmbedUrl)
            url.searchParams.set("mode", driveMode)
            url.searchParams.delete("hold")
            return url.toString()
        } catch {
            return activeEmbedUrl
        }
    }, [activeEmbedUrl, driveMode])

    // Restrict postMessage target to the embed's origin (never '*').
    const targetOrigin = useMemo(() => {
        try {
            return new URL(runtimeEmbedUrl).origin
        } catch {
            return "*"
        }
    }, [runtimeEmbedUrl])

    // Load one persistent, explicit font source for every hero headline and
    // the CTA. Keeping this outside drive-mode state prevents autoplay and
    // scroll calibration from ever resolving to different Framer fallbacks.
    useEffect(() => {
        if (typeof document === "undefined") return
        if (document.getElementById(HERO_FONT_LINK_ID)) return

        const link = document.createElement("link")
        link.id = HERO_FONT_LINK_ID
        link.rel = "stylesheet"
        link.href = HERO_FONT_STYLESHEET
        document.head.appendChild(link)
    }, [])

    const setH3Hidden = () => {
        const h3 = h3Ref.current
        if (!h3) return
        h3.style.visibility = "hidden"
        h3.style.clipPath = H3_HIDDEN_CLIP
        h3.setAttribute("aria-hidden", "true")
    }

    const setH3Visible = () => {
        const h3 = h3Ref.current
        if (!h3) return
        h3.style.visibility = "visible"
        h3.style.clipPath = "none"
        h3.setAttribute("aria-hidden", "false")
    }

    const resetH3Reveal = () => {
        h3PhaseRef.current = "waiting"
        lastEdgePRef.current = null
        lastClipRef.current = null
        edgeRef.current = null
        setH3Hidden()
    }

    // ---- Calibrated dual-edge feed. H3 is completely hidden before
    // p=0.760. The near-side long edge drives 0.760–0.772; the far-side
    // long edge drives from 0.772 onward. Forward clipping is monotonic:
    // once a letter pixel is revealed, later edge motion cannot remove it.
    const applyLiveEdge = () => {
        const edge = edgeRef.current
        const stage = stageRef.current
        const h3 = h3Ref.current
        if (!edge || !stage || !h3) return
        const sr = stage.getBoundingClientRect()
        const hr = h3.getBoundingClientRect()
        if (sr.width === 0 || hr.width === 0 || hr.height === 0) return

        const x1 = edge.ax * sr.width
        const y1 = edge.ay * sr.height
        const x2 = edge.bx * sr.width
        const y2 = edge.by * sr.height
        const hL = hr.left - sr.left
        const hR = hr.right - sr.left
        const dx = x2 - x1
        const yAt = (x: number) =>
            Math.abs(dx) < 0.0001 ? y1 : y1 + ((x - x1) * (y2 - y1)) / dx

        const topOffset = hr.top - sr.top
        const yLpct = ((yAt(hL) - topOffset) / hr.height) * 100
        const yRpct = ((yAt(hR) - topOffset) / hr.height) * 100
        const previousP = lastEdgePRef.current
        const movingBackward =
            previousP !== null && edge.p < previousP - H3_DIRECTION_EPSILON
        lastEdgePRef.current = edge.p

        // Fail closed with v7.5.9 or older: those builds do not identify both
        // stable long edges. They must never drive an approximate H3 reveal.
        if (!edge.calibrated || edge.p < swap2Start) {
            h3PhaseRef.current = "waiting"
            lastClipRef.current = null
            setH3Hidden()
            return
        }

        if (h3PhaseRef.current === "latched" && !movingBackward) {
            setH3Visible()
            return
        }
        if (h3PhaseRef.current === "latched" && movingBackward) {
            h3PhaseRef.current = "revealing"
        }

        const clampPct = (v: number) => Math.min(150, Math.max(-50, v))
        const clipGuardPct = (H3_CLIP_GUARD_PX / hr.height) * 100
        let l = clampPct(yLpct - clipGuardPct)
        let r = clampPct(yRpct - clipGuardPct)

        // Forward reveal is an envelope of all prior edge positions. This
        // removes the post-0.840 seesaw without changing the physical boundary
        // that first reveals each pixel.
        const previousClip = lastClipRef.current
        if (!movingBackward && previousClip) {
            l = Math.max(previousClip.l, l)
            r = Math.max(previousClip.r, r)
        }
        lastClipRef.current = { l, r }

        // The glass edge owns only the physical reveal. H3 focus uses the
        // same single-element 12px-to-0px calculation as H1 and H2.
        if (
            !movingBackward &&
            edge.p >= H3_FOCUS_END &&
            Math.min(l, r) >= 100
        ) {
            h3PhaseRef.current = "latched"
            setH3Visible()
            return
        }

        h3PhaseRef.current = "revealing"
        h3.style.clipPath =
            `polygon(0% 0%, 100% 0%, 100% ${r}%, 0% ${l}%)`
        const anyRevealed = Math.max(l, r) > 0
        h3.style.visibility = anyRevealed ? "visible" : "hidden"
        h3.setAttribute("aria-hidden", anyRevealed ? "false" : "true")
    }

    useEffect(() => {
        if (isStatic || typeof window === "undefined") return
        const onMessage = (event: MessageEvent) => {
            if (targetOrigin !== "*" && event.origin !== targetOrigin) return
            const d = event.data
            if (!d || typeof d.type !== "string") return

            if (d.type === "iglass-scene-ready") {
                if (typeof d.introEnd === "number") {
                    setIntroEnd(clamp01(d.introEnd))
                }
                setAutoplayPhase("playing")
                return
            }

            if (d.type === "iglass-autoplay-progress") {
                if (typeof d.progress !== "number") return
                const next = clamp01(d.progress)
                pRef.current = next
                setP(next)
                return
            }

            if (d.type === "iglass-autoplay-complete") {
                pRef.current = 1
                setP(1)
                setAutoplayPhase("complete")
                return
            }

            if (d.type !== "glass-edge") return

            const isLine = (line: any) =>
                line &&
                line.a &&
                line.b &&
                typeof line.a.x === "number" &&
                typeof line.a.y === "number" &&
                typeof line.b.x === "number" &&
                typeof line.b.y === "number"

            const messageP =
                typeof d.p === "number" ? clamp01(d.p) : pRef.current
            const near = d.edges?.near
            const far = d.edges?.far
            const calibrated = isLine(near) && isLine(far)
            const selected = calibrated
                ? messageP < swap2End
                    ? near
                    : far
                : isLine({ a: d.a, b: d.b })
                  ? { a: d.a, b: d.b }
                  : null
            if (!selected) return

            edgeRef.current = {
                ax: selected.a.x,
                ay: selected.a.y,
                bx: selected.b.x,
                by: selected.b.y,
                p: messageP,
                calibrated,
                role: calibrated
                    ? messageP < swap2End
                        ? "near"
                        : "far"
                    : "legacy",
            }
            cancelAnimationFrame(edgeRafRef.current)
            edgeRafRef.current = requestAnimationFrame(applyLiveEdge)
        }
        window.addEventListener("message", onMessage)
        return () => {
            window.removeEventListener("message", onMessage)
            cancelAnimationFrame(edgeRafRef.current)
        }
    }, [isStatic, targetOrigin, swap2Start, swap2End])

    // Scroll calibration owns the same normalized 0→1 clock as autoplay.
    // The parent drives both its DOM headlines and the R3F iframe from the
    // component's existing scrollLength track.
    useEffect(() => {
        if (
            isStatic ||
            driveMode !== "scroll" ||
            typeof window === "undefined"
        )
            return

        let raf = 0
        const sendScrollProgress = () => {
            raf = 0
            const track = wrapRef.current
            const iframe = iframeRef.current
            if (!track || !iframe?.contentWindow) return

            const rect = track.getBoundingClientRect()
            const travel = Math.max(1, rect.height - window.innerHeight)
            const next = clamp01(-rect.top / travel)

            pRef.current = next
            setP(next)
            iframe.contentWindow.postMessage(
                { type: "scroll-progress", progress: next },
                targetOrigin
            )
        }
        const requestScrollSync = () => {
            if (!raf) raf = requestAnimationFrame(sendScrollProgress)
        }

        scrollSyncRef.current = requestScrollSync
        window.addEventListener("scroll", requestScrollSync, {
            passive: true,
        })
        window.addEventListener("resize", requestScrollSync, {
            passive: true,
        })
        requestScrollSync()

        return () => {
            scrollSyncRef.current = () => {}
            if (raf) cancelAnimationFrame(raf)
            window.removeEventListener("scroll", requestScrollSync)
            window.removeEventListener("resize", requestScrollSync)
        }
    }, [isStatic, driveMode, targetOrigin, scrollLength])

    // iframe load is not scene ready. Keep all headlines gated until the
    // Canvas sends iglass-scene-ready after two rendered model frames.
    const onIframeLoad = () => {
        pRef.current = 0
        setP(0)
        setIntroEnd(INTRO_END_FALLBACK)
        setAutoplayPhase("loading")
        resetH3Reveal()
        if (driveMode === "scroll") scrollSyncRef.current()
    }

    // ---- Frame state (single source of truth; static frame = p 0) ----
    const fp = isStatic ? 0 : p
    const introT = smooth(seg(fp, 0, introEnd))
    const darkOpacity = 1 - introT
    const h1Out = smooth(seg(fp, H1_OUT_START, H1_OUT_END))
    const h1Focus = smooth(seg(fp, H1_FOCUS_START, H1_FOCUS_END))
    const h2Out = smooth(seg(fp, H2_OUT_START, H2_OUT_END))
    const h2Focus = smooth(seg(fp, H2_REVEAL_START, H2_FOCUS_END))
    const h3Focus = smooth(seg(fp, H3_REVEAL_START, H3_FOCUS_END))
    const o1 = 1 - h1Out
    const o2 = 1 - h2Out
    const y1 = H1_REST_Y - 30 * h1Out
    const y2 = H2_REST_Y - 30 * h2Out
    const h1Blur =
        REVEAL_BLUR_PX * Math.max(1 - h1Focus, h1Out)
    const h2Blur =
        REVEAL_BLUR_PX * Math.max(1 - h2Focus, h2Out)
    const h3Blur = REVEAL_BLUR_PX * (1 - h3Focus)
    const sceneReady = isStatic || autoplayPhase !== "loading"
    const h1Visible = sceneReady && o1 > 0.001
    const h2Visible =
        sceneReady && fp >= H2_REVEAL_START && h2Out < 0.999
    const ctaO = smooth(seg(fp, ctaAt, Math.min(1, ctaAt + 0.04)))
    const ctaVisible = sceneReady && ctaO > 0.01

    const typographyBase: React.CSSProperties = {
        fontFamily: HERO_FONT_FAMILY,
        fontWeight: 400,
        fontStyle: "normal",
        fontStretch: "normal",
        fontKerning: "normal",
        fontVariantLigatures: "common-ligatures",
        fontFeatureSettings: '"kern" 1, "liga" 1',
        letterSpacing: "-0.01em",
        textRendering: "optimizeLegibility",
    }

    const headlineBase: React.CSSProperties = {
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: 0,
        width: "90%",
        textAlign: "center",
        ...typographyBase,
        fontSize: fontSize,
        lineHeight: 1.1,
        margin: 0,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        willChange: "opacity, transform, clip-path, filter",
    }

    return (
        <div
            ref={wrapRef}
            style={{
                position: "relative",
                width: "100%",
                height:
                    driveMode === "scroll" ? `${scrollLength}vh` : "100vh",
            }}
        >
            <div
                ref={stageRef}
                style={{
                    position: "sticky",
                    top: 0,
                    width: "100%",
                    height: "100vh",
                    overflow: "hidden",
                    background: lightBg,
                }}
            >
                {/* Dark layer under everything visual; reaches white exactly
                    when the authored path arrives at its first hold. */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: darkBg,
                        opacity: darkOpacity,
                        willChange: "opacity",
                    }}
                />

                {/* Headlines sit behind the transparent R3F layer so the phone and glass can occlude them. */}
                {/* Headline band */}
                <div
                    style={{
                        position: "absolute",
                        top: `${bandTop}%`,
                        left: 0,
                        right: 0,
                        height: fontSize * 1.4,
                        pointerEvents: "none",
                    }}
                >
                    <h1
                        aria-hidden={!h1Visible}
                        style={{
                            ...headlineBase,
                            color: textGrey,
                            fontSize: headline1FontSize,
                            opacity: sceneReady ? o1 : 0,
                            visibility: h1Visible ? "visible" : "hidden",
                            transform: `translateX(-50%) translateY(${y1}px)`,
                            filter: `blur(${h1Blur}px)`,
                        }}
                    >
                        {headline1}
                    </h1>
                    {h2Visible && (
                        <p
                            aria-hidden={false}
                            style={{
                                ...headlineBase,
                                color: textGrey,
                                opacity: o2,
                                visibility: "visible",
                                transform: `translateX(-50%) translateY(${y2}px)`,
                                filter: `blur(${h2Blur}px)`,
                            }}
                        >
                            {headline2}
                        </p>
                    )}
                    <p
                        ref={h3Ref}
                        aria-hidden={true}
                        style={{
                            ...headlineBase,
                            color: textGrey,
                            opacity: 1,
                            visibility: "hidden",
                            clipPath: H3_HIDDEN_CLIP,
                            filter: `blur(${h3Blur}px)`,
                        }}
                    >
                        {headline3}
                    </p>
                </div>

                {/* R3F iframe — transparent background required app-side (§4.1).
                    Held until the wide/compact choice resolves so exactly one
                    bundle, one GLB and one WebGL context are ever requested. */}
                {!isStatic && isCompact !== null && (
                    <iframe
                        ref={iframeRef}
                        src={runtimeEmbedUrl}
                        onLoad={onIframeLoad}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            border: "none",
                            background: "transparent",
                            pointerEvents: "none",
                        }}
                        title="iGlass 3D hero"
                    />
                )}

                {/* CTA — hidden from a11y tree and pointer until reveal */}
                <a
                    href={ctaLink}
                    style={{
                        position: "absolute",
                        left: "50%",
                        bottom: "8%",
                        transform: "translateX(-50%)",
                        padding: "16px 36px",
                        borderRadius: 999,
                        background: ctaBg,
                        color: ctaText,
                        ...typographyBase,
                        fontSize: 20,
                        textDecoration: "none",
                        opacity: ctaO,
                        visibility: ctaVisible ? "visible" : "hidden",
                        pointerEvents: ctaVisible ? "auto" : "none",
                        willChange: "opacity",
                    }}
                >
                    {ctaLabel}
                </a>

                {showP && !isStatic && (
                    <div
                        style={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "#888",
                            background: "rgba(255,255,255,0.7)",
                            padding: "2px 6px",
                            borderRadius: 4,
                        }}
                    >
                        p={fp.toFixed(3)} ·{" "}
                        {isCompact === null
                            ? "measuring"
                            : isCompact
                              ? "compact"
                              : "wide"}
                    </div>
                )}
            </div>
        </div>
    )
}

HeroGlassDriver.defaultProps = {
    embedUrl: "https://iphone-animation-five.vercel.app/?mode=autoplay",
    embedUrlCompact: "",
    compactMaxWidth: COMPACT_MAX_WIDTH_FALLBACK,
    driveMode: "autoplay",
    scrollLength: 400,
    headline1: "imagine",
    headline2: "changing the glass",
    headline3: "just the glass",
    fontSize: 128,
    headline1FontSize: 160,
    textLight: "#E9E9E9",
    textGrey: "#A9A9A9",
    darkBg: "#0A0A0A",
    lightBg: "#FFFFFF",
    bandTop: 9,
    ctaLabel: "Book a repair",
    ctaLink: "#book",
    ctaBg: "#111111",
    ctaText: "#FFFFFF",
    bgEnd: 0.2,
    swap2Start: H3_REVEAL_START,
    swap2End: H3_EDGE_SWITCH,
    ctaAt: 0.95,
    showP: false,
}

addPropertyControls(HeroGlassDriver, {
    embedUrl: { type: ControlType.String, title: "Embed URL (wide)" },
    embedUrlCompact: {
        type: ControlType.String,
        title: "Embed URL (compact)",
        description:
            "Overrides the bundled compact path used below the threshold. Leave empty to use the built-in compact URL.",
    },
    compactMaxWidth: {
        type: ControlType.Number,
        title: "Compact below (px)",
        min: 320,
        max: 1200,
        step: 1,
        description:
            "810 matches Framer's phone breakpoint and the R3F app's internal gate. Change all three together or none.",
    },
    driveMode: {
        type: ControlType.Enum,
        title: "Drive mode",
        options: ["autoplay", "scroll"],
        optionTitles: ["Autoplay", "Scroll calibration"],
    },
    scrollLength: {
        type: ControlType.Number,
        title: "Scroll (vh)",
        min: 150,
        max: 800,
        step: 10,
    },
    headline1: { type: ControlType.String, title: "Headline 1" },
    headline2: { type: ControlType.String, title: "Headline 2" },
    headline3: { type: ControlType.String, title: "Headline 3" },
    fontSize: {
        type: ControlType.Number,
        title: "Font size",
        min: 24,
        max: 240,
        step: 1,
    },
    headline1FontSize: {
        type: ControlType.Number,
        title: "Imagine size",
        min: 128,
        max: 200,
        step: 1,
    },
    textLight: { type: ControlType.Color, title: "Text (dark bg)" },
    textGrey: { type: ControlType.Color, title: "Text (light bg)" },
    darkBg: { type: ControlType.Color, title: "Dark bg" },
    lightBg: { type: ControlType.Color, title: "Light bg" },
    bandTop: {
        type: ControlType.Number,
        title: "Band top %",
        min: 0,
        max: 60,
        step: 1,
    },
    ctaLabel: { type: ControlType.String, title: "CTA label" },
    ctaLink: { type: ControlType.String, title: "CTA link" },
    ctaBg: { type: ControlType.Color, title: "CTA bg" },
    ctaText: { type: ControlType.Color, title: "CTA text" },
    bgEnd: {
        type: ControlType.Number,
        title: "BG lift end",
        min: 0.05,
        max: 0.5,
        step: 0.01,
    },
    swap2Start: {
        type: ControlType.Number,
        title: "H3 near start",
        min: 0,
        max: 1,
        step: 0.001,
    },
    swap2End: {
        type: ControlType.Number,
        title: "H3 far switch",
        min: 0,
        max: 1,
        step: 0.001,
    },
    ctaAt: {
        type: ControlType.Number,
        title: "CTA reveal",
        min: 0.5,
        max: 1,
        step: 0.01,
    },
    showP: { type: ControlType.Boolean, title: "Show p (dev)" },
})
