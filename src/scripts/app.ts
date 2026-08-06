import QRCode from "qrcode";
import { buildShareParams, parseSharedLink, type SharedCollection } from "./share-codec";

type SavedCollection = { owned?: number[]; mastered?: number[]; name?: string };
type ViewMode = "cards" | "table";

const STORAGE_KEY = "fortnite-sprites-collection-v1";
const VIEW_STORAGE_KEY = "fortnite-sprites-view-v1";
const INTRO_STORAGE_KEY = "fortnite-sprites-intro-v1";

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
const shareQr = must<HTMLElement>("#share-qr");
const shareQrCanvas = must<HTMLCanvasElement>("#share-qr-canvas");
const compareUrlInput = must<HTMLTextAreaElement>("#compare-url");
const compareError = must<HTMLElement>("#compare-error");
const compareQrInput = must<HTMLInputElement>("#compare-qr");
const compareQrDrop = must<HTMLElement>("#compare-qr-drop");
const compareQrLabel = must<HTMLElement>("#compare-qr-label");
const spriteGrid = must<HTMLElement>("#sprite-grid");
const tableScrollHint = must<HTMLElement>("#table-scroll-hint");
const ownAllShownButton = must<HTMLButtonElement>("#own-all-shown");
const masterAllShownButton = must<HTMLButtonElement>("#master-all-shown");
const backToTopButton = must<HTMLButtonElement>("#back-to-top");
const filtersTarget = must<HTMLElement>("#filters");
const introSection = must<HTMLElement>("#intro-section");
const introControls = must<HTMLElement>("#intro-controls");
const introToggle = must<HTMLButtonElement>("#intro-toggle");

function updateBackToTop(): void {
  const visible = filtersTarget.getBoundingClientRect().top < -400;
  backToTopButton.classList.toggle("is-visible", visible);
  backToTopButton.setAttribute("aria-hidden", String(!visible));
  backToTopButton.tabIndex = visible ? 0 : -1;
}

backToTopButton.addEventListener("click", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  filtersTarget.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
});
window.addEventListener("scroll", updateBackToTop, { passive: true });
updateBackToTop();

