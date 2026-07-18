const state = {
  items: [],
  selectedId: null,
  health: null,
  view: "workflow"
};

const els = {
  repoRoot: document.querySelector("#repoRoot"),
  settingsSource: document.querySelector("#settingsSource"),
  healthStatus: document.querySelector("#healthStatus"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  sourceFilter: document.querySelector("#sourceFilter"),
  refreshButton: document.querySelector("#refreshButton"),
  workflowPendingCount: document.querySelector("#workflowPendingCount"),
  workflowReadyCount: document.querySelector("#workflowReadyCount"),
  workflowAppliedCount: document.querySelector("#workflowAppliedCount"),
  workflowProgressPanel: document.querySelector("#workflowProgressPanel"),
  workflowProgressTitle: document.querySelector("#workflowProgressTitle"),
  workflowProgressStatus: document.querySelector("#workflowProgressStatus"),
  workflowProgressBody: document.querySelector("#workflowProgressBody"),
  applyReadyCount: document.querySelector("#applyReadyCount"),
  applyReadyList: document.querySelector("#applyReadyList"),
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
  markAppliedButton: document.querySelector("#markAppliedButton"),
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

function applyReadyItems() {
  return state.items
    .filter((item) => item.source === "tracker")
    .filter((item) => typeof item.score === "number" && item.score >= 4)
    .filter((item) => !["Applied", "Rejected", "Discarded", "Skip"].includes(item.status));
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

function renderWorkflow() {
  const pending = state.items.filter((item) => item.source === "pipeline" || item.status === "Pipeline");
  const ready = applyReadyItems();
  const applied = state.items.filter((item) => item.status === "Applied");

  els.workflowPendingCount.textContent = pending.length;
  els.workflowReadyCount.textContent = ready.length;
  els.workflowAppliedCount.textContent = applied.length;
  els.applyReadyCount.textContent = `${ready.length} ${ready.length === 1 ? "job" : "jobs"}`;
  els.applyReadyList.innerHTML = ready.length ? ready.map((item) => `
    <article class="history-item ${item.id === state.selectedId ? "selected" : ""}" data-id="${escapeHtml(item.id)}">
      <div class="history-date">${escapeHtml(formatDate(item.date))}</div>
      <div class="history-body">
        <div class="history-title">
          <strong>${escapeHtml(item.company)}</strong>
          <span class="score-pill ${scoreClass(item.score)}">${formatScore(item.score)}</span>
        </div>
        <div>${escapeHtml(item.role)}</div>
        <div class="history-meta">
          <span>${escapeHtml(item.status || "Evaluated")}</span>
          <span>${escapeHtml(item.location || "Location not listed")}</span>
        </div>
        ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <div class="row-actions">
        <button data-open="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Open</button>
        <button data-tailor-resume="${escapeHtml(item.trackerNum || "")}" ${item.trackerNum && item.reportFile ? "" : "disabled"}>Tailor Resume</button>
        <button data-mark-applied="${escapeHtml(item.trackerNum || "")}" ${item.trackerNum ? "" : "disabled"}>Applied</button>
        <button data-skip-job="${escapeHtml(item.trackerNum || "")}" ${item.trackerNum ? "" : "disabled"}>Skip</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">No 4.0+ unapplied jobs yet. Fetch jobs, grade the pipeline, then add graded jobs to history.</div>';
}

function renderWorkflowProgress(jobs = []) {
  const gradeJob = jobs.find((job) => job.action === "grade") || jobs.find((job) => job.progress?.total);
  els.workflowProgressPanel.classList.toggle("hidden", !gradeJob);
  if (!gradeJob) return;

  els.workflowProgressTitle.textContent = gradeJob.label || "Grading Progress";
  els.workflowProgressStatus.textContent = `${gradeJob.status} / exit ${gradeJob.exitCode ?? "pending"}`;
  els.workflowProgressBody.innerHTML = renderJobProgress(gradeJob) || '<div class="empty-state">Waiting for grading progress output...</div>';
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
  els.markAppliedButton.disabled = item.source !== "tracker" || !item.trackerNum || item.status === "Applied";
  els.reportPreview.classList.add("hidden");
}

function renderCommands() {
  if (!state.health) return;
  const details = state.health.actionDetails || {};
  els.commandGrid.innerHTML = Object.entries(state.health.actions).map(([action, label]) => {
    const detail = details[action] || {};
    return `
    <div class="command-card">
      <div>
        <strong>${escapeHtml(detail.label || label)}</strong>
        <p>${escapeHtml(detail.description || "Run this career-ops command.")}</p>
      </div>
      <span class="eyebrow">${escapeHtml(action)}</span>
      <dl class="command-docs">
        <div><dt>When</dt><dd>${escapeHtml(detail.when || "Use when this step is needed.")}</dd></div>
        <div><dt>Effect</dt><dd>${escapeHtml(detail.effect || "See command output for details.")}</dd></div>
      </dl>
      <button class="primary-button command-button" data-action="${escapeHtml(action)}">Run</button>
    </div>
  `;
  }).join("");
}

function renderJobProgress(job) {
  const progress = job.progress;
  if (!progress?.total) return "";
  const current = Math.min(progress.current || 0, progress.total);
  const percent = Math.round((current / progress.total) * 100);
  return `
    <div class="job-progress" aria-label="${escapeHtml(job.label)} progress">
      <div class="job-progress-meta">
        <span>${escapeHtml(String(current))}/${escapeHtml(String(progress.total))}</span>
        <span>${escapeHtml(String(percent))}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${escapeHtml(String(percent))}%"></div>
      </div>
      <div class="job-progress-label">${escapeHtml(progress.label || "Working through queue")}</div>
    </div>
  `;
}

function jobStatusClass(status = "") {
  return `job-status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown"}`;
}

async function renderJobs() {
  const { jobs } = await api("/api/jobs");
  renderWorkflowProgress(jobs);
  els.jobsList.innerHTML = jobs.length ? jobs.map((job) => `
    <article class="job-item">
      <div class="job-meta">
        <div>
          <div class="job-title-line">
            <strong>${escapeHtml(job.label)}</strong>
            <span class="job-status ${jobStatusClass(job.status)}">
              <span class="job-status-dot"></span>
              ${escapeHtml(job.status)}
            </span>
          </div>
          <div class="eyebrow">exit ${job.exitCode ?? "pending"}</div>
        </div>
        <div class="job-actions">
          <button class="secondary-button" data-copy-job-log="${escapeHtml(job.id)}">Copy Log</button>
          <button class="secondary-button" data-cancel="${escapeHtml(job.id)}" ${job.status === "running" ? "" : "disabled"}>Cancel</button>
        </div>
      </div>
      ${renderJobProgress(job)}
      <pre class="job-log">${escapeHtml(job.logs || "Waiting for command output...")}</pre>
    </article>
  `).join("") : '<div class="empty-state">No commands have run in this UI session.</div>';
}

function render() {
  populateFilters();
  renderSummary();
  renderWorkflow();
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

function showView(viewName) {
  state.view = viewName;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${state.view}View`));
}

async function markApplied(trackerNum) {
  if (!trackerNum) return;
  await api(`/api/applications/${encodeURIComponent(trackerNum)}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "Applied" })
  });
  toast("Application marked Applied");
  await loadData();
}

async function skipJob(trackerNum) {
  if (!trackerNum) return;
  await api(`/api/applications/${encodeURIComponent(trackerNum)}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "Skip" })
  });
  toast("Job removed from apply-ready list");
  await loadData();
}

async function tailorResume(trackerNum) {
  if (!trackerNum) return;
  const job = await api(`/api/applications/${encodeURIComponent(trackerNum)}/tailor-resume`, { method: "POST" });
  toast(`${job.label} started`);
  showView("commands");
  await renderJobs();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function copyJobLog(jobId) {
  const { jobs } = await api("/api/jobs");
  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new Error("Command log not found.");
  await copyText(job.logs || "");
  toast("Command log copied");
}

document.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-id]");
  if (row && !event.target.matches("button")) {
    state.selectedId = row.dataset.id;
    renderApplications();
    renderWorkflow();
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

  const markAppliedId = event.target.dataset.markApplied;
  if (markAppliedId) markApplied(markAppliedId).catch((error) => toast(error.message));

  const skipJobId = event.target.dataset.skipJob;
  if (skipJobId) skipJob(skipJobId).catch((error) => toast(error.message));

  const tailorResumeId = event.target.dataset.tailorResume;
  if (tailorResumeId) tailorResume(tailorResumeId).catch((error) => toast(error.message));

  const copyJobLogId = event.target.dataset.copyJobLog;
  if (copyJobLogId) copyJobLog(copyJobLogId).catch((error) => toast(error.message));

  if (event.target.dataset.showReady) {
    showView("applications");
    els.statusFilter.value = "all";
    els.sourceFilter.value = "tracker";
    els.searchInput.value = "";
    renderApplications();
  }

  const historyStatus = event.target.closest("[data-history-status]")?.dataset.historyStatus;
  if (historyStatus) {
    showView("applications");
    els.statusFilter.value = historyStatus;
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
    showView(button.dataset.view);
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
els.markAppliedButton.addEventListener("click", async () => {
  const item = state.items.find((candidate) => candidate.id === state.selectedId);
  await markApplied(item?.trackerNum);
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
