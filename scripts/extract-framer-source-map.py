#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / ".integration" / "current-framer"
MAP = SNAPSHOT / "HeroGlassDriver.compiled.js.map"
OUT = SNAPSHOT / "HeroGlassDriver.current.tsx"
CHUNKS = SNAPSHOT / "chunks"


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
    raw = content.encode("utf-8")
    OUT.write_bytes(raw)
    digest = hashlib.sha256(raw).hexdigest()
    (SNAPSHOT / "HeroGlassDriver.current.sha256").write_text(
        f"{digest}  {OUT.relative_to(ROOT)}\n", encoding="utf-8"
    )
    (SNAPSHOT / "HeroGlassDriver.current.source.txt").write_text(
        f"source={name}\nscore={score}\nbytes={len(raw)}\n", encoding="utf-8"
    )

    match = re.search(
        r'const COMPACT_EMBED_URL\s*=\s*\n?\s*("(?:[^"\\]|\\.)*")',
        content,
        re.S,
    )
    if not match:
        raise RuntimeError("Could not extract the exact COMPACT_EMBED_URL literal.")
    (SNAPSHOT / "COMPACT_EMBED_URL.literal.txt").write_text(
        match.group(1) + "\n", encoding="utf-8"
    )

    if CHUNKS.exists():
        shutil.rmtree(CHUNKS)
    CHUNKS.mkdir(parents=True)
    encoded = base64.b64encode(raw).decode("ascii")
    chunk_size = 6000
    names: list[str] = []
    for index in range(0, len(encoded), chunk_size):
        name_part = f"current.{index // chunk_size:03d}.b64"
        (CHUNKS / name_part).write_text(
            encoded[index : index + chunk_size] + "\n", encoding="ascii"
        )
        names.append(name_part)
    (CHUNKS / "manifest.txt").write_text(
        f"sha256={digest}\nbytes={len(raw)}\nbase64_chars={len(encoded)}\n"
        + "\n".join(names)
        + "\n",
        encoding="utf-8",
    )

    print(f"Extracted {name} -> {OUT} ({digest}; {len(names)} chunks)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
