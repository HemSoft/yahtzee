import assert from "node:assert/strict";
import { test } from "node:test";
import { startFlow, resumeFlow, completeFlow, corruptFlow, scenarios } from "./flows.mjs";

function parse(flow) {
  const [header, body] = flow.trim().split("\n---\n");
  assert.equal(JSON.parse(header.slice("appId: ".length)), "com.hemsoft.yahtzee");
  return body.split("\n").map((line) => {
    const match = /^- ([a-zA-Z]+)(?:: (.*))?$/.exec(line); assert(match, line);
    return { command: match[1], value: match[2] === undefined ? undefined : JSON.parse(match[2]) };
  });
}
test("native matrix covers every mode with solo and three AI, both devices/themes and largest text", () => {
  const completed = scenarios.filter((item) => !item.largeText);
  assert.equal(completed.length, 8);
  for (const dice of [5, 6, 8, 10]) for (const ai of [0, 3]) assert(completed.some((item) => item.dice === dice && item.ai === ai));
  assert.equal(new Set(scenarios.filter((item) => item.largeText).map((item) => item.device)).size, 2);
  assert.deepEqual(new Set(scenarios.map((item) => item.appearance)), new Set(["light", "dark"]));
  assert(scenarios.some((item) => item.device.startsWith("iPad") && item.orientation === "LANDSCAPE_LEFT"));
});
test("generated flows use valid JSON-in-YAML commands and real semantic controls", () => {
  for (const scenario of scenarios) {
    const steps = parse(startFlow("com.hemsoft.yahtzee", scenario));
    assert.deepEqual(steps[0].value, { clearState: true, permissions: { all: "deny" } });
    assert(steps.some((step) => step.command === "tapOn" && step.value === `${scenario.dice} dice`));
    assert(steps.some((step) => step.command === "tapOn" && step.value?.id === "die-0"));
    assert(steps.some((step) => step.command === "assertVisible" && new RegExp(step.value).test("Re-roll (1)")));
  }
  const resumed = parse(resumeFlow("com.hemsoft.yahtzee"));
  assert.equal(resumed[0].value.clearState, undefined);
  assert(resumed.some((step) => step.value === "Resume Game"));
  const completed = parse(completeFlow("com.hemsoft.yahtzee", ["ones", "chance"]));
  assert.equal(completed.filter((step) => step.command === "tapOn" && step.value?.id?.startsWith("score-")).length, 2);
  assert(completed.some((step) => step.command === "assertVisible" && step.value === "Game Over!"));
  const preview = parse(completeFlow("com.hemsoft.yahtzee", ["ones"], true));
  assert(preview.some((step) => step.command === "assertVisible" && step.value?.id === "diagnostics-preview"));
  assert(preview.some((step) => step.value === "Cancel preview"));
});
test("corruption flow never clears state and reset includes cancellation first", () => {
  for (const reset of [false, true]) {
    const steps = parse(corruptFlow("com.hemsoft.yahtzee", reset));
    assert.equal(steps[0].value.clearState, undefined);
    assert(steps.some((step) => step.value === "Your saved data has not been reset."));
    assert.equal(steps.some((step) => step.value === "Cancel"), reset);
    if (reset) assert(steps.findIndex((step) => step.value === "Cancel") < steps.findIndex((step) => step.value?.index === 1));
  }
});
