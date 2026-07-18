import { api, toast } from "./js/api.js";
import {
  addPipelineUrl,
  copyJobLog,
  markApplied,
  openItem,
  refreshAll,
  renderJobs,
  runCommand,
  showView,
  skipJob,
  tailorResume
} from "./js/actions.js";
import { els } from "./js/dom.js";
import { renderApplications, renderDetail, renderHistory, renderWorkflow } from "./js/render.js";
import { state } from "./js/state.js";

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
  await addPipelineUrl(els.urlInput.value);
});

refreshAll().catch((error) => toast(error.message));
