import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { instrument } from "./instrument";
import { isProductionSource, productionLoadFilter } from "./sources";

plugin({ name: "production-branch-coverage", setup(build) {
  build.onLoad({ filter: productionLoadFilter }, ({ path }) => {
    const source = readFileSync(path, "utf8");
    return { contents: isProductionSource(path) ? instrument(source, path).code : source,
      loader: path.endsWith(".tsx") ? "tsx" : path.endsWith(".jsx") ? "jsx" : /\.[cm]?ts$/.test(path) ? "ts" : "js" };
  });
} });
