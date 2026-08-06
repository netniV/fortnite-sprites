import type { SharedCollection } from "./share-codec";

export type SharePreview = {
  title: string;
  description: string;
};

export function buildSharePreview(shared: SharedCollection, total: number): SharePreview {
  const owned = shared.owned.size;
  const mastered = shared.mastered.size;
  const percent = total ? Math.round((owned / total) * 100) : 0;
  const hasName = shared.name !== "Friend";
  const owner = hasName ? `${shared.name}’s` : "Shared";
  const comparisonTarget = hasName ? ` with ${shared.name}` : "";

  return {
    title: `${owner} Fortnite Sprites — ${owned}/${total} owned`,
    description: `${owned} of ${total} Sprites owned · ${mastered} mastered · ${percent}% complete. Compare your collection${comparisonTarget}.`,
  };
}
