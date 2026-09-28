import assert from "node:assert/strict";

export function bounds(value) {
  const match = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(value ?? "");
  assert(match, "Missing or invalid native bounds.");
  const [left, top, right, bottom] = match.slice(1).map(Number);
  assert([left, top, right, bottom].every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 100000), "Invalid native coordinate.");
  assert(right > left && bottom > top, "Native bounds must have positive area.");
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
export function screenElements(screen) {
  assert.equal(screen.ui_schema?.platform, "ios", "Expected a native iOS hierarchy.");
  assert.equal(screen.ui_schema?.defaults?.enabled, true, "Unexpected native enabled default.");
  const result = [];
  function visit(nodes, parents = []) {
    assert(Array.isArray(nodes) && parents.length < 64, "Invalid native hierarchy.");
    for (const node of nodes) {
      assert(result.length < 10000, "Native hierarchy exceeds its bound.");
      const item = { ...node, enabled: node.enabled ?? true, parents, rect: bounds(node.b) };
      result.push(item);
      if (node.c) visit(node.c, [...parents, item]);
    }
  }
  visit(screen.elements);
  return result;
}
export function uniqueElement(elements, id, required = true) {
  const matches = elements.filter((node) => node.rid === id);
  assert(matches.length <= 1 && (!required || matches.length === 1), `Expected one native ${id}; found ${matches.length}.`);
  return matches[0];
}
const within = (row, viewport, margin = 8) => row.left >= viewport.left && row.right <= viewport.right && row.top >= viewport.top + margin && row.bottom <= viewport.bottom - margin;
const intersects = (row, viewport) => row.bottom > viewport.top && row.top < viewport.bottom && row.right > viewport.left && row.left < viewport.right;

/** Uses the actual scroll view, not Maestro's whole-screen visibility/one-sided centering. */
export function scorePosition(screen, id, categories) {
  const elements = screenElements(screen);
  const viewportNode = uniqueElement(elements, "score-viewport");
  const viewport = viewportNode.rect;
  assert(viewport.width >= 80 && viewport.height >= 100, "Score viewport is too small to exercise.");
  const target = uniqueElement(elements, `score-${id}`, false);
  if (target) {
    assert(target.parents.includes(viewportNode), "Score target is outside its scroll view.");
    assert(!/points recorded/.test(target.a11y ?? ""), "Refusing to score an already recorded category.");
    assert(target.enabled === true || target.enabled === false, "Invalid enabled state.");
    if (!target.enabled) return { action: "wait", id, viewport, target: target.rect };
    assert(target.rect.width <= viewport.width && target.rect.height <= viewport.height - 16, "Score target cannot fit in its viewport.");
    if (within(target.rect, viewport)) return { action: "tap", id, viewport, target: target.rect };
  }
  const index = categories.indexOf(id); assert(index >= 0, "Unknown score category.");
  const visible = elements.filter((node) => node.parents.includes(viewportNode) && node.rid?.startsWith("score-") && intersects(node.rect, viewport))
    .map((node) => categories.indexOf(node.rid.slice(6))).filter((value) => value >= 0);
  let direction;
  if (target) direction = target.rect.top < viewport.top + 8 ? "up" : "down";
  else if (visible.length === 0 || index > Math.max(...visible)) direction = "down";
  else { assert(index < Math.min(...visible), "Missing target among visible score rows."); direction = "up"; }
  const distance = Math.round(viewport.height * 0.18);
  const x = Math.round((viewport.left + viewport.right) / 2), middle = (viewport.top + viewport.bottom) / 2;
  const delta = direction === "down" ? distance : -distance;
  return { action: "swipe", id, viewport, target: target?.rect ?? null, direction,
    start: `${x},${Math.round(middle + delta / 2)}`, end: `${x},${Math.round(middle - delta / 2)}`, duration: 1000 };
}

export function assertRecorded(screen, id) {
  const node = uniqueElement(screenElements(screen), `score-${id}`);
  assert.match(node.a11y ?? "", /points recorded/, `Native score ${id} was not acknowledged.`);
  assert.equal(node.enabled, false, "Recorded score must no longer accept input.");
}
