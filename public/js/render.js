import { els } from "./dom.js";
import { state } from "./state.js";
import { applyReadyItems, filteredItems } from "./selectors.js";
import {
  dateSortValue,
  escapeHtml,
  formatDate,
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
  const gradeJob = jobs.find((job) => job.action === "grade") || jobs.find((job) => job.progress?.total);
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
      <td><div class="row-actions"><button data-open="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Open</button></div></td>
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

export function renderCommands() {
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

export function renderJobsList(jobs) {
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

export function render() {
  populateFilters();
  renderSummary();
  renderWorkflow();
  renderApplications();
  renderHistory();
  renderPipeline();
  renderDetail();
  renderCommands();
}
