const state = {
  items: [],
  selectedId: null,
  health: null,
  view: "applications"
};

const els = {
  repoRoot: document.querySelector("#repoRoot"),
  settingsSource: document.querySelector("#settingsSource"),
  healthStatus: document.querySelector("#healthStatus"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  sourceFilter: document.querySelector("#sourceFilter"),
  refreshButton: document.querySelector("#refreshButton"),
  applicationsTable: document.querySelector("#applicationsTable"),
  statusBoard: document.querySelector("#statusBoard"),
  historyCount: document.querySelector("#historyCount"),
  historyList: document.querySelector("#historyList"),
  pipelineTable: document.querySelector("#pipelineTable"),
  emptyState: document.querySelector("#emptyState"),
  totalCount: document.querySelector("#totalCount"),
  pipelineCount: document.querySelector("#pipelineCount"),
  recommendedCount: document.querySelector("#recommendedCount"),
  averageScore: document.querySelector("#averageScore"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailContent: document.querySelector("#detailContent"),
  detailCompany: document.querySelector("#detailCompany"),
  detailRole: document.querySelector("#detailRole"),
  detailScore: document.querySelector("#detailScore"),
  detailStatus: document.querySelector("#detailStatus"),
  detailLocation: document.querySelector("#detailLocation"),
  detailSource: document.querySelector("#detailSource"),
  detailDate: document.querySelector("#detailDate"),
  detailNotes: document.querySelector("#detailNotes"),
  openJobButton: document.querySelector("#openJobButton"),
  openReportButton: document.querySelector("#openReportButton"),
  reportPreview: document.querySelector("#reportPreview"),
  commandGrid: document.querySelector("#commandGrid"),
  jobsList: document.querySelector("#jobsList"),
  refreshJobsButton: document.querySelector("#refreshJobsButton"),
  addUrlForm: document.querySelector("#addUrlForm"),
  urlInput: document.querySelector("#urlInput"),
  toast: document.querySelector("#toast")
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || text || "Request failed");
  return data;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.add("hidden"), 3200);
}

function scoreClass(score) {
  if (score === null || score === undefined) return "";
  if (score >= 4) return "score-high";
  if (score >= 3) return "score-mid";
  return "score-low";
}

function formatScore(score) {
  return score === null || score === undefined ? "-" : Number(score).toFixed(1);
}

function sourceLabel(source = "") {
  return {
    tracker: "Tracker",
    pipeline: "Pipeline",
    report: "Report",
    sample: "Sample"
  }[source] || source || "Unknown";
}

