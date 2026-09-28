import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { repositoryRoot } from "./build.mjs";

test("preview workflow actions use exact immutable commit identifiers", () => {
  const workflow = readFileSync(join(repositoryRoot, ".github/workflows/site-preview.yml"), "utf8");
  const actions = [...workflow.matchAll(/\buses:\s+(\S+)/g)].map((match) => match[1]);
  assert(actions.length >= 4);
  for (const action of actions) assert.match(action, /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/, action);
});
