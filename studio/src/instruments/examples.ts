import {
  clone,
  uid,
  type Entity,
  type Props,
  type StudioDocument,
} from "../model";
import { makeEntity } from "../seed";
import { instantiate } from "./registry";
import type { Variant, VisualProject, SceneState, ActorLink } from "./types";
export const examples = [
  {
    id: "iglass",
    name: "iGlass",
    sub: "Glass, light & living copy",
    colour: "#dce9df",
  },
  {
    id: "olympic",
    name: "Olympic editorial",
    sub: "Depth, rhythm & reveal",
    colour: "#c6d6d9",
  },
  {
    id: "cartier",
    name: "Cartier rhythm",
    sub: "Aperture & product handoffs",
    colour: "#e8d9c9",
  },
  {
    id: "morpho",
    name: "Morpho portal",
    sub: "Approach into another world",
    colour: "#bed7d8",
  },
  {
    id: "aevion",
    name: "Aevion states",
    sub: "Scan · Connect · Compact",
    colour: "#dbe0ea",
  },
  {
    id: "teatika",
    name: "Teatika material",
    sub: "Lattice, hinge & light",
    colour: "#e2d8c8",
  },
  {
    id: "shapes",
    name: "Shape playground",
    sub: "Draw three states. Connect them.",
    colour: "#e3d8f2",
  },
];
const actor = (
  id: string,
  kind: Entity["kind"],
  p: Props,
  mobile: Props = {},
): Entity => ({
  ...makeEntity(kind),
  id,
  name: id.replace(/-/g, " ").replace(/^./, (x) => x.toUpperCase()),
  props: { ...makeEntity(kind).props, ...p },
  overrides: { mobile: { ...mobile } },
});
const empty = (): StudioDocument => ({
  schemaVersion: 2,
  id: uid("composition"),
  name: "Visual composition",
  revision: 0,
  duration: 8,
  profiles: [
    { id: "desktop", name: "Desktop", width: 1200, height: 760 },
    { id: "mobile", name: "Mobile", width: 390, height: 900 },
  ],
  entities: [],
  copy: [],
  assets: [],
  tracks: [],
  poses: [],
  bindings: [],
  relationships: [],
  clocks: [{ id: "page", name: "Page", source: "scroll" }],
  actions: [],
});
export const makeLink = (
  source: string,
  target: string,
  kind: ActorLink["kind"],
): ActorLink => ({
  id: uid("link"),
  source,
  target,
  kind,
  enabled: true,
  amount: 1,
  sourcePort: {
    id: kind === "clearance" ? "bounds" : "orientation",
    unit: kind === "clearance" ? "px" : "degrees",
    space: "stage",
  },
  targetPort: {
    id: kind === "clearance" ? "layout" : "position",
    unit: "px",
    space: "stage",
  },
});
export function exampleVariant(example = "iglass"): Variant {
  const v: Variant = {
    id: uid("variant"),
    name: "A",
    document: empty(),
    instruments: [],
    states: [],
    beats: [],
    links: [],
    background: "#f2f1ec",
    example,
    references: [],
  };
  const refName =
    example === "cartier"
      ? "cartier"
      : example === "aevion"
        ? "aevion"
        : ["morpho", "teatika"].includes(example)
          ? "morpho-teatika"
          : null;
  if (refName)
    v.references.push({
      id: uid("reference"),
      name: "Supplied " + example + " contact sheet",
      assetUrl: "/assets/poc/references/" + refName + ".jpg",
      type: "image",
      timecode: 0,
      observation:
        "Contact-sheet observation from the supplied build pack; original motion video unavailable in this build session.",
      inferredControl:
        example === "cartier"
          ? "Aperture and alternating handoff"
          : example === "aevion"
            ? "Linked pose, metrics and surface annotations"
            : "Approach, aperture, material and articulation",
      fidelity: "partial",
      strokes: [],
    });
  const d = v.document;
  d.name = examples.find((e) => e.id === example)?.name ?? example;
  const add = (
    id: string,
    target?: string,
    values: Record<string, number> = {},
    range: [number, number] = [0, 1],
  ) => {
    const i = instantiate(id, target);
    Object.assign(i.macroValues, values);
    i.drivers[0].range = range;
    v.instruments.push(i);
    return i;
  };
  add("smooth");
  add("stage");
  const header = actor(
    "eyebrow",
    "text",
    {
      x: 64,
      y: 42,
      width: 850,
      height: 30,
      text: "IGLASS   /   ORIGINAL, REIMAGINED",
      fontSize: 12,
      letterSpacing: 2,
      fontWeight: 600,
      color: "#334139",
    },
    { x: 26, y: 30, width: 330, fontSize: 10 },
  );
  const headline = actor(
    "headline",
    "text",
    {
      x: 68,
      y: 176,
      width: 580,
      height: 300,
      text: "Keep what\nmakes it\noriginal.",
      fontSize: 86,
      letterSpacing: -4,
      fontWeight: 500,
      lineHeight: 1.02,
    },
    { x: 26, y: 90, width: 335, height: 180, fontSize: 52, letterSpacing: -2 },
  );
  const body = actor(
    "support",
    "text",
    {
      x: 72,
      y: 545,
      width: 410,
      height: 75,
      text: "One movement. Glass, light and words,\nresponding together.",
      fontSize: 18,
      letterSpacing: -0.3,
      lineHeight: 1.55,
      color: "#6b756c",
    },
    { x: 26, y: 745, width: 330, height: 75, fontSize: 16 },
  );
  const phone = actor(
    "product",
    "scene",
    {
      x: 570,
      y: 65,
      width: 560,
      height: 625,
      rotateX: 0,
      rotateY: 145,
      rotateZ: -8,
      partDirection: -1,
      scale: 1,
      roughness: 0.25,
      metalness: 0.4,
      partName: "Glass_Front",
      hotspotText: "Original OLED",
      hotspotX: 0,
      hotspotY: 0.5,
      hotspotZ: 0.15,
    },
    { x: 8, y: 300, width: 374, height: 450, rotateZ: -4 },
  );
  const footer = actor(
    "footer",
    "text",
    {
      x: 72,
      y: 712,
      width: 1000,
      height: 24,
      text: "01 — A STUDY IN RESTORATION                                         SCROLL TO EXPLORE  ↓",
      fontSize: 11,
      letterSpacing: 1.4,
      color: "#71796e",
    },
    { x: 26, y: 863, width: 335, fontSize: 9 },
  );
  d.entities = [header, headline, body, phone, footer];
  d.assets = [
    {
      id: "phone-asset",
      name: "Original iPhone · four named meshes",
      type: "model",
      url: "/assets/14_pro_oled_repaired.glb",
    },
  ];
  let names = ["Arrive", "Reveal", "Restore"];
  if (example === "iglass") {
    add("orbit", "product", { turn: 68, tilt: 12 });
    add("part", "product", { lift: 0.65 }, [0.22, 0.85]);
    const light = add("glint", "product", { angle: -60, intensity: 5 });
    light.drivers[0].modulators.push({ kind: "phase", amount: 0.08 });
    add("camera", "product", { dolly: 0.5, orbit: 12 });
    add("hotspot", "product");
    add("rise", "support", { lift: 28 }, [0, 0.3]);
    v.links = [makeLink("product", "headline", "clearance")];
    // An actor-emitted orientation also drives a separate light-bearing actor through the same graph.
    const cue = actor(
      "light-cue",
      "svg",
      {
        x: 1060,
        y: 110,
        width: 40,
        height: 40,
        background: "#b3bca5",
        shape: 2,
        opacity: 0.5,
      },
      { x: 320, y: 260, width: 20, height: 20 },
    );
    d.entities.push(cue);
    v.links.push(makeLink("product", "light-cue", "glint"));
  } else if (example === "olympic") {
    v.background = "#f6f5ef";
    v.instruments = v.instruments.filter((i) => i.definitionId !== "stage");
    header.props.text = "NORTH / FIELD NOTES";
    headline.props.text = "A slower\nway of seeing.";
    Object.assign(headline.props, { x: 68, y: 180, width: 470, fontSize: 82 });
    body.props.text =
      "Follow the coast. Find another perspective.\nAn editorial composition in three movements.";
    body.props.y = 480;
    d.entities = d.entities.filter((e) => e.id !== "product");
    d.entities.push(
      actor(
        "coast",
        "image",
        {
          x: 615,
          y: 100,
          width: 520,
          height: 570,
          src: "/assets/poc/coast.svg",
          radius: 2,
        },
        { x: 26, y: 310, width: 338, height: 400 },
      ),
      actor(
        "chapter",
        "text",
        {
          x: 670,
          y: 900,
          width: 470,
          height: 300,
          text: "Between land\nand water.",
          fontSize: 78,
          letterSpacing: -4,
        },
        { x: 26, y: 850, width: 330, height: 150, fontSize: 46 },
      ),
      actor(
        "terrain",
        "image",
        {
          x: 65,
          y: 820,
          width: 510,
          height: 560,
          src: "/assets/poc/terrain.svg",
        },
        { x: 26, y: 1030, width: 338, height: 380 },
      ),
    );
    footer.props.y = 1460;
    footer.overrides.mobile.y = 1470;
    add("parallax", "coast", { depth: 0.42 });
    add("rise", "headline", { lift: 55 }, [0, 0.12]);
    add("parallax", "terrain", { depth: 0.6 }, [0.3, 1]);
    add("rise", "chapter", { lift: 70 }, [0.3, 0.6]);
    add("settle", "terrain", { depth: 0.15 }, [0.2, 0.65]);
    names = ["Coast", "Passage", "Landscape"];
  } else if (example === "cartier") {
    v.background = "#f4f0e9";
    header.props.text = "ATELIER / MECHANICAL POETRY";
    headline.props.text = "A different\nmeasure\nof time.";
    phone.props.rotateY = -24;
    phone.props.fixture = "watch";
    phone.props.modelUrl = "";
    phone.props.rotateZ = 12;
    phone.props.hotspotText = "Sapphire / fixture";
    body.props.text =
      "An original sample watch.\nA study of aperture, rhythm and handoff.";
    d.entities.unshift(
      actor(
        "portal",
        "image",
        {
          x: 0,
          y: 0,
          width: 1200,
          height: 760,
          src: "/assets/poc/coast.svg",
          opacity: 0.45,
        },
        { x: 0, y: 0, width: 390, height: 900 },
      ),
    );
    const second = actor(
      "second-product",
      "scene",
      {
        ...phone.props,
        x: 650,
        y: 120,
        width: 460,
        height: 560,
        opacity: 0,
        fixture: "watch",
        rotateY: -40,
      },
      { x: 80, y: 420, width: 260, height: 350, opacity: 0 },
    );
    d.entities.push(second);
    add("aperture", "portal", { open: 1.1, end: 0.28, shape: 1 }, [0, 0.3]);
    add("parallax", "portal", { depth: 0.35 });
    add("orbit", "product", { turn: 180, tilt: 0 });
    add("glint", "product");
    add("orbit", "second-product", { turn: -110, tilt: 10 });
    add("glint", "second-product");
    d.entities.push(actor("finale", "video", {
      x: 0, y: 0, width: 1200, height: 760,
      src: "/assets/poc/tide.webm", poster: "/assets/poc/coast.svg",
    }, { x: 0, y: 0, width: 390, height: 900 }));
    add("rise", "finale", { lift: 0 }, [0.86, 1]);
    names = ["Lens", "Passage", "Handoff"];
  } else if (example === "morpho") {
    v.background = "#102b32";
    header.props.text = "MORPHO / A WORLD WITHIN";
    header.props.color = "#d4e5df";
    headline.props.text = "A world\nwithin.";
    headline.props.color = "#d4e5df";
    body.props.text = "A small opening.\nA different world.";
    body.props.color = "#c0d8d0";
    phone.props.rotateY = -24;
    phone.props.fixture = "can";
    phone.props.modelUrl = "";
    d.entities.push(
      actor(
        "portal",
        "video",
        {
          x: 0,
          y: 0,
          width: 1200,
          height: 760,
          src: "/assets/poc/tide.webm",
          poster: "/assets/poc/coast.svg",
          opacity: 1,
        },
        { x: 0, y: 0, width: 390, height: 900 },
      ),
      actor(
        "portal-copy",
        "text",
        {
          x: 90,
          y: 460,
          width: 650,
          height: 200,
          text: "Follow\nthe feeling.",
          fontSize: 96,
          letterSpacing: -4,
          color: "#fff",
          opacity: 1,
        },
        { x: 26, y: 540, width: 340, height: 200, fontSize: 62 },
      ),
    );
    add("orbit", "product", { turn: 80, tilt: -35 });
    add("camera", "product", { dolly: 2.1, orbit: 0 }, [0, 0.5]);
    add("aperture", "portal", { open: 0.02, end: 1.5, shape: 1 }, [0.35, 0.82]);
    add("rise", "portal-copy", { lift: 50 }, [0.7, 1]);
    names = ["Approach", "Opening", "World"];
  } else if (example === "aevion") {
    v.background = "#eef1f2";
    header.props.text = "AEVION / SPATIAL INTELLIGENCE";
    headline.props.text = "See more.\nUnderstand\nfurther.";
    phone.props.rotateY = -24;
    phone.props.fixture = "drone";
    phone.props.modelUrl = "";
    phone.props.hotspotText = "LiDAR sensor";
    phone.props.hotspotY = -0.2;
    phone.props.hotspotZ = 0.5;
    phone.props.rotateZ = 0;
    body.props.text = "Scan · Connection · Compactness";
    d.entities.push(
      actor(
        "metric",
        "text",
        {
          x: 80,
          y: 630,
          width: 460,
          height: 60,
          text: "450",
          fontSize: 44,
          letterSpacing: -2,
        },
        { x: 26, y: 790, width: 300, height: 60, fontSize: 36 },
      ),
    );
    add("orbit", "product", { turn: 140, tilt: 10 });
    add("part", "product", { hinge: 85, lift: 0 }, [0.55, 1]);
    add("hotspot", "product");
    add("camera", "product", { dolly: 0, orbit: 28 });
    add("counter", "metric", { end: 450 }, [0, 0.5]);
    add("glint", "product", { angle: 40, intensity: 4 });
    v.links = [makeLink("product", "headline", "clearance")];
    names = ["Scan", "Connection", "Compactness"];
  } else if (example === "teatika") {
    v.background = "#22231f";
    header.props.text = "TEATIKA / MATERIAL STUDIES";
    header.props.color = "#d1bf99";
    headline.props.text = "Every detail.\nMade visible.";
    headline.props.color = "#f2eadd";
    body.props.text =
      "From structure to surface.\nAn articulated sample, under moving light.";
    body.props.color = "#aeaa9b";
    phone.props.rotateY = -24;
    phone.props.fixture = "case";
    phone.props.modelUrl = "";
    phone.props.rotateZ = 0;
    add("material", "product", { solid: 1, roughness: 0.22 });
    add("part", "product", { hinge: 90, lift: 0 }, [0.35, 0.9]);
    add("glint", "product", { angle: -70, intensity: 7 });
    add("orbit", "product", { turn: 80, tilt: 6 });
    add("camera", "product", { dolly: 0.5, orbit: 15 });
    names = ["Structure", "Surface", "Open"];
  } else if (example === "shapes") {
    v.background = "#f6f2ed";
    header.props.text = "FORM / THREE MOMENTS";
    headline.props.text = "Make a\nshape of it.";
    body.props.text =
      "Select a state. Move, resize or reshape.\nScrub between your choices.";
    d.entities = d.entities.filter((e) => e.id !== "product");
    d.entities.push(
      actor(
        "shape",
        "svg",
        {
          x: 670,
          y: 230,
          width: 290,
          height: 290,
          background: "#8467d6",
          shape: 0,
        },
        { x: 100, y: 420, width: 190, height: 190 },
      ),
    );
    names = ["Triangle", "Rectangle", "Circle"];
  }
  if (example !== "olympic") {
    v.states = names.map((name, i) => ({
      id: uid("state"),
      name,
      at: i / 2,
      actors: {},
      mobile: {},
    }));
    if (example === "iglass")
      v.states.forEach((s, i) => {
        s.actors.product = { rotateX: [-8, 9, -4][i], hotspotText: ["Original OLED", "Lift / named front glass", "Restore the original"][i] };
        s.actors.support = { color: ["#6b756c", "#334139", "#6b756c"][i] };
      });
    if (example === "cartier")
      v.states.forEach((s, i) => {
        s.at = [0, 0.4, 0.78][i];
        s.actors.product = { x: [620, 620, 70][i], y: 100 };
        s.actors["second-product"] = { opacity: [0, 0, 1][i] };
        s.actors.headline = {
          x: [68, 68, 520][i],
          width: 480,
          opacity: [1, 1, 0][i],
        };
        s.mobile = {
          product: { x: [8, 8, -100][i], y: 320 },
          "second-product": { opacity: [0, 0, 1][i] },
        };
      });
    if (example === "morpho")
      v.states.forEach((s, i) => {
        s.actors.product = { opacity: [1, 1, 0][i] };
        s.actors.headline = { opacity: [1, 0.6, 0][i] };
      });
    if (example === "aevion")
      v.states.forEach((s, i) => {
        s.actors.product = { rotateX: [-18, 12, 0][i], rotateZ: [0, -6, 3][i], hotspotText: ["LiDAR / scan", "Link / connected", "Arms / compact"][i] };
        s.actors.metric = { color: ["#304c60", "#397d76", "#304c60"][i] };
        s.actors.support = {
          text: [
            "Scan · 450 m range",
            "Connection · ±2 cm precision",
            "Compactness · 42 cm silhouette",
          ][i],
        };
      });
    if (example === "shapes")
      v.states.forEach((s, i) => {
        s.actors.shape = {
          x: [650, 620, 760][i],
          y: [190, 280, 190][i],
          width: [280, 350, 230][i],
          height: [300, 180, 230][i],
          shape: i,
          rotation: [-8, 0, 20][i],
          background: ["#8467d6", "#d18851", "#4b9280"][i],
        };
        s.mobile = {
          shape: {
            x: [50, 30, 130][i],
            y: [400, 440, 450][i],
            width: [220, 320, 200][i],
            height: [240, 150, 200][i],
          },
        };
      });
  }
  const beatId = uid("beat");
  v.beats = [
    {
      id: beatId,
      name:
        example === "iglass"
          ? "Glass · Light · Copy"
          : example === "olympic"
            ? "Coast to landscape"
            : names.join(" → "),
      start: 0,
      end: 1,
      enabled: true,
      strength: 1,
      instrumentIds: v.instruments
        .filter((i) => i.targetId)
        .map((i) => i.stableId),
      stateIds: v.states.map((s) => s.id),
    },
  ];
  v.instruments.filter((i) => i.targetId).forEach((i) => (i.beatId = beatId));
  return v;
}
export function makeProject(example = "iglass"): VisualProject {
  const a = exampleVariant(example),
    b = clone(a);
  b.id = uid("variant");
  b.name = "B";
  const headline = b.document.entities.find((e) => e.id === "headline");
  if (headline) {
    headline.props.fontFamily = "Georgia, serif";
    headline.props.fontWeight = 400;
    headline.props.letterSpacing = -3;
  }
  for (const i of b.instruments)
    if (i.definitionId === "orbit") i.macroValues.turn = -i.macroValues.turn;
  return {
    version: 1,
    variants: [a, b],
    boards: [
      {
        id: uid("board"),
        name: "A · Desktop",
        variantId: a.id,
        profile: "desktop",
        width: 1200,
        height: 760,
        x: 0,
        y: 0,
      },
      {
        id: uid("board"),
        name: "A · Mobile",
        variantId: a.id,
        profile: "mobile",
        width: 390,
        height: 900,
        x: 1260,
        y: 0,
      },
      {
        id: uid("board"),
        name: "B · Desktop",
        variantId: b.id,
        profile: "desktop",
        width: 1200,
        height: 760,
        x: 1710,
        y: 0,
      },
    ],
  };
}
