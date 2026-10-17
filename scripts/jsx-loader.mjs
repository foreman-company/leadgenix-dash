// Node ESM loader hook that compiles the repo's .jsx sources to plain ESM so
// plain `node --test` can exercise the real components (no bundler needed).
// Uses the project's own Vite toolchain (transformWithEsbuild) — no extra
// dependencies. Registered from the test file via module.register().

import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const vite = await import("vite");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".jsx")) {
    const base = context.parentURL
      ? new URL(".", context.parentURL)
      : new URL("../", import.meta.url); // scripts/ -> project root
    return nextResolve(new URL(specifier, base).href, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".jsx")) {
    const filePath = fileURLToPath(url);
    const source = await readFile(filePath, "utf8");
    const result = await vite.transformWithEsbuild(source, filePath, {
      loader: "jsx",
      jsx: "automatic",
      jsxImportSource: "react",
    });
    return { format: "module", shortCircuit: true, source: result.code };
  }
  return nextLoad(url, context);
}

export function pathToFile(url) {
  return pathToFileURL(url).href;
}
