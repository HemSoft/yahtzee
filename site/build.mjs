import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pages } from "./pages.mjs";

export const siteRoot = import.meta.dirname;
export const repositoryRoot = resolve(siteRoot, "..");
export const contentSecurityPolicy = "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export function buildSite(output, { publish = false } = {}) {
  assert(!publish, "Publication is not authorized or configured. This builder produces an unpublished preview only; see site/README.md.");
  assert(!existsSync(output), "Existing site output was not overwritten. Choose a new output directory.");
  const files = new Map(Object.entries(pages).map(([name, html]) => [name, Buffer.from(html)]));
  files.set("style.css", readFileSync(join(siteRoot, "style.css")));
  files.set("assets/manrope-variable.ttf", readFileSync(join(repositoryRoot, "packages/ui/src/assets/manrope-variable.ttf")));
  files.set("assets/OFL.txt", readFileSync(join(repositoryRoot, "packages/ui/src/assets/OFL.txt")));
  files.set("robots.txt", Buffer.from("User-agent: *\nDisallow: /\n"));
  const artifacts = [];
  for (const [name, bytes] of files) {
    const destination = join(output, name);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    writeFileSync(destination, bytes);
    artifacts.push({ path: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const receipt = { schemaVersion: 1, kind: "unpublished-site-preview", publicationAuthorized: false, artifacts };
  writeFileSync(join(output, "preview-manifest.json"), JSON.stringify(receipt, null, 2) + "\n");
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  assert(args.length <= 1 && !args[0]?.startsWith("-"), "Usage: node site/build.mjs [new-output-directory]. No publication mode is available.");
  const output = resolve(args[0] ?? join(repositoryRoot, "reports/site-preview"));
  buildSite(output);
  console.log(`Unpublished preview: ${output}`);
}
