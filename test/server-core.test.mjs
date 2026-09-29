import assert from "node:assert/strict";
import test from "node:test";

import {
  countPipelineRowsFromMarkdown,
  extractReportFile,
  extractUrl,
  hasFatalCommandOutput,
  inferFinishedStatus,
  parseMarkdownTables,
  parsePipelineCheckboxes,
  parsePipelineMarkdown,
  parseScore,
  stripMarkdownLinks,
  updateJobProgressFromLog
} from "../server.mjs";

test("parses markdown tracker tables into normalized row keys", () => {
  const markdown = `
| # | Date | Company | Role | Score | Status | Report |
|---|---|---|---|---|---|---|
| 7 | 2026-09-28 | [Acme](https://example.com/job) | AI Engineer | 4.3/5 | Evaluated | [Report](reports/007-acme.md) |
`;

  const [table] = parseMarkdownTables(markdown);

  assert.deepEqual(table.headers, ["#", "Date", "Company", "Role", "Score", "Status", "Report"]);
  assert.equal(table.rows[0].company, "[Acme](https://example.com/job)");
  assert.equal(parseScore(table.rows[0].score), 4.3);
  assert.equal(extractReportFile(table.rows[0].report), "007-acme.md");
});

test("extracts markdown links and bare urls used by career-ops files", () => {
  assert.deepEqual(stripMarkdownLinks("[OpenAI](https://openai.com/careers)"), {
    text: "OpenAI",
    url: "https://openai.com/careers"
  });
  assert.equal(extractUrl("Apply at https://example.com/jobs/123)."), "https://example.com/jobs/123");
  assert.equal(parseScore("Recommended: 5/5"), 5);
  assert.equal(parseScore("no score"), null);
});

test("parses pending pipeline checkbox rows and ignores processed rows", () => {
  const markdown = `
# Pipeline
- [ ] https://jobs.example.com/1 | Acme AI | Forward Deployed Engineer | Remote | From scan
- [x] https://jobs.example.com/2 | Done Co | Software Engineer | Remote |
- [!] https://jobs.example.com/3 | Failed Co | Software Engineer | Remote |
`;

  const rows = parsePipelineCheckboxes(markdown);
  const counts = countPipelineRowsFromMarkdown(markdown);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, "Acme AI");
  assert.equal(rows[0].role, "Forward Deployed Engineer");
  assert.equal(rows[0].url, "https://jobs.example.com/1");
  assert.deepEqual(counts, { pending: 1, total: 3 });
});

test("falls back to table pipeline format when no task rows exist", () => {
  const markdown = `
| Company | Role | URL | Location | Notes |
|---|---|---|---|---|
| [Northstar](https://example.com/northstar) | Platform Engineer |  | California | manually added |
`;

  const rows = parsePipelineMarkdown(markdown);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, "Northstar");
  assert.equal(rows[0].role, "Platform Engineer");
  assert.equal(rows[0].url, "https://example.com/northstar");
  assert.equal(rows[0].location, "California");
});

test("detects failed command output even when process exit code is zero", () => {
  assert.equal(
    hasFatalCommandOutput({
      action: "grade",
      logs: "Evaluating...\nOpenRouter error: API_KEY not found.\n"
    }),
    true
  );
  assert.equal(
    hasFatalCommandOutput({
      action: "grade",
      logs: "API_KEY not found earlier\nReport saved: reports/001-acme.md\n"
    }),
    false
  );
  assert.equal(
    inferFinishedStatus({
      action: "scan",
      logs: "Errors (2):\n  x Some provider failed",
      exitCode: 0
    }),
    "failed"
  );
});

test("updates grading progress from command logs", () => {
  const job = { action: "grade", logs: "" };

  updateJobProgressFromLog(job, "[3/84] Acme AI - Software Engineer\nFetching job page...\n");
  assert.deepEqual(job.progress, {
    current: 3,
    total: 84,
    label: "Acme AI - Software Engineer"
  });

  updateJobProgressFromLog(job, "Pipeline processing complete\n");
  assert.equal(job.progress.current, 84);
  assert.equal(job.progress.label, "Pipeline grading complete");
});
