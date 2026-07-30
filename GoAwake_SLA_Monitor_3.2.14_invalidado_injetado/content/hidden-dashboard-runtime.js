(function (global) {
  'use strict';

  if (global.__goAwakeHiddenDashboardRuntimeInstalled) {
    global.GoAwakeHiddenDashboardRuntime.run();
    return;
  }
  global.__goAwakeHiddenDashboardRuntimeInstalled = true;
  global.__goAwakeHiddenDashboardRunning = false;
  global.__goAwakeHiddenDashboardWatchdog = null;
  var DASHBOARD_INACTIVITY_TIMEOUT_MS = 120000;

  function clearDashboardWatchdog() {
    if (global.__goAwakeHiddenDashboardWatchdog) {
      clearTimeout(global.__goAwakeHiddenDashboardWatchdog);
      global.__goAwakeHiddenDashboardWatchdog = null;
    }
  }

  function resetDashboardWatchdog() {
    clearDashboardWatchdog();
    global.__goAwakeHiddenDashboardWatchdog = setTimeout(function () {
      if (!global.__goAwakeHiddenDashboardRunning) return;
      showError({
        error: 'A coleta ficou sem progresso por 2 minutos. Verifique a conexão e tente novamente.'
      });
    }, DASHBOARD_INACTIVITY_TIMEOUT_MS);
  }

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
    clearDashboardWatchdog();
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
      scopeComplete: result.pageLimitReached !== true
    };

    global.GoAwakeDashboardView.removeProgress();
    global.GoAwakeDashboardView.showDashboard(dashboard, period, collectionMeta);
    if (!global.GoAwakeDashboardPdf) {
      throw new Error('O gerador local de PDF não foi carregado.');
    }
    global.GoAwakeDashboardPdf.download(dashboard, period, collectionMeta);
    global.__goAwakeHiddenDashboardRunning = false;
  }

  function showError(message) {
    clearDashboardWatchdog();
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

  chrome.runtime.onMessage.addListener(function (message) {
    if (!message) return;
    if (message.type === 'slaHiddenDashboardProgress' &&
        global.__goAwakeHiddenDashboardRunning) {
      var progress = message.progress || {};
      resetDashboardWatchdog();
      progressText(
        'Audit: página ' + (progress.pagesRead || 0) +
        ' · ' + (progress.examinedRows || 0) + ' linhas' +
        ' · ' + (progress.uniqueAudits || 0) + ' auditorias'
      );
      return;
    }
    if (message.type === 'slaHiddenDashboardResult') showResultSafely(message);
    if (message.type === 'slaHiddenDashboardError') showError(message);
  });

  async function run() {
    if (global.__goAwakeHiddenDashboardRunning) {
      alert('O Dashboard já está sendo gerado.');
      return;
    }

    var period = await global.GoAwakeDashboardView.showPeriodSelector();
    if (!period) return;

    global.__goAwakeHiddenDashboardRunning = true;
    global.GoAwakeDashboardView.createProgress();
    resetDashboardWatchdog();
    progressText('Consultando a Audit em uma janela minimizada...');
    chrome.runtime.sendMessage({
      type: 'runHiddenAuditDashboard',
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
        resetDashboardWatchdog();
        progressText('Coleta iniciada. Aguardando a paginação da Audit...');
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
