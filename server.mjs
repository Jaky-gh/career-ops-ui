import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const STATE_DIR = path.join(__dirname, ".career-ops-ui");
const JOBS_STATE_FILE = path.join(STATE_DIR, "jobs.json");

const jobs = new Map();
let nextJobId = 1;

const DEFAULT_SETTINGS = {
  port: 5177,
  careerOpsPath: "../career-ops",
  requiredFiles: ["cv.md", "config/profile.yml", "modes/_profile.md", "portals.yml"],
  actions: {
    doctor: {
      label: "Doctor",
      command: ["node", "doctor.mjs"],
      description: "Checks whether the connected career-ops checkout is configured correctly.",
      when: "Run this first when setup looks broken or commands fail unexpectedly.",
      effect: "Read-only health check."
    },
    scan: {
      label: "Search New Jobs",
      command: ["node", "scan.mjs"],
      description: "Scans configured job portals and queues matching postings in data/pipeline.md.",
      when: "Run when you want fresh jobs to grade.",
      effect: "Writes new pending pipeline entries and scan history."
    },
    grade: {
      label: "Grade Pipeline",
      command: ["node", "openrouter-runner.mjs", "pipeline"],
      description: "Grades each pending pipeline job with OpenRouter and saves evaluation reports.",
      when: "Run after fetching or queueing jobs. Use smaller batches when possible.",
      effect: "Writes reports, tracker additions, and marks processed pipeline rows."
    },
    verify: {
      label: "Verify Pipeline",
      command: ["node", "verify-pipeline.mjs"],
      description: "Checks tracker and pipeline integrity: statuses, reports, PDFs, duplicates, and pending merge files.",
      when: "Run after grading, merging, or hand-editing tracker data.",
      effect: "Read-only validation."
    },
    merge: {
      label: "Merge Tracker",
      command: ["node", "merge-tracker.mjs"],
      description: "Moves generated tracker additions into data/applications.md.",
      when: "Run after Grade Pipeline creates evaluated jobs that should appear in History.",
      effect: "Updates application history and archives merged additions."
    },
    dedup: {
      label: "Deduplicate Tracker",
      command: ["node", "dedup-tracker.mjs", "--dry-run"],
      description: "Finds likely duplicate application tracker rows without changing files.",
      when: "Run when the same company or role appears multiple times.",
      effect: "Dry-run only."
    },
    normalize: {
      label: "Normalize Statuses",
      command: ["node", "normalize-statuses.mjs", "--dry-run"],
      description: "Finds non-standard statuses and shows how they would be normalized.",
      when: "Run when filters or history counts look inconsistent.",
      effect: "Dry-run only."
    },
    liveness: {
      label: "Check Liveness",
      command: ["node", "check-liveness.mjs"],
      description: "Checks whether job posting URLs still appear active.",
      when: "Run before grading a large queue to avoid wasting model calls on closed postings.",
      effect: "Read-only URL check unless called with file-specific options outside the UI."
    }
  }
};

