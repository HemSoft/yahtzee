import { readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootPattern = projectRoot.replaceAll("\\", "/").split("/")
  .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\\\/]");
export const productionLoadFilter = new RegExp(`^${rootPattern}[\\\\/](?:apps|packages|convex)[\\\\/].*\\.(?:[cm]?[jt]s|[jt]sx)$`);
export const exclusions = ["node_modules", "_generated", ".expo", ".next", "dist", "out", "coverage", "reports", "release", "web-build", "tests", "__tests__"];
export function sourceKey(path: string, root = projectRoot): string { return relative(root, path).replaceAll("\\", "/"); }
export function isProductionSource(path: string, root = projectRoot): boolean {
  const key = sourceKey(path, root);
  return /^(apps\/|packages\/[^/]+\/src\/|convex\/)/.test(key)
    && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(key) && !/\.d\.[cm]?ts$|\.(?:test|spec|fixture)\.[jt]sx?$/.test(key)
    && !key.split("/").some((part) => exclusions.includes(part));
}
export function productionSources(root = projectRoot): string[] {
  const files: string[] = [];
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (exclusions.includes(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Source inventory cannot follow an undeclared link: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (isProductionSource(path, root)) files.push(path);
    }
  }
  for (const directory of ["apps", "packages", "convex"]) visit(resolve(root, directory));
  if (!files.length) throw new Error("Production inventory is empty");
  return files.sort();
}
