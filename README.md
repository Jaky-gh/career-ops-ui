# Career-Ops Local UI

A small local control panel for a `career-ops` checkout.

## Run

```bash
node server.mjs
```

Settings load from built-in defaults, then `settings.json`, then `settings.local.json` if it exists. Environment variables override file settings.

By default the app looks for `../career-ops` from this project directory. For your machine, copy the local settings template and point it at your checkout:

```bash
cp settings.local.example.json settings.local.json
```

Then edit `settings.local.json`:

```json
{
  "careerOpsPath": "/path/to/career-ops"
}
```

For a one-off run, you can still use:

```bash
CAREER_OPS_PATH=/path/to/career-ops node server.mjs
```

Then open the URL printed by the server.

## Settings

`settings.json` configures:

- `port`: local UI port
- `careerOpsPath`: path to the `career-ops` checkout, relative to this UI project or absolute
- `requiredFiles`: files checked by the workspace health panel
- `actions`: commands exposed in the Commands tab

`settings.local.json` is ignored by git so personal paths can stay local.

## What It Does

- Shows evaluated applications from `data/applications.md` and `reports/*.md`
- Shows new pipeline entries from `data/pipeline.md`
- Filters by status, score, source, and text search
- Runs local `career-ops` commands such as doctor, scan, verify, merge, dedup, and normalize
- Adds a URL to `data/pipeline.md`
- Opens a job description URL from the application list

This is intentionally local-only. It does not submit applications.
