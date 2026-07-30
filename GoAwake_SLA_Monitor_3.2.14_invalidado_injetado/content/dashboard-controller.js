(function (global) {
  'use strict';

  async function run() {
    if (global.__goAwakeDashboardRunning) {
      alert('O Dashboard Gerencial já está sendo gerado.');
      return;
    }

    global.__goAwakeDashboardRunning = true;
    try {
      var period = await global.GoAwakeDashboardView.showPeriodSelector();
      if (!period) return;

      global.GoAwakeDashboardView.createProgress();
      var collection = await global.GoAwakeDashboardCollector.collect({
        start: period.start,
        end: period.end,
        onProgress: global.GoAwakeDashboardView.updateProgress
      });

      await global.GoAwakeAuditEventStore.append(collection.rawRecords);
      var stored = await global.GoAwakeAuditEventStore.loadPeriod(period.start, period.end);
      stored = stored.filter(function (record) {
        return global.GoAwakeAuditUtils.isMobyAuthor(record.author, global.GoAwakeProductivityConfig);
      });

      var byFingerprint = new Map();
      stored.concat(collection.rawRecords).forEach(function (record) {
        var fingerprint = record.eventFingerprint ||
          global.GoAwakeAuditNormalizer.eventFingerprint(record);
        record.eventFingerprint = fingerprint;
        byFingerprint.set(fingerprint, record);
      });
      var combined = Array.from(byFingerprint.values());
      var normalized = global.GoAwakeAuditNormalizer.consolidate(combined);
      var validation = global.GoAwakeIntegrityValidator.validate(normalized.canonical, normalized);
      var treatedTimes = normalized.rawUniqueEvents
        .map(function (record) {
          return record.treatedAt instanceof Date ? record.treatedAt.getTime() : NaN;
        })
        .filter(Number.isFinite)
        .sort(function (a, b) { return a - b; });

      collection.records = normalized.canonical;
      collection.normalization = normalized;
      collection.validation = validation;
      collection.liveStoredEvents = stored.length;
      collection.localEventsInPeriod = combined.length;
      collection.coverageStart = treatedTimes.length ? new Date(treatedTimes[0]) : null;
      collection.coverageEnd = treatedTimes.length ? new Date(treatedTimes[treatedTimes.length - 1]) : null;
      collection.dataScope = 'visible-page-and-local-history';
      collection.scopeComplete = false;

      var dashboard = global.GoAwakeDashboardEngine.build(collection.records, {
        normalization: normalized,
        validation: validation
      });

      global.GoAwakeDashboardView.removeProgress();
      global.GoAwakeDashboardView.showDashboard(dashboard, period, collection);
    } catch (error) {
      console.error('[Dashboard Gerencial]', error);
      global.GoAwakeDashboardView.removeProgress();
      alert('Não foi possível gerar o Dashboard Gerencial.\n\n' + (error.message || String(error)));
    } finally {
      global.__goAwakeDashboardRunning = false;
    }
  }

  global.GoAwakeDashboardController = { run: run };
  run();
})(window);
