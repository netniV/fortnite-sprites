import assert from "node:assert/strict";
import test from "node:test";
import { compareSprites, normalizeVariant } from "../src/scripts/sprite-sort.ts";

const sprites = [
  { id: 74, name: "Air", base: "Air", variant: "base", gameOrder: 70 },
  { id: 42, name: "Gold Air", base: "Air", variant: "gold", gameOrder: 71 },
  { id: 72, name: "Gummy Air", base: "Air", variant: "gummy", gameOrder: 72 },
  { id: 1, name: "Water", base: "Water", variant: "base", gameOrder: 7 },
  { id: 2, name: "Gummy Water", base: "Water", variant: "gummy", gameOrder: 10 },
];

test("name sort uses each sprite's full display name", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "name")).map((sprite) => sprite.name),
    ["Air", "Gold Air", "Gummy Air", "Gummy Water", "Water"],
  );
});

test("type sort groups sprite families and orders their variants", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "type")).map((sprite) => sprite.name),
    ["Air", "Gold Air", "Gummy Air", "Water", "Gummy Water"],
  );
});

test("game sort follows the explicit collection order instead of numeric IDs", () => {
  assert.deepEqual(
    [...sprites].sort((a, b) => compareSprites(a, b, "game")).map((sprite) => sprite.name),
    ["Water", "Gummy Water", "Air", "Gold Air", "Gummy Air"],
  );
});

test("game order starts with Batman before John Wick as shown in Fortnite", () => {
  const opening = [
    { id: 138, name: "John Wick", base: "John Wick", variant: "base", gameOrder: 1 },
    { id: 146, name: "Cube Batman", base: "Batman", variant: "cube", gameOrder: 2 },
    { id: 139, name: "Batman", base: "Batman", variant: "base", gameOrder: 0 },
  ];

  assert.deepEqual(
    opening.sort((a, b) => compareSprites(a, b, "game")).map((sprite) => sprite.name),
    ["Batman", "John Wick", "Cube Batman"],
  );
});

test("legacy candy variants normalize to gummy", () => {
  assert.equal(normalizeVariant("candy"), "gummy");
});
