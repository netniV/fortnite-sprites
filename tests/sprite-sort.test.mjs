import assert from "node:assert/strict";
import test from "node:test";
import { compareSprites, normalizeVariant } from "../src/scripts/sprite-sort.ts";

const sprites = [
  { id: 194, name: "Storm Scout", base: "Storm Scout", variant: "base", gameOrder: 33 },
  { id: 195, name: "Cheat Master Storm Scout", base: "Storm Scout", variant: "cheatmaster", gameOrder: 34 },
  { id: 196, name: "Gold Storm Scout", base: "Storm Scout", variant: "gold", gameOrder: 35 },
  { id: 118, name: "Loot Hacker Storm Scout", base: "Storm Scout", variant: "hacker", gameOrder: 60 },
  { id: 161, name: "Jackrabbit", base: "Jackrabbit", variant: "base", gameOrder: 0 },
  { id: 163, name: "Cheat Master Jackrabbit", base: "Jackrabbit", variant: "cheatmaster", gameOrder: 2 },
];

test("name sort uses each sprite's full display name", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "name")).map((sprite) => sprite.name),
    ["Cheat Master Jackrabbit", "Cheat Master Storm Scout", "Gold Storm Scout", "Jackrabbit", "Loot Hacker Storm Scout", "Storm Scout"],
  );
});

test("type sort groups sprite families and orders their variants", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "type")).map((sprite) => sprite.name),
    ["Jackrabbit", "Cheat Master Jackrabbit", "Storm Scout", "Cheat Master Storm Scout", "Loot Hacker Storm Scout", "Gold Storm Scout"],
  );
});

test("game sort follows the explicit collection order instead of numeric IDs", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "game")).map((sprite) => sprite.name),
    ["Jackrabbit", "Cheat Master Jackrabbit", "Storm Scout", "Cheat Master Storm Scout", "Gold Storm Scout", "Loot Hacker Storm Scout"],
  );
});

test("game order follows the live Season 4 catalog sequence", () => {
  const opening = [
    { id: 183, name: "Cheat Master Jonesy", base: "Jonesy", variant: "cheatmaster", gameOrder: 2 },
    { id: 110, name: "Loot Hacker Jonesy", base: "Jonesy", variant: "hacker", gameOrder: 3 },
    { id: 182, name: "Jonesy", base: "Jonesy", variant: "base", gameOrder: 0 },
    { id: 184, name: "Gold Jonesy", base: "Jonesy", variant: "gold", gameOrder: 1 },
  ];

  assert.deepEqual(
    opening.sort((a, b) => compareSprites(a, b, "game")).map((sprite) => sprite.name),
    ["Jonesy", "Gold Jonesy", "Cheat Master Jonesy", "Loot Hacker Jonesy"],
  );
});

test("legacy candy variants normalize to gummy", () => {
  assert.equal(normalizeVariant("candy"), "gummy");
});
