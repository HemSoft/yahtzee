const command = (name, value) => `- ${name}${value === undefined ? "" : `: ${JSON.stringify(value)}`}`;
const visible = (text) => command("assertVisible", text);
const tap = (text) => command("tapOn", text);
const scroll = (element) => command("scrollUntilVisible", { element, direction: "DOWN", timeout: 60000, visibilityPercentage: 100 });
const shot = (name) => command("takeScreenshot", name);
const header = (bundleId, commands) => `appId: ${JSON.stringify(bundleId)}\n---\n${commands.join("\n")}\n`;

export function startFlow(bundleId, scenario) {
  return header(bundleId, [command("launchApp", { clearState: true, permissions: { all: "deny" } }),
    command("setOrientation", scenario.orientation), visible("A little time for dice."), shot("setup"),
    scroll({ text: "Your name" }), tap("Your name"), command("eraseText"), command("inputText", "Local tester"), command("hideKeyboard"),
    scroll({ text: "AI opponents" }), tap("AI opponents"), tap(scenario.ai ? "3 AI" : "Solo"),
    scroll({ text: "Dice count" }), tap("Dice count"), tap(`${scenario.dice} dice`),
    scroll({ text: "Start Game" }), tap("Start Game"),
    scroll({ id: "die-0" }), command("tapOn", { id: "die-0" }), tap("Re-roll \\(2\\)"), visible("Re-roll \\(1\\)"), shot("held-and-rerolled")]);
}
export function resumeFlow(bundleId) {
  return header(bundleId, [command("launchApp", { permissions: { all: "deny" } }),
    scroll({ text: "Resume Game" }), tap("Resume Game"), visible("Re-roll \\(1\\)"), shot("resumed")]);
}
export function completeFlow(bundleId, categories) {
  return header(bundleId, [
    ...categories.flatMap((id) => [scroll({ id: `score-${id}` }), command("tapOn", { id: `score-${id}` })]),
    visible("Game Over!"), shot("results"), tap("History"), visible("Local history"), shot("history"),
    command("launchApp", { permissions: { all: "deny" } }), scroll({ text: "Review saved result" }), tap("Review saved result"),
    visible("Game Over!"), tap("Help"), visible("How to play"), shot("help"), tap("Done"),
    scroll({ text: "Play Again" }), tap("Play Again"), scroll({ text: "Start Game" }), shot("play-again")]);
}
export function corruptFlow(bundleId, reset = false) {
  const commands = [command("launchApp", { permissions: { all: "deny" } }), visible("Your saved data has not been reset."), shot("recovery")];
  if (reset) commands.push(tap("Help"), scroll({ text: "Delete all local data" }), tap("Delete all local data"), tap("Cancel"),
    tap("Delete all local data"), command("tapOn", { text: "Delete all local data", index: 1 }), tap("Done"), scroll({ text: "Start Game" }), shot("explicit-reset"));
  return header(bundleId, commands);
}

export const scenarios = [
  { id: "phone-5-solo-light", device: "iPhone 17", dice: 5, ai: 0, appearance: "light", orientation: "PORTRAIT" },
  { id: "phone-5-ai-dark-wide", device: "iPhone 17", dice: 5, ai: 3, appearance: "dark", orientation: "LANDSCAPE_LEFT" },
  { id: "phone-6-solo-dark", device: "iPhone 17", dice: 6, ai: 0, appearance: "dark", orientation: "PORTRAIT" },
  { id: "phone-6-ai-light", device: "iPhone 17", dice: 6, ai: 3, appearance: "light", orientation: "PORTRAIT" },
  { id: "tablet-8-solo-light", device: "iPad Pro 13-inch (M5)", dice: 8, ai: 0, appearance: "light", orientation: "PORTRAIT" },
  { id: "tablet-8-ai-dark-wide", device: "iPad Pro 13-inch (M5)", dice: 8, ai: 3, appearance: "dark", orientation: "LANDSCAPE_LEFT" },
  { id: "tablet-10-solo-dark", device: "iPad Pro 13-inch (M5)", dice: 10, ai: 0, appearance: "dark", orientation: "PORTRAIT" },
  { id: "tablet-10-ai-light-wide", device: "iPad Pro 13-inch (M5)", dice: 10, ai: 3, appearance: "light", orientation: "LANDSCAPE_LEFT" },
  { id: "phone-largest-text", device: "iPhone 17", dice: 6, ai: 3, appearance: "dark", orientation: "PORTRAIT", largeText: true },
  { id: "tablet-largest-text", device: "iPad Pro 13-inch (M5)", dice: 10, ai: 3, appearance: "light", orientation: "PORTRAIT", largeText: true },
];
