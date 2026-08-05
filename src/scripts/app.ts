type SavedCollection = { owned?: number[]; mastered?: number[]; name?: string };
type SharedCollection = { owned: Set<number>; mastered: Set<number>; name: string };

const STORAGE_KEY = "fortnite-sprites-collection-v1";

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("Missing required element: " + selector);
  return element;
}

const cards = Array.from(document.querySelectorAll<HTMLElement>(".sprite-card"));
const releasedIds = new Set(
  cards.filter((card) => card.dataset.unreleased === "false").map((card) => Number(card.dataset.id)),
);
const owned = new Set<number>();
const mastered = new Set<number>();
let shared: SharedCollection | null = null;
let activeStatus = "all";
let activeComparison = "all";
let activeVariant = "all";
let showUnreleased = false;
let toastTimer = 0;

const searchInput = must<HTMLInputElement>("#search");
const showUnreleasedInput = must<HTMLInputElement>("#show-unreleased");
const shareDialog = must<HTMLDialogElement>("#share-dialog");
const compareDialog = must<HTMLDialogElement>("#compare-dialog");
const shareNameInput = must<HTMLInputElement>("#share-name");
const shareUrlInput = must<HTMLInputElement>("#share-url");
const compareUrlInput = must<HTMLTextAreaElement>("#compare-url");
const compareError = must<HTMLElement>("#compare-error");

function cleanIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.map(Number).filter((id) => Number.isInteger(id) && releasedIds.has(id));
}