function loadIntroExpanded(): boolean {
  try {
    return localStorage.getItem(INTRO_STORAGE_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

function setIntroExpanded(expanded: boolean, persist = true): void {
  introSection.hidden = !expanded;
  introControls.classList.toggle("is-collapsed", !expanded);
  introToggle.setAttribute("aria-expanded", String(expanded));
  const label = introToggle.querySelector("span");
  if (label) label.textContent = expanded ? "Hide intro" : "Show intro";
  if (persist) {
    try { localStorage.setItem(INTRO_STORAGE_KEY, expanded ? "expanded" : "collapsed") } catch { /* Preference is optional. */ }
  }
  updateBackToTop();
}

introToggle.addEventListener("click", () => setIntroExpanded(introSection.hidden));
setIntroExpanded(loadIntroExpanded(), false);

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

function updateTableScrollHint(): void {
  const isTable = spriteGrid.classList.contains("is-table");
  const hasOverflow = spriteGrid.scrollWidth > spriteGrid.clientWidth + 16;
  tableScrollHint.hidden = !isTable || !hasOverflow;
}

function setView(view: ViewMode, persist = true): void {
  const isTable = view === "table";
  spriteGrid.classList.toggle("is-table", isTable);
  spriteGrid.dataset.view = view;
  must("#item-view-label").textContent = isTable ? "row" : "card";
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updateTableScrollHint();
  if (persist) {
    try { localStorage.setItem(VIEW_STORAGE_KEY, view) } catch { /* Preference is optional. */ }
  }
}

window.addEventListener("resize", updateTableScrollHint);

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

function buildShareUrl(): string {
  const url = new URL(window.location.origin + window.location.pathname);
  const params = buildShareParams(owned, mastered, shareNameInput.value.trim(), releasedIds);
  url.hash = params.toString();
  return url.toString();
}

async function updateShareLink(): Promise<void> {
  const url = buildShareUrl();
  shareUrlInput.value = url;
  shareQr.hidden = false;
  shareQr.setAttribute("aria-busy", "true");
  try {
    await QRCode.toCanvas(shareQrCanvas, url, {
      width: 152,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#06111f", light: "#ffffff" },
    });
  } catch {
    shareQr.hidden = true;
  } finally {
    shareQr.removeAttribute("aria-busy");
  }
}

async function decodeQrImage(file: File): Promise<string | null> {
  const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
  if ((file.type && !supportedTypes.includes(file.type)) || file.size > 10 * 1024 * 1024) return null;
  const { default: jsQR } = await import("jsqr");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    return jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  } finally {
    bitmap.close();
  }
}

function loadSharedLink(input: string): boolean {
  const parsed = parseSharedLink(input, releasedIds);
  if (!parsed) return false;
  compareError.hidden = true;
  compareDialog.close();
  setShared(parsed);
  return true;
}

async function loadQrFile(file: File): Promise<void> {
  compareError.hidden = true;
  compareQrDrop.setAttribute("aria-busy", "true");
  compareQrLabel.textContent = "Scanning QR…";
  try {
    const value = await decodeQrImage(file);
    if (!value || !loadSharedLink(value)) {
      compareError.textContent = "We couldn’t find a valid Fortnite Sprites QR code in that image.";
      compareError.hidden = false;
      return;
    }
    showToast("QR code scanned");
  } catch {
    compareError.textContent = "We couldn’t read that image. Try a clear PNG, JPG or WebP.";
    compareError.hidden = false;
  } finally {
    compareQrDrop.removeAttribute("aria-busy");
    compareQrDrop.classList.remove("is-dragging");
    compareQrLabel.textContent = "Choose or drop a QR image";
    compareQrInput.value = "";
  }
}

function setHashFromShared(): void {
  if (!shared) return;
  const params = buildShareParams(shared.owned, shared.mastered, shared.name, releasedIds);
  history.replaceState(null, "", location.pathname + location.search + "#" + params.toString());
}

function updateCard(card: HTMLElement): void {
  const id = Number(card.dataset.id);
  const isOwned = owned.has(id);
  const isMastered = mastered.has(id);
  const isUnreleased = card.dataset.unreleased === "true";
  const friendOwns = Boolean(shared?.owned.has(id));
  const friendMastered = Boolean(shared?.mastered.has(id));
  const ownedButton = card.querySelector<HTMLButtonElement>('[data-action="owned"]');
  const masterButton = card.querySelector<HTMLButtonElement>('[data-action="mastered"]');
  const ownedLabel = card.querySelector<HTMLElement>(".owned-label");
  const ownerRow = card.querySelector<HTMLElement>(".comparison-owners");
  const meMarker = card.querySelector<HTMLElement>(".owner-me");
  const themMarker = card.querySelector<HTMLElement>(".owner-them");
  const themName = card.querySelector<HTMLElement>(".owner-them b");

  card.classList.toggle("is-owned", isOwned);
  card.classList.toggle("is-mastered", isMastered);
  card.classList.toggle("is-comparing", Boolean(shared));
  card.classList.toggle("friend-owned", friendOwns);
  card.classList.toggle("friend-mastered", friendMastered);
  ownedButton?.setAttribute("aria-pressed", String(isOwned));
  masterButton?.setAttribute("aria-pressed", String(isMastered));
  if (ownedLabel && !isUnreleased) {
    ownedLabel.textContent = isMastered ? "Owned · mastered" : isOwned ? "Owned" : "Missing";
  }
  if (ownerRow) ownerRow.hidden = !shared;
  if (meMarker) {
    meMarker.classList.toggle("has-it", isOwned);
    meMarker.classList.toggle("is-mastered", isMastered);
  }
  if (themMarker) {
    themMarker.classList.toggle("has-it", friendOwns);
    themMarker.classList.toggle("is-mastered", friendMastered);
  }
  if (themName) themName.textContent = shared?.name || "Them";
}

function updateSummary(): void {
  const ownedCount = [...owned].filter((id) => releasedIds.has(id)).length;
  const masteredCount = [...mastered].filter((id) => releasedIds.has(id)).length;
  const notMasteredCount = [...owned].filter((id) => releasedIds.has(id) && !mastered.has(id)).length;
  const total = releasedIds.size;
  const percent = total ? Math.round((ownedCount / total) * 100) : 0;
  must("#owned-count").textContent = String(ownedCount);
  must("#mastered-count").textContent = String(masteredCount);
  must("#missing-count").textContent = String(total - ownedCount);
  must("#filter-owned-count").textContent = String(ownedCount);
  must("#filter-mastered-count").textContent = String(masteredCount);
  must("#filter-not-owned-count").textContent = String(total - ownedCount);
  must("#filter-not-mastered-count").textContent = String(notMasteredCount);
  must("#progress-percent").textContent = String(percent) + "%";
  must<HTMLElement>("#progress-bar").style.width = String(percent) + "%";
  must<HTMLElement>("#progress-ring").style.setProperty("--progress", String(percent * 3.6) + "deg");

  if (shared) {
    const theirCount = [...shared.owned].filter((id) => releasedIds.has(id)).length;
    const both = [...owned].filter((id) => shared?.owned.has(id)).length;
    const mineOnly = ownedCount - both;
    const theirsOnly = theirCount - both;
    const unique = mineOnly + theirsOnly;
    const neither = total - both - unique;
    must("#comparison-mine").textContent = String(ownedCount);
    must("#comparison-theirs").textContent = String(theirCount);
    must("#comparison-both").textContent = String(both);
    must("#comparison-unique").textContent = String(unique);
    must("#filter-comparison-both-count").textContent = String(both);
    must("#filter-comparison-mine-only-count").textContent = String(mineOnly);
    must("#filter-comparison-theirs-only-count").textContent = String(theirsOnly);
    must("#filter-comparison-neither-count").textContent = String(neither);
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
    if (activeStatus === "not-owned" && (isOwned || isUnreleased)) return false;
    if (activeStatus === "mastered" && !isMastered) return false;
    if (activeStatus === "not-mastered" && (!isOwned || isMastered || isUnreleased)) return false;
  }
  return true;
}

function updateBulkActions(filteredReleasedCards: HTMLElement[]): void {
  const ownable = filteredReleasedCards.filter((card) => !owned.has(Number(card.dataset.id))).length;
  const masterable = filteredReleasedCards.filter((card) => !mastered.has(Number(card.dataset.id))).length;

  ownAllShownButton.disabled = ownable === 0;
  masterAllShownButton.disabled = masterable === 0;
  ownAllShownButton.title = ownable
    ? `Mark ${ownable} shown ${ownable === 1 ? "Sprite" : "Sprites"} as owned`
    : "All shown released Sprites are already owned";
  masterAllShownButton.title = masterable
    ? `Mark ${masterable} shown ${masterable === 1 ? "Sprite" : "Sprites"} as mastered`
    : "All shown released Sprites are already mastered";
}

function applyFilters(): void {
  let visible = 0;
  const filteredReleasedCards: HTMLElement[] = [];
  for (const card of cards) {
    const matches = matchesFilters(card);
    card.hidden = !matches;
    if (matches) {
      visible += 1;
      if (releasedIds.has(Number(card.dataset.id))) filteredReleasedCards.push(card);
    }
  }
  must("#visible-count").textContent = String(visible);
  must<HTMLElement>("#empty-state").hidden = visible !== 0;
  updateBulkActions(filteredReleasedCards);
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
setView(loadView(), false);
const initialShared = parseSharedLink(location.hash, releasedIds);
if (initialShared) setShared(initialShared, false);
else render();

for (const card of cards) {
  card.addEventListener("click", (event) => {
    const eventTarget = event.target as Element;
    const target = eventTarget.closest<HTMLButtonElement>("[data-action]");
    if (target?.disabled) return;
    const isTableRowClick = spriteGrid.classList.contains("is-table") && !eventTarget.closest(".comparison-owners");
    const action = target?.dataset.action ?? (isTableRowClick ? "owned" : null);
    if (!action) return;
    const id = Number(card.dataset.id);
    if (!releasedIds.has(id)) return;
    if (action === "owned") {
      if (owned.has(id)) {
        owned.delete(id);
        mastered.delete(id);
      } else owned.add(id);
    } else if (action === "mastered") {
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

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view === "table" ? "table" : "cards"));
});

function applyBulkAction(action: "owned" | "mastered"): void {
  const filteredIds = cards
    .filter((card) => matchesFilters(card))
    .map((card) => Number(card.dataset.id))
    .filter((id) => releasedIds.has(id));
  const changedIds = filteredIds.filter((id) => action === "owned" ? !owned.has(id) : !mastered.has(id));
  if (!changedIds.length) return;

  for (const id of changedIds) {
    owned.add(id);
    if (action === "mastered") mastered.add(id);
  }
  render();
  const state = action === "owned" ? "owned" : "mastered";
  showToast(`${changedIds.length} ${changedIds.length === 1 ? "Sprite" : "Sprites"} marked ${state}`);
}

ownAllShownButton.addEventListener("click", () => applyBulkAction("owned"));
masterAllShownButton.addEventListener("click", () => applyBulkAction("mastered"));

must<HTMLButtonElement>("#open-share").addEventListener("click", () => {
  void updateShareLink();
  shareDialog.showModal();
});
shareNameInput.addEventListener("input", () => {
  void updateShareLink();
  saveCollection();
});
must<HTMLButtonElement>("#copy-share").addEventListener("click", async () => {
  await updateShareLink();
  await copyText(shareUrlInput.value);
  showToast("Collection link copied");
});
must<HTMLButtonElement>("#open-compare").addEventListener("click", () => {
  compareUrlInput.value = "";
  compareQrInput.value = "";
  compareError.textContent = "That doesn’t look like a Fortnite Sprites collection link.";
  compareError.hidden = true;
  compareDialog.showModal();
});
must<HTMLButtonElement>("#load-comparison").addEventListener("click", () => {
  if (!loadSharedLink(compareUrlInput.value)) {
    compareError.textContent = "That doesn’t look like a Fortnite Sprites collection link.";
    compareError.hidden = false;
    compareUrlInput.focus();
  }
});
compareQrInput.addEventListener("change", () => {
  const file = compareQrInput.files?.[0];
  if (file) void loadQrFile(file);
});
compareQrDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  compareQrDrop.classList.add("is-dragging");
});
compareQrDrop.addEventListener("dragleave", () => compareQrDrop.classList.remove("is-dragging"));
compareQrDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file) void loadQrFile(file);
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
