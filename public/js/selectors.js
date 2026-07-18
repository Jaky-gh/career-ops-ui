import { els } from "./dom.js";
import { state } from "./state.js";

export function applyReadyItems() {
  return state.items
    .filter((item) => item.source === "tracker")
    .filter((item) => typeof item.score === "number" && item.score >= 4)
    .filter((item) => !["Applied", "Rejected", "Discarded", "Skip"].includes(item.status));
}

export function filteredItems() {
  const q = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const source = els.sourceFilter.value;
  return state.items.filter((item) => {
    const haystack = [item.company, item.role, item.status, item.location, item.notes, item.source].join(" ").toLowerCase();
    return (!q || haystack.includes(q))
      && (status === "all" || item.status === status)
      && (source === "all" || item.source === source);
  });
}
