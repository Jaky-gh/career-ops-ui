import assert from "node:assert/strict";
import test from "node:test";

const elements = new Map();

global.document = {
  querySelector(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, {
        value: "",
        textContent: "",
        innerHTML: "",
        classList: {
          add() {},
          remove() {},
          toggle() {}
        },
        dataset: {},
        disabled: false
      });
    }
    return elements.get(selector);
  }
};

const formatters = await import("../public/js/formatters.js");
const { state } = await import("../public/js/state.js");
const { els } = await import("../public/js/dom.js");
const selectors = await import("../public/js/selectors.js");

test("formats scores, dates, durations, and status classes consistently", () => {
  assert.equal(formatters.formatScore(null), "-");
  assert.equal(formatters.formatScore(4), "4.0");
  assert.equal(formatters.scoreClass(4.2), "score-high");
  assert.equal(formatters.scoreClass(3.4), "score-mid");
  assert.equal(formatters.scoreClass(2.9), "score-low");
  assert.equal(formatters.formatDate("not-a-date"), "not-a-date");
  assert.equal(formatters.formatDuration("2026-09-28T12:00:00Z", "2026-09-28T13:02:04Z"), "1h 2m");
  assert.equal(formatters.jobStatusClass("Needs Attention"), "job-status-needs-attention");
});

test("filters application rows by search, status, and source", () => {
  state.items = [
    {
      id: "1",
      source: "tracker",
      company: "Acme AI",
      role: "Forward Deployed Engineer",
      status: "Evaluated",
      location: "California",
      notes: "Strong fit",
      score: 4.4
    },
    {
      id: "2",
      source: "pipeline",
      company: "Beta Cloud",
      role: "Backend Engineer",
      status: "Pipeline",
      location: "Remote",
      notes: "",
      score: null
    }
  ];
  els.searchInput.value = "acme";
  els.statusFilter.value = "Evaluated";
  els.sourceFilter.value = "tracker";

  assert.deepEqual(selectors.filteredItems().map((item) => item.id), ["1"]);

  els.searchInput.value = "";
  els.statusFilter.value = "all";
  els.sourceFilter.value = "pipeline";
  assert.deepEqual(selectors.filteredItems().map((item) => item.id), ["2"]);
});

test("apply-ready excludes already applied, rejected, discarded, and skipped jobs", () => {
  state.items = [
    { id: "ready", source: "tracker", status: "Evaluated", score: 4.1 },
    { id: "low", source: "tracker", status: "Evaluated", score: 3.9 },
    { id: "applied", source: "tracker", status: "Applied", score: 4.5 },
    { id: "pipeline", source: "pipeline", status: "Pipeline", score: 5 }
  ];

  assert.deepEqual(selectors.applyReadyItems().map((item) => item.id), ["ready"]);
});
