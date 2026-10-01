import { getCategories, type CategoryId } from "./scoring";

// Presentation only. Keep the scoring registry's AI tie-breaking order unchanged.
const DISPLAY_AFTER: Partial<Record<CategoryId, CategoryId>> = {
  "two-pairs": "three-pairs",
  "four-of-a-kind": "five-of-a-kind",
  "full-house": "castle",
  "large-straight": "full-straight",
};
export function getScorecardCategories(diceCount: number) {
  const categories = getCategories(diceCount);
  const moved = new Set(Object.values(DISPLAY_AFTER));
  return categories.filter((category) => !moved.has(category.id)).flatMap((category) => {
    const extra = categories.find((candidate) => candidate.id === DISPLAY_AFTER[category.id]);
    return extra ? [category, extra] : [category];
  });
}
