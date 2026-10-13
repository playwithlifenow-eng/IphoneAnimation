import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
const Legacy = lazy(async () => {
  await import("./style.css");
  await import("./workspace.css");
  return import("./App");
});
const Visual = lazy(() => import("./instruments/VisualStudio"));
createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div>Opening Studio…</div>}>
    {new URLSearchParams(location.search).has("legacy") ? (
      <Legacy />
    ) : (
      <Visual />
    )}
  </Suspense>,
);