function formatDate(value) {
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

function dateSortValue(value) {
  const dateOnly = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function filteredItems() {
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

function populateFilters() {
  const currentStatus = els.statusFilter.value;
  const currentSource = els.sourceFilter.value;
  const statuses = Array.from(new Set(state.items.map((item) => item.status).filter(Boolean))).sort();
  const sources = Array.from(new Set(state.items.map((item) => item.source).filter(Boolean))).sort();

  els.statusFilter.innerHTML = '<option value="all">All statuses</option>'
    + statuses.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
  els.sourceFilter.innerHTML = '<option value="all">All sources</option>'
    + sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(sourceLabel(source))}</option>`).join("");

  els.statusFilter.value = statuses.includes(currentStatus) ? currentStatus : "all";
  els.sourceFilter.value = sources.includes(currentSource) ? currentSource : "all";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSummary() {
  const items = state.items;
  const scores = items.map((item) => item.score).filter((score) => typeof score === "number");
  const avg = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : "-";
  els.totalCount.textContent = items.length;
  els.pipelineCount.textContent = items.filter((item) => item.status === "Pipeline" || item.source === "pipeline").length;
  els.recommendedCount.textContent = items.filter((item) => (item.score || 0) >= 4 || /recommend/i.test(item.status)).length;
  els.averageScore.textContent = avg;
}

function renderApplications() {
  const items = filteredItems();
  els.applicationsTable.innerHTML = items.map((item) => `
    <tr data-id="${escapeHtml(item.id)}" class="${item.id === state.selectedId ? "selected" : ""}">
      <td><strong>${escapeHtml(item.company)}</strong><br><span class="source-pill">${escapeHtml(sourceLabel(item.source))}</span></td>
      <td>${escapeHtml(item.role)}</td>
      <td><span class="status-pill">${escapeHtml(item.status || "-")}</span></td>
      <td><span class="score-pill ${scoreClass(item.score)}">${formatScore(item.score)}</span></td>
      <td>${escapeHtml(item.location || "-")}</td>
      <td>
        <div class="row-actions">
          <button data-open="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Open</button>
        </div>
      </td>
    </tr>
  `).join("");
  els.emptyState.classList.toggle("hidden", items.length > 0);
}

function renderPipeline() {
  const pipeline = state.items.filter((item) => item.source === "pipeline" || item.status === "Pipeline");
  els.pipelineTable.innerHTML = pipeline.map((item) => `
    <tr data-id="${escapeHtml(item.id)}">
      <td><strong>${escapeHtml(item.company)}</strong></td>
      <td>${escapeHtml(item.role)}</td>
      <td>${escapeHtml(item.location || "-")}</td>
      <td>${escapeHtml(item.notes || "Ready for evaluation")}</td>
      <td><div class="row-actions"><button data-open="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Open</button></div></td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="empty-table-cell">No pending postings in the pipeline.</td></tr>';
}

function renderHistory() {
  const trackable = state.items.filter((item) => item.source !== "pipeline" || item.status !== "Pipeline");
  const statuses = Array.from(trackable.reduce((counts, item) => {
    const status = item.status || "Unspecified";
    counts.set(status, (counts.get(status) || 0) + 1);
    return counts;
  }, new Map()).entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  els.statusBoard.innerHTML = statuses.length ? statuses.map(([status, count]) => `
    <button class="status-card" data-history-status="${escapeHtml(status)}" title="Filter Applications by ${escapeHtml(status)}">
      <span>${escapeHtml(String(count))}</span>
      <strong>${escapeHtml(status)}</strong>
    </button>
  `).join("") : '<div class="empty-state">No tracker statuses yet.</div>';

  const history = [...trackable].sort((a, b) => {
    const dateDiff = dateSortValue(b.date) - dateSortValue(a.date);
    if (dateDiff) return dateDiff;
    return `${a.company} ${a.role}`.localeCompare(`${b.company} ${b.role}`);
  });

  els.historyCount.textContent = `${history.length} ${history.length === 1 ? "record" : "records"}`;
  els.historyList.innerHTML = history.length ? history.map((item) => `
    <article class="history-item ${item.id === state.selectedId ? "selected" : ""}" data-id="${escapeHtml(item.id)}">
      <div class="history-date">${escapeHtml(formatDate(item.date))}</div>
      <div class="history-body">
        <div class="history-title">
          <strong>${escapeHtml(item.company)}</strong>
          <span class="status-pill">${escapeHtml(item.status || "-")}</span>
        </div>
        <div>${escapeHtml(item.role)}</div>
        <div class="history-meta">
          <span>${escapeHtml(item.location || "Location not listed")}</span>
          <span>${escapeHtml(sourceLabel(item.source))}</span>
          <span>Score ${escapeHtml(formatScore(item.score))}</span>
        </div>
        ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <div class="row-actions">
        <button data-open="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Open</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">No tracker history yet. Evaluated applications will appear here.</div>';
}

function renderDetail() {
  const item = state.items.find((candidate) => candidate.id === state.selectedId);
  if (!item) {
    els.detailEmpty.classList.remove("hidden");
    els.detailContent.classList.add("hidden");
    return;
  }

  els.detailEmpty.classList.add("hidden");
  els.detailContent.classList.remove("hidden");
  els.detailCompany.textContent = item.company;
  els.detailRole.textContent = item.role;
  els.detailScore.textContent = formatScore(item.score);
  els.detailScore.className = `score-pill ${scoreClass(item.score)}`;
  els.detailStatus.textContent = item.status || "-";
  els.detailLocation.textContent = item.location || "-";
  els.detailSource.textContent = sourceLabel(item.source);
  els.detailDate.textContent = formatDate(item.date);
  els.detailNotes.textContent = item.notes || "No notes recorded yet.";
  els.openJobButton.disabled = !item.url;
  els.openReportButton.disabled = !item.reportFile;
  els.reportPreview.classList.add("hidden");
}

function renderCommands() {
  if (!state.health) return;
  els.commandGrid.innerHTML = Object.entries(state.health.actions).map(([action, label]) => `
    <div class="command-card">
      <strong>${escapeHtml(label)}</strong>
      <span class="eyebrow">${escapeHtml(action)}</span>
      <button class="primary-button command-button" data-action="${escapeHtml(action)}">Run</button>
    </div>
  `).join("");
}

async function renderJobs() {
  const { jobs } = await api("/api/jobs");
  els.jobsList.innerHTML = jobs.length ? jobs.map((job) => `
    <article class="job-item">
      <div class="job-meta">
        <div>
          <strong>${escapeHtml(job.label)}</strong>
          <div class="eyebrow">${escapeHtml(job.status)} / exit ${job.exitCode ?? "pending"}</div>
        </div>
        <button class="secondary-button" data-cancel="${escapeHtml(job.id)}" ${job.status === "running" ? "" : "disabled"}>Cancel</button>
      </div>
      <pre class="job-log">${escapeHtml(job.logs || "Waiting for command output...")}</pre>
    </article>
  `).join("") : '<div class="empty-state">No commands have run in this UI session.</div>';
}

function render() {
  populateFilters();
  renderSummary();
  renderApplications();
  renderHistory();
  renderPipeline();
  renderDetail();
  renderCommands();
}

async function loadHealth() {
  state.health = await api("/api/health");
  els.repoRoot.textContent = state.health.root;
  els.settingsSource.textContent = `Settings: ${state.health.settings.sources.join(" + ")}`;
  if (!state.health.exists) {
    els.healthStatus.textContent = "Career-Ops checkout not found";
  } else if (state.health.missing.length) {
    els.healthStatus.textContent = `Needs setup files: ${state.health.missing.join(", ")}`;
  } else {
    els.healthStatus.textContent = "Ready to review applications";
  }
}

async function loadData() {
  const data = await api("/api/applications");
  state.items = data.items;
  if (!state.selectedId && state.items.length) state.selectedId = state.items[0].id;
  render();
}

async function refreshAll() {
  await loadHealth();
  await loadData();
  await renderJobs();
}

async function runCommand(action) {
  const job = await api("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ action })
  });
  toast(`${job.label} started`);
  await renderJobs();
  const interval = setInterval(async () => {
    await renderJobs();
    const { jobs } = await api("/api/jobs");
    if (!jobs.some((item) => item.status === "running")) {
      clearInterval(interval);
      await loadData();
    }
  }, 1500);
}

async function openItem(item) {
  if (!item?.url) return;
  try {
    await api("/api/open", {
      method: "POST",
      body: JSON.stringify({ url: item.url })
    });
  } catch {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }
}

document.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-id]");
  if (row && !event.target.matches("button")) {
    state.selectedId = row.dataset.id;
    renderApplications();
    renderHistory();
    renderDetail();
  }

  const openId = event.target.dataset.open;
  if (openId) {
    const item = state.items.find((candidate) => candidate.id === openId);
    await openItem(item);
  }

  const action = event.target.dataset.action;
  if (action) runCommand(action).catch((error) => toast(error.message));

  const historyStatus = event.target.closest("[data-history-status]")?.dataset.historyStatus;
  if (historyStatus) {
    state.view = "applications";
    els.statusFilter.value = historyStatus;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${state.view}View`));
    renderApplications();
  }

  const cancelId = event.target.dataset.cancel;
  if (cancelId) {
    await api(`/api/jobs/${cancelId}/cancel`, { method: "POST" });
    await renderJobs();
  }
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${state.view}View`));
  });
});

els.searchInput.addEventListener("input", renderApplications);
els.statusFilter.addEventListener("change", renderApplications);
els.sourceFilter.addEventListener("change", renderApplications);
els.refreshButton.addEventListener("click", () => refreshAll().catch((error) => toast(error.message)));
els.refreshJobsButton.addEventListener("click", () => renderJobs().catch((error) => toast(error.message)));
els.openJobButton.addEventListener("click", async () => {
  const item = state.items.find((candidate) => candidate.id === state.selectedId);
  await openItem(item);
});
els.openReportButton.addEventListener("click", async () => {
  const item = state.items.find((candidate) => candidate.id === state.selectedId);
  if (!item?.reportFile) return;
  const report = await api(`/api/reports/${encodeURIComponent(item.reportFile)}`);
  els.reportPreview.textContent = report.markdown;
  els.reportPreview.classList.remove("hidden");
});
els.addUrlForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/pipeline", {
    method: "POST",
    body: JSON.stringify({ url: els.urlInput.value })
  });
  els.urlInput.value = "";
  toast("Posting queued for review");
  await loadData();
});

refreshAll().catch((error) => toast(error.message));
