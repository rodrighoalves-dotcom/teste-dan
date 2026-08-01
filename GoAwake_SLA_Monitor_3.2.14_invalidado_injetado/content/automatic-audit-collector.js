(function (global) {
  'use strict';

  var config = global.GoAwakeProductivityConfig;
  var utils = global.GoAwakeAuditUtils;
  var activeCollectionState = null;
  var activeCollectionOptions = null;
  var activePagesRead = 0;

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function findTable() {
    return Array.from(document.querySelectorAll(config.selectors.table)).find(function (table) {
      var headers = Array.from(table.querySelectorAll(config.selectors.headers))
        .map(function (header) { return utils.normalizeHeader(header.textContent); });
      return headers.some(function (header) { return header.includes('id da auditoria'); }) &&
        headers.some(function (header) { return header.includes('autor tratativa'); }) &&
        headers.some(function (header) { return header.includes('tratado em'); });
    }) || null;
  }

  async function waitForTable() {
    var startedAt = Date.now();
    while (Date.now() - startedAt < config.collection.hiddenAuditTableTimeoutMs) {
      var table = findTable();
      if (table) return table;
      await sleep(config.collection.pollIntervalMs);
    }
    throw new Error('Tabela Audit não encontrada na guia dedicada.');
  }

  function mapColumns(table) {
    var map = {};
    Array.from(table.querySelectorAll('thead tr:first-child th')).forEach(function (header, index) {
      var text = utils.normalizeHeader(header.textContent);
      if (text.includes('id da auditoria')) map.auditId = index;
      else if (text.includes('placa') || text.includes('prefixo')) map.plate = index;
      else if (text.includes('motorista')) map.driver = index;
      else if (text.includes('disponivel em')) map.availableAt = index;
      else if (text.includes('tratativa iniciada')) map.startedAt = index;
      else if (text.includes('tratado em')) map.treatedAt = index;
      else if (text.includes('autor tratativa')) map.author = index;
      else if (text === 'tratativa') map.treatment = index;
      else if (text.includes('classificacao')) map.classification = index;
      else if (text.includes('alerta original')) map.originalAlert = index;
    });
    if (!Number.isInteger(map.auditId) || !Number.isInteger(map.author) ||
        !Number.isInteger(map.treatedAt)) {
      throw new Error('Colunas ID, Autor da tratativa ou Tratado em não encontradas.');
    }
    return map;
  }

  function rows(table) {
    return Array.from(table.querySelectorAll(config.selectors.rows))
      .filter(function (row) { return row.querySelectorAll('td').length > 0; });
  }

  function textAt(cells, index) {
    if (!Number.isInteger(index)) return '';
    return utils.normalizeText(cells[index] && cells[index].textContent);
  }

  function signature(table, map) {
    return rows(table).map(function (row) {
      var cells = row.querySelectorAll('td');
      return textAt(cells, map.auditId) + '@' + textAt(cells, map.treatedAt);
    }).filter(Boolean).join('|');
  }

  async function waitStable(table) {
    var startedAt = Date.now();
    var previous = '';
    var repetitions = 0;
    var requiredRepetitions = Math.max(1, Number(config.collection.stablePolls) || 2);
    while (Date.now() - startedAt < config.collection.tableStableTimeoutMs) {
      var current = table.innerText || '';
      if (current && current === previous) {
        repetitions += 1;
        if (repetitions >= requiredRepetitions) return;
      } else {
        repetitions = 0;
        previous = current;
      }
      await sleep(config.collection.pollIntervalMs);
    }
  }

  async function waitPageChange(table, map, previousSignature) {
    var startedAt = Date.now();
    while (Date.now() - startedAt < config.collection.hiddenAuditPageChangeTimeoutMs) {
      await sleep(config.collection.pollIntervalMs);
      var currentTable = findTable() || table;
      var currentMap = mapColumns(currentTable);
      var currentSignature = signature(currentTable, currentMap);
      if (currentSignature && currentSignature !== previousSignature) {
        await waitStable(currentTable);
        return true;
      }
    }
    return false;
  }

  function enabled(button) {
    if (!button) return false;
    return !button.hasAttribute('disabled') &&
      button.getAttribute('aria-disabled') !== 'true' &&
      !String(button.className || '').includes('ui-state-disabled') &&
      !String(button.className || '').includes('p-disabled');
  }

  async function goFirst(table, map) {
    var first = document.querySelector(config.selectors.firstPage);
    if (!enabled(first)) return;
    var before = signature(table, map);
    first.click();
    await waitPageChange(table, map, before);
  }

  function parseRecord(row, map) {
    var cells = row.querySelectorAll('td');
    var treatedAtText = textAt(cells, map.treatedAt);
    var availableAtText = textAt(cells, map.availableAt);
    var startedAtText = textAt(cells, map.startedAt);
    var treatedAtDate = utils.parseBrazilianDate(treatedAtText);
    var availableAtDate = utils.parseBrazilianDate(availableAtText);
    var startedAtDate = utils.parseBrazilianDate(startedAtText);
    var durationMinutes = utils.calculateMinutes(availableAtDate, treatedAtDate);

    return {
      auditId: textAt(cells, map.auditId),
      author: textAt(cells, map.author),
      plate: textAt(cells, map.plate),
      driver: textAt(cells, map.driver),
      treatment: textAt(cells, map.treatment),
      classification: textAt(cells, map.classification),
      originalAlert: textAt(cells, map.originalAlert),
      treatedAtText: treatedAtText,
      treatedAt: treatedAtDate instanceof Date && !Number.isNaN(treatedAtDate.getTime())
        ? treatedAtDate.getTime() : null,
      availableAtText: availableAtText,
      availableAt: availableAtDate instanceof Date && !Number.isNaN(availableAtDate.getTime())
        ? availableAtDate.getTime() : null,
      startedAtText: startedAtText,
      startedAt: startedAtDate instanceof Date && !Number.isNaN(startedAtDate.getTime())
        ? startedAtDate.getTime() : null,
      durationMinutes: Number.isFinite(durationMinutes) && durationMinutes >= 0
        ? durationMinutes : null,
      collectedAt: Date.now(),
      source: 'dedicated-hidden-audit-tab'
    };
  }

  function eventFingerprint(record) {
    return [
      record.auditId,
      record.author,
      record.treatedAt,
      record.treatment,
      record.classification
    ].join('|');
  }

  function readPage(table, map, options, state) {
    rows(table).forEach(function (row) {
      state.examinedRows += 1;
      var record = parseRecord(row, map);
      if (!record.auditId || !record.author || !Number.isFinite(record.treatedAt)) return;
      if (config.authorFilter.enabled && !utils.isMobyAuthor(record.author, config)) return;
      if (record.treatedAt < options.startTime || record.treatedAt > options.endTime) return;

      var fingerprint = eventFingerprint(record);
      if (state.eventFingerprints.has(fingerprint)) {
        state.duplicateRows += 1;
        return;
      }
      state.eventFingerprints.add(fingerprint);
      state.acceptedEvents += 1;

      if (!state.idMeta.has(record.auditId)) {
        state.idMeta.set(record.auditId, { occurrences: 0, authors: new Set() });
      }
      var meta = state.idMeta.get(record.auditId);
      meta.occurrences += 1;
      meta.authors.add(record.author);

      var existing = state.byAuditId.get(record.auditId);
      if (!existing || record.treatedAt >= existing.treatedAt) {
        state.byAuditId.set(record.auditId, record);
      }
    });
  }

  function reportDashboardProgress(options, state, pagesRead) {
    if (options.includeRecords !== true ||
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    try {
      var pending = chrome.runtime.sendMessage({
        type: 'slaHiddenDashboardProgress',
        progress: {
          pagesRead: pagesRead,
          examinedRows: state.examinedRows,
          acceptedEvents: state.acceptedEvents,
          uniqueAudits: state.byAuditId.size
        }
      });
      if (pending && typeof pending.catch === 'function') {
        pending.catch(function () {
          // A coleta continua mesmo se a página Fadiga tiver sido fechada.
        });
      }
    } catch (error) {
      // O progresso é informativo e não pode interromper a coleta.
    }
  }

  function buildResult(options, state, pagesRead, pageLimitReached, completionReason) {
    var canonical = Array.from(state.byAuditId.values()).map(function (record) {
      var meta = state.idMeta.get(record.auditId);
      record.occurrences = meta ? meta.occurrences : 1;
      record.authorsObserved = meta ? Array.from(meta.authors).sort() : [record.author];
      record.hasAuthorConflict = record.authorsObserved.length > 1;
      return record;
    }).sort(function (a, b) { return a.treatedAt - b.treatedAt; });

    var byAuthor = new Map();
    canonical.forEach(function (record) {
      byAuthor.set(record.author, (byAuthor.get(record.author) || 0) + 1);
    });
    var authors = Array.from(byAuthor.entries()).map(function (entry) {
      return { author: entry[0], count: entry[1] };
    }).sort(function (a, b) {
      return b.count - a.count || a.author.localeCompare(b.author, 'pt-BR');
    });

    var treatedTimes = canonical.map(function (record) { return record.treatedAt; })
      .filter(Number.isFinite);
    var authorConflicts = canonical.filter(function (record) {
      return record.hasAuthorConflict;
    }).length;

    var result = {
      authors: authors,
      totalUniqueAudits: canonical.length,
      acceptedEvents: state.acceptedEvents,
      repeatedEvents: Math.max(0, state.acceptedEvents - canonical.length),
      duplicateRows: state.duplicateRows,
      pagesRead: pagesRead,
      examinedRows: state.examinedRows,
      authorConflicts: authorConflicts,
      periodStart: options.startTime,
      periodEnd: options.endTime,
      coverageStart: treatedTimes.length ? Math.min.apply(null, treatedTimes) : null,
      coverageEnd: treatedTimes.length ? Math.max.apply(null, treatedTimes) : null,
      pageLimitReached: pageLimitReached === true,
      completionReason: completionReason || 'completed',
      updatedAt: Date.now(),
      source: 'dedicated-hidden-audit-tab'
    };
    if (options.includeRecords === true) result.records = canonical;
    return result;
  }

  function getPartialResult(reason) {
    if (!activeCollectionState || !activeCollectionOptions || activePagesRead < 1) {
      return null;
    }
    var result = buildResult(
      activeCollectionOptions,
      activeCollectionState,
      activePagesRead,
      false,
      reason || 'recovered-after-inactivity'
    );
    result.partialCompletion = true;
    return result;
  }

  async function collect(options) {
    global.__goAwakeDedicatedAuditCollector = true;
    var table = await waitForTable();
    var map = mapColumns(table);
    await waitStable(table);
    await goFirst(table, map);

    var state = {
      byAuditId: new Map(),
      idMeta: new Map(),
      eventFingerprints: new Set(),
      examinedRows: 0,
      acceptedEvents: 0,
      duplicateRows: 0
    };
    activeCollectionState = state;
    activeCollectionOptions = options;
    activePagesRead = 0;
    var pagesRead = 0;
    var seenSignatures = new Set();
    var pageLimitReached = false;
    var maxPages = options.includeRecords === true
      ? config.collection.hiddenDashboardMaxPages
      : config.collection.hiddenAuditMaxPages;

    while (pagesRead < maxPages) {
      table = findTable() || table;
      map = mapColumns(table);

      var currentSignature = signature(table, map);
      if (!currentSignature || seenSignatures.has(currentSignature)) break;
      seenSignatures.add(currentSignature);
      pagesRead += 1;
      activePagesRead = pagesRead;
      readPage(table, map, options, state);
      reportDashboardProgress(options, state, pagesRead);

      var next = document.querySelector(config.selectors.nextPage);
      if (!enabled(next)) break;
      if (pagesRead >= maxPages) {
        pageLimitReached = true;
        break;
      }
      next.click();
      if (!(await waitPageChange(table, map, currentSignature))) break;
    }

    return buildResult(
      options,
      state,
      pagesRead,
      pageLimitReached,
      pageLimitReached ? 'page-limit-reached' : 'completed'
    );
  }

  global.GoAwakeAutomaticAuditCollector = Object.freeze({
    collect: collect,
    getPartialResult: getPartialResult
  });
})(window);
