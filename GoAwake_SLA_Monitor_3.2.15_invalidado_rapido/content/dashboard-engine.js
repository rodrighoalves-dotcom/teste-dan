(function (global) {
  'use strict';

  var config = global.GoAwakeProductivityConfig;

  function classify(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return 'unknown';
    if (minutes <= config.sla.okMaxMinutes) return 'ok';
    if (minutes <= config.sla.attentionMaxMinutes) return 'attention';
    return 'critical';
  }

  function average(values) {
    return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0;
  }

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function build(records, meta) {
    var byAuthor = {}, byHour = {}, byDay = {};

    records.forEach(function (record) {
      var author = record.author || 'Autor não informado';
      if (!byAuthor[author]) {
        byAuthor[author] = {
          author: author, uniqueAudits: 0, totalEventsObserved: 0,
          authorConflictAudits: 0, ok: 0, attention: 0, critical: 0, unknown: 0, times: []
        };
      }

      var item = byAuthor[author];
      item.uniqueAudits += 1;
      item.totalEventsObserved += record.occurrences || 1;
      if (record.hasAuthorConflict) item.authorConflictAudits += 1;

      var status = classify(record.durationMinutes);
      item[status] += 1;
      if (Number.isFinite(record.durationMinutes) && record.durationMinutes >= 0) item.times.push(record.durationMinutes);

      if (record.treatedAt instanceof Date && !Number.isNaN(record.treatedAt.getTime())) {
        var hour = String(record.treatedAt.getHours()).padStart(2, '0') + ':00';
        byHour[hour] = (byHour[hour] || 0) + 1;
        var day = record.treatedAt.toLocaleDateString('pt-BR');
        byDay[day] = (byDay[day] || 0) + 1;
      }
    });

    var authors = Object.values(byAuthor).map(function (item) {
      item.averageMinutes = average(item.times);
      item.medianMinutes = median(item.times);
      item.minimumMinutes = item.times.length ? Math.min.apply(null, item.times) : 0;
      item.maximumMinutes = item.times.length ? Math.max.apply(null, item.times) : 0;
      item.validDurationAudits = item.times.length;
      item.timeCoverageRate = item.uniqueAudits
        ? (item.validDurationAudits / item.uniqueAudits) * 100
        : 0;
      item.slaComplianceRate = item.validDurationAudits
        ? (item.ok / item.validDurationAudits) * 100
        : 0;
      delete item.times;
      return item;
    }).sort(function (a, b) {
      return b.uniqueAudits - a.uniqueAudits || a.author.localeCompare(b.author, 'pt-BR');
    });

    var allTimes = records.map(function (r) { return r.durationMinutes; })
      .filter(function (v) { return Number.isFinite(v) && v >= 0; });
    var totalOk = authors.reduce(function (s, a) { return s + a.ok; }, 0);
    var normalization = meta && meta.normalization ? meta.normalization.metrics : {};
    var validation = meta && meta.validation ? meta.validation : { qualityScore: 0, status: 'critical', counts: {} };

    return {
      summary: {
        uniqueAudits: records.length,
        observedEvents: normalization.uniqueEvents || records.length,
        repeatedAuditEvents: normalization.repeatedAuditEvents || 0,
        conflictingAuthorAudits: normalization.conflictingAuthorAudits || 0,
        operators: authors.length,
        averageMinutes: average(allTimes),
        medianMinutes: median(allTimes),
        validDurationAudits: allTimes.length,
        timeCoverageRate: records.length ? (allTimes.length / records.length) * 100 : 0,
        ok: totalOk,
        attention: authors.reduce(function (s, a) { return s + a.attention; }, 0),
        critical: authors.reduce(function (s, a) { return s + a.critical; }, 0),
        unknown: authors.reduce(function (s, a) { return s + a.unknown; }, 0),
        slaComplianceRate: allTimes.length ? (totalOk / allTimes.length) * 100 : 0,
        qualityScore: validation.qualityScore,
        qualityStatus: validation.status
      },
      authors: authors,
      byHour: Object.entries(byHour).sort(),
      byDay: Object.entries(byDay),
      records: records,
      quality: validation,
      conflicts: meta && meta.normalization ? meta.normalization.conflicts : []
    };
  }

  global.GoAwakeDashboardEngine = { build: build };
})(window);