async function loadJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Could not load settings from ${filePath}: ${error.message}`);
  }
}

function mergeSettings(base, override = {}) {
  return {
    ...base,
    ...override,
    requiredFiles: override.requiredFiles || base.requiredFiles,
    actions: {
      ...(base.actions || {}),
      ...(override.actions || {})
    }
  };
}

async function loadSettings() {
  const configuredPaths = [
    process.env.CAREER_OPS_UI_SETTINGS,
    path.join(__dirname, "settings.json"),
    path.join(__dirname, "settings.local.json")
  ].filter(Boolean);

  let settings = DEFAULT_SETTINGS;
  const sources = ["built-in defaults"];
  for (const settingsPath of configuredPaths) {
    const loaded = await loadJsonIfExists(path.resolve(settingsPath));
    if (!loaded) continue;
    settings = mergeSettings(settings, loaded);
    sources.push(path.resolve(settingsPath));
  }

  if (process.env.CAREER_OPS_PATH) {
    settings = { ...settings, careerOpsPath: process.env.CAREER_OPS_PATH };
    sources.push("CAREER_OPS_PATH");
  }
  if (process.env.PORT) {
    settings = { ...settings, port: Number(process.env.PORT) };
    sources.push("PORT");
  }

  return { ...settings, sources };
}

function resolveFromProject(value) {
  return path.resolve(__dirname, value || ".");
}

function normalizeCommand(command) {
  const [cmd, ...args] = Array.isArray(command) ? command : String(command || "").split(/\s+/).filter(Boolean);
  return [cmd === "node" ? process.execPath : cmd, args];
}

const settings = await loadSettings();
const PORT = Number(settings.port || 5177);
const CAREER_OPS_ROOT = resolveFromProject(settings.careerOpsPath);
const ACTIONS = Object.fromEntries(Object.entries(settings.actions || {}).map(([id, action]) => [
  id,
  {
    label: action.label || id,
    command: normalizeCommand(action.command),
    description: action.description || "",
    when: action.when || "",
    effect: action.effect || ""
  }
]));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body.trim()) return {};
  return JSON.parse(body);
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function serializeJob(job) {
  const { child, ...safeJob } = job;
  return safeJob;
}

async function loadPersistedJobs() {
  const saved = await loadJsonIfExists(JOBS_STATE_FILE);
  if (!saved?.jobs?.length) return;

  for (const savedJob of saved.jobs) {
    const job = {
      ...savedJob,
      status: savedJob.status === "running" ? "interrupted" : savedJob.status
    };
    if (job.logs) updateJobProgressFromLog(job, job.logs);
    jobs.set(job.id, job);
    nextJobId = Math.max(nextJobId, Number(job.id) + 1);
  }
}

async function persistJobs() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const list = Array.from(jobs.values()).map(serializeJob).slice(-50);
  await fs.writeFile(JOBS_STATE_FILE, JSON.stringify({ jobs: list }, null, 2), "utf8");
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isDividerRow(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseMarkdownTables(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].includes("|") || !isDividerRow(lines[i + 1])) continue;
    const headers = splitMarkdownRow(lines[i]);
    const rows = [];
    i += 2;
    while (i < lines.length && lines[i].includes("|") && !isDividerRow(lines[i])) {
      const cells = splitMarkdownRow(lines[i]);
      if (cells.length >= Math.max(2, headers.length - 1)) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.toLowerCase().replace(/\s+/g, "_")] = cells[index] || "";
        });
        rows.push(row);
      }
      i += 1;
    }
    tables.push({ headers, rows });
  }
  return tables;
}

function stripMarkdownLinks(value = "") {
  const match = String(value).match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (match) return { text: match[1], url: match[2] };
  return { text: String(value).replace(/[*_`]/g, "").trim(), url: "" };
}

function extractUrl(value = "") {
  const link = String(value).match(/\]\((https?:\/\/[^)]+)\)/);
  if (link) return link[1];
  const bare = String(value).match(/https?:\/\/\S+/);
  return bare ? bare[0].replace(/[),.;]+$/, "") : "";
}

function extractReportFile(value = "") {
  const link = String(value).match(/\]\([^)]+\/([^/)]+\.md)\)/);
  return link ? link[1] : "";
}

