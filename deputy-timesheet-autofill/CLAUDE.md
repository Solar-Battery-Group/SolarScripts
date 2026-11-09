# Deputy Timesheet Autofill

## Deputy page

- Use `unsafeWindow.jQuery`.
- Form ids: `#timesheet-opunit`, `#timesheet-date` (jQuery UI datepicker, format `D dd/mm/y`, `maxDate` today), `#timesheet-start`, `#timesheet-end`, `#timesheet-comment`. Submit is `button.btnSubmit`.
- Submitted timesheet forms stay in the DOM, so these ids repeat. Scope lookups to the form `Add new` just opened.
- "Add Break" link adds a row with `select.js-break-type` (`M` / `R`) and `select.js-break-length` (minutes).
- `GET /api/v1/me` returns `EmployeeId`.
- `GET /api/management/v2/timesheets?start=<iso+offset>&end=<iso+offset>&employeeId=N` returns `{ data: [{ start, isLeave, isDiscarded }] }`, with `start` in UTC. Approved leave is included with `isLeave: true`.
