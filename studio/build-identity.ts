import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
export function sourceIdentity() {
  const root = process.cwd();
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)],
    );
  const files = [
    ...walk(resolve("src")),
    ...[
      "package.json",
      "package-lock.json",
      "runtime.html",
      "vite.config.ts",
      "build-identity.ts",
    ].map((f) => resolve(f)),
  ].sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(root, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}
