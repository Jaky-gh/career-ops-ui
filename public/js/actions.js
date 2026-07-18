import { api, toast } from "./api.js";
import { els } from "./dom.js";
import { state } from "./state.js";
import { render, renderJobsList } from "./render.js";

export async function renderJobs() {
  const { jobs } = await api("/api/jobs");
  renderJobsList(jobs);
}

export async function loadHealth() {
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

export async function loadData() {
  const data = await api("/api/applications");
  state.items = data.items;
  if (!state.selectedId && state.items.length) state.selectedId = state.items[0].id;
  render();
}

export async function refreshAll() {
  await loadHealth();
  await loadData();
  await renderJobs();
}

export async function runCommand(action) {
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

export async function openItem(item) {
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

export function showView(viewName) {
  state.view = viewName;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${state.view}View`));
}

export async function markApplied(trackerNum) {
  if (!trackerNum) return;
  await api(`/api/applications/${encodeURIComponent(trackerNum)}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "Applied" })
  });
  toast("Application marked Applied");
  await loadData();
}

export async function skipJob(trackerNum) {
  if (!trackerNum) return;
  await api(`/api/applications/${encodeURIComponent(trackerNum)}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "Skip" })
  });
  toast("Job removed from apply-ready list");
  await loadData();
}

export async function tailorResume(trackerNum) {
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

export async function copyJobLog(jobId) {
  const { jobs } = await api("/api/jobs");
  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new Error("Command log not found.");
  await copyText(job.logs || "");
  toast("Command log copied");
}

export async function addPipelineUrl(url) {
  await api("/api/pipeline", {
    method: "POST",
    body: JSON.stringify({ url })
  });
  els.urlInput.value = "";
  toast("Posting queued for review");
  await loadData();
}
