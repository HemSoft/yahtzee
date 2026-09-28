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
  return viewportSwipe(viewport, target?.rect ?? null, id, direction);
}

function viewportSwipe(viewport, target, id, direction) {
  const distance = Math.round(viewport.height * 0.18);
  const x = Math.round((viewport.left + viewport.right) / 2), middle = (viewport.top + viewport.bottom) / 2;
  const delta = direction === "down" ? distance : -distance;
  return { action: "swipe", id, viewport, target, direction,
    start: `${x},${Math.round(middle + delta / 2)}`, end: `${x},${Math.round(middle - delta / 2)}`, duration: 1000 };
}

export function assertRecorded(screen, id) {
  const node = uniqueElement(screenElements(screen), `score-${id}`);
  assert.match(node.a11y ?? "", /points recorded/, `Native score ${id} was not acknowledged.`);
  assert.equal(node.enabled, false, "Recorded score must no longer accept input.");
}

function inPlayHierarchy(node, root) {
  if (node.parents.includes(root)) return true;
  // iOS exposes this nonaccessible RN View's testID as a leaf sibling of its
  // children. Accept that observed shape only inside the same direct container.
  return !root.c?.length && root.parents.length > 0 && node.parents.at(-1) === root.parents.at(-1);
}

export function diePosition(screen) {
  const elements = screenElements(screen);
  const root = uniqueElement(elements, "play-viewport");
  const viewportNode = uniqueElement(elements, "dice-viewport", false) ?? uniqueElement(elements, "score-viewport");
  const viewport = viewportNode.rect, target = uniqueElement(elements, "die-0");
  assert(inPlayHierarchy(viewportNode, root) && within(viewport, root.rect, 0), "Dice viewport is outside the play area.");
  assert(viewport.width >= 80 && viewport.height >= 100, "Dice viewport is too small to exercise.");
  assert(target.parents.includes(viewportNode), "Die is outside its scroll view.");
  assert(target.enabled === true || target.enabled === false, "Invalid die enabled state.");
  if (!target.enabled) return { action: "wait", viewport, target: target.rect };
  assert.equal(target.val, "checkbox, unchecked, Not held", "Refusing to toggle an already-held or unknown die state.");
  assert(target.rect.width <= viewport.width && target.rect.height <= viewport.height - 16, "Die cannot fit in its viewport.");
  if (within(target.rect, viewport)) return { action: "tap", viewport, target: target.rect };
  return viewportSwipe(viewport, target.rect, "die-0", target.rect.top < viewport.top + 8 ? "up" : "down");
}

export function rollPosition(screen) {
  const elements = screenElements(screen), root = uniqueElement(elements, "play-viewport"), target = uniqueElement(elements, "reroll-action");
  assert(inPlayHierarchy(target, root) && within(target.rect, root.rect), "Reroll is outside the play area.");
  assert.equal(target.a11y, "Re-roll (2)", "Unexpected reroll state before the single tap.");
  assert(target.enabled === true || target.enabled === false, "Invalid reroll enabled state.");
  return { action: target.enabled ? "tap" : "wait", viewport: root.rect, target: target.rect };
}

export function assertHeld(screen) {
  const node = uniqueElement(screenElements(screen), "die-0");
  // RN's iOS checkbox exposes its state in value; Maestro's generic checked
  // boolean remains false. Both forms were inspected in actual native evidence.
  assert.equal(node.val, "checkbox, checked, Held", "Native die hold was not acknowledged.");
}
