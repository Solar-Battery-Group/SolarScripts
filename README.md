# SolarScripts

Tampermonkey scripts for the team.

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension.
2. Open a script's `.user.js` file in its raw view and click **Install**.

## Scripts

### Deputy Timesheet Autofill

[Install](https://raw.githubusercontent.com/Solar-Battery-Group/SolarScripts/main/deputy-timesheet-autofill.user.js) — fills missing weekday timesheets in Deputy.

1. In Deputy, open your profile sidebar (**Me** → your name).
2. Click **Auto-fill** next to **Add new** under **Recent time sheets**.
3. Set your start and end time (saved for next time) and the date range.
4. Days that already have a timesheet or leave are greyed out and skipped. Click **Fill** to submit the rest one by one.

Every day gets a 30 min meal break and the comment "n/a". Future dates are ignored.
