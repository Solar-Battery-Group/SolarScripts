# SolarScripts

Tampermonkey userscripts, one `.user.js` file each, no build step. Check syntax with `node --check <file>`.

- Bump `@version` on every change to a script; `@updateURL` / `@downloadURL` point at the raw file on `main`.
- Push over SSH: `git@github.com:Solar-Battery-Group/SolarScripts.git`.

## Deputy Timesheet Autofill

Submit step (`.btnSubmit` → save confirmed via the timesheets API → form closed) is unverified; test it on one real day first.

## Deputy page

- Use `unsafeWindow.jQuery`.
- Form ids: `#timesheet-opunit`, `#timesheet-date` (jQuery UI datepicker, format `D dd/mm/y`, `maxDate` today), `#timesheet-start`, `#timesheet-end`, `#timesheet-comment`. Submit is `button.btnSubmit`.
- "Add Break" link adds a row with `select.js-break-type` (`M` / `R`) and `select.js-break-length` (minutes).
- `GET /api/v1/me` returns `EmployeeId`.
- `GET /api/management/v2/timesheets?start=<iso+offset>&end=<iso+offset>&employeeId=N` returns `{ data: [{ start, isLeave, isDiscarded }] }`, with `start` in UTC. Approved leave is included with `isLeave: true`.
