export const variantOrder = [
  "base",
  "cheatmaster",
  "hacker",
  "reaper",
  "cube",
  "gold",
  "quack",
  "gummy",
  "galaxy",
  "gem",
  "holofoil",
] as const;

export type SortMode = "name" | "type" | "game";

export type SortableSprite = {
  id: number;
  name: string;
  base: string;
  variant: string;
  gameOrder: number;
};

export function normalizeVariant(variant: string): string {
  return variant === "candy" ? "gummy" : variant;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function variantIndex(variant: string): number {
  const index = variantOrder.indexOf(variant as (typeof variantOrder)[number]);
  return index < 0 ? variantOrder.length : index;
}

export function compareSprites(
  left: SortableSprite,
  right: SortableSprite,
  mode: SortMode,
): number {
  if (mode === "game") return left.gameOrder - right.gameOrder || left.id - right.id;
  if (mode === "name") {
    return compareText(left.name, right.name) || left.id - right.id;
  }
  return compareText(left.base, right.base) ||
    variantIndex(left.variant) - variantIndex(right.variant) ||
    compareText(left.name, right.name) ||
    left.id - right.id;
}
