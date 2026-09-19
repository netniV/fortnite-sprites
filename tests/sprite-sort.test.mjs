import assert from "node:assert/strict";
import test from "node:test";
import { compareSprites, normalizeVariant } from "../src/scripts/sprite-sort.ts";

const sprites = [
  { id: 194, name: "Storm Scout", base: "Storm Scout", variant: "base", gameOrder: 71 },
  { id: 195, name: "Cheat Master Storm Scout", base: "Storm Scout", variant: "cheatmaster", gameOrder: 73 },
  { id: 196, name: "Gold Storm Scout", base: "Storm Scout", variant: "gold", gameOrder: 72 },
  { id: 118, name: "Loot Hacker Storm Scout", base: "Storm Scout", variant: "hacker", gameOrder: 74 },
  { id: 218, name: "Bounty Hunter Storm Scout", base: "Storm Scout", variant: "reaper", gameOrder: 75 },
  { id: 161, name: "Jackrabbit", base: "Jackrabbit", variant: "base", gameOrder: 35 },
  { id: 163, name: "Cheat Master Jackrabbit", base: "Jackrabbit", variant: "cheatmaster", gameOrder: 37 },
];

test("name sort uses each sprite's full display name", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "name")).map((sprite) => sprite.name),
    ["Bounty Hunter Storm Scout", "Cheat Master Jackrabbit", "Cheat Master Storm Scout", "Gold Storm Scout", "Jackrabbit", "Loot Hacker Storm Scout", "Storm Scout"],
  );
});

test("type sort groups sprite families and orders their variants", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "type")).map((sprite) => sprite.name),
    ["Jackrabbit", "Cheat Master Jackrabbit", "Storm Scout", "Cheat Master Storm Scout", "Loot Hacker Storm Scout", "Bounty Hunter Storm Scout", "Gold Storm Scout"],
  );
});

test("game sort follows the explicit collection order instead of numeric IDs", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "game")).map((sprite) => sprite.name),
    ["Jackrabbit", "Cheat Master Jackrabbit", "Storm Scout", "Gold Storm Scout", "Cheat Master Storm Scout", "Loot Hacker Storm Scout", "Bounty Hunter Storm Scout"],
  );
});

test("game order follows the live Season 4 catalog sequence", () => {
  const opening = [
    { id: 183, name: "Cheat Master Jonesy", base: "Jonesy", variant: "cheatmaster", gameOrder: 2 },
    { id: 110, name: "Loot Hacker Jonesy", base: "Jonesy", variant: "hacker", gameOrder: 3 },
    { id: 209, name: "Bounty Hunter Jonesy", base: "Jonesy", variant: "reaper", gameOrder: 4 },
    { id: 182, name: "Jonesy", base: "Jonesy", variant: "base", gameOrder: 0 },
    { id: 184, name: "Gold Jonesy", base: "Jonesy", variant: "gold", gameOrder: 1 },
  ];

  assert.deepEqual(
    opening.sort((a, b) => compareSprites(a, b, "game")).map((sprite) => sprite.name),
    ["Jonesy", "Gold Jonesy", "Cheat Master Jonesy", "Loot Hacker Jonesy", "Bounty Hunter Jonesy"],
  );
});

test("legacy candy variants normalize to gummy", () => {
  assert.equal(normalizeVariant("candy"), "gummy");
});
