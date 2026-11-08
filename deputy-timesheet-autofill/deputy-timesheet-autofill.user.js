// ==UserScript==
// @name         SolarScripts – Deputy Timesheet Autofill
// @namespace    solarscripts
// @version      0.2.0
// @description  Fill missing weekday timesheets from the Deputy profile sidebar
// @match        https://*.deputy.com/*
// @updateURL    https://raw.githubusercontent.com/Solar-Battery-Group/SolarScripts/main/deputy-timesheet-autofill/deputy-timesheet-autofill.user.js
// @downloadURL  https://raw.githubusercontent.com/Solar-Battery-Group/SolarScripts/main/deputy-timesheet-autofill/deputy-timesheet-autofill.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

(() => {
  const DEFAULT_SETTINGS = { start: '08:45', end: '17:00' };
  const BREAK_MINUTES = '30';
  const COMMENT = 'n/a';
  const PANEL_ATTR = 'data-timesheet-autofill';

  let employeeId;
  let isFilling = false;

  const getSettings = () => {
    const savedSettings = GM_getValue('settings', {});
    return {
      start: savedSettings.start || DEFAULT_SETTINGS.start,
      end: savedSettings.end || DEFAULT_SETTINGS.end,
    };
  };

  const saveSetting = (name, value) => {
    if (value) GM_setValue('settings', { ...getSettings(), [name]: value });
  };

  const waitFor = async (getValue, label, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await getValue();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };

  const pad = (value) => String(value).padStart(2, '0');

  const formatDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const formatIsoWithOffset = (date, time) => {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    return `${formatDateKey(date)}T${time}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  };

  const formatTime12h = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    return `${pad(hours % 12 || 12)}:${pad(minutes)} ${hours < 12 ? 'AM' : 'PM'}`;
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  };

  const getEmployeeId = async () => {
    employeeId ??= (await fetchJson('/api/v1/me')).EmployeeId;
    return employeeId;
  };

  const fetchTimesheetKindsByDate = async (from, to) => {
    const params = new URLSearchParams({
      start: formatIsoWithOffset(from, '00:00:00'),
      end: formatIsoWithOffset(to, '23:59:59'),
      employeeId: await getEmployeeId(),
    });
    const { data } = await fetchJson(`/api/management/v2/timesheets?${params}`);

    return new Map(
      data
        .filter((timesheet) => !timesheet.isDiscarded)
        .map((timesheet) => [formatDateKey(new Date(timesheet.start)), timesheet.isLeave ? 'leave' : 'timesheet']),
    );
  };

  const getWeekdays = (from, to) => {
    const today = new Date();
    const days = [];
    for (const day = new Date(from); day <= to && day <= today; day.setDate(day.getDate() + 1)) {
      if (day.getDay() !== 0 && day.getDay() !== 6) days.push(new Date(day));
    }
    return days;
  };

  const getSectionHeading = (element) => {
    let node = element.parentElement;
    while (node && !node.querySelector('h1, h2, h3, h4, h5')) node = node.parentElement;
    return node?.querySelector('h1, h2, h3, h4, h5')?.textContent.trim();
  };

  const findAddTimesheetButton = () =>
    [...document.querySelectorAll('a.btnCreate')].find((link) => getSectionHeading(link) === 'Recent time sheets');

  const findVisible = (selector) => {
    const element = document.querySelector(selector);
    return element?.offsetParent ? element : null;
  };

  const findByText = (container, selector, text) =>
    [...container.querySelectorAll(selector)].find((element) => element.textContent.trim() === text);

  const closeOpenForm = () => {
    const form = findVisible('#timesheet-date')?.closest('.card');
    if (form) findByText(form, 'button, a', 'Cancel')?.click();
  };

  const fillDay = async (date, settings) => {
    const $ = unsafeWindow.jQuery;
    const key = formatDateKey(date);

    (await waitFor(findAddTimesheetButton, 'the Add new button')).click();
    const dateInput = await waitFor(() => findVisible('#timesheet-date'), 'the timesheet form');
    const form = dateInput.closest('.card');

    try {
      $(dateInput).datepicker('setDate', date).trigger('change');
      if (formatDateKey($(dateInput).datepicker('getDate')) !== key) throw new Error(`Deputy refused the date ${key}`);

      $('#timesheet-start').val(formatTime12h(settings.start)).trigger('change').trigger('blur');
      $('#timesheet-end').val(formatTime12h(settings.end)).trigger('change').trigger('blur');

      (await waitFor(() => findByText(form, 'a', 'Add Break'), 'the Add Break button')).click();
      const breakLength = await waitFor(() => form.querySelector('.js-break-length'), 'the break row');
      $(breakLength).val(BREAK_MINUTES).trigger('change');

      $('#timesheet-comment').val(COMMENT).trigger('input').trigger('change');
      form.querySelector('.btnSubmit').click();

      await waitFor(
        async () => (await fetchTimesheetKindsByDate(date, date)).has(key),
        `the ${key} timesheet to save`,
        20000,
      );
    } finally {
      closeOpenForm();
    }
  };

  const createPanel = () => {
    const $ = unsafeWindow.jQuery;
    const settings = getSettings();
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const panel = document.createElement('div');
    panel.setAttribute(PANEL_ATTR, '');
    panel.hidden = true;
    panel.style.cssText = 'margin: 8px 0; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;';
    panel.innerHTML = `
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center;">
        <label>Start time</label><input type="time" data-field="start" class="form-control" value="${settings.start}">
        <label>End time</label><input type="time" data-field="end" class="form-control" value="${settings.end}">
        <label>From</label><input type="text" data-field="from" class="form-control" readonly>
        <label>To</label><input type="text" data-field="to" class="form-control" readonly>
      </div>
      <p style="margin: 8px 0 0; color: #777;">Weekdays only, ${BREAK_MINUTES} min meal break, comment "${COMMENT}".</p>
      <ul data-field="days" style="margin: 8px 0; padding-left: 18px;"></ul>
      <button type="button" data-field="fill" class="btn btn-primary btn-sm" disabled>Fill</button>
      <span data-field="status" style="margin-left: 8px;"></span>
    `;

    const getField = (name) => panel.querySelector(`[data-field="${name}"]`);
    const setStatus = (text) => {
      getField('status').textContent = text;
    };
    let missingDays = [];

    const refreshDays = async () => {
      getField('fill').disabled = true;
      const from = $(getField('from')).datepicker('getDate');
      const to = $(getField('to')).datepicker('getDate');

      setStatus('Checking existing timesheets…');
      const timesheetKindsByDate = await fetchTimesheetKindsByDate(from, to);
      const days = getWeekdays(from, to);
      missingDays = days.filter((day) => !timesheetKindsByDate.has(formatDateKey(day)));

      getField('days').innerHTML = days
        .map((day) => {
          const kind = timesheetKindsByDate.get(formatDateKey(day));
          const label = day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
          return `<li style="color: ${kind ? '#999' : 'inherit'}">${label}${kind ? ` (${kind})` : ''}</li>`;
        })
        .join('');
      getField('fill').textContent = `Fill ${missingDays.length} day${missingDays.length === 1 ? '' : 's'}`;
      getField('fill').disabled = isFilling || missingDays.length === 0;
      setStatus('');
    };

    const refreshDaysSafely = () => refreshDays().catch((error) => setStatus(`⚠ ${error.message}`));

    getField('start').addEventListener('change', () => saveSetting('start', getField('start').value));
    getField('end').addEventListener('change', () => saveSetting('end', getField('end').value));

    const fromInput = $(getField('from'));
    const toInput = $(getField('to'));
    const handleDateSelect = () => {
      fromInput.datepicker('option', 'maxDate', toInput.datepicker('getDate'));
      toInput.datepicker('option', 'minDate', fromInput.datepicker('getDate'));
      refreshDaysSafely();
    };

    fromInput.datepicker({ dateFormat: 'D dd/mm/y', maxDate: today, onSelect: handleDateSelect }).datepicker('setDate', monday);
    toInput.datepicker({ dateFormat: 'D dd/mm/y', minDate: monday, maxDate: today, onSelect: handleDateSelect }).datepicker('setDate', today);

    getField('fill').addEventListener('click', async () => {
      if (isFilling) return;

      isFilling = true;
      getField('fill').disabled = true;
      try {
        for (const [index, day] of missingDays.entries()) {
          setStatus(`Saving ${formatDateKey(day)} (${index + 1}/${missingDays.length})…`);
          await fillDay(day, getSettings());
        }
        setStatus('✓ Done');
      } catch (error) {
        setStatus(`⚠ ${error.message}`);
      } finally {
        isFilling = false;
      }
      await refreshDaysSafely();
    });

    return { panel, refreshDaysSafely };
  };

  const injectButton = () => {
    if (document.querySelector(`[${PANEL_ATTR}]`)) return;

    const addButton = findAddTimesheetButton();
    if (!addButton || !unsafeWindow.jQuery?.fn.datepicker) return;

    const { panel, refreshDaysSafely } = createPanel();
    const toggle = document.createElement('a');
    toggle.className = 'btn btn-default btn-sm u-pullRight margin-none';
    toggle.style.marginRight = '6px';
    toggle.textContent = 'Auto-fill';
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) refreshDaysSafely();
    });

    addButton.after(toggle);
    addButton.parentElement.after(panel);
  };

  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: true });
})();
