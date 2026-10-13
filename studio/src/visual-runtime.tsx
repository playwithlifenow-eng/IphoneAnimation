import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { effectiveInstrument } from "./instruments/registry";
import { Stage } from "./instruments/Stage";
import { useClock } from "./instruments/useClock";
import type { VisualProject } from "./instruments/types";
import "./instruments/visual.css";
function Runtime({
  project,
  boardId,
}: {
  project: VisualProject;
  boardId: string;
}) {
  const [width, setWidth] = useState(innerWidth);
  const [reduced, setReduced] = useState(matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReduced(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    const f = () => setWidth(innerWidth);
    addEventListener("resize", f);
    return () => removeEventListener("resize", f);
  }, []);
  const source =
      project.boards.find((b) => b.id === boardId) ?? project.boards[0],
    variant = project.variants.find((v) => v.id === source.variantId)!;
  const profile = width < 640 ? "mobile" : "desktop",
    board = {
      ...source,
      width: Math.min(width, 1600),
      profile: profile as "mobile" | "desktop",
      height: profile === "mobile" ? 900 : 760,
    };
  const instruments = variant.instruments.map(i => effectiveInstrument(i, profile));
  const smooth = instruments.find(
      (i) => i.definitionId === "smooth" && i.enabled,
    ),
    clock = useClock(
      smooth?.macroValues.weight ?? 0,
      reduced,
    );
  useEffect(() => {
    const f = () =>
      clock.seek(
        scrollY /
          Math.max(1, document.documentElement.scrollHeight - innerHeight),
      );
    addEventListener("scroll", f, { passive: true });
    clock.seek(0, true);
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <div
      style={{
        height: `${(instruments.find((i) => i.definitionId === "stage" && i.enabled)?.macroValues.travel ?? 3) * 100}vh`,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          overflow: "hidden",
          height: "100vh",
        }}
      >
        <Stage
          variant={variant}
          board={board}
          signals={{
            scroll: clock.progress,
            time: clock.progress,
            velocity: clock.velocity,
            pointerX: 0.5,
            pointerY: 0.5,
            reducedMotion: reduced,
          }}
          active
          editor={false}
        />
      </div>
    </div>
  );
}
fetch("./composition.json")
  .then((r) => r.json())
  .then((d) =>
    createRoot(document.getElementById("root")!).render(<Runtime {...d} />),
  )
  .catch((e) => {
    document.getElementById("root")!.textContent =
      "Unable to load composition: " + e.message;
  });
