import { els } from "./dom.js";
import { state } from "./state.js";
import { applyReadyItems, filteredItems } from "./selectors.js";
import {
  dateSortValue,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatDuration,
  formatScore,
  jobStatusClass,
  scoreClass,
  sourceLabel
} from "./formatters.js";

export function populateFilters() {
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

export function renderSummary() {
  const items = state.items;
  const scores = items.map((item) => item.score).filter((score) => typeof score === "number");
  const avg = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : "-";
  els.totalCount.textContent = items.length;
  els.pipelineCount.textContent = items.filter((item) => item.status === "Pipeline" || item.source === "pipeline").length;
  els.recommendedCount.textContent = items.filter((item) => (item.score || 0) >= 4 || /recommend/i.test(item.status)).length;
  els.averageScore.textContent = avg;
}

function connectionStateClass(ok) {
  return ok ? "connection-ok" : "connection-missing";
}

function renderConnectionActions(pathValue, exists) {
  const path = escapeHtml(pathValue || ".");
  return `
    <div class="connection-row-actions">
      <button class="secondary-button" data-view-career-ops-path="${path}" ${exists ? "" : "disabled"}>View</button>
      <button class="secondary-button" data-open-career-ops-folder="${path}" ${exists ? "" : "disabled"}>Open Folder</button>
    </div>
  `;
}

export function renderConnection() {
  if (!state.health) return;
  const healthy = state.health.exists && !state.health.missing.length;
  els.connectionStatus.textContent = healthy ? "Connected" : "Needs attention";
  els.connectionStatus.className = `connection-status ${connectionStateClass(healthy)}`;
  els.connectionRoot.textContent = state.health.root;
  els.connectionSources.textContent = `Settings loaded from ${state.health.settings.sources.join(" + ")}`;
  els.connectionConfiguredPath.textContent = state.health.settings.careerOpsPath || "-";
  els.connectionCodexCommand.textContent = state.health.codexCommand || "-";
  els.careerOpsPathInput.value = state.health.root || state.health.settings.careerOpsPath || "";

  const requiredFiles = state.health.requiredFiles || [];
  const presentCount = requiredFiles.filter((file) => file.exists).length;
  els.requiredFilesCount.textContent = `${presentCount}/${requiredFiles.length} present`;
  els.requiredFilesList.innerHTML = requiredFiles.map((file) => `
    <article class="connection-row">
      <span class="connection-dot ${connectionStateClass(file.exists)}"></span>
      <div>
        <strong>${escapeHtml(file.label)}</strong>
        <p>${escapeHtml(file.path)}</p>
      </div>
      ${renderConnectionActions(file.label, file.exists)}
    </article>
  `).join("") || '<div class="empty-state">No required files configured.</div>';

  els.dataBindingsList.innerHTML = (state.health.dataBindings || []).map((binding) => `
    <article class="connection-row">
      <span class="connection-dot ${connectionStateClass(binding.exists)}"></span>
      <div>
        <strong>${escapeHtml(binding.area)} -> ${escapeHtml(binding.file)}</strong>
        <p>${escapeHtml(binding.purpose)}</p>
        <p>${escapeHtml(binding.path)}</p>
      </div>
      ${renderConnectionActions(binding.paths?.[0] || binding.file, binding.exists)}
    </article>
  `).join("") || '<div class="empty-state">No data bindings reported.</div>';
}

export function renderApplications() {
  const items = [...filteredItems()].sort((a, b) => {
    const dateDiff = dateSortValue(b.date) - dateSortValue(a.date);
    if (dateDiff) return dateDiff;
    return `${a.company} ${a.role}`.localeCompare(`${b.company} ${b.role}`);
  });
  els.applicationsTable.innerHTML = items.map((item) => `
    <tr data-id="${escapeHtml(item.id)}" class="${item.id === state.selectedId ? "selected" : ""}">
      <td class="date-cell">${escapeHtml(formatDate(item.date))}</td>
      <td class="company-cell"><strong>${escapeHtml(item.company)}</strong><br><span class="source-pill">${escapeHtml(sourceLabel(item.source))}</span></td>
      <td class="role-cell">${escapeHtml(item.role)}</td>
      <td class="status-cell"><span class="status-pill">${escapeHtml(item.status || "-")}</span></td>
      <td class="score-cell"><span class="score-pill ${scoreClass(item.score)}">${formatScore(item.score)}</span></td>
      <td class="location-cell">${escapeHtml(item.location || "-")}</td>
      <td class="actions-cell">
        <div class="row-actions">
          <button data-open="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Open</button>
        </div>
      </td>
    </tr>
  `).join("");
  els.emptyState.classList.toggle("hidden", items.length > 0);
}

export function renderWorkflow() {
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

export function renderWorkflowProgress(jobs = []) {
  const gradeJob = jobs.find((job) => job.action === "grade" && job.progress?.total)
    || jobs.find((job) => job.action === "grade")
    || jobs.find((job) => job.progress?.total);
  els.workflowProgressPanel.classList.toggle("hidden", !gradeJob);
  if (!gradeJob) return;

  els.workflowProgressTitle.textContent = gradeJob.label || "Grading Progress";
  els.workflowProgressStatus.textContent = `${gradeJob.status} / exit ${gradeJob.exitCode ?? "pending"}`;
  els.workflowProgressBody.innerHTML = renderJobProgress(gradeJob) || '<div class="empty-state">Waiting for grading progress output...</div>';
}

export function renderPipeline() {
  const pipeline = state.items.filter((item) => item.source === "pipeline" || item.status === "Pipeline");
  els.pipelineTable.innerHTML = pipeline.map((item) => `
    <tr data-id="${escapeHtml(item.id)}">
      <td><strong>${escapeHtml(item.company)}</strong></td>
      <td>${escapeHtml(item.role)}</td>
      <td>${escapeHtml(item.location || "-")}</td>
      <td>${escapeHtml(item.notes || "Ready for evaluation")}</td>
      <td>
        <div class="row-actions">
          <button data-open="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Open</button>
          <button data-grade-pipeline-url="${escapeHtml(item.url || "")}" ${item.url ? "" : "disabled"}>Grade</button>
        </div>
      </td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="empty-table-cell">No pending postings in the pipeline.</td></tr>';
}

export function renderHistory() {
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

export function renderDetail() {
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

const primaryCommandOrder = ["scan", "grade", "merge"];
const maintenanceCommandOrder = ["doctor", "verify", "liveness", "dedup", "normalize"];

function commandSortValue(action) {
  const primaryIndex = primaryCommandOrder.indexOf(action);
  if (primaryIndex >= 0) return primaryIndex;
  const maintenanceIndex = maintenanceCommandOrder.indexOf(action);
  if (maintenanceIndex >= 0) return 100 + maintenanceIndex;
  return 200;
}

function renderCommandCard(action, label, detail = {}) {
  return `
    <div class="command-card">
      <div>
        <div class="command-card-topline">
          <strong>${escapeHtml(detail.label || label)}</strong>
          <span class="eyebrow">${escapeHtml(action)}</span>
        </div>
        <p>${escapeHtml(detail.description || "Run this career-ops command.")}</p>
      </div>
      <dl class="command-docs">
        <div><dt>When</dt><dd>${escapeHtml(detail.when || "Use when this step is needed.")}</dd></div>
        <div><dt>Effect</dt><dd>${escapeHtml(detail.effect || "See command output for details.")}</dd></div>
      </dl>
      <div class="command-card-footer">
        <button class="primary-button command-button" data-action="${escapeHtml(action)}">Run</button>
      </div>
    </div>
  `;
}

export function renderCommands() {
  if (!state.health) return;
  const details = state.health.actionDetails || {};
  const commands = Object.entries(state.health.actions)
    .sort(([actionA], [actionB]) => commandSortValue(actionA) - commandSortValue(actionB) || actionA.localeCompare(actionB));
  const primary = commands.filter(([action]) => primaryCommandOrder.includes(action));
  const maintenance = commands.filter(([action]) => !primaryCommandOrder.includes(action));

  els.commandGrid.innerHTML = `
    <section class="command-group">
      <div class="section-head compact">
        <div>
          <h2>Workflow Commands</h2>
          <p>Run these in order for the normal job-search loop.</p>
        </div>
      </div>
      <div class="command-grid-inner">
        ${primary.map(([action, label]) => renderCommandCard(action, label, details[action])).join("")}
      </div>
    </section>
    <section class="command-group">
      <div class="section-head compact">
        <div>
          <h2>Maintenance</h2>
          <p>Use these when data needs checking or cleanup.</p>
        </div>
      </div>
      <div class="command-grid-inner maintenance-grid">
        ${maintenance.map(([action, label]) => renderCommandCard(action, label, details[action])).join("")}
      </div>
    </section>
  `;
}

export function renderJobProgress(job) {
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

function renderJobTimeline(job) {
  const finishedAt = job.status === "running" ? new Date().toISOString() : job.updatedAt;
  const duration = formatDuration(job.startedAt, finishedAt);
  return [
    `Started ${formatDateTime(job.startedAt)}`,
    job.updatedAt ? `Updated ${formatDateTime(job.updatedAt)}` : "",
    duration ? `Duration ${duration}` : "",
    `Exit ${job.exitCode ?? "pending"}`
  ].filter(Boolean).join(" / ");
}

export function renderLatestLog(jobs) {
  const latestJob = jobs[0];
  els.latestLogPanel.classList.toggle("empty", !latestJob);
  els.latestLogViewButton.disabled = !latestJob;
  els.latestLogCopyButton.disabled = !latestJob;

  if (!latestJob) {
    els.latestLogTitle.textContent = "Latest Command Output";
    els.latestLogStatus.textContent = "";
    els.latestLogMeta.textContent = "No command has run yet";
    els.latestLogBody.textContent = "Run a command to see its output here.";
    els.latestLogPanel.removeAttribute("data-job-id");
    return;
  }

  els.latestLogTitle.textContent = latestJob.label || "Command Log";
  els.latestLogStatus.innerHTML = `
    <span class="job-status ${jobStatusClass(latestJob.status)}">
      <span class="job-status-dot"></span>
      ${escapeHtml(latestJob.status || "unknown")}
    </span>
  `;
  els.latestLogMeta.textContent = renderJobTimeline(latestJob);
  els.latestLogBody.textContent = latestJob.logs || "Waiting for command output...";
  els.latestLogPanel.dataset.jobId = latestJob.id;
}

export function renderJobsList(jobs) {
  renderWorkflowProgress(jobs);
  renderLatestLog(jobs);
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
          <div class="job-time-row">${escapeHtml(renderJobTimeline(job))}</div>
        </div>
        <div class="job-actions">
          <button class="secondary-button" data-view-job-log="${escapeHtml(job.id)}">View Log</button>
          <button class="secondary-button" data-copy-job-log="${escapeHtml(job.id)}">Copy Log</button>
          ${job.status === "running" ? `<button class="secondary-button" data-cancel="${escapeHtml(job.id)}">Cancel</button>` : ""}
        </div>
      </div>
      ${renderJobProgress(job)}
    </article>
  `).join("") : '<div class="empty-state">No commands have run in this UI session.</div>';
}

export function renderLogModal(job) {
  els.logModalTitle.textContent = job.label || "Command Log";
  els.logModalStatus.innerHTML = `
    <span class="job-status ${jobStatusClass(job.status)}">
      <span class="job-status-dot"></span>
      ${escapeHtml(job.status || "unknown")}
    </span>
  `;
  els.logModalMeta.textContent = `${renderJobTimeline(job)} / ${job.command || "command unavailable"}`;
  els.logModalBody.textContent = job.logs || "Waiting for command output...";
  els.logModal.dataset.jobId = job.id;
  els.logModal.classList.remove("hidden");
}

export function closeLogModal() {
  els.logModal.classList.add("hidden");
  els.logModal.removeAttribute("data-job-id");
  els.logModalBody.textContent = "";
}

export function renderFileModal(entry) {
  const isDirectory = entry.kind === "directory";
  els.fileModalTitle.textContent = isDirectory ? "Folder Preview" : "File Preview";
  els.fileModalStatus.innerHTML = `
    <span class="job-status ${isDirectory ? "job-status-running" : "job-status-succeeded"}">
      <span class="job-status-dot"></span>
      ${isDirectory ? "directory" : "file"}
    </span>
  `;
  els.fileModalMeta.textContent = entry.absolutePath || entry.path || "";
  els.fileModalBody.textContent = isDirectory
    ? (entry.entries || []).map((item) => `${item.type === "directory" ? "[dir] " : "      "}${item.path}`).join("\n") || "Folder is empty."
    : entry.content || "";
  els.fileModal.dataset.content = els.fileModalBody.textContent;
  els.fileModal.classList.remove("hidden");
}

export function closeFileModal() {
  els.fileModal.classList.add("hidden");
  els.fileModalBody.textContent = "";
  els.fileModal.removeAttribute("data-content");
}

export function render() {
  populateFilters();
  renderSummary();
  renderConnection();
  renderWorkflow();
  renderApplications();
  renderHistory();
  renderPipeline();
  renderDetail();
  renderCommands();
}
