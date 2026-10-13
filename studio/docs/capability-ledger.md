# Capability ledger · Evolutionary PoC

**Status meaning:** working = implemented behaviour; proxy = intentional simplified visual substitute; partial = a working bounded subset; pending = not implemented. A source-site name describes visual inspiration, never an assertion about its original technology. `unit` means `tests/instruments.test.ts`; `browser` means `tests/browser-poc.cjs`; `demo` means `tests/poc-demos.cjs` and its committed PNG/WebM captures. Final counts are in `docs/poc/verification.md`.

## Editor and architecture

| Capability | Status | Implementation / evidence | Limits |
|---|---|---|---|
| Light spatial editor / contextual Layers & Assets / rack | working | VisualStudio, Rack; browser workspace; all demos | Advanced legacy editor remains at `?legacy` |
| Pointer/touchpad pan, cursor-centred zoom, focus, fit | working | VisualStudio pointer/wheel gestures | Native laptop feel awaits Matt |
| A Desktop + A Mobile + independent B | working | VisualProject boards/variants; browser isolation | Inactive 3D uses pose proxy |
| Add / duplicate / delete / rename / move boards | working | Artboard inspector and Ctrl & D; browser duplicate | Responsive view creation uses existing A Mobile or clone |
| Editable intermediate responsive widths | working | responsive evaluator + viewport width; browser 480px export | Free-layout adaptation; no automatic design solver |
| Inline text / width / size / typography | working | Stage, Rack; inherited legacy regression + new gestures | Line width is continuous; auto-layout of arbitrary nested legacy documents remains partial |
| Folder/category-searchable assets | partial | Layers search, compact actor library, local imports | Folder creation is pending |
| React component capability adapters | partial | Registered proof/stat cards, GLB adapter | Arbitrary React/R3F code import pending; Spline/Framer native import unsupported |
| Arrangement variations / remix | working | Editable Editorial / Reversed / Close-up forks | Preset generation, not AI generation |
| Instrument contract / typed inputs / outputs | working | registry/types/engine; unit | Bounded catalog; extensible registry, not universal interoperability |
| Semantic preview/cancel/commit / undo / SQLite / recovery | working | Existing store command path; unit + legacy/browser persistence | Undo history is session history; saved documents survive reload |
| ON/OFF, reset, duplicate, order, parameter depth | working | Rack controls and compound bypass; unit/browser | Incompatible replacement outputs are ordered, reported by evaluator |
| Property arbitration | working | translations add, scales multiply, quaternion rotations, clamped opacity; unit | No physics simulation guarantee |
| Cross-actor DAG routing / geometry response | working | clearance/follow/align/glint/reveal/synchronize, typed ports; unit/browser | Immediate feedback loops rejected; delayed feedback pending |
| Visual wires and contextual coupling | working | Connect actor → select target; Stage wires; iGlass demo | Wire drag-to-port authoring pending |
| Full scene states / endpoint edits / transitions | working | states, moments, interpolation; shape demo + browser | Non-numeric text/state changes switch at midpoint |
| Compound multi-actor Story Beats | working | enable/bypass, span move/stretch, coupling; unit/browser | Independent new beat UI selects current actor's instruments; full group selection pending |
| Reference import / scrub / freeze / sketch | working | Reference board and asset service | Original recordings absent; supplied contact sheets bundled |
| Intent JSON + assets + actual storyboard + replay | working | exportIntent + visual-runtime; browser export | Native Framer/Webflow routes explicitly unverified |
| Preview video capture | working | Playwright recording script; seven WebM demos | Export button captures stills; live screen recording button pending |

## Global dynamics and drivers

| Inventory item | Status | Instrument / sample / evidence | Boundary |
|---|---|---|---|
| Smooth/inertial scroll | working | `smooth`; all Preview/runtime; browser native scroll | Finite exponential settling; weight zero bypasses |
| Velocity skew/stretch with snapback | working | `velocity`; unit reduced-motion | Bounded response to master velocity |
| Time/autoplay, scroll/progress, pointer/hover | working | driver source + Play + `drift`; unit | Time transport currently follows master progress |
| Click / actor event / entry / section clocks | partial | actor progress driver, entry ranges; existing legacy section clocks | Click-triggered graph events and independent visual-editor section clocks pending |
| Springs/damping/inertia/lag | partial | orbit release and scroll smoothing; spring response modulator; browser orbit | Full spring mass/tension/damping signal nodes pending |
| Easing / phase / threshold / interpolation | working | ordered modulators + state interpolation; unit | Hysteresis modulator pending |
| Stagger | working | `stagger`, masked lines; Olympic | Explicit authored line breaks; automatic measured split lines pending |
| Reduced motion | working | dynamic media/query support, settle to final entrance states, suppress velocity; unit/browser | Human motion comfort not inferred |
| Theme inversion | working | `theme` stage environment | Light/dark stage transition is a threshold; continuous authored colour states interpolate |
| Grain / ambient styling / magnetic hover | partial | ambient environment; `depth` atmosphere; `drift` pointer | Grain and magnetic attraction pending |

## Viewport motion and typography

| Inventory item | Status | Instrument / sample / evidence | Boundary |
|---|---|---|---|
| Soft Rise entry / exit and top fade | working | `rise` with exit control; Olympic demo | Uses authored master progress range |
| Scale Settle | working | `settle`; Olympic terrain; unit | — |
| Masked line reveal / split-text / stagger | partial | `stagger`; registered text actors | Authored newline split, not arbitrary DOM word layout |
| Counter / telemetry reveal | working | `counter`; Aevion demo | Counters are illustrative fixture metrics |
| Hover/focus transitions | partial | `drift` pointer response; standard control focus | Authored focus-event choreography pending |
| Typography rhythm / presets / mobile wrapping | working | Rack + responsive base/overrides; browser | — |
| Once / every entry / reverse / scrub | working | driver mode + controlled progress | Entry is based on authored timeline range, not IntersectionObserver |

