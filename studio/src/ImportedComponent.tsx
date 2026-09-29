import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentDefinition, Props } from "./model";

export function ImportedComponent({ definition, values, interactive = false, onMetadata }: { definition: ComponentDefinition; values: Props; interactive?: boolean; onMetadata?: (controls: NonNullable<ComponentDefinition["controls"]>) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const props = useMemo(() => {
    let extras = {}; try { const parsed = JSON.parse(String(values.componentPropsJson ?? "{}")); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extras = parsed; } catch {}
    return { ...extras, ...Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith("prop:")).map(([key, value]) => [key.slice(5), value])) };
  }, [values]);
  const current = useRef({ props, onMetadata }); current.current = { props, onMetadata };
  const html = useMemo(() => {
    const url = new URL(definition.bundle, location.href).href.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html,body,#root{margin:0;width:100%;height:100%;font-family:Arial,sans-serif}*{box-sizing:border-box}p[role=alert]{font-size:12px;padding:12px;color:#8c2828}</style></head><body><div id="root"></div><script src="${url}"></script></body></html>`;
  }, [definition.bundle]);
  useEffect(() => {
    setReady(false); setError("");
    const timer = setTimeout(() => setError("Component did not finish loading. Re-import it or check its dependencies."), 20000);
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data?.studioComponent) return;
      if (event.data.type === "ready") { clearTimeout(timer); setReady(true); setError(""); current.current.onMetadata?.(event.data.controls ?? {}); frame.current?.contentWindow?.postMessage({ type: "studio-props", props: current.current.props }, "*"); }
      if (event.data.type === "error") { clearTimeout(timer); setError(String(event.data.message)); }
    };
    addEventListener("message", receive);
    return () => { clearTimeout(timer); removeEventListener("message", receive); };
  }, [definition.bundle]);
  useEffect(() => { if (ready) frame.current?.contentWindow?.postMessage({ type: "studio-props", props }, "*"); }, [props, ready]);
  return <div className="imported-component" data-ready={ready}>
    <iframe ref={frame} title={definition.name + " component"} srcDoc={html} sandbox="allow-scripts" style={{ pointerEvents: interactive ? "auto" : "none" }} />
    {(!ready || error) && <div className="component-status" role={error ? "alert" : "status"}>{error || "Loading component…"}</div>}
  </div>;
}
