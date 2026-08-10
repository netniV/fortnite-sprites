export type SharedCollection = { owned: Set<number>; mastered: Set<number>; name: string };

function decodeLegacyIds(value: string | null, validIds: Set<number>): Set<number> {
  if (!value) return new Set();
  return new Set(
    value.split(".").map((id) => Number.parseInt(id, 36))
      .filter((id) => Number.isInteger(id) && validIds.has(id)),
  );
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^(?:[A-Fa-f0-9]{2})*$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function encodeDeltaCollection(
  selectedIds: number[],
  collectionMastered: Set<number>,
): Uint8Array {
  const bytes: number[] = [];
  let previousId = 0;
  for (const id of selectedIds) {
    const state = collectionMastered.has(id) ? 3 : 1;
    let value = (id - previousId) * 4 + state;
    do {
      const remainder = value % 128;
      value = Math.floor(value / 128);
      bytes.push(remainder | (value ? 128 : 0));
    } while (value);
    previousId = id;
  }
  return Uint8Array.from(bytes);
}

export function encodePackedCollection(
  collectionOwned: Set<number>,
  collectionMastered: Set<number>,
  validIds: Set<number>,
): string {
  const selectedIds = [...new Set([...collectionOwned, ...collectionMastered])]
    .filter((id) => validIds.has(id))
    .sort((a, b) => a - b);
  const highestId = selectedIds.length ? Math.max(...selectedIds) : -1;
  const bitsetBytes = new Uint8Array(highestId < 0 ? 0 : Math.floor(highestId / 4) + 1);

  for (const id of selectedIds) {
    const state = collectionMastered.has(id) ? 3 : 1;
    bitsetBytes[Math.floor(id / 4)] |= state << ((id % 4) * 2);
  }
  const bitsetPayload = bytesToHex(bitsetBytes);
  const deltaPayload = bytesToHex(encodeDeltaCollection(selectedIds, collectionMastered));
  return bitsetPayload.length <= deltaPayload.length ? "h" + bitsetPayload : "x" + deltaPayload;
}

export function decodePackedCollection(
  value: string,
  validIds: Set<number>,
): Pick<SharedCollection, "owned" | "mastered"> | null {
  const encoding = value.slice(0, 1);
  const isBitset = encoding === "b" || encoding === "h";
  const isDelta = encoding === "d" || encoding === "x";
  if (!isBitset && !isDelta) return null;
  const payload = value.slice(1);
  const bytes = encoding === "h" || encoding === "x"
    ? hexToBytes(payload)
    : base64UrlToBytes(payload);
  if (!bytes) return null;
  const highestValidId = validIds.size ? Math.max(...validIds) : -1;
  const maximumBitsetBytes = highestValidId < 0 ? 0 : Math.floor(highestValidId / 4) + 1;
  if (isBitset && bytes.length > maximumBitsetBytes) return null;
  if (isDelta && bytes.length > validIds.size * 5) return null;

  const decodedOwned = new Set<number>();
  const decodedMastered = new Set<number>();
  if (isDelta) {
    let previousId = 0;
    for (let index = 0; index < bytes.length;) {
      let value = 0;
      let multiplier = 1;
      let byte = 0;
      do {
        if (index >= bytes.length || multiplier > Number.MAX_SAFE_INTEGER / 128) return null;
        byte = bytes[index];
        value += (byte & 127) * multiplier;
        multiplier *= 128;
        index += 1;
      } while (byte & 128);
      const state = value % 4;
      if (state !== 1 && state !== 3) return null;
      const id = previousId + Math.floor(value / 4);
      if (!Number.isSafeInteger(id) || id < previousId) return null;
      if (validIds.has(id)) {
        decodedOwned.add(id);
        if (state & 2) decodedMastered.add(id);
      }
      previousId = id;
    }
    return { owned: decodedOwned, mastered: decodedMastered };
  }

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    for (let offset = 0; offset < 4; offset += 1) {
      const id = byteIndex * 4 + offset;
      if (!validIds.has(id)) continue;
      const state = (bytes[byteIndex] >> (offset * 2)) & 3;
      if (state & 1 || state & 2) decodedOwned.add(id);
      if (state & 2) decodedMastered.add(id);
    }
  }
  return { owned: decodedOwned, mastered: decodedMastered };
}

export function buildShareParams(
  collectionOwned: Set<number>,
  collectionMastered: Set<number>,
  name: string,
  validIds: Set<number>,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("s", encodePackedCollection(collectionOwned, collectionMastered, validIds));
  if (name && name !== "Friend") params.set("n", name);
  params.set("v", "3");
  return params;
}

export function parseSharedLink(input: string, validIds: Set<number>): SharedCollection | null {
  try {
    const value = input.trim();
    if (!value) return null;

    const hasCollection = (params: URLSearchParams) => params.has("s") || params.has("c");
    let params: URLSearchParams | null = null;
    const queryStart = value.indexOf("?");
    const hashStart = value.indexOf("#");

    if (queryStart >= 0) {
      const queryEnd = hashStart > queryStart ? hashStart : value.length;
      const queryParams = new URLSearchParams(value.slice(queryStart + 1, queryEnd));
      if (hasCollection(queryParams)) params = queryParams;
    }
    if (!params && hashStart >= 0) {
      const hashParams = new URLSearchParams(value.slice(hashStart + 1));
      if (hasCollection(hashParams)) params = hashParams;
    }
    if (!params) {
      const rawParams = new URLSearchParams(value.replace(/^[?#]/, ""));
      if (hasCollection(rawParams)) params = rawParams;
    }
    if (!params) return null;

    const name = (params.get("n") || "Friend").slice(0, 32);
    const packed = params.get("s");
    if (packed !== null) {
      const decoded = decodePackedCollection(packed, validIds);
      return decoded ? { ...decoded, name } : null;
    }
    if (!params.has("c")) return null;
    return {
      owned: decodeLegacyIds(params.get("c"), validIds),
      mastered: decodeLegacyIds(params.get("m"), validIds),
      name,
    };
  } catch {
    return null;
  }
}
