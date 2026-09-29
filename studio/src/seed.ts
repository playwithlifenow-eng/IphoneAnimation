import { type StudioDocument, type Entity, type Kind, uid } from "./model";
export const COMPONENTS = [
  {
    id: "proof-card",
    name: "Proof card",
    description: "A compact service or evidence card.",
    category: "Content",
    capabilities: ["Text", "Colour", "Layout", "Responsive"],
    defaults: {
      title: "Original OLED. Preserved.",
      text: "Keep the display you already paid for.",
      background: "#e7e6df",
      color: "#202a28",
      radius: 16,
      padding: 24,
    },
  },
  {
    id: "stat-card",
    name: "Statistic",
    description: "A number with a clear supporting label.",
    category: "Content",
    capabilities: ["Text", "Colour", "Layout"],
    defaults: {
      title: "12 months",
      text: "Screen warranty",
      background: "#233d35",
      color: "#f4f3eb",
      radius: 16,
      padding: 24,
    },
  },
  {
    id: "hero-reference",
    name: "Existing Hero",
    description: "Pinned source reference. Live host integration pending.",
    category: "Reference",
    capabilities: ["Reference", "Position", "Size"],
    defaults: {
      title: "Existing Hero · 7.5.51",
      text: "Production stays intact. The versioned host adapter is pending.",
      background: "#e5ebe6",
      color: "#263e34",
      radius: 16,
      padding: 24,
    },
  },
];
export function makeEntity(kind: Kind, index = 0): Entity {
  const id = uid(kind);
  return {
    id,
    name:
      kind === "scene"
        ? "Product scene"
        : `${kind[0].toUpperCase() + kind.slice(1)} ${index + 1}`,
    kind,
    props: {
      x: 90 + index * 18,
      y: 140 + index * 18,
      width:
        kind === "scene"
          ? 420
          : kind === "button"
            ? 190
            : kind === "line"
              ? 300
              : 320,
      height:
        kind === "scene"
          ? 520
          : kind === "button"
            ? 52
            : kind === "text"
              ? 90
              : kind === "line"
                ? 2
                : 200,
      rotation: 0,
      opacity: 1,
      visible: true,
      text:
        kind === "button"
          ? "Explore the repair"
          : kind === "text"
            ? "Make room for an idea."
            : "",
      fontSize: kind === "text" ? 40 : 16,
      fontWeight: kind === "text" ? 500 : 400,
      lineHeight: 1.12,
      letterSpacing: -1,
      color: "#233a30",
      background:
        kind === "button"
          ? "#c8f36a"
          : kind === "frame"
            ? "#ecebe4"
            : "transparent",
      radius: kind === "button" ? 26 : 0,
      padding: 0,
      layout: "free",
      gap: 16,
      modelUrl: "/assets/14_pro_oled_repaired.glb",
      rotateX: 0,
      rotateY: -24,
      rotateZ: -10,
      scale: 1,
      cameraZ: 5,
      fov: 35,
      ambient: 1.5,
      key: 3,
      roughness: 0.45,
      metalness: 0.3,
      exposure: 1,
      lightX: 4,
      lightY: 5,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
    },
    overrides: { mobile: { x: 24, y: 240, width: 340 } },
  };
}
export function seedDocument(): StudioDocument {
  const headline = makeEntity("text");
  Object.assign(headline, {
    id: "headline",
    name: "The main idea",
    copyId: "copy-headline",
  });
  Object.assign(headline.props, {
    x: 78,
    y: 140,
    width: 570,
    height: 280,
    fontSize: 86,
    fontWeight: 500,
    lineHeight: 0.99,
    letterSpacing: -5,
    text: "A clearer\npoint of view.",
  });
  headline.overrides = {
    mobile: {
      x: 26,
      y: 80,
      width: 335,
      height: 150,
      fontSize: 50,
      letterSpacing: -2.5,
    },
  };
  const kicker = makeEntity("text");
  Object.assign(kicker, { id: "kicker", name: "Eyebrow" });
  Object.assign(kicker.props, {
    x: 82,
    y: 90,
    width: 500,
    height: 24,
    text: "IGLASS  /  A DIFFERENT KIND OF REPAIR",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 2,
    lineHeight: 1.5,
  });
  kicker.overrides = { mobile: { x: 28, y: 36, width: 335, fontSize: 9 } };
  const body = makeEntity("text");
  Object.assign(body, {
    id: "body",
    name: "Supporting copy",
    copyId: "copy-body",
  });
  Object.assign(body.props, {
    x: 84,
    y: 442,
    width: 375,
    height: 78,
    text: "Change the glass. Keep what matters.\nDiscover a new perspective on your original display.",
    fontSize: 17,
    lineHeight: 1.55,
    letterSpacing: -0.3,
    color: "#697169",
  });
  body.overrides = {
    mobile: { x: 28, y: 230, width: 310, fontSize: 14, height: 80 },
  };
  const button = makeEntity("button");
  Object.assign(button, { id: "cta", name: "Primary action" });
  Object.assign(button.props, {
    x: 82,
    y: 548,
    width: 198,
    height: 52,
    text: "Explore the repair  ↗",
    href: "https://iglassmobilephonerepairs.framer.website",
    letterSpacing: -0.2,
    fontWeight: 500,
  });
  button.overrides = { mobile: { x: 28, y: 320, width: 195 } };
  const scene = makeEntity("scene");
  Object.assign(scene, { id: "phone", name: "Original OLED · 3D" });
  Object.assign(scene.props, { x: 642, y: 76, width: 470, height: 586 });
  scene.overrides = {
    mobile: {
      x: 5,
      y: 377,
      width: 370,
      height: 430,
      rotateZ: -6,
      rotateY: -18,
    },
  };
  const rule = makeEntity("line");
  Object.assign(rule, { id: "rule", name: "Section divider" });
  Object.assign(rule.props, {
    x: 82,
    y: 677,
    width: 1032,
    height: 1,
    background: "#cbd0c5",
  });
  rule.overrides = { mobile: { x: 28, y: 838, width: 320 } };
  const foot = makeEntity("text");
  Object.assign(foot, { id: "footnote", name: "Composition note" });
  Object.assign(foot.props, {
    x: 82,
    y: 696,
    width: 600,
    height: 28,
    text: "01  /  ORIGINAL DISPLAY. A NEW BEGINNING.",
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#697169",
  });
  foot.overrides = { mobile: { x: 28, y: 856, width: 320, fontSize: 9 } };
  return {
    schemaVersion: 1,
    id: "iglass-first-composition",
    name: "A clearer point of view",
    revision: 0,
    duration: 8,
    profiles: [
      { id: "desktop", name: "Desktop", width: 1200, height: 760 },
      { id: "mobile", name: "Mobile", width: 390, height: 900 },
    ],
    entities: [kicker, headline, body, button, scene, rule, foot],
    copy: [
      {
        id: "copy-headline",
        name: "Main headline",
        text: "A clearer\npoint of view.",
        variants: [
          "Change the glass.\nKeep the original.",
          "A clearer\npoint of view.",
        ],
      },
      {
        id: "copy-body",
        name: "Supporting copy",
        text: "Change the glass. Keep what matters.\nDiscover a new perspective on your original display.",
        variants: [],
      },
    ],
    assets: [
      {
        id: "asset-oled",
        name: "Original iPhone OLED",
        url: "/assets/14_pro_oled_repaired.glb",
        type: "model",
      },
    ],
    tracks: [
      {
        id: "track-phone",
        entityId: "phone",
        property: "rotateY",
        profileId: "base",
        interpolation: "smooth",
        keys: [
          { id: "k1", time: 0, value: -24 },
          { id: "k2", time: 4, value: 18 },
          { id: "k3", time: 8, value: -24 },
        ],
      },
    ],
    poses: [],
    bindings: [],
    relationships: [],
  };
}