function parseScore(value = "") {
  const match = String(value).match(/([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/);
  return match ? Number(match[1]) : null;
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "item";
}

async function parseReports() {
  const reportsDir = path.join(CAREER_OPS_ROOT, "reports");
  let entries = [];
  try {
    entries = await fs.readdir(reportsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const reports = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(reportsDir, entry.name);
    const markdown = await readTextIfExists(filePath);
    const title = markdown.match(/^#\s*(?:Evaluation:\s*)?(.+)$/m)?.[1]?.trim() || entry.name.replace(/\.md$/, "");
    const score = parseScore(markdown.match(/\*\*Score:\*\*\s*(.+)$/m)?.[1] || "");
    const url = extractUrl(markdown.match(/\*\*URL:\*\*\s*(.+)$/m)?.[1] || markdown);
    const date = markdown.match(/\*\*Date:\*\*\s*(.+)$/m)?.[1]?.trim() || "";
    const [companyGuess, ...roleParts] = title.split(/\s+--\s+|\s+-\s+/);
    reports.push({
      id: `report:${entry.name}`,
      source: "report",
      company: companyGuess || "Unknown",
      role: roleParts.join(" - ") || title,
      status: score && score >= 4 ? "Recommended" : score ? "Evaluated" : "Report",
      score,
      date,
      url,
      location: "",
      reportFile: entry.name,
      notes: ""
    });
  }
  return reports;
}

async function parseApplications() {
  const markdown = await readTextIfExists(path.join(CAREER_OPS_ROOT, "data", "applications.md"));
  const tables = parseMarkdownTables(markdown);
  const rows = tables.flatMap((table) => table.rows);

  return rows.map((row, index) => {
    const companyLink = stripMarkdownLinks(firstValue(row, ["company", "empresa"]));
    const roleLink = stripMarkdownLinks(firstValue(row, ["role", "position", "title", "puesto", "rol"]));
    const url = extractUrl(firstValue(row, ["url", "link", "jd", "posting"])) || companyLink.url || roleLink.url;
    const score = parseScore(firstValue(row, ["score", "fit", "rating"]));
    const trackerNum = firstValue(row, ["#", "num", "id"]);
    return {
      id: `application:${index + 1}`,
      source: "tracker",
      trackerNum,
      company: companyLink.text || "Unknown",
      role: roleLink.text || "Unknown role",
      status: firstValue(row, ["status", "estado"]) || "Tracked",
      score,
      date: firstValue(row, ["date", "applied", "fecha"]),
      url,
      location: firstValue(row, ["location", "ubicacion", "ubicación"]),
      reportFile: extractReportFile(firstValue(row, ["report"])),
      notes: firstValue(row, ["notes", "notas"])
    };
  });
}

function parsePipelineCheckboxes(markdown) {
  const lines = markdown.split(/\r?\n/);
  const pending = [];

  for (const line of lines) {
    const match = line.match(/^\s*-\s+\[\s\]\s+(.+)$/);
    if (!match) continue;
    const parts = match[1].split("|").map((part) => part.trim());
    const url = extractUrl(parts[0] || match[1]);
    pending.push({
      id: `pipeline:${pending.length + 1}`,
      source: "pipeline",
      company: parts[1] || "New lead",
      role: parts[2] || "Unreviewed role",
      status: "Pipeline",
      score: null,
      date: "",
      url,
      location: parts[3] || "",
      reportFile: "",
      notes: parts[4] || ""
    });
  }

  return pending;
}

async function parsePipeline() {
  const markdown = await readTextIfExists(path.join(CAREER_OPS_ROOT, "data", "pipeline.md"));
  const checkboxRows = parsePipelineCheckboxes(markdown);
  if (checkboxRows.length > 0) return checkboxRows;

  const tables = parseMarkdownTables(markdown);
  const rows = tables.flatMap((table) => table.rows);

  if (rows.length > 0) {
    return rows.map((row, index) => {
      const company = stripMarkdownLinks(firstValue(row, ["company", "empresa"]));
      const role = stripMarkdownLinks(firstValue(row, ["role", "title", "puesto", "rol"]));
      return {
        id: `pipeline:${index + 1}`,
        source: "pipeline",
        company: company.text || firstValue(row, ["source"]) || "New lead",
        role: role.text || "Unreviewed role",
        status: "Pipeline",
        score: null,
        date: firstValue(row, ["date", "added"]),
        url: extractUrl(firstValue(row, ["url", "link"])) || company.url || role.url,
        location: firstValue(row, ["location", "ubicacion", "ubicación"]),
        reportFile: "",
        notes: firstValue(row, ["notes", "source"])
      };
    });
  }

  const lines = markdown.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
  return lines.map((line, index) => {
    const parts = line.split("\t");
    const url = extractUrl(line) || parts.find((part) => /^https?:\/\//.test(part)) || "";
    return {
      id: `pipeline:${index + 1}`,
      source: "pipeline",
      company: parts[1] || "New lead",
      role: parts[2] || "Unreviewed role",
      status: "Pipeline",
      score: null,
      date: "",
      url,
      location: parts[3] || "",
      reportFile: "",
      notes: parts[0] || ""
    };
  });
}

function sampleApplications() {
  return [
    {
      id: "sample:1",
      source: "sample",
      company: "Acme AI",
      role: "Senior AI Engineer",
      status: "Recommended",
      score: 4.2,
      date: "2026-04-01",
      url: "https://jobs.example.com/acme-ai-senior-engineer",
      location: "Remote",
      reportFile: "",
      notes: "Sample data shown because no tracker exists yet."
    },
    {
      id: "sample:2",
      source: "sample",
      company: "Northstar Labs",
      role: "ML Platform Lead",
      status: "Pipeline",
      score: null,
      date: "",
      url: "https://example.com/jobs/ml-platform-lead",
      location: "New York / Remote",
      reportFile: "",
      notes: "Add real jobs with the URL box or run Search New Jobs."
    }
  ];
}

async function getData() {
  const [applications, reports, pipeline] = await Promise.all([
    parseApplications(),
    parseReports(),
    parsePipeline()
  ]);
  const reportsByFile = new Map(reports.map((report) => [report.reportFile, report]));
  const enrichedApplications = applications.map((application) => {
    const report = reportsByFile.get(application.reportFile);
    if (!report) return application;
    return {
      ...application,
      url: application.url || report.url,
      location: application.location || report.location,
      notes: application.notes || report.notes
    };
  });
  const linkedReports = new Set(enrichedApplications.map((item) => item.reportFile).filter(Boolean));
  const untrackedReports = reports.filter((report) => !linkedReports.has(report.reportFile));
  const items = [...enrichedApplications, ...untrackedReports, ...pipeline];
  return {
    root: CAREER_OPS_ROOT,
    settings: {
      sources: settings.sources,
      careerOpsPath: settings.careerOpsPath
    },
    hasData: items.length > 0,
    items: items.length > 0 ? items : sampleApplications()
  };
}

async function getHealth() {
  const required = settings.requiredFiles || [];
  const missing = required.filter((rel) => !existsSync(path.join(CAREER_OPS_ROOT, ...rel.split("/"))));
  return {
    root: CAREER_OPS_ROOT,
    exists: existsSync(CAREER_OPS_ROOT),
    missing,
    settings: {
      sources: settings.sources,
      careerOpsPath: settings.careerOpsPath,
      requiredFiles: required
    },
    actions: Object.fromEntries(Object.entries(ACTIONS).map(([id, action]) => [id, action.label])),
    actionDetails: Object.fromEntries(Object.entries(ACTIONS).map(([id, action]) => [id, {
      label: action.label,
      description: action.description,
      when: action.when,
      effect: action.effect
    }]))
  };
}

function updateJobProgressFromLog(job, text) {
  const processing = text.match(/Processing\s+(\d+)\s+pending listing/i);
  if (processing) {
    job.progress = {
      current: 0,
      total: Number(processing[1]),
      label: "Preparing grading run"
    };
  }

  for (const match of text.matchAll(/\[(\d+)\/(\d+)\]\s+([^\n]+)/g)) {
    const index = Number(match[1]);
    const total = Number(match[2]);
    job.progress = {
      current: Math.max(job.progress?.current || 0, index),
      total,
      label: match[3].trim()
    };
    job.currentItemIndex = index;
  }

  if (/Report saved:/i.test(text) && job.progress?.total && job.currentItemIndex) {
    job.progress = {
      ...job.progress,
      current: Math.max(job.progress.current, job.currentItemIndex)
    };
  }

  if (/Pipeline processing complete/i.test(text) && job.progress?.total) {
    job.progress = {
      ...job.progress,
      current: job.progress.total,
      label: "Pipeline grading complete"
    };
  }
}

function appendLog(job, text) {
  job.logs += text;
  updateJobProgressFromLog(job, text);
  job.updatedAt = new Date().toISOString();
  void persistJobs();
}

function startJob(actionId) {
  const action = ACTIONS[actionId];
  if (!action) throw new Error(`Unknown action: ${actionId}`);
  if (!existsSync(CAREER_OPS_ROOT)) throw new Error(`career-ops root not found: ${CAREER_OPS_ROOT}`);

  const [cmd, args] = action.command;
  const id = String(nextJobId++);
  const job = {
    id,
    action: actionId,
    label: action.label,
    status: "running",
    command: [cmd, ...args].join(" "),
    logs: "",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exitCode: null
  };
  jobs.set(id, job);
  void persistJobs();

  const child = spawn(cmd, args, {
    cwd: CAREER_OPS_ROOT,
    env: process.env,
    shell: false
  });
  job.child = child;

  child.stdout.on("data", (chunk) => appendLog(job, chunk.toString()));
  child.stderr.on("data", (chunk) => appendLog(job, chunk.toString()));
  child.on("error", (error) => {
    job.status = "failed";
    appendLog(job, `${error.message}\n`);
    void persistJobs();
  });
  child.on("close", (code) => {
    job.exitCode = code;
    job.status = code === 0 ? "succeeded" : "failed";
    job.updatedAt = new Date().toISOString();
    delete job.child;
    if (code === 0 && job.progress?.total) {
      job.progress = {
        ...job.progress,
        current: job.progress.total
      };
    }
    void persistJobs();
  });

  return job;
}

async function addPipelineUrl(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http(s) URLs are supported.");
  const dataDir = path.join(CAREER_OPS_ROOT, "data");
  const filePath = path.join(dataDir, "pipeline.md");
  await fs.mkdir(dataDir, { recursive: true });
  const existing = await readTextIfExists(filePath);
  const line = `- [ ] ${parsed.href} | Manual | Unreviewed role | | Added from local UI\n`;
  await fs.writeFile(filePath, existing ? `${existing.replace(/\s*$/, "\n")}${line}` : line, "utf8");
}

async function updateApplicationStatus(trackerNum, status) {
  const allowed = new Set(["Evaluated", "Applied", "Responded", "Interview", "Offer", "Rejected", "Discarded", "Skip"]);
  if (!allowed.has(status)) throw new Error(`Unsupported status: ${status}`);
  if (!String(trackerNum || "").trim()) throw new Error("Missing application number.");

  const filePath = path.join(CAREER_OPS_ROOT, "data", "applications.md");
  const markdown = await readTextIfExists(filePath);
  if (!markdown) throw new Error("applications.md not found.");

  const lines = markdown.split(/\r?\n/);
  let updated = false;
  const nextLines = lines.map((line) => {
    if (!line.trim().startsWith("|") || isDividerRow(line)) return line;
    const cells = splitMarkdownRow(line);
    if (cells[0] !== String(trackerNum)) return line;
    if (cells.length < 9) throw new Error(`Application #${trackerNum} has an unexpected tracker format.`);
    cells[1] = status === "Applied" ? todayIso() : cells[1];
    cells[5] = status;
    updated = true;
    return `| ${cells.join(" | ")} |`;
  });

  if (!updated) throw new Error(`Application #${trackerNum} not found.`);
  await fs.writeFile(filePath, nextLines.join("\n"), "utf8");
}

function openUrl(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http(s) URLs are supported.");
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", parsed.href] : [parsed.href];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(PUBLIC_DIR, `.${requested}`);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");
  if (!existsSync(filePath)) return sendText(res, 404, "Not found");
  const ext = path.extname(filePath);
  res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, await getHealth());
    }

    if (req.method === "GET" && url.pathname === "/api/applications") {
      return sendJson(res, 200, await getData());
    }

    if (req.method === "GET" && url.pathname === "/api/settings") {
      return sendJson(res, 200, {
        root: CAREER_OPS_ROOT,
        port: PORT,
        careerOpsPath: settings.careerOpsPath,
        requiredFiles: settings.requiredFiles,
        actionIds: Object.keys(ACTIONS),
        sources: settings.sources
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/reports/")) {
      const file = path.basename(decodeURIComponent(url.pathname.replace("/api/reports/", "")));
      const filePath = path.join(CAREER_OPS_ROOT, "reports", file);
      if (!file.endsWith(".md") || !existsSync(filePath)) return sendText(res, 404, "Report not found");
      return sendJson(res, 200, { file, markdown: await readTextIfExists(filePath) });
    }

    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const body = await readBody(req);
      const job = startJob(body.action);
      return sendJson(res, 202, { ...job, child: undefined });
    }

    if (req.method === "GET" && url.pathname === "/api/jobs") {
      const list = Array.from(jobs.values()).map((job) => ({ ...job, child: undefined }));
      return sendJson(res, 200, { jobs: list.reverse() });
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/jobs\/[^/]+\/cancel$/)) {
      const id = url.pathname.split("/")[3];
      const job = jobs.get(id);
      if (!job) return sendText(res, 404, "Job not found");
      if (job.child) {
        job.child.kill();
        job.status = "cancelled";
        job.updatedAt = new Date().toISOString();
        await persistJobs();
      }
      return sendJson(res, 200, { ...job, child: undefined });
    }

    if (req.method === "POST" && url.pathname === "/api/pipeline") {
      const body = await readBody(req);
      await addPipelineUrl(body.url);
      return sendJson(res, 201, { ok: true });
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/applications\/[^/]+\/status$/)) {
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const body = await readBody(req);
      await updateApplicationStatus(id, body.status);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/open") {
      const body = await readBody(req);
      openUrl(body.url);
      return sendJson(res, 200, { ok: true });
    }

    return sendText(res, 404, "Not found");
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
}

const server = createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

await loadPersistedJobs();

server.listen(PORT, () => {
  console.log(`Career-Ops Local UI: http://localhost:${PORT}`);
  console.log(`career-ops root: ${CAREER_OPS_ROOT}`);
  console.log(`settings: ${settings.sources.join(", ")}`);
});
