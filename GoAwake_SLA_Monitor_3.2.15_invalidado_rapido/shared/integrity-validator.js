(function (global) {
  'use strict';

  function validate(records, normalization) {
    var issues = [];
    var missingAuditId = 0;
    var missingAuthor = 0;
    var invalidTreatedAt = 0;
    var negativeDuration = 0;
    var missingAvailableAt = 0;
    var invalidCoreRows = 0;
    var validDurationRows = 0;

    (records || []).forEach(function (record, index) {
      var hasAuditId = Boolean(record.auditId);
      var hasAuthor = Boolean(record.author);
      var hasTreatedAt = record.treatedAt instanceof Date && !Number.isNaN(record.treatedAt.getTime());
      var hasAvailableAt = record.availableAt instanceof Date && !Number.isNaN(record.availableAt.getTime());
      var hasValidDuration = Number.isFinite(record.durationMinutes) && record.durationMinutes >= 0;

      if (!hasAuditId) missingAuditId += 1;
      if (!hasAuthor) missingAuthor += 1;
      if (!hasTreatedAt) invalidTreatedAt += 1;
      if (!hasAvailableAt) missingAvailableAt += 1;
      if (Number.isFinite(record.durationMinutes) && record.durationMinutes < 0) negativeDuration += 1;
      if (hasAvailableAt && hasValidDuration) validDurationRows += 1;

      if (!hasAuditId || !hasAuthor || !hasTreatedAt) {
        invalidCoreRows += 1;
        issues.push({ type: 'invalid-row', index: index, auditId: record.auditId || '' });
      } else if (!hasAvailableAt || !hasValidDuration) {
        issues.push({ type: 'invalid-duration', index: index, auditId: record.auditId || '' });
      }
    });

    var metrics = normalization && normalization.metrics ? normalization.metrics : {};
    var total = (records || []).length;
    var denominator = Math.max(1, total);
    var canonicalDenominator = Math.max(1, metrics.canonicalAudits || total);
    var coreCompleteness = total ? 1 - (invalidCoreRows / denominator) : 0;
    var timeCompleteness = total ? validDurationRows / denominator : 0;
    var authorConsistency = total
      ? 1 - Math.min(1, (metrics.conflictingAuthorAudits || 0) / canonicalDenominator)
      : 0;
    var qualityScore =
      (coreCompleteness * 40) +
      (timeCompleteness * 40) +
      (authorConsistency * 20);

    return {
      status: qualityScore >= 95 ? 'excellent' : qualityScore >= 80 ? 'attention' : 'critical',
      qualityScore: Math.max(0, qualityScore),
      counts: {
        missingAuditId: missingAuditId,
        missingAuthor: missingAuthor,
        invalidTreatedAt: invalidTreatedAt,
        missingAvailableAt: missingAvailableAt,
        negativeDuration: negativeDuration,
        validDurationRows: validDurationRows,
        exactDuplicates: metrics.exactDuplicateRows || 0,
        authorConflicts: metrics.conflictingAuthorAudits || 0
      },
      issues: issues
    };
  }

  global.GoAwakeIntegrityValidator = { validate: validate };
})(window);
