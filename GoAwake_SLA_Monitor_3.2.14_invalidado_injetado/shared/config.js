'use strict';

// Regra operacional permanente:
// Vale e Argenta = 5 min; Geral, Libéria e demais = 10 min.
var SLA_VALE_ARGENTA_POLICY = Object.freeze({ attention: 3, critical: 5 });
var SLA_GENERAL_POLICY = Object.freeze({ attention: 8, critical: 10 });

var SLA_CONFIG = Object.freeze({
  version: '3.2.10',
  urls: Object.freeze({
    base: 'https://www.goawakecloud.com.br/',
    fatigue: 'https://www.goawakecloud.com.br/#/pages/f/fatigue',
    audit: 'https://www.goawakecloud.com.br/#/pages/f/audit'
  }),
  monitor: Object.freeze({
    intervalSeconds: 3,
    automaticReportMinutes: 60,
    automaticAuthorPopupMinutes: 10
  }),
  sla: Object.freeze({
    operational: Object.freeze({
      valeArgenta: SLA_VALE_ARGENTA_POLICY,
      general: SLA_GENERAL_POLICY
    }),
    vale: SLA_VALE_ARGENTA_POLICY,
    argenta: SLA_VALE_ARGENTA_POLICY,
    liberia: SLA_GENERAL_POLICY,
    default: SLA_GENERAL_POLICY,
    others: SLA_GENERAL_POLICY,
    summary: Object.freeze({
      formula: 'current-time-minus-earliest-available',
      scope: 'visible-page-only',
      rounding: 'floor-completed-minutes'
    })
  }),
  storageKeys: Object.freeze({
    automaticReport: 'relatorioAutomatico',
    generateReport: 'gerarRelatorio',
    generateSummary: 'gerarResumoAgora'
  })
});
