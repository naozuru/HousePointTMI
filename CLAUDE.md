# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HousePointTMI v2.0** — "Sistem Poin Siswa Digital" for Tunas Mekar Indonesia (TMI), an Indonesian school. Static web frontend backed by a Google Apps Script web API, with a Google Spreadsheet as the database. Three houses: **JJT**, **Jensud**, **Munir**.

Frontend copy is in Indonesian (`lang="id"`); preserve Indonesian strings in user-facing UI.

## Architecture

```
┌──────────────────────┐      POST (text/plain)      ┌──────────────────────┐
│  Static HTML/CSS/JS  │ ──────────────────────────► │  Google Apps Script  │
│  (this repo)         │ ◄────────────────────────── │  Code.gs (doPost)    │
│  + shared.js helpers │   JSON {status, ...data}    └──────────┬───────────┘
└──────────────────────┘                                       │
                                                                ▼
                                                     ┌──────────────────────┐
                                                     │  Google Spreadsheet  │
                                                     │  5 sheets (see below)│
                                                     └──────────────────────┘
```

- **No build step.** All JS loaded via `<script>` tags. No bundler, no npm.
- **No local server needed.** Serve directory statically (or open `index.html` in a browser). Web NFC requires HTTPS or localhost.
- **`config.js`** is the source of truth for the API endpoint (`API_URL`). Required by every page.

## File map

| File | Purpose |
|---|---|
| `shared.js` | **NEW v2.0.** Shared utilities: `api()` wrapper with request dedup, `toast` queue, `modal`, `theme` (dark mode), `format*` helpers, `createAvatar`, `debounce/throttle`, `confetti`, `store`, PWA install prompt. Loaded by every page. |
| `app.js` | Page-shell behavior: theme toggle button, online indicator, PWA install button, SW update toast, announcement banner. |
| `config.js` | `API_URL` constant + `APP_VERSION`. |
| `index.html` | Teacher login — username/password or Web NFC. |
| `dashboard.html` + `dashboard.js` | Teacher dashboard: stat cards, house points banner, search/filter students (with NFC tap), pick +/- violation, confirm modal with notes, undo, history preview, house quick-filters, category filters. |
| `reports.html` + `reports.js` | 5 tabs: **Ranking** (with highest/lowest highlight + filters), **History** (chart + filters by month/view/house), **Houses** (battle bars + 6-month trend line + top 3 per house), **Classes** (stats per class with top student), **Export** (Excel/PDF/CSV with date range filter). |
| `parent.html` + `parent.js` | Parent portal: enter NIS to view points, summary stats, full history, achievement banner. |
| `style.css` | Global stylesheet with **dark mode** (toggled via `data-theme="dark"` on `<html>`), responsive grid, animations (skeleton, confetti, slide-in, pulse), design tokens in `:root`. |
| `manifest.json` | PWA manifest with shortcuts (Dashboard, Wali Murid). |
| `sw.js` | Service worker v2 — cache-first with network-first for navigations, auto-cleanup of old caches. |
| `debug.html` | Standalone test page — buttons for every API action, shows raw JSON response + timing. |
| `Code.gs` | Google Apps Script backend — see Backend section below. |

## Backend (`Code.gs`)

`doPost(e)` dispatches on the JSON body's `action` field. Reads from these sheets (header row in row 1, data from row 2):

| Sheet | Columns (1-indexed) |
|---|---|
| `Teachers` | id, username, password, nfc_id, name |
| `Students` | nis, nfc_id, name, class, house, photo_url, points |
| `Violations` | id, name, type (`plus`/`minus`), point, category |
| `Transactions` | tr_id, timestamp, teacher_id, student_nis, violation_id, point_change, note, **deleted (0\|1), deleted_by, deleted_at**, class, house |
| `AuditLog` | log_id, timestamp, actor, action, target, details |
| `Announcements` | id, title, body, created_at, expires_at, active |

Supported actions: `login`, `parentLogin`, `getStudents`, `getStudentHistory`, `getStudentStats`, `getViolations`, `addTransaction`, `undoTransaction`, `redoTransaction`, `deleteTransaction`, `getTransaction`, `getLeaderboard`, `getHistory`, `getHousePoints`, `getHouseHistory`, `getDashboardStats`, `getClassStats`, `getActivityHeatmap`, `getAuditLog`, `getAnnouncements`, `exportData`.

