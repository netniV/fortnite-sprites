import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShareParams,
  decodePackedCollection,
  encodePackedCollection,
  parseSharedLink,
} from "../src/scripts/share-codec.ts";

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

test("new share fragments preserve display names", () => {
  const params = buildShareParams(new Set([1, 84]), new Set([84]), "Jonesy & Peely", validIds);
  const parsed = parseSharedLink(`https://sprites.example/#${params}`, validIds);

  assert.equal(parsed.name, "Jonesy & Peely");
  assert.deepEqual(sorted(parsed.owned), [1, 84]);
  assert.deepEqual(sorted(parsed.mastered), [84]);
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
