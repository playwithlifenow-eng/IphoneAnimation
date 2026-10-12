# Pose Studio — source-only review export

This export contains the Pose Studio editor and runtime source, tests, configuration, documentation, and verification screenshots, derived from `playwithlifenow-eng/IphoneAnimation` branch `studio/broad-v1` commit `f29fd7c391eea2b54a17d02bdfed839b493af470`.

**Intentionally excluded:** the separate legacy iPhone Hero React/R3F app (repository-root `src/`, `public/`, root dependency manifests) and the iPhone GLB models (`studio/public/assets/14_pro_oled_repaired.glb`).

**Kept:** Pose Studio's own `src/SceneView.tsx`, Three.js/React Three Fiber integrations, the application state/runtime, and every other file under original `studio/`. These 3D integrations are part of the editor and necessary for code review.

This is a **code-review/AI import package**, not a fully self-contained 3D demonstration. The sample iPhone model will not load without the omitted GLB. The original source code and dependencies are otherwise unchanged.

## Running

From this extracted repository root (corresponding to the original `studio/` folder):

```sh
npm ci
npm test
npm run build
npm run dev
```

Requires Node 22.13+. Local URL: http://127.0.0.1:5173

For original goals and constraints, read `docs/master-plan.md`, `docs/implementation-checkpoint.md`, and `README.md`.

## Important review theme

Is the Studio a genuinely direct-manipulation environment where creativity develops faster than the ability to describe it in words, or merely a technical Inspector/interface over numeric properties?
