#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / ".integration" / "current-framer"
MAP = SNAPSHOT / "HeroGlassDriver.compiled.js.map"
OUT = SNAPSHOT / "HeroGlassDriver.current.tsx"


def main() -> int:
    if not MAP.exists():
        print("No source map was downloaded.")
        return 0

    payload = json.loads(MAP.read_text(encoding="utf-8"))
    sources = payload.get("sources") or []
    contents = payload.get("sourcesContent") or []
    (SNAPSHOT / "source-map-sources.txt").write_text(
        "\n".join(f"{index}\t{name}" for index, name in enumerate(sources)) + "\n",
        encoding="utf-8",
    )

    candidates: list[tuple[int, str, str]] = []
    for index, (name, content) in enumerate(zip(sources, contents)):
        if not isinstance(content, str):
            continue
        score = 0
        if "HeroGlassDriver" in str(name):
            score += 4
        if "COMPACT_EMBED_URL" in content:
            score += 8
        if "iglass-autoplay-progress" in content:
            score += 4
        if "glass-edge" in content:
            score += 2
        if score:
            candidates.append((score, str(name), content))

    if not candidates:
        raise RuntimeError("Source map contains no identifiable HeroGlassDriver source.")

    score, name, content = max(candidates, key=lambda item: item[0])
    OUT.write_text(content, encoding="utf-8")
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    (SNAPSHOT / "HeroGlassDriver.current.sha256").write_text(
        f"{digest}  {OUT.relative_to(ROOT)}\n", encoding="utf-8"
    )
    (SNAPSHOT / "HeroGlassDriver.current.source.txt").write_text(
        f"source={name}\nscore={score}\n", encoding="utf-8"
    )
    print(f"Extracted {name} -> {OUT} ({digest})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
