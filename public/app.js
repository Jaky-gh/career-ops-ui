import { api, toast } from "./js/api.js";
import {
  addPipelineUrl,
  closeFileModal,
  closeLogModal,
  copyFilePreview,
  copyLatestJobLog,
  copyOpenJobLog,
  copyJobLog,
  gradePipelineJob,
  markApplied,
  openCareerOpsFolder,
  openItem,
  refreshAll,
  renderJobs,
  runCommand,
  saveCareerOpsPath,
  showView,
  skipJob,
  tailorResume,
  viewCareerOpsPath,
  viewLatestJobLog,
  viewJobLog
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

  const gradePipelineUrl = event.target.dataset.gradePipelineUrl;
  if (gradePipelineUrl) gradePipelineJob(gradePipelineUrl).catch((error) => toast(error.message));

  const markAppliedId = event.target.dataset.markApplied;
  if (markAppliedId) markApplied(markAppliedId).catch((error) => toast(error.message));

  const skipJobId = event.target.dataset.skipJob;
  if (skipJobId) skipJob(skipJobId).catch((error) => toast(error.message));

  const tailorResumeId = event.target.dataset.tailorResume;
  if (tailorResumeId) tailorResume(tailorResumeId).catch((error) => toast(error.message));

  const copyJobLogId = event.target.dataset.copyJobLog;
  if (copyJobLogId) copyJobLog(copyJobLogId).catch((error) => toast(error.message));

  const viewJobLogId = event.target.dataset.viewJobLog;
  if (viewJobLogId) viewJobLog(viewJobLogId).catch((error) => toast(error.message));

  if (event.target.dataset.closeLogModal || event.target === els.logModal) {
    closeLogModal();
  }

  if (event.target.dataset.closeFileModal || event.target === els.fileModal) {
    closeFileModal();
  }

  const viewCareerOpsPathValue = event.target.dataset.viewCareerOpsPath;
  if (viewCareerOpsPathValue) viewCareerOpsPath(viewCareerOpsPathValue).catch((error) => toast(error.message));

  const openCareerOpsFolderPath = event.target.dataset.openCareerOpsFolder;
  if (openCareerOpsFolderPath) openCareerOpsFolder(openCareerOpsFolderPath).catch((error) => toast(error.message));

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

els.logModalCloseButton.addEventListener("click", closeLogModal);
els.logModalCopyButton.addEventListener("click", () => copyOpenJobLog().catch((error) => toast(error.message)));
els.fileModalCloseButton.addEventListener("click", closeFileModal);
els.fileModalCopyButton.addEventListener("click", () => copyFilePreview().catch((error) => toast(error.message)));
els.latestLogViewButton.addEventListener("click", () => viewLatestJobLog().catch((error) => toast(error.message)));
els.latestLogCopyButton.addEventListener("click", () => copyLatestJobLog().catch((error) => toast(error.message)));
els.openCareerOpsFolderButton.addEventListener("click", () => openCareerOpsFolder(".").catch((error) => toast(error.message)));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.logModal.classList.contains("hidden")) {
    closeLogModal();
  }
  if (event.key === "Escape" && !els.fileModal.classList.contains("hidden")) {
    closeFileModal();
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
els.careerOpsPathForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveCareerOpsPath(els.careerOpsPathInput.value).catch((error) => toast(error.message));
});

refreshAll().catch((error) => toast(error.message));
