// Use the installed Convex generator without selecting or contacting a deployment.
// This app has no Convex components. Revisit this script before adding one.
import { apiCodegen } from "../node_modules/convex/src/cli/codegen_templates/api.ts";

const paths = [];
for await (const entry of new Bun.Glob("**/*.ts").scan("convex")) {
  const path = entry.replaceAll("\\", "/");
  if (!path.startsWith("_generated/") && !path.endsWith(".d.ts")
    && !["schema.ts", "auth.config.ts", "convex.config.ts", "crons.ts"].includes(path)) paths.push(path);
}
const generated = apiCodegen(paths.sort());
const clean = (text) => text.replace(/[ \t]+$/gm, "").trimEnd() + "\n";
await Bun.write("convex/_generated/api.d.ts", clean(generated.DTS));
await Bun.write("convex/_generated/api.js", clean(generated.JS));
console.log("Generated local Convex API bindings without deployment access.");
