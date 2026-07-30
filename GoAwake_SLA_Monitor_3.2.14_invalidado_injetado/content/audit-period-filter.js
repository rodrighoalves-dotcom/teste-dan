(function (global) {
  'use strict';

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function visible(element) {
    if (!element || !element.getBoundingClientRect) return false;
    var rect = element.getBoundingClientRect();
    var style = global.getComputedStyle ? global.getComputedStyle(element) : null;
    return rect.width > 0 && rect.height > 0 &&
      (!style || (style.display !== 'none' && style.visibility !== 'hidden'));
  }

  function formatDate(timestamp, iso) {
    var date = new Date(timestamp);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return iso ? year + '-' + month + '-' + day : day + '/' + month + '/' + year;
  }

  function formatTime(timestamp) {
    var date = new Date(timestamp);
    return String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0');
  }

  // The current Audit component displays no year: "DD/MM HH:mm".
  function formatCompactDateTime(timestamp) {
    var date = new Date(timestamp);
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return day + '/' + month + ' ' + formatTime(timestamp);
  }

  function isCompactDateTimeValue(value) {
    return /^\d{2}\/\d{2}\s+\d{2}:\d{2}$/.test(String(value || '').trim());
  }

  function description(input) {
    var parent = input.closest(
      'label, .form-group, .field, .filter, [class*="date"], [class*="period"], [class*="calendar"]'
    ) || input.parentElement;
    return normalize([
      input.getAttribute('placeholder'),
      input.getAttribute('aria-label'),
      input.getAttribute('name'),
      input.getAttribute('id'),
      input.getAttribute('formcontrolname'),
      parent && parent.textContent
    ].join(' ')).slice(0, 300);
  }

  function inputDateValue(input, timestamp) {
    var type = String(input.type || '').toLowerCase();
    if (type === 'datetime-local') {
      return formatDate(timestamp, true) + 'T' + formatTime(timestamp);
    }
    if (type === 'date') return formatDate(timestamp, true);
    if (/hora|time|hh:mm|datetime/.test(description(input))) {
      return formatDate(timestamp, false) + ' ' + formatTime(timestamp);
    }
    return formatDate(timestamp, false);
  }

  function inputCarriesTime(input) {
    var type = String(input.type || '').toLowerCase();
    return type === 'datetime-local' ||
      /hora|time|hh:mm|datetime/.test(description(input));
  }

  function usablePeriodInput(input) {
    var type = String(input.type || 'text').toLowerCase();
    return !/checkbox|radio|button|submit|hidden/.test(type);
  }

  function orderedInputs(inputs) {
    return inputs.slice().sort(function (a, b) {
      var aRect = a.getBoundingClientRect();
      var bRect = b.getBoundingClientRect();
      return aRect.top - bRect.top || aRect.left - bRect.left;
    });
  }

  function periodInputs() {
    return Array.from(document.querySelectorAll([
      'input[type="date"]',
      'input[type="datetime-local"]',
      'input[placeholder*="data" i]',
      'input[placeholder*="periodo" i]',
      'input[placeholder*="dd/mm" i]',
      'input[name*="date" i]',
      'input[name*="data" i]',
      'input[name*="period" i]',
      'input[id*="date" i]',
      'input[id*="data" i]',
      'input[id*="period" i]',
      'input[formcontrolname*="date" i]',
      'input[formcontrolname*="data" i]',
      'input[formcontrolname*="period" i]'
    ].join(','))).filter(visible);
  }

  /*
   * Finds the exact control shown in Audit:
   * "Periodo" + two text inputs containing "DD/MM HH:mm" + an icon button.
   * It intentionally does not depend on Angular-generated names or classes.
   */
  function compactPeriodSelection() {
    var allInputs = Array.from(document.querySelectorAll('input'))
      .filter(visible)
      .filter(usablePeriodInput);
    // Scan every visible text-like input so the control is also found while
    // Angular is still initializing empty values and has no useful placeholder.
    var seeds = allInputs;
    var matches = [];

    seeds.forEach(function (seed) {
      var container = seed.parentElement;
      var depth = 0;
      while (container && container !== document.body && depth < 8) {
        var inputs = Array.from(container.querySelectorAll('input'))
          .filter(visible)
          .filter(usablePeriodInput);
        if (
          /period|periodo/.test(normalize(container.textContent)) &&
          inputs.length >= 2 &&
          inputs.length <= 6
        ) {
          var compactCount = inputs.filter(function (input) {
            return isCompactDateTimeValue(input.value);
          }).length;
          var rect = container.getBoundingClientRect();
          matches.push({
            container: container,
            inputs: orderedInputs(inputs),
            score: compactCount * 100 + (inputs.length === 2 ? 40 : 0) -
              Math.min((rect.width || 0) * (rect.height || 0) / 100000, 20)
          });
          break;
        }
        container = container.parentElement;
        depth += 1;
      }
    });

    var best = matches.sort(function (a, b) { return b.score - a.score; })[0];
    if (!best) return null;
    var angularDateInputs = best.inputs.filter(function (input) {
      return input.matches &&
        input.matches('input.dateInput.ui-inputtext[type="text"]');
    });
    var compactInputs = best.inputs.filter(function (input) {
      return isCompactDateTimeValue(input.value);
    });
    var selected = angularDateInputs.length >= 2
      ? angularDateInputs
      : (compactInputs.length >= 2 ? compactInputs : best.inputs);
    if (selected.length < 2) return null;
    return {
      mode: 'audit-compact-period',
      start: selected[0],
      end: selected[1],
      container: best.container
    };
  }

  function timeInputs() {
    return Array.from(document.querySelectorAll([
      'input[type="time"]',
      'input[placeholder*="hh:mm" i]',
      'input[name*="time" i]',
      'input[name*="hora" i]',
      'input[id*="time" i]',
      'input[id*="hora" i]',
      'input[formcontrolname*="time" i]',
      'input[formcontrolname*="hora" i]'
    ].join(','))).filter(visible);
  }

  async function waitPeriodSelection(timeoutMs) {
    var startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      var compact = compactPeriodSelection();
      if (compact) return compact;
      var inputs = periodInputs();
      if (inputs.length) return chooseInputs(inputs);
      await sleep(250);
    }
    return { mode: 'none' };
  }

  function findPeriodOpener() {
    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .filter(visible)
      .map(function (button) {
        var text = normalize([
          button.textContent,
          button.getAttribute('title'),
          button.getAttribute('aria-label'),
          button.getAttribute('class'),
          button.innerHTML
        ].join(' '));
        var score = 0;
        if (/period|periodo|data|date|calendario|calendar/.test(text)) score += 40;
        if (/limpar|clear|reset|cancelar/.test(text)) score -= 60;
        return { button: button, score: score };
      })
      .sort(function (a, b) { return b.score - a.score; })
      .find(function (item) { return item.score > 0; });
  }

  function inputScore(input, kind) {
    var text = description(input);
    var score = 0;
    if (/period|periodo|data|date|dd\/mm/.test(text)) score += 10;
    if (kind === 'start' && /inicio|inicial|de\b|from|start/.test(text)) score += 40;
    if (kind === 'end' && /fim|final|ate|to\b|end/.test(text)) score += 40;
    if (/tratado|tratativa|auditoria/.test(text)) score += 8;
    return score;
  }

  function chooseInputs(inputs) {
    if (!inputs.length) return { mode: 'none' };
    if (inputs.length === 1) {
      return String(inputs[0].type).toLowerCase() === 'date'
        ? { mode: 'none' }
        : { mode: 'range', range: inputs[0] };
    }

    var starts = inputs.slice().sort(function (a, b) {
      return inputScore(b, 'start') - inputScore(a, 'start');
    });
    var ends = inputs.slice().sort(function (a, b) {
      return inputScore(b, 'end') - inputScore(a, 'end');
    });
    var start = starts[0];
    var end = ends.find(function (item) { return item !== start; });
    if (!end || (inputScore(start, 'start') === 0 && inputScore(end, 'end') === 0)) {
      var ordered = orderedInputs(inputs);
      start = ordered[0];
      end = ordered[1];
    }
    return { mode: 'two-inputs', start: start, end: end };
  }

  function setInputValue(input, value) {
    if (input.focus) input.focus();
    var inputOptions = {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType: 'insertText'
    };
    if (global.InputEvent) {
      input.dispatchEvent(new global.InputEvent('beforeinput', inputOptions));
    }
    var descriptor = global.HTMLInputElement &&
      Object.getOwnPropertyDescriptor(global.HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(global.InputEvent
      ? new global.InputEvent('input', inputOptions)
      : new global.Event('input', { bubbles: true }));
    input.dispatchEvent(new global.Event('change', { bubbles: true }));
    if (global.KeyboardEvent) {
      input.dispatchEvent(new global.KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        code: 'Enter'
      }));
      input.dispatchEvent(new global.KeyboardEvent('keyup', {
        bubbles: true,
        key: 'Enter',
        code: 'Enter'
      }));
    }
    input.dispatchEvent(new global.Event('blur', { bubbles: true }));
    if (input.blur) input.blur();
    return String(input.value || '').trim() === String(value).trim();
  }

  function isPrimeNgCalendarInput(input) {
    return Boolean(
      input &&
      input.matches &&
      input.matches('input.dateInput.ui-inputtext[type="text"]')
    );
  }

  async function selectPrimeNgCalendarInput(input, value) {
    if (!isPrimeNgCalendarInput(input)) {
      return setInputValue(input, value);
    }

    // Open the PrimeNG calendar first. Its Angular ControlValueAccessor then
    // receives the new compact value through input/change and commits on blur.
    if (input.focus) input.focus();
    if (input.click) input.click();
    await sleep(100);

    // execCommand inserts text through Chromium's editing pipeline, which is
    // observed by PrimeNG more reliably than assigning input.value alone.
    if (input.select) input.select();
    if (global.document && typeof global.document.execCommand === 'function') {
      try {
        global.document.execCommand('insertText', false, value);
      } catch (error) {
        // The native setter below is the safe fallback in inactive tabs.
      }
    }
    var confirmed = setInputValue(input, value);
    await sleep(180);

    if (!confirmed || String(input.value || '').trim() !== String(value).trim()) {
      if (input.focus) input.focus();
      if (input.select) input.select();
      setInputValue(input, '');
      await sleep(60);
      confirmed = setInputValue(input, value);
      await sleep(180);
    }

    return String(input.value || '').trim() === String(value).trim();
  }

  async function fillPeriod(selection, startTime, endTime) {
    if (selection.mode === 'audit-compact-period') {
      var compactStart = formatCompactDateTime(startTime);
      var compactEnd = formatCompactDateTime(endTime);
      var startConfirmed = await selectPrimeNgCalendarInput(
        selection.start,
        compactStart
      );
      await sleep(120);
      var refreshedAfterStart = compactPeriodSelection();
      if (refreshedAfterStart) {
        selection.start = refreshedAfterStart.start;
        selection.end = refreshedAfterStart.end;
        selection.container = refreshedAfterStart.container;
      }
      var endConfirmed = await selectPrimeNgCalendarInput(
        selection.end,
        compactEnd
      );
      await sleep(120);
      var refreshedAfterEnd = compactPeriodSelection();
      if (refreshedAfterEnd) {
        selection.start = refreshedAfterEnd.start;
        selection.end = refreshedAfterEnd.end;
        selection.container = refreshedAfterEnd.container;
      }
      startConfirmed = String(selection.start.value || '').trim() === compactStart;
      endConfirmed = String(selection.end.value || '').trim() === compactEnd;
      return {
        filledInputs: 2,
        includesTime: true,
        valuesConfirmed: startConfirmed && endConfirmed,
        calendarInputsClicked: 2,
        startText: compactStart,
        endText: compactEnd
      };
    }
    if (selection.mode === 'two-inputs') {
      var startValue = inputDateValue(selection.start, startTime);
      var endValue = inputDateValue(selection.end, endTime);
      var genericStartConfirmed = setInputValue(selection.start, startValue);
      await sleep(100);
      var genericEndConfirmed = setInputValue(selection.end, endValue);
      await sleep(100);
      return {
        filledInputs: 2,
        includesTime: inputCarriesTime(selection.start) && inputCarriesTime(selection.end),
        valuesConfirmed: genericStartConfirmed && genericEndConfirmed,
        startText: startValue,
        endText: endValue
      };
    }
    if (selection.mode === 'range') {
      var range = formatDate(startTime, false) + ' ' + formatTime(startTime) +
        ' - ' + formatDate(endTime, false) + ' ' + formatTime(endTime);
      return {
        filledInputs: 1,
        includesTime: true,
        valuesConfirmed: setInputValue(selection.range, range),
        startText: range,
        endText: range
      };
    }
    return { filledInputs: 0, includesTime: false, valuesConfirmed: false };
  }

  function fillTimeInputs(inputs, startTime, endTime) {
    var selection = chooseInputs(inputs);
    if (selection.mode !== 'two-inputs') return 0;
    setInputValue(selection.start, formatTime(startTime));
    setInputValue(selection.end, formatTime(endTime));
    return 2;
  }

  function buttonDescription(button) {
    return normalize([
      button.textContent,
      button.getAttribute('title'),
      button.getAttribute('aria-label'),
      button.getAttribute('class'),
      button.innerHTML
    ].join(' ')).slice(0, 500);
  }

  function findApplyButton(selection) {
    var anchor = selection.start || selection.range;
    var exactScope = selection.container || null;
    var endRect = selection.end && selection.end.getBoundingClientRect
      ? selection.end.getBoundingClientRect()
      : null;
    var scopes = [];
    var currentScope = exactScope;
    var depth = 0;

    while (currentScope && currentScope !== document.body && depth < 6) {
      if (!scopes.includes(currentScope)) scopes.push(currentScope);
      currentScope = currentScope.parentElement;
      depth += 1;
    }
    var broadScope = anchor &&
      anchor.closest('form, nb-card, .card, .filters, [class*="filter"]');
    if (broadScope && !scopes.includes(broadScope)) scopes.push(broadScope);
    if (!scopes.includes(document)) scopes.push(document);

    var seen = [];
    var scored = [];
    scopes.forEach(function (scope, scopeIndex) {
      var candidates = Array.from(scope.querySelectorAll(
        'button, a, [role="button"]'
      )).filter(visible);
      candidates.forEach(function (button) {
        if (seen.includes(button)) return;
        seen.push(button);

        var text = buttonDescription(button);
        var score = 0;
        if (/pesquisar|buscar|consultar|filtrar|aplicar|search|filter/.test(text)) score += 60;
        if (/lupa|fa-search|search-outline|search-icon/.test(text)) score += 45;
        if (/btn-danger|button-danger|appearance-filled.*danger/.test(text)) score += 15;
        if (
          button.querySelector &&
          button.querySelector(
            'i[class*="search"], svg[class*="search"], nb-icon[icon*="search"], ' +
            'mat-icon, [class*="fa-search"], [class*="lupa"]'
          )
        ) {
          score += 45;
        }
        if (endRect && button.getBoundingClientRect) {
          var buttonRect = button.getBoundingClientRect();
          var sameRow = Math.abs(
            (buttonRect.top + buttonRect.height / 2) -
            (endRect.top + endRect.height / 2)
          ) <= Math.max(buttonRect.height, endRect.height, 30);
          if (sameRow && buttonRect.left >= endRect.right - 5) score += 55;
        }
        if (score > 0) score += Math.max(0, 12 - scopeIndex * 2);
        if (score > 0 && scope === exactScope && candidates.length === 1) score += 25;
        if (/limpar|clear|reset|cancelar/.test(text)) score -= 100;
        scored.push({ button: button, score: score });
      });
    });

    return scored.sort(function (a, b) { return b.score - a.score; })
      .find(function (item) { return item.score > 0; });
  }

  function auditResultsSnapshot() {
    return Array.from(document.querySelectorAll('table tbody'))
      .filter(visible)
      .map(function (tbody) {
        return normalize(tbody.innerText || tbody.textContent).slice(0, 5000);
      })
      .filter(Boolean)
      .join('|');
  }

  function auditIsBusy(button) {
    if (
      button &&
      (button.disabled || button.getAttribute('aria-disabled') === 'true')
    ) {
      return true;
    }
    return Array.from(document.querySelectorAll([
      '.ui-progress-spinner',
      '.p-progress-spinner',
      '.spinner-border',
      '.loading',
      '.loader',
      '.ui-blockui',
      '[aria-busy="true"]'
    ].join(','))).some(visible);
  }

  async function waitForAuditResults(beforeSnapshot, button, timeoutMs) {
    var startedAt = Date.now();
    var previous = beforeSnapshot;
    var changed = false;
    var sawBusy = false;
    var stablePolls = 0;

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(100);
      var busy = auditIsBusy(button);
      if (busy) sawBusy = true;
      var current = auditResultsSnapshot();
      if (current && current !== beforeSnapshot) changed = true;

      if (changed && current === previous && !busy) {
        stablePolls += 1;
        if (stablePolls >= 2) {
          return { observed: true, reason: 'table-changed-and-stable' };
        }
      } else {
        stablePolls = 0;
      }
      if (sawBusy && !busy && Date.now() - startedAt >= 300) {
        return { observed: true, reason: 'loading-finished' };
      }
      if (!sawBusy && !changed && Date.now() - startedAt >= 2000) {
        return { observed: false, reason: 'no-visible-change' };
      }
      previous = current;
    }
    return { observed: false, reason: 'refresh-timeout' };
  }

  async function apply(options) {
    var selection = await waitPeriodSelection(5000);
    if (selection.mode === 'none') {
      var opener = findPeriodOpener();
      if (opener) {
        opener.button.click();
        await sleep(350);
        selection = await waitPeriodSelection(15000);
      }
    }

    var periodFill = await fillPeriod(selection, options.startTime, options.endTime);
    if (!periodFill.filledInputs) {
      return {
        applied: false,
        mode: 'local-treated-at-filter-only',
        reason: 'Controles de periodo da Audit nao encontrados.',
        filledInputs: 0,
        buttonClicked: false
      };
    }

    var filledTimeInputs = periodFill.includesTime
      ? 0
      : fillTimeInputs(timeInputs(), options.startTime, options.endTime);
    var fullDateTimeApplied = periodFill.includesTime || filledTimeInputs === 2;
    var valuesConfirmed = periodFill.valuesConfirmed !== false;
    await sleep(250);

    var applyCandidate = findApplyButton(selection);
    var buttonClicked = false;
    var resultsRefresh = { observed: false, reason: 'search-not-clicked' };
    if (fullDateTimeApplied && valuesConfirmed && applyCandidate) {
      var beforeSnapshot = auditResultsSnapshot();
      if (applyCandidate.button.focus) applyCandidate.button.focus();
      applyCandidate.button.click();
      buttonClicked = true;
      resultsRefresh = await waitForAuditResults(
        beforeSnapshot,
        applyCandidate.button,
        10000
      );
    }

    return {
      applied: fullDateTimeApplied && valuesConfirmed && buttonClicked,
      mode: fullDateTimeApplied ? selection.mode : 'date-only-local-time-filter',
      reason: fullDateTimeApplied && valuesConfirmed
        ? (buttonClicked
          ? 'Datas e horarios preenchidos; consulta acionada.'
          : 'Datas e horarios preenchidos; nenhum botao de consulta identificado.')
        : 'O periodo nao foi confirmado na interface. O horario sera filtrado localmente por "Tratado em".',
      filledInputs: periodFill.filledInputs,
      filledTimeInputs: filledTimeInputs,
      valuesConfirmed: valuesConfirmed,
      calendarInputsClicked: periodFill.calendarInputsClicked || 0,
      buttonClicked: buttonClicked,
      resultsRefreshObserved: resultsRefresh.observed,
      resultsRefreshReason: resultsRefresh.reason,
      startText: periodFill.startText ||
        formatDate(options.startTime, false) + ' ' + formatTime(options.startTime),
      endText: periodFill.endText ||
        formatDate(options.endTime, false) + ' ' + formatTime(options.endTime)
    };
  }

  global.GoAwakeAuditPeriodFilter = Object.freeze({
    apply: apply,
    formatCompactDateTime: formatCompactDateTime,
    isCompactDateTimeValue: isCompactDateTimeValue,
    selectPrimeNgCalendarInput: selectPrimeNgCalendarInput
  });
})(window);
