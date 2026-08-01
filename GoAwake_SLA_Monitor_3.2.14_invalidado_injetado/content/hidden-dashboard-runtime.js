(function (global) {
  'use strict';

  var RUNTIME_BUILD = '3.2.14-R2-PDF-MODEL';
  if (global.__goAwakeHiddenDashboardMessageListenerV2 &&
      chrome.runtime.onMessage.removeListener) {
    chrome.runtime.onMessage.removeListener(
      global.__goAwakeHiddenDashboardMessageListenerV2
    );
  }
  global.__goAwakeHiddenDashboardRuntimeInstalled = RUNTIME_BUILD;
  global.__goAwakeHiddenDashboardRunning =
    global.__goAwakeHiddenDashboardRunning === true;

  function rehydrateRecord(record) {
    var copy = Object.assign({}, record);
    ['treatedAt', 'availableAt', 'startedAt', 'collectedAt'].forEach(function (field) {
      copy[field] = Number.isFinite(copy[field]) ? new Date(copy[field]) : null;
    });
    return copy;
  }

  function progressText(text) {
    var target = document.getElementById('goawake-dashboard-progress-text');
    if (target) target.textContent = text;
  }

  function periodFromMessage(message) {
    return {
      start: new Date(message.period.startTime),
      end: new Date(message.period.endTime),
      days: message.period.days,
      key: message.period.key,
      label: message.period.label,
      referenceDay: new Date(message.period.referenceDay)
    };
  }

  function showResult(message) {
    var result = message.result;
    var records = (result.records || []).map(rehydrateRecord);
    var normalization = {
      canonical: records,
      rawUniqueEvents: records,
      conflicts: records.filter(function (record) { return record.hasAuthorConflict; }),
      metrics: {
        inputRows: result.examinedRows || 0,
        validRows: result.acceptedEvents || 0,
        uniqueEvents: result.acceptedEvents || records.length,
        canonicalAudits: records.length,
        exactDuplicateRows: result.duplicateRows || 0,
        repeatedAuditEvents: result.repeatedEvents || 0,
        conflictingAuthorAudits: result.authorConflicts || 0
      }
    };
    var validation = global.GoAwakeIntegrityValidator.validate(records, normalization);
    var dashboard = global.GoAwakeDashboardEngine.build(records, {
      normalization: normalization,
      validation: validation
    });
    var period = periodFromMessage(message);
    var collectionMeta = {
      collectionMode: 'dedicated-hidden-audit-pagination',
      auditExecutionMode: result.auditExecutionMode || 'inactive-tab-fallback',
      pagesRead: result.pagesRead || 0,
      examinedRows: result.examinedRows || 0,
      duplicateRows: result.duplicateRows || 0,
      localEventsInPeriod: records.length,
      liveStoredEvents: 0,
      coverageStart: Number.isFinite(result.coverageStart) ? new Date(result.coverageStart) : null,
      coverageEnd: Number.isFinite(result.coverageEnd) ? new Date(result.coverageEnd) : null,
      pagination: {
        label: (result.pagesRead || 0) + ' páginas da Audit',
        currentPage: result.pagesRead || 0
      },
      diagnostics: { acceptedRows: records.length },
      auditPeriodFilter: result.auditPeriodFilter || {
        applied: false,
        reason: 'Situação do filtro visual da Audit não informada.'
      },
      pageLimitReached: result.pageLimitReached === true,
      partialCompletion: result.partialCompletion === true,
      completionReason: result.completionReason || 'completed',
      scopeComplete: result.pageLimitReached !== true &&
        result.partialCompletion !== true
    };

    if (!global.GoAwakeDashboardPdf) {
      throw new Error('O gerador local de PDF não foi carregado.');
    }
    if (!global.GoAwakeDashboardView ||
        typeof global.GoAwakeDashboardView.showPdfReport !== 'function') {
      throw new Error('A visualização unificada do PDF não foi carregada.');
    }
    var pdfResult = global.GoAwakeDashboardPdf.build(
      dashboard,
      period,
      collectionMeta
    );
    global.GoAwakeDashboardView.removeProgress();
    global.GoAwakeDashboardView.showPdfReport(
      pdfResult,
      period,
      collectionMeta
    );
    global.GoAwakeDashboardPdf.downloadBuilt(pdfResult);
    global.__goAwakeHiddenDashboardRunning = false;
  }

  function showError(message) {
    global.GoAwakeDashboardView.removeProgress();
    global.__goAwakeHiddenDashboardRunning = false;
    alert('Não foi possível gerar o Dashboard.\n\n' + (message.error || 'Erro desconhecido.'));
  }

  function showResultSafely(message) {
    try {
      progressText('Coleta concluída. Montando o Dashboard...');
      showResult(message);
    } catch (error) {
      console.error('[SLA][Dashboard] Falha ao montar resultado:', error);
      showError({
        error: 'A coleta terminou, mas o painel não pôde ser montado: ' +
          (error.message || String(error))
      });
    }
  }

  var dashboardMessageListenerV2 = function (message) {
    if (!message) return;
    if (message.type === 'slaHiddenDashboardProgress' &&
        global.__goAwakeHiddenDashboardRunning) {
      var progress = message.progress || {};
      if (progress.message) {
        progressText(progress.message);
      } else {
        progressText(
          'Audit: página ' + (progress.pagesRead || 0) +
          ' · ' + (progress.examinedRows || 0) + ' linhas' +
          ' · ' + (progress.uniqueAudits || 0) + ' auditorias'
        );
      }
      return;
    }
    if (message.type === 'slaHiddenDashboardResultV2') showResultSafely(message);
    if (message.type === 'slaHiddenDashboardErrorV2') showError(message);
  };
  global.__goAwakeHiddenDashboardMessageListenerV2 = dashboardMessageListenerV2;
  chrome.runtime.onMessage.addListener(dashboardMessageListenerV2);

  async function run() {
    if (global.__goAwakeHiddenDashboardRunning) {
      alert('O Dashboard já está sendo gerado.');
      return;
    }

    var period = await global.GoAwakeDashboardView.showPeriodSelector();
    if (!period) return;

    global.__goAwakeHiddenDashboardRunning = true;
    global.GoAwakeDashboardView.createProgress();
    progressText('Consultando a Audit em uma janela minimizada...');
    chrome.runtime.sendMessage({
      type: 'runHiddenAuditDashboard',
      responseType: 'pdf-model-v2',
      runtimeBuild: RUNTIME_BUILD,
      period: {
        startTime: period.start.getTime(),
        endTime: period.end.getTime(),
        days: period.days,
        key: period.key,
        label: period.label,
        referenceDay: period.referenceDay.getTime()
      }
    }, function (response) {
      if (chrome.runtime.lastError) {
        showError({
          error: 'A conexão com a coleta foi encerrada: ' +
            chrome.runtime.lastError.message
        });
        return;
      }
      if (!response || response.ok !== true) {
        showError({
          error: response && response.error
            ? response.error
            : 'A coleta terminou sem devolver o resultado do Dashboard.'
        });
        return;
      }
      if (response.result) {
        showResultSafely({
          type: 'slaHiddenDashboardResult',
          result: response.result,
          period: response.period
        });
        return;
      }
      if (response.accepted === true) {
        progressText('Coleta iniciada. O tempo varia conforme o período; aguarde...');
        return;
      }
      showError({
        error: 'O serviço confirmou a solicitação, mas não iniciou a coleta.'
      });
    });
  }

  global.GoAwakeHiddenDashboardRuntime = Object.freeze({ run: run });
  run();
})(window);