### Notable behavior
- **Soft-delete undo**: `handleUndoTransaction` marks column H (`deleted=1`) rather than deleting the row. Allows `redoTransaction`. Student points are reverted atomically.
- **Milestone detection**: `addTransaction` returns `{ milestone: { type, value } }` at ±10/±25/±50/±100 boundaries; frontend triggers confetti.
- **Audit logging**: login, parentLogin, addTransaction, undoTransaction, redoTransaction all write to `AuditLog`.
- **Cached spreadsheet access**: `getSS()` caches `SpreadsheetApp.openById()` once per execution.

### Setup checklist
1. Create Google Sheet with the 6 sheets above.
2. Replace `SPREADSHEET_ID` in `Code.gs`.
3. Deploy as Web App → Execute as "Me", access "Anyone".
4. Paste deployment URL into `config.js` as `API_URL`.

## Frontend ↔ Backend conventions

- All requests: `POST` with `Content-Type: text/plain;charset=utf-8` (Apps Script rejects `application/json` from browsers due to preflight). Body is `JSON.stringify({ action, ...payload })`.
- Responses: `{ status: "success" | "error", message?, ...data }`.
- **In-flight dedup**: `T.api()` deduplicates identical concurrent requests (uses Map keyed by action+payload).
- Teacher session in `localStorage` key `teacher`. `T.checkAuth()` redirects to `index.html` if missing — call at top of any gated page.
- **Dark mode**: `T.setTheme('dark' | 'light')` toggles `data-theme` on `<html>`. Persists in `localStorage.tmi-theme`. CSS variables swap in `[data-theme="dark"]`.
- House colors: JJT = `#004632`, Jensud = `#00835c`, Munir = `#2ea876`. Encoded in `style.css` (CSS vars), `shared.js` (`T.HOUSES`), and the chart datasets in `reports.js`.

## Adding a new page

1. `<link rel="stylesheet" href="style.css">`
2. `<script src="config.js"></script>` (must be before `shared.js`)
3. `<script src="shared.js"></script>` (exposes `window.TMI`)
4. `<script src="app.js"></script>` (theme toggle, online indicator, install button, SW update toast)
5. Page-specific JS that calls `T.checkAuth()` if gated.

All UI helpers (`createAvatar`, `formatDate`, `showToast`, `showModal`, etc.) live on `window.TMI`.

## Common edits

- **Add an API action**: extend the `switch (action)` block in `Code.gs`, write a handler, then call `await T.api('yourAction', payload)` from the frontend.
- **Add a violation**: insert row in `Violations` sheet — no code change. Set `category` column for category filtering in dashboard.
- **Add a violation category**: just type a new value in the `category` column — chips appear automatically.
- **Change brand color**: update `--primary` in `style.css` `:root` + dark-mode override. Update `T.HOUSES` in `shared.js`.
- **Change API endpoint**: edit only `config.js`. `debug.html` loads from `config.js` automatically.
- **Bust PWA cache**: bump `CACHE_NAME` in `sw.js` (e.g. `tmi-points-v3`) and `APP_VERSION` in `config.js`. Users get the new assets on next load and a "version updated" toast.
- **Add a new stat tile in dashboard**: edit `renderStats()` in `dashboard.js`.

## Things to know

- **No tests/lint/CI.** Validation is manual via `debug.html` (try every action) and the live UI.
- **Web NFC** only works in Chrome on Android over HTTPS or localhost. Feature-detect with `'NDEFReader' in window`.
- **Transaction ID** format: `TR<Date.now()><3-digit-rand>` — millisecond collisions are extremely unlikely.
- **Audit log** grows unbounded; add periodic cleanup if it matters.
- **`getHistory` with `month="all"`** ignores `chartData` (per-day aggregation is meaningless across months).
- **Print stylesheet** hides header/buttons in `@media print` — works for both reports and parent portal.
- **PWA install**: button appears in header automatically when `beforeinstallprompt` fires; click it to trigger native install prompt.
- **`T.confetti(x, y)`** spawns 60 pieces; use sparingly (milestone moments).