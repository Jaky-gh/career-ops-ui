export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function scoreClass(score) {
  if (score === null || score === undefined) return "";
  if (score >= 4) return "score-high";
  if (score >= 3) return "score-mid";
  return "score-low";
}

export function formatScore(score) {
  return score === null || score === undefined ? "-" : Number(score).toFixed(1);
}

export function sourceLabel(source = "") {
  return {
    tracker: "Tracker",
    pipeline: "Pipeline",
    report: "Report",
    sample: "Sample"
  }[source] || source || "Unknown";
}

export function formatDate(value) {
  if (!value) return "No date";
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day))
      .toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function dateSortValue(value) {
  const dateOnly = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function jobStatusClass(status = "") {
  return `job-status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown"}`;
}
