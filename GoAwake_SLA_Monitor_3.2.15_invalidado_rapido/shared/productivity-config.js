(function (global) {
  'use strict';

  global.GoAwakeProductivityConfig = Object.freeze({
    version: '2.2.0',
    authorFilter: { enabled: true, contains: 'Moby', caseSensitive: false },
    deduplication: {
      primaryKey: 'auditId',
      canonicalRule: 'latestTreatedAt',
      exactEventFields: ['auditId', 'author', 'treatedAt', 'treatment', 'classification']
    },
    period: {
      field: 'treatedAt',
      inclusiveStart: true,
      inclusiveEnd: true,
      reference: 'current-day',
      end: 'current-time',
      presetDays: [1, 7, 15, 30, 90]
    },
    liveCollection: { enabled: true, storageKey: 'goawake_audit_events_v1', maxEvents: 20000 },
    collection: {
      mode: 'visible-page-and-local-history',
      tableStableTimeoutMs: 1800,
      pollIntervalMs: 100,
      stablePolls: 2,
      hiddenAuditMaxPages: 200,
      hiddenDashboardMaxPages: 1000,
      hiddenAuditTableTimeoutMs: 30000,
      hiddenAuditPageChangeTimeoutMs: 12000,
      automaticAuthorPopupMinutes: 10
    },
    sla: { okMaxMinutes: 2, attentionMaxMinutes: 5 },
    selectors: {
      table: 'table',
      rows: 'tbody tr',
      headers: 'thead th',
      firstPage: [
        'a.ui-paginator-first:not(.ui-state-disabled)',
        'button.p-paginator-first:not(.p-disabled)',
        '.p-paginator-first:not(.p-disabled)'
      ].join(','),
      nextPage: [
        'a.ui-paginator-next:not(.ui-state-disabled)',
        'button.p-paginator-next:not(.p-disabled)',
        '.p-paginator-next:not(.p-disabled)'
      ].join(',')
    }
  });
})(window);