## Media, layouts and transitions

| Inventory item | Status | Instrument / sample / evidence | Boundary |
|---|---|---|---|
| Parallax Window / depth / overscan / focal point | working | `parallax`; Olympic; unit/browser/demo | Axis and overscan in expanded controls |
| Circle/stadium/rounded aperture / video portal | working | `aperture`; Morpho, Cartier; demo | Custom SVG aperture authoring pending |
| Direct portal endpoint / independent focal point | working | Stage portal edge handle + expanded controls | Aligned CSS mask, not a cut through live 3D geometry |
| Video within mask → full bleed | working | Morpho animated illustration; demo | Source footage substitute is explicitly labelled in export |
| Hover drift / cursor parallax | working | `drift`; capability-filtered rack | — |
| Grain / decorative frame corners | pending | no inert catalog entry | Future instrument |
| Crop / scale / position / multilevel staging | working | media properties + parallax/depth and layer order | Crop focus uses cover; advanced crop frame authoring partial |
| Stage pin / travel / flow continuity | partial | `stage` + Preview sticky travel; Olympic flow; browser | Multi-section visual editing beyond existing legacy editor pending |
| Asymmetric L/R editorial split / flip | working | Olympic scene + Reversed variation | Authored free-layout with responsive decisions |
| Grid/cards, stack deck, horizontal pinned ribbon | partial | registered cards and layer ordering | Automatic grid/deck/ribbon rigs pending |
| Rotating L/R product handoff | working | Cartier linked states + orbit; demo | Secondary inactive product is editable pose proxy |
| Full-bleed media | working | Morpho portal | — |
| Coordinated gallery scale/mask/crop/text/background | partial | editable instrument composition / state graph | Gallery-specific adaptive layout rig pending |

## 3D and hybrid DOM

| Inventory item | Status | Instrument / sample / evidence | Boundary |
|---|---|---|---|
| Scroll + pointer orbit / smooth handoff | working | `orbit`; iGlass and Aevion; browser | Uses quaternion composition, finite release |
| Named-mesh separation / part fold | working | `part`; actual Glass_Front; Aevion/Teatika fixtures | Hinges on imported arbitrary GLBs need authored pivot |
| Raycast pick / stable local mesh identity | working | Pick surface → GLTF hit point/name; InstrumentScene | Primitive fixture pin uses root local coordinates |
| On-canvas part axis arrow | pending | separation/axis currently rack controls | No inert handle claimed |
| Camera dolly / orbit / FOV / responsive camera | working | `camera`; sample scenes + mobile overrides | Explicit target position handle pending |
| Specular glint puck / real controlled light | working | `glint` + real environment/directional light; demos | Not replication of source site's lighting |
| Lattice → solid / PBR preservation | working | `material`; GLB material/overlay blend; Teatika fixture | Fixture switches wireframe; no topology morph |
| Surface wipe / true morph | partial | DOM curtain/mask and representation transitions | True geometry morph is pending |
| 3D → DOM hotspot follows pose and camera | working | `hotspot`; projected mesh-local pin; browser | Frustum clipping only, surface occlusion pending |
| Depth sandwich / atmosphere / layer order | proxy | `depth` + CSS layer order | No real DOM/WebGL refraction or depth-aware occlusion |
| Mesh state + metrics + labels as one beat | working | Aevion three states and iGlass; demos | Metrics are fixture data |
| Cross-media continuity | proxy | Morpho camera + expanding video mask | Visual alignment; not geometric portal intersection |

## Compound coverage

| Scenario | Status | Evidence | Exact substitution / remaining scope |
|---|---|---|---|
| Olympic | working | `olympic.png`, `olympic.webm`, browser | Original vector scenery instead of source photography |
| Cartier | partial | `cartier.png`, `cartier.webm` | Original watch fixture; aperture, depth, L/R handoff, final illustrated video; source photography/gallery not reproduced |
| Morpho | proxy | `morpho.png`, `morpho.webm` | Original can and animated illustrated coast; CSS portal, no true hole in model |
| Aevion | proxy | `aevion.png`, `aevion.webm` | Original folding drone, linked labels/counter/pin; LiDAR terrain transition pending |
| Teatika | proxy | `teatika.png`, `teatika.webm` | Original hinged case with wireframe/solid and light; not handbag/ring/furniture assets |
| Montfort / Watches & Wonders | partial | `depth`, `curtain` registry | Atmosphere/curtain primitives; no separate benchmark scene |
| iGlass | working | `iglass.png`, `iglass.webm`, browser | Original GLB, real front glass, glint, camera, bounds-driven copy; production Hero unchanged |
| Triangle → rectangle → circle | working | `shapes.png`, `shapes.webm`, browser | Equal-vertex polygon interpolation; editable/reorderable states |
| Product configurator / scene options | partial | states and registered actors | Configurator dimensions/build-sheet logic pending |
| Saved rearrangements / recombination | partial | independent forks, arrangement presets, legacy Takes | Cross-variant selected-subgraph recombination pending |

All pending items remain scoped work, not completed claims. Technical acceptance and Matt's evolutionary-advance verdict remain separate.
