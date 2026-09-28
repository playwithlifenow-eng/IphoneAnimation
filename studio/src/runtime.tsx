import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PageRenderer } from "./PageRenderer";
import { validateDocument, type StudioDocument } from "./model";
import "./runtime.css";
function Runtime() {
  const [doc, setDoc] = useState<StudioDocument | null>(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [width, setWidth] = useState(innerWidth);
  useEffect(() => {
    fetch("./composition.json")
      .then((r) => {
        if (!r.ok) throw new Error("Composition could not be loaded.");
        return r.json();
      })
      .then((d) => setDoc(validateDocument(d)))
      .catch((e) => setError(e.message));
    const size = () => setWidth(innerWidth);
    addEventListener("resize", size);
    return () => removeEventListener("resize", size);
  }, []);
  useEffect(() => {
    if (!doc || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0,
      start = performance.now();
    const tick = (now: number) => {
      setTime(Math.min(doc.duration, (now - start) / 1000));
      if (now - start < doc.duration * 1000)
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [doc]);
  if (!doc)
    return <p className="runtime-loading">{error || "Opening composition…"}</p>;
  const profile =
    doc.profiles.find((p) => p.id === (width < 700 ? "mobile" : "desktop")) ??
    doc.profiles[0];
  const zoom = Math.min(1, width / profile.width);
  return (
    <main
      className="runtime-frame"
      style={{ width: profile.width * zoom, height: profile.height * zoom }}
    >
      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
        <PageRenderer document={doc} profileId={profile.id} time={time} />
      </div>
    </main>
  );
}
document.body.className = "runtime-body";
createRoot(document.getElementById("root")!).render(<Runtime />);
