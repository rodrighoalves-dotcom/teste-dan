(function (global) {
  'use strict';

  var utils = global.GoAwakeAuditUtils;

  function normalizedAuthor(value) {
    return utils.normalizeText(value).replace(/\s*[-–—]\s*/g, ' - ');
  }

  function timestamp(date) {
    if (!date) return 0;
    var value = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  function eventFingerprint(record) {
    return [
      utils.normalizeText(record.auditId),
      normalizedAuthor(record.author).toLowerCase(),
      timestamp(record.treatedAt),
      utils.normalizeText(record.treatment).toLowerCase(),
      utils.normalizeText(record.classification).toLowerCase()
    ].join('|');
  }

  function compareCanonical(a, b) {
    var treatedDiff = timestamp(b.treatedAt) - timestamp(a.treatedAt);
    if (treatedDiff) return treatedDiff;

    var startedDiff = timestamp(b.startedAt) - timestamp(a.startedAt);
    if (startedDiff) return startedDiff;

    return eventFingerprint(a).localeCompare(eventFingerprint(b), 'pt-BR');
  }

  function consolidate(records) {
    var exactSeen = new Set();
    var exactDuplicates = [];
    var groups = new Map();
    var valid = [];

    (records || []).forEach(function (input, index) {
      var record = Object.assign({}, input);
      record.author = normalizedAuthor(record.author);
      record.auditId = utils.normalizeText(record.auditId);
      record.source = record.source || 'audit-page';
      record.collectedAt = record.collectedAt instanceof Date ? record.collectedAt : new Date(record.collectedAt || Date.now());
      record._inputIndex = index;

      var fingerprint = eventFingerprint(record);
      record.eventFingerprint = fingerprint;

      if (exactSeen.has(fingerprint)) {
        exactDuplicates.push(record);
        return;
      }
      exactSeen.add(fingerprint);
      valid.push(record);

      if (!groups.has(record.auditId)) groups.set(record.auditId, []);
      groups.get(record.auditId).push(record);
    });

    var canonical = [];
    var conflicts = [];
    var history = {};

    groups.forEach(function (items, auditId) {
      items.sort(compareCanonical);
      var selected = items[0];
      var authors = Array.from(new Set(items.map(function (item) { return item.author; }).filter(Boolean)));

      selected.occurrences = items.length;
      selected.hasAuthorConflict = authors.length > 1;
      selected.authorsObserved = authors;
      selected.isCanonical = true;
      canonical.push(selected);
      history[auditId] = items;

      if (authors.length > 1) {
        conflicts.push({
          auditId: auditId,
          authors: authors,
          selectedAuthor: selected.author,
          selectedTreatedAt: selected.treatedAt,
          occurrences: items.length
        });
      }
    });

    canonical.sort(function (a, b) { return timestamp(a.treatedAt) - timestamp(b.treatedAt); });

    return {
      canonical: canonical,
      rawUniqueEvents: valid,
      exactDuplicates: exactDuplicates,
      conflicts: conflicts,
      history: history,
      metrics: {
        receivedRows: (records || []).length,
        uniqueEvents: valid.length,
        canonicalAudits: canonical.length,
        exactDuplicateRows: exactDuplicates.length,
        repeatedAuditEvents: Math.max(0, valid.length - canonical.length),
        conflictingAuthorAudits: conflicts.length
      }
    };
  }

  global.GoAwakeAuditNormalizer = {
    normalizedAuthor: normalizedAuthor,
    eventFingerprint: eventFingerprint,
    consolidate: consolidate
  };
})(window);
