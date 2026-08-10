import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShareParams,
  decodePackedCollection,
  encodePackedCollection,
  parseSharedLink,
} from "../src/scripts/share-codec.ts";
import { buildSharePreview } from "../src/scripts/share-preview.ts";

const validIds = new Set([1, 4, 84, 138, 160]);

function sorted(values) {
  return [...values].sort((a, b) => a - b);
}

test("packed collections round-trip owned and mastered states", () => {
  const owned = new Set([1, 4, 84, 138, 160]);
  const mastered = new Set([4, 138]);
  const encoded = encodePackedCollection(owned, mastered, validIds);
  const decoded = decodePackedCollection(encoded, validIds);

  assert.match(encoded, /^[bd][A-Za-z0-9_-]+$/);
  assert.deepEqual(sorted(decoded.owned), sorted(owned));
  assert.deepEqual(sorted(decoded.mastered), sorted(mastered));
});

test("mastered sprites are treated as owned", () => {
  const encoded = encodePackedCollection(new Set([1]), new Set([4]), validIds);
  const decoded = decodePackedCollection(encoded, validIds);

  assert.deepEqual(sorted(decoded.owned), [1, 4]);
  assert.deepEqual(sorted(decoded.mastered), [4]);
});

test("new share links preserve display names in queries and fragments", () => {
  const params = buildShareParams(new Set([1, 84]), new Set([84]), "Jonesy & Peely", validIds);
  assert.equal(params.get("v"), "2");
  const queryParsed = parseSharedLink(`https://sprites.example/?${params}`, validIds);
  const fragmentParsed = parseSharedLink(`https://sprites.example/#${params}`, validIds);

  for (const parsed of [queryParsed, fragmentParsed]) {
    assert.equal(parsed.name, "Jonesy & Peely");
    assert.deepEqual(sorted(parsed.owned), [1, 84]);
    assert.deepEqual(sorted(parsed.mastered), [84]);
  }
});

test("the reported 103-sprite link preserves every mastered state", () => {
  const sharedIds = new Set([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
    60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 77, 78,
    79, 84, 86, 87, 89, 90, 99, 106, 113, 116, 126, 129, 138, 139, 140, 141,
    142, 145, 146, 148, 149, 150, 151, 152, 153, 154, 156, 157, 158, 160,
  ]);
  const parsed = parseSharedLink(
    "https://fortnite-sprites.netniv.workers.dev/?s=b_P________8D__8________P__8A8zwAwAAwAAwDADAMAPA_PP8_PwM&n=netniV&v=2",
    sharedIds,
  );

  assert.equal(parsed.name, "netniV");
  assert.equal(parsed.owned.size, 103);
  assert.equal(parsed.mastered.size, 103);
  assert.deepEqual(sorted(parsed.owned), sorted(sharedIds));
  assert.deepEqual(sorted(parsed.mastered), sorted(sharedIds));
});

test("original c/m links remain supported", () => {
  const parsed = parseSharedLink("https://sprites.example/#c=1.2c.46&m=2c&n=Legacy", validIds);

  assert.equal(parsed.name, "Legacy");
  assert.deepEqual(sorted(parsed.owned), [1, 84]);
  assert.deepEqual(sorted(parsed.mastered), [84]);
});

test("invalid or oversized packed payloads are rejected", () => {
  assert.equal(parseSharedLink("#s=xFuture", validIds), null);
  assert.equal(parseSharedLink("#s=bnot.valid", validIds), null);
  assert.equal(decodePackedCollection(`b${"A".repeat(100)}`, validIds), null);
});

test("sparse collections use the shorter delta representation", () => {
  const encoded = encodePackedCollection(new Set([160]), new Set(), validIds);

  assert.match(encoded, /^d/);
  assert.ok(encoded.length < 8);
});

test("packed all-selected payload is substantially shorter than the legacy form", () => {
  const allIds = new Set(Array.from({ length: 161 }, (_, id) => id));
  const packed = buildShareParams(allIds, allIds, "", allIds).toString();
  const legacyIds = [...allIds].map((id) => id.toString(36)).join(".");
  const legacy = new URLSearchParams({ c: legacyIds, m: legacyIds }).toString();

  assert.ok(packed.length < legacy.length / 4, `${packed.length} should be less than a quarter of ${legacy.length}`);
});

test("shared preview includes owned, mastered, and completion stats", () => {
  const preview = buildSharePreview({
    owned: new Set([1, 4, 84]),
    mastered: new Set([4]),
    name: "Jonesy",
  }, 5);

  assert.equal(preview.title, "Jonesy’s Fortnite Sprites — 3/5 owned");
  assert.equal(
    preview.description,
    "3 of 5 Sprites owned · 1 mastered · 60% complete. Compare your collection with Jonesy.",
  );
});
