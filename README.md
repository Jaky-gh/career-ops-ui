# Career-Ops Local UI

A small local control panel for a `career-ops` checkout.

## Run

```bash
node server.mjs
```

By default the app looks for `../career-ops` from this project directory. To point at another checkout:

```bash
CAREER_OPS_PATH=/path/to/career-ops node server.mjs
```

Then open the URL printed by the server.

## What It Does

- Shows evaluated applications from `data/applications.md` and `reports/*.md`
- Shows new pipeline entries from `data/pipeline.md`
- Filters by status, score, source, and text search
- Runs local `career-ops` commands such as doctor, scan, verify, merge, dedup, and normalize
- Adds a URL to `data/pipeline.md`
- Opens a job description URL from the application list

This is intentionally local-only. It does not submit applications.