function loadSavedCollection(): SavedCollection {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as SavedCollection;
    for (const id of cleanIds(parsed.owned)) owned.add(id);
    for (const id of cleanIds(parsed.mastered)) {
      mastered.add(id);
      owned.add(id);
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveCollection(): void {
  const value: SavedCollection = {
    owned: [...owned].sort((a, b) => a - b),
    mastered: [...mastered].sort((a, b) => a - b),
    name: shareNameInput.value.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function encodeIds(ids: Set<number>): string {
  return [...ids]
    .filter((id) => releasedIds.has(id))
    .sort((a, b) => a - b)
    .map((id) => id.toString(36))
    .join(".");
}

function decodeIds(value: string | null): Set<number> {
  if (!value) return new Set();
  return new Set(
    value.split(".").map((id) => Number.parseInt(id, 36))
      .filter((id) => Number.isInteger(id) && releasedIds.has(id)),
  );
}

function buildShareUrl(): string {
  const url = new URL(window.location.origin + window.location.pathname);
  const params = new URLSearchParams();
  params.set("c", encodeIds(owned));
  if (mastered.size) params.set("m", encodeIds(mastered));
  const name = shareNameInput.value.trim();
  if (name) params.set("n", name);
  url.hash = params.toString();
  return url.toString();
}

function parseSharedLink(input: string): SharedCollection | null {
  try {
    let fragment = input.trim();
    if (fragment.includes("#")) fragment = fragment.slice(fragment.indexOf("#") + 1);
    if (fragment.startsWith("#")) fragment = fragment.slice(1);
    const params = new URLSearchParams(fragment);
    if (!params.has("c")) return null;
    return {
      owned: decodeIds(params.get("c")),
      mastered: decodeIds(params.get("m")),
      name: (params.get("n") || "Friend").slice(0, 32),
    };
  } catch {
    return null;
  }
}

function setHashFromShared(): void {
  if (!shared) return;
  const params = new URLSearchParams();
  params.set("c", encodeIds(shared.owned));
  if (shared.mastered.size) params.set("m", encodeIds(shared.mastered));
  if (shared.name && shared.name !== "Friend") params.set("n", shared.name);
  history.replaceState(null, "", location.pathname + location.search + "#" + params.toString());
}

function updateCard(card: HTMLElement): void {
  const id = Number(card.dataset.id);
  const isOwned = owned.has(id);
  const isMastered = mastered.has(id);
  const isUnreleased = card.dataset.unreleased === "true";
  const ownedButton = card.querySelector<HTMLButtonElement>('[data-action="owned"]');
  const masterButton = card.querySelector<HTMLButtonElement>('[data-action="mastered"]');
  const ownedLabel = card.querySelector<HTMLElement>(".owned-label");
  const ownerRow = card.querySelector<HTMLElement>(".comparison-owners");
  const meMarker = card.querySelector<HTMLElement>(".owner-me");
  const themMarker = card.querySelector<HTMLElement>(".owner-them");
  const themName = card.querySelector<HTMLElement>(".owner-them b");

  card.classList.toggle("is-owned", isOwned);
  card.classList.toggle("is-mastered", isMastered);
  ownedButton?.setAttribute("aria-pressed", String(isOwned));
  masterButton?.setAttribute("aria-pressed", String(isMastered));
  if (ownedLabel && !isUnreleased) {
    ownedLabel.textContent = isMastered ? "Owned · mastered" : isOwned ? "Owned" : "Missing";
  }
  if (ownerRow) ownerRow.hidden = !shared;
  if (meMarker) meMarker.classList.toggle("has-it", isOwned);
  if (themMarker) themMarker.classList.toggle("has-it", Boolean(shared?.owned.has(id)));
  if (themName) themName.textContent = shared?.name || "Them";
}

function updateSummary(): void {
  const ownedCount = [...owned].filter((id) => releasedIds.has(id)).length;
  const masteredCount = [...mastered].filter((id) => releasedIds.has(id)).length;
  const total = releasedIds.size;
  const percent = total ? Math.round((ownedCount / total) * 100) : 0;
  must("#owned-count").textContent = String(ownedCount);
  must("#mastered-count").textContent = String(masteredCount);
  must("#missing-count").textContent = String(total - ownedCount);
  must("#progress-percent").textContent = String(percent) + "%";
  must<HTMLElement>("#progress-bar").style.width = String(percent) + "%";
  must<HTMLElement>("#progress-ring").style.setProperty("--progress", String(percent * 3.6) + "deg");

  if (shared) {
    const theirCount = [...shared.owned].filter((id) => releasedIds.has(id)).length;
    const both = [...owned].filter((id) => shared?.owned.has(id)).length;
    const unique = new Set([...owned, ...shared.owned]).size - both;
    must("#comparison-mine").textContent = String(ownedCount);
    must("#comparison-theirs").textContent = String(theirCount);
    must("#comparison-both").textContent = String(both);
    must("#comparison-unique").textContent = String(unique);
  }
}

function matchesFilters(card: HTMLElement): boolean {
  const id = Number(card.dataset.id);
  const query = searchInput.value.trim().toLowerCase();
  const isUnreleased = card.dataset.unreleased === "true";
  const isOwned = owned.has(id);
  const isMastered = mastered.has(id);
  const theirs = Boolean(shared?.owned.has(id));
  if (isUnreleased && !showUnreleased) return false;
  if (query && !card.dataset.name?.includes(query)) return false;
  if (activeVariant !== "all" && card.dataset.variant !== activeVariant) return false;
  if (shared) {
    if (activeComparison === "both" && !(isOwned && theirs)) return false;
    if (activeComparison === "mine-only" && !(isOwned && !theirs)) return false;
    if (activeComparison === "theirs-only" && !(!isOwned && theirs)) return false;
    if (activeComparison === "neither" && (isOwned || theirs || isUnreleased)) return false;
  } else {
    if (activeStatus === "owned" && !isOwned) return false;
    if (activeStatus === "missing" && (isOwned || isUnreleased)) return false;
    if (activeStatus === "mastered" && !isMastered) return false;
  }
  return true;
}

function applyFilters(): void {
  let visible = 0;
  for (const card of cards) {
    const matches = matchesFilters(card);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  must("#visible-count").textContent = String(visible);
  must<HTMLElement>("#empty-state").hidden = visible !== 0;
}

function render(): void {
  for (const card of cards) updateCard(card);
  updateSummary();
  applyFilters();
  saveCollection();
}

function setShared(next: SharedCollection | null, updateHash = true): void {
  shared = next;
  activeComparison = "all";
  must<HTMLElement>("#comparison-panel").hidden = !shared;
  must<HTMLElement>("#comparison-filters").hidden = !shared;
  must<HTMLElement>("#collection-filters").hidden = Boolean(shared);
  must("#comparison-name").textContent = shared?.name || "Friend";
  must("#open-compare span").textContent = shared ? "Change comparison" : "Compare";
  document.querySelectorAll<HTMLButtonElement>("[data-comparison]").forEach((button) => {
    const active = button.dataset.comparison === "all";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (updateHash) {
    if (shared) setHashFromShared();
    else history.replaceState(null, "", location.pathname + location.search);
  }
  render();
}

function showToast(message: string): void {
  const toast = must<HTMLElement>("#toast");
  const label = toast.querySelector("span");
  if (label) label.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true }, 2600);
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    shareUrlInput.focus();
    shareUrlInput.select();
    document.execCommand("copy");
  }
}

const saved = loadSavedCollection();
shareNameInput.value = typeof saved.name === "string" ? saved.name.slice(0, 32) : "";
const initialShared = parseSharedLink(location.hash);
if (initialShared) setShared(initialShared, false);
else render();

for (const card of cards) {
  card.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLButtonElement>("[data-action]");
    if (!target || target.disabled) return;
    const id = Number(card.dataset.id);
    if (!releasedIds.has(id)) return;
    if (target.dataset.action === "owned") {
      if (owned.has(id)) {
        owned.delete(id);
        mastered.delete(id);
      } else owned.add(id);
    } else if (target.dataset.action === "mastered") {
      if (mastered.has(id)) mastered.delete(id);
      else {
        owned.add(id);
        mastered.add(id);
      }
    }
    render();
  });
}

searchInput.addEventListener("input", applyFilters);
showUnreleasedInput.addEventListener("change", () => {
  showUnreleased = showUnreleasedInput.checked;
  applyFilters();
});

document.querySelectorAll<HTMLButtonElement>("[data-status]").forEach((button) => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status || "all";
    document.querySelectorAll<HTMLButtonElement>("[data-status]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-comparison]").forEach((button) => {
  button.addEventListener("click", () => {
    activeComparison = button.dataset.comparison || "all";
    document.querySelectorAll<HTMLButtonElement>("[data-comparison]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  });
});

document.querySelectorAll<HTMLButtonElement>(".variant-chip[data-variant]").forEach((button) => {
  button.addEventListener("click", () => {
    activeVariant = button.dataset.variant || "all";
    document.querySelectorAll<HTMLButtonElement>(".variant-chip[data-variant]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  });
});

must<HTMLButtonElement>("#open-share").addEventListener("click", () => {
  shareUrlInput.value = buildShareUrl();
  shareDialog.showModal();
});
shareNameInput.addEventListener("input", () => {
  shareUrlInput.value = buildShareUrl();
  saveCollection();
});
must<HTMLButtonElement>("#copy-share").addEventListener("click", async () => {
  shareUrlInput.value = buildShareUrl();
  await copyText(shareUrlInput.value);
  showToast("Collection link copied");
});
must<HTMLButtonElement>("#open-compare").addEventListener("click", () => {
  compareUrlInput.value = "";
  compareError.hidden = true;
  compareDialog.showModal();
});
must<HTMLButtonElement>("#load-comparison").addEventListener("click", () => {
  const parsed = parseSharedLink(compareUrlInput.value);
  if (!parsed) {
    compareError.hidden = false;
    compareUrlInput.focus();
    return;
  }
  compareError.hidden = true;
  compareDialog.close();
  setShared(parsed);
});
must<HTMLButtonElement>("#close-comparison").addEventListener("click", () => setShared(null));
must<HTMLButtonElement>("#reset-collection").addEventListener("click", () => {
  if (!window.confirm("Clear every owned and mastered Sprite from this device?")) return;
  owned.clear();
  mastered.clear();
  render();
  showToast("Collection reset");
});
must<HTMLButtonElement>("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  activeStatus = "all";
  activeComparison = "all";
  activeVariant = "all";
  showUnreleased = false;
  showUnreleasedInput.checked = false;
  document.querySelectorAll<HTMLButtonElement>(".filter-chip, .variant-chip").forEach((button) => {
    const active = button.dataset.status === "all" ||
      button.dataset.comparison === "all" ||
      button.dataset.variant === "all";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  applyFilters();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && !shareDialog.open && !compareDialog.open && searchInput.value) {
    searchInput.value = "";
    applyFilters();
  }
});
