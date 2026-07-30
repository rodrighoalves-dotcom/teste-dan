(function (global) {
  'use strict';

  var config = global.GoAwakeProductivityConfig;
  var utils = global.GoAwakeAuditUtils;

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function findAuditTable() {
    var tables = Array.from(document.querySelectorAll(config.selectors.table));
    return tables.find(function (table) {
      var headers = Array.from(table.querySelectorAll(config.selectors.headers))
        .map(function (th) { return utils.normalizeHeader(th.textContent); });
      return headers.some(function (header) { return header.includes('id da auditoria'); }) &&
        headers.some(function (header) { return header.includes('autor tratativa'); }) &&
        headers.some(function (header) { return header.includes('tratado em'); });
    }) || null;
  }

  function mapColumns(table) {
    var map = {};
    Array.from(table.querySelectorAll('thead tr:first-child th')).forEach(function (th, index) {
      var text = utils.normalizeHeader(th.textContent);
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

    ['auditId', 'treatedAt', 'author'].forEach(function (key) {
      if (!Number.isInteger(map[key])) {
        throw new Error('Coluna obrigatória não encontrada: ' + key);
      }
    });
    return map;
  }

  function getRows(table) {
    return Array.from(table.querySelectorAll(config.selectors.rows))
      .filter(function (row) { return row.querySelectorAll('td').length > 0; });
  }

  async function waitTableStable(table, timeout) {
    var start = Date.now();
    var last = '';
    var repeated = 0;

    while (Date.now() - start < timeout) {
      var current = table.innerText || '';
      if (current && current === last) {
        repeated += 1;
        if (repeated >= 3) return true;
      } else {
        repeated = 0;
        last = current;
      }
      await sleep(config.collection.pollIntervalMs);
    }
    return false;
  }

  function readCell(cells, index) {
    if (!Number.isInteger(index)) return '';
    return utils.normalizeText(cells[index] && cells[index].textContent);
  }

  function parseRow(row, map, source) {
    var cells = row.querySelectorAll('td');
    var treatedText = readCell(cells, map.treatedAt);
    var availableText = readCell(cells, map.availableAt);
    var startedText = readCell(cells, map.startedAt);
    var record = {
      auditId: readCell(cells, map.auditId),
      author: readCell(cells, map.author),
      plate: readCell(cells, map.plate),
      driver: readCell(cells, map.driver),
      treatment: readCell(cells, map.treatment),
      classification: readCell(cells, map.classification),
      originalAlert: readCell(cells, map.originalAlert),
      treatedAtText: treatedText,
      treatedAt: utils.parseBrazilianDate(treatedText),
      availableAtText: availableText,
      availableAt: utils.parseBrazilianDate(availableText),
      startedAtText: startedText,
      startedAt: utils.parseBrazilianDate(startedText),
      source: source || 'audit-visible-page',
      collectedAt: new Date()
    };

    record.durationMinutes = utils.calculateMinutes(record.availableAt, record.treatedAt);
    if (record.availableAt && record.treatedAt && record.treatedAt < record.availableAt) {
      record.durationMinutes = -1;
    }
    return record;
  }

  function readPaginationState() {
    var currentLabel = document.querySelector('.ui-paginator-current, .p-paginator-current');
    var activePage = document.querySelector(
      '.ui-paginator-page.ui-state-active, .p-paginator-page.p-highlight, [aria-current="page"]'
    );
    var next = document.querySelector(
      'a.ui-paginator-next, button.p-paginator-next, .p-paginator-next'
    );
    var nextDisabled = !next ||
      next.hasAttribute('disabled') ||
      next.getAttribute('aria-disabled') === 'true' ||
      String(next.className || '').includes('ui-state-disabled') ||
      String(next.className || '').includes('p-disabled');

    return {
      label: utils.normalizeText(currentLabel && currentLabel.textContent),
      currentPage: Number(utils.normalizeText(activePage && activePage.textContent)) || 1,
      hasNextPage: Boolean(next && !nextDisabled)
    };
  }

  function emptyDiagnostics(examinedRows) {
    return {
      examinedRows: examinedRows || 0,
      acceptedRows: 0,
      missingAuditId: 0,
      missingAuthor: 0,
      invalidTreatedAt: 0,
      missingAvailableAt: 0,
      negativeDuration: 0,
      filteredNonMoby: 0,
      outsidePeriod: 0
    };
  }

  function collectVisiblePage(options) {
    options = options || {};
    var table = findAuditTable();
    if (!table) {
      return {
        records: [],
        examinedRows: 0,
        diagnostics: emptyDiagnostics(0),
        pagination: readPaginationState()
      };
    }

    var map = mapColumns(table);
    var rows = getRows(table);
    var diagnostics = emptyDiagnostics(rows.length);
    var records = [];

    rows.forEach(function (row) {
      var record = parseRow(row, map, options.source || 'audit-visible-page');

      if (!record.auditId) diagnostics.missingAuditId += 1;
      if (!record.author) diagnostics.missingAuthor += 1;
      if (!(record.treatedAt instanceof Date) || Number.isNaN(record.treatedAt.getTime())) {
        diagnostics.invalidTreatedAt += 1;
      }
      if (!(record.availableAt instanceof Date) || Number.isNaN(record.availableAt.getTime())) {
        diagnostics.missingAvailableAt += 1;
      }
      if (Number.isFinite(record.durationMinutes) && record.durationMinutes < 0) {
        diagnostics.negativeDuration += 1;
      }

      if (!record.auditId || !record.author || !record.treatedAt) return;

      if (options.mobyOnly && !utils.isMobyAuthor(record.author, config)) {
        diagnostics.filteredNonMoby += 1;
        return;
      }
      if (options.start && options.end && !utils.withinPeriod(record.treatedAt, options.start, options.end)) {
        diagnostics.outsidePeriod += 1;
        return;
      }

      record.eventFingerprint = global.GoAwakeAuditNormalizer.eventFingerprint(record);
      diagnostics.acceptedRows += 1;
      records.push(record);
    });

    return {
      records: records,
      examinedRows: rows.length,
      diagnostics: diagnostics,
      pagination: readPaginationState()
    };
  }

  async function collect(options) {
    options = options || {};
    var table = findAuditTable();
    if (!table) throw new Error('Tabela de auditoria não encontrada.');

    await waitTableStable(table, config.collection.tableStableTimeoutMs);

    var visible = collectVisiblePage({
      source: 'dashboard-visible-page',
      start: options.start,
      end: options.end,
      mobyOnly: true
    });
    var normalization = global.GoAwakeAuditNormalizer.consolidate(visible.records);
    var validation = global.GoAwakeIntegrityValidator.validate(
      normalization.canonical,
      normalization
    );

    if (typeof options.onProgress === 'function') {
      options.onProgress({
        page: visible.pagination.currentPage,
        pageLabel: visible.pagination.label,
        hasNextPage: visible.pagination.hasNextPage,
        examined: visible.examinedRows,
        unique: normalization.metrics.canonicalAudits,
        duplicateRows: normalization.metrics.exactDuplicateRows,
        repeatedEvents: normalization.metrics.repeatedAuditEvents,
        conflicts: normalization.metrics.conflictingAuthorAudits,
        authors: new Set(normalization.canonical.map(function (record) {
          return record.author;
        })).size
      });
    }

    return {
      records: normalization.canonical,
      rawRecords: normalization.rawUniqueEvents,
      normalization: normalization,
      validation: validation,
      diagnostics: visible.diagnostics,
      pagination: visible.pagination,
      examinedRows: visible.examinedRows,
      uniqueAudits: normalization.metrics.canonicalAudits,
      duplicateRows: normalization.metrics.exactDuplicateRows,
      pagesRead: table ? 1 : 0,
      collectionMode: 'visible-page-and-local-history'
    };
  }

  global.GoAwakeDashboardCollector = {
    collect: collect,
    collectVisiblePage: collectVisiblePage,
    findAuditTable: findAuditTable,
    mapColumns: mapColumns,
    readPaginationState: readPaginationState
  };
})(window);
