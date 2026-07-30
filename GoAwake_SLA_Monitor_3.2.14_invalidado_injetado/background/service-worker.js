importScripts(
  '../shared/config.js',
  '../shared/logger.js',
  '../shared/sla-summary-calculator.js',
  'report-template.js'
);

const AUTHOR_POPUP_ALARM = 'sla-author-popup';
const AUTHOR_POPUP_ACTIVE_KEY = 'slaAutomaticAuthorPopupActive';
const AUTHOR_POPUP_SUMMARY_KEY = 'slaAutomaticAuthorSummary';
const AUTHOR_POPUP_FATIGUE_TAB_KEY = 'slaAutomaticAuthorFatigueTabId';
let authorCollectionRunning = false;
let dedicatedAuditTabId = null;
let dedicatedAuditPurpose = null;
let dedicatedAuditWindowId = null;
let dashboardProgressTargetTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  sincronizarAlarme();
  chrome.storage.local.set({ [AUTHOR_POPUP_ACTIVE_KEY]: false });
  chrome.alarms.clear(AUTHOR_POPUP_ALARM);
});
chrome.runtime.onStartup.addListener(() => {
  sincronizarAlarme();
  chrome.storage.local.set({ [AUTHOR_POPUP_ACTIVE_KEY]: false });
  chrome.alarms.clear(AUTHOR_POPUP_ALARM);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.relatorioAutomatico) {
    sincronizarAlarme();
  }
});

async function sincronizarAlarme() {
  const data = await chrome.storage.local.get(SLA_CONFIG.storageKeys.automaticReport);
  const ativo = data[SLA_CONFIG.storageKeys.automaticReport] === true;

  await chrome.alarms.clear('sla-report');
  if (!ativo) {
    console.log('[SLA] Relatório automático desativado.');
    return;
  }

  chrome.alarms.create('sla-report', {
    periodInMinutes: SLA_CONFIG.monitor.automaticReportMinutes,
    delayInMinutes: SLA_CONFIG.monitor.automaticReportMinutes
  });
  console.log('[SLA] Alarme configurado para 60 minutos.');
}

async function sincronizarAlarmeAutores() {
  const data = await chrome.storage.local.get(AUTHOR_POPUP_ACTIVE_KEY);
  await chrome.alarms.clear(AUTHOR_POPUP_ALARM);
  if (data[AUTHOR_POPUP_ACTIVE_KEY] !== true) return;

  chrome.alarms.create(AUTHOR_POPUP_ALARM, {
    periodInMinutes: SLA_CONFIG.monitor.automaticAuthorPopupMinutes,
    delayInMinutes: SLA_CONFIG.monitor.automaticAuthorPopupMinutes
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTHOR_POPUP_ALARM) {
    const state = await chrome.storage.local.get(AUTHOR_POPUP_ACTIVE_KEY);
    if (state[AUTHOR_POPUP_ACTIVE_KEY] !== true) {
      await chrome.alarms.clear(AUTHOR_POPUP_ALARM);
      return;
    }
    await executarResumoAutoresAutomatico();
    return;
  }

  if (alarm.name !== 'sla-report') return;

  const data = await chrome.storage.local.get(SLA_CONFIG.storageKeys.automaticReport);
  if (data[SLA_CONFIG.storageKeys.automaticReport] !== true) {
    await chrome.alarms.clear('sla-report');
    return;
  }

  console.log('[SLA] Alarme disparado em', new Date().toLocaleString());
  await executarColetaAutomatica();
});

function faixaHoje() {
  const agora = new Date();
  const inicio = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    0, 0, 0, 0
  );
  return { startTime: inicio.getTime(), endTime: agora.getTime() };
}

async function esperarGuiaCarregar(tabId, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return tab;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Tempo excedido ao carregar a guia Audit dedicada.');
}

async function criarAuditDashboardDiscreta(fatigueTab) {
  let createdWindowId = null;
  try {
    const auditWindow = await chrome.windows.create({
      url: SLA_CONFIG.urls.audit,
      focused: false,
      state: 'minimized',
      type: 'popup'
    });
    createdWindowId = auditWindow && auditWindow.id;

    let auditTab = auditWindow && Array.isArray(auditWindow.tabs)
      ? auditWindow.tabs[0]
      : null;
    if ((!auditTab || !Number.isInteger(auditTab.id)) &&
        Number.isInteger(createdWindowId)) {
      const windowTabs = await chrome.tabs.query({ windowId: createdWindowId });
      auditTab = windowTabs[0] || null;
    }
    if (!auditTab || !Number.isInteger(auditTab.id)) {
      throw new Error('A janela minimizada não retornou a guia Audit.');
    }

    dedicatedAuditWindowId = createdWindowId;
    return {
      tab: auditTab,
      mode: 'minimized-window'
    };
  } catch (error) {
    if (Number.isInteger(createdWindowId)) {
      try {
        await chrome.windows.remove(createdWindowId);
      } catch (closeError) {
        // A janela pode ter sido encerrada pelo navegador.
      }
    }
    console.warn(
      '[SLA][Dashboard] Janela minimizada indisponível; usando guia inativa:',
      error
    );
    const auditTab = await chrome.tabs.create({
      url: SLA_CONFIG.urls.audit,
      active: false,
      windowId: fatigueTab.windowId
    });
    return {
      tab: auditTab,
      mode: 'inactive-tab-fallback'
    };
  }
}

async function fecharAuditDashboardDiscreta() {
  const auditTabId = dedicatedAuditTabId;
  const auditWindowId = dedicatedAuditWindowId;

  dedicatedAuditWindowId = null;
  dedicatedAuditTabId = null;
  dedicatedAuditPurpose = null;

  if (Number.isInteger(auditTabId)) {
    try {
      await chrome.tabs.remove(auditTabId);
    } catch (error) {
      // A guia pode ter sido fechada durante a coleta.
    }
  }

  if (Number.isInteger(auditWindowId)) {
    try {
      await chrome.windows.remove(auditWindowId);
    } catch (error) {
      // A janela pode ter sido encerrada ao remover sua única guia.
    }
  }
}

async function localizarGuiaFadiga(preferredTabId) {
  if (Number.isInteger(preferredTabId)) {
    try {
      const preferred = await chrome.tabs.get(preferredTabId);
      if (preferred && isGoAwakeRoute(preferred.url, 'fatigue')) return preferred;
    } catch (error) {
      // A guia preferida pode ter sido fechada.
    }
  }
  const tabs = await chrome.tabs.query({ url: 'https://www.goawakecloud.com.br/*' });
  return tabs.find((item) => isGoAwakeRoute(item.url, 'fatigue')) || null;
}

async function aplicarPeriodoAuditDedicada(tabId, period) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async function (startTime, endTime) {
        return window.GoAwakeAuditPeriodFilter.apply({
          startTime: startTime,
          endTime: endTime
        });
      },
      args: [period.startTime, period.endTime]
    });
    return results[0] && results[0].result
      ? results[0].result
      : { applied: false, reason: 'O filtro da Audit não retornou confirmação.' };
  } catch (error) {
    console.warn('[SLA][Audit oculta] Período visual não aplicado:', error);
    return {
      applied: false,
      mode: 'local-treated-at-filter-only',
      reason: error.message || String(error)
    };
  }
}

async function executarResumoAutoresAutomatico() {
  if (authorCollectionRunning) {
    console.log('[SLA][Audit oculta] Coleta ignorada: outra coleta ainda está em andamento.');
    return;
  }

  authorCollectionRunning = true;
  try {
    const state = await chrome.storage.local.get([
      AUTHOR_POPUP_ACTIVE_KEY,
      AUTHOR_POPUP_FATIGUE_TAB_KEY
    ]);
    if (state[AUTHOR_POPUP_ACTIVE_KEY] !== true) return;

    const fatigueTab = await localizarGuiaFadiga(state[AUTHOR_POPUP_FATIGUE_TAB_KEY]);
    if (!fatigueTab) {
      console.log('[SLA][Audit oculta] Coleta ignorada: página Fadiga não está aberta.');
      return;
    }

    const auditTab = await chrome.tabs.create({
      url: SLA_CONFIG.urls.audit,
      active: false,
      windowId: fatigueTab.windowId
    });
    dedicatedAuditTabId = auditTab.id;
    dedicatedAuditPurpose = 'author-popup';
    await esperarGuiaCarregar(auditTab.id, 45000);

    await chrome.scripting.executeScript({
      target: { tabId: auditTab.id },
      func: function () {
        window.__goAwakeDedicatedAuditCollector = true;
      }
    });
    await chrome.scripting.executeScript({
      target: { tabId: auditTab.id },
      files: [
        'shared/productivity-config.js',
        'shared/audit-utils.js',
        'content/audit-period-filter.js',
        'content/automatic-audit-collector.js'
      ]
    });

    const period = faixaHoje();
    const auditPeriodFilter = await aplicarPeriodoAuditDedicada(auditTab.id, period);
    const results = await chrome.scripting.executeScript({
      target: { tabId: auditTab.id },
      func: async function (startTime, endTime) {
        return window.GoAwakeAutomaticAuditCollector.collect({
          startTime: startTime,
          endTime: endTime
        });
      },
      args: [period.startTime, period.endTime]
    });
    const summary = results[0] && results[0].result;
    if (!summary) throw new Error('A guia Audit dedicada não retornou o resumo por autor.');
    summary.auditPeriodFilter = auditPeriodFilter;

    await chrome.storage.local.set({ [AUTHOR_POPUP_SUMMARY_KEY]: summary });
    await chrome.tabs.sendMessage(fatigueTab.id, {
      type: 'slaAutomaticAuthorSummary',
      summary: summary
    });
    console.log(
      '[SLA][Audit oculta] Popup atualizado:',
      summary.totalUniqueAudits,
      'IDs únicos em',
      summary.pagesRead,
      'páginas.'
    );
  } catch (error) {
    const mensagem = String(error && error.message ? error.message : error);
    if (mensagem.includes('Frame with ID 0 was removed') ||
        mensagem.includes('No frame with id') ||
        mensagem.includes('The tab was closed')) {
      console.warn('[SLA][Audit oculta] Coleta cancelada porque a guia/frame foi removido.');
    } else {
      console.error('[SLA][Audit oculta] Falha na coleta por autor:', error);
    }
  } finally {
    if (Number.isInteger(dedicatedAuditTabId)) {
      try {
        await chrome.tabs.remove(dedicatedAuditTabId);
      } catch (error) {
        // A guia pode ter sido fechada durante a coleta.
      }
    }
    dedicatedAuditTabId = null;
    dedicatedAuditPurpose = null;
    authorCollectionRunning = false;
  }
}

async function executarDashboardAuditOculto(message, fatigueTab) {
  if (authorCollectionRunning) {
    return {
      ok: false,
      error: 'Aguarde a coleta automática por autor terminar e tente novamente.'
    };
  }

  authorCollectionRunning = true;
  try {
    if (!message.period ||
        !Number.isFinite(message.period.startTime) ||
        !Number.isFinite(message.period.endTime)) {
      throw new Error('Período inválido para o Dashboard.');
    }
    if (!isGoAwakeRoute(fatigueTab.url, 'fatigue')) {
      throw new Error('O Dashboard deve ser solicitado na página Fadiga.');
    }

    const auditContext = await criarAuditDashboardDiscreta(fatigueTab);
    const auditTab = auditContext.tab;
    dedicatedAuditTabId = auditTab.id;
    dedicatedAuditPurpose = 'dashboard';
    await esperarGuiaCarregar(auditTab.id, 45000);

    await chrome.scripting.executeScript({
      target: { tabId: auditTab.id },
      func: function () {
        window.__goAwakeDedicatedAuditCollector = true;
      }
    });
    await chrome.scripting.executeScript({
      target: { tabId: auditTab.id },
      files: [
        'shared/productivity-config.js',
        'shared/audit-utils.js',
        'content/audit-period-filter.js',
        'content/automatic-audit-collector.js'
      ]
    });

    const auditPeriodFilter = await aplicarPeriodoAuditDedicada(
      auditTab.id,
      message.period
    );
    if (!auditPeriodFilter || auditPeriodFilter.buttonClicked !== true) {
      throw new Error(
        'A lupa do período da Audit não foi acionada. O Dashboard foi interrompido para evitar uma consulta incorreta.'
      );
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: auditTab.id },
      func: async function (startTime, endTime) {
        return window.GoAwakeAutomaticAuditCollector.collect({
          startTime: startTime,
          endTime: endTime,
          includeRecords: true
        });
      },
      args: [message.period.startTime, message.period.endTime]
    });
    const result = results[0] && results[0].result;
    if (!result || !Array.isArray(result.records)) {
      throw new Error('A guia Audit dedicada não retornou os registros do período.');
    }
    result.auditPeriodFilter = auditPeriodFilter;
    result.auditExecutionMode = auditContext.mode;

    return {
      ok: true,
      result: result,
      period: message.period
    };
  } catch (error) {
    console.error('[SLA][Dashboard Audit oculta]', error);
    return {
      ok: false,
      error: error.message || String(error)
    };
  } finally {
    await fecharAuditDashboardDiscreta();
    authorCollectionRunning = false;
  }
}

async function entregarResultadoDashboard(fatigueTabId, response) {
  var payload = response && response.ok === true
    ? {
        type: 'slaHiddenDashboardResult',
        result: response.result,
        period: response.period
      }
    : {
        type: 'slaHiddenDashboardError',
        error: response && response.error
          ? response.error
          : 'A coleta do Dashboard terminou sem devolver um resultado válido.'
      };
  try {
    await chrome.tabs.sendMessage(fatigueTabId, payload);
  } catch (error) {
    console.error(
      '[SLA][Dashboard] Não foi possível entregar o resultado à página Fadiga:',
      error
    );
  } finally {
    if (dashboardProgressTargetTabId === fatigueTabId) {
      dashboardProgressTargetTabId = null;
    }
  }
}

async function encaminharProgressoDashboard(message, senderTabId) {
  if (dedicatedAuditPurpose !== 'dashboard' ||
      senderTabId !== dedicatedAuditTabId ||
      !Number.isInteger(dashboardProgressTargetTabId)) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(dashboardProgressTargetTabId, {
      type: 'slaHiddenDashboardProgress',
      progress: message.progress || {}
    });
  } catch (error) {
    console.warn('[SLA][Dashboard] Progresso não entregue à página Fadiga:', error);
  }
}

async function iniciarResumoAutoresAutomatico(fatigueTabId) {
  await chrome.storage.local.set({
    [AUTHOR_POPUP_ACTIVE_KEY]: true,
    [AUTHOR_POPUP_FATIGUE_TAB_KEY]: fatigueTabId
  });
  await sincronizarAlarmeAutores();
  await executarResumoAutoresAutomatico();
}

async function pararResumoAutoresAutomatico() {
  await chrome.storage.local.set({ [AUTHOR_POPUP_ACTIVE_KEY]: false });
  await chrome.alarms.clear(AUTHOR_POPUP_ALARM);
  if (Number.isInteger(dedicatedAuditTabId) && dedicatedAuditPurpose === 'author-popup') {
    try {
      await chrome.tabs.remove(dedicatedAuditTabId);
    } catch (error) {
      // A guia já pode ter sido fechada.
    }
  }

  const tabs = await chrome.tabs.query({ url: 'https://www.goawakecloud.com.br/*' });
  const fatigueTabs = tabs.filter((item) => isGoAwakeRoute(item.url, 'fatigue'));
  await Promise.allSettled(fatigueTabs.map((tab) => chrome.tabs.sendMessage(tab.id, {
    type: 'slaAutomaticAuthorPopupStopped'
  })));
}

function isGoAwakeRoute(url, route) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.goawakecloud.com.br') return false;
    return parsed.pathname.includes('/' + route) || parsed.hash.includes('/pages/f/' + route);
  } catch (error) {
    return false;
  }
}

async function executarColetaAutomatica() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.goawakecloud.com.br/*' });
    const tab = tabs.find((item) => isGoAwakeRoute(item.url, 'fatigue'));
    if (!tab) {
      console.log('[SLA] Relatório automático ignorado: mantenha a página de Fadiga aberta.');
      return;
    }

    const resultados = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: coletarDadosBackground
    });

    const dados = resultados[0]?.result;
    if (!dados || dados.registros.length === 0) {
      console.log('[SLA] Nenhum registro encontrado.');
      return;
    }
    const html = gerarRelatorioBackground(dados);
    const nomeArquivo = 'Relatorio_SLA_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16) + '.html';
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const reader = new FileReader();
    reader.onload = function() {
      chrome.downloads.download({
        url: reader.result,
        filename: nomeArquivo,
        saveAs: false
      });
    };
    reader.readAsDataURL(blob);
    console.log('[SLA] Relatório automático gerado com sucesso!');

  } catch (erro) {
    console.error('[SLA] Erro na coleta automática:', erro);
  }
}

function coletarDadosBackground() {
  var registros = [];
  var agora = new Date();
  var rows = document.querySelectorAll('tbody tr');
  var selection = globalThis.SLACompanyPreselection &&
    typeof globalThis.SLACompanyPreselection.detect === 'function'
    ? globalThis.SLACompanyPreselection.detect(document)
    : { code: 'UNKNOWN' };
  var generalSelection = selection.code === 'GENERAL';

  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].querySelectorAll('td');
    if (cells.length < 7) continue;

    var placaTexto = cells[3]?.textContent?.trim() || '';
    var motorista = cells[4]?.textContent?.trim() || '';
    var disponivelStr = cells[6]?.textContent?.trim() || '';
    var autor = cells[10]?.textContent?.trim() || cells[11]?.textContent?.trim() || 'N/I';
    if (!disponivelStr) continue;

    var m = disponivelStr.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);
    if (!m) continue;

    var dataDisponivel = new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], 0);
    var minutos = Math.floor((agora - dataDisponivel) / 60000);

    if (minutos < 0) continue;

    var placa = placaTexto.split(/\s+/)[0].trim();
    var p = placa.toUpperCase().trim();
    var vale = !generalSelection &&
      p.charAt(0) === 'C' && p.length >= 2 &&
      p.charAt(1) >= 'A' && p.charAt(1) <= 'Z';
    var argent = !generalSelection &&
      (motorista.includes('(Re') || motorista.includes('[Fr') || motorista.includes('{Q'));
    var liberia = !vale && p.match(/^([A-Z]{4})-([0-9]{2})$/);
    var empresa = generalSelection ? 'Geral' : 'Outras';
    if (!generalSelection && argent) empresa = 'Argenta';
    else if (!generalSelection && vale) empresa = 'Vale';
    else if (!generalSelection && liberia) empresa = 'Libéria';

    registros.push({
      placa: placa, 
      autor: autor, 
      minutos: minutos, 
      availableAt: dataDisponivel.getTime(),
      empresa: empresa 
    });
  }
  return {
    registros: registros,
    timestamp: agora.getTime(),
    preselectionCode: selection.code
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'slaHiddenDashboardProgress') {
    encaminharProgressoDashboard(
      message,
      sender.tab && sender.tab.id
    ).catch((error) => {
      console.warn('[SLA][Dashboard] Falha ao encaminhar progresso:', error);
    });
    sendResponse({ received: true });
    return;
  }
  if (message.type === 'startAutomaticAuthorPopup') {
    iniciarResumoAutoresAutomatico(message.fatigueTabId).catch((error) => {
      console.error('[SLA][Audit oculta] Não foi possível iniciar:', error);
    });
    sendResponse({ started: true });
    return;
  }
  if (message.type === 'stopAutomaticAuthorPopup') {
    pararResumoAutoresAutomatico().catch((error) => {
      console.error('[SLA][Audit oculta] Não foi possível parar:', error);
    });
    sendResponse({ stopped: true });
    return;
  }
  if (message.type === 'runHiddenAuditDashboard') {
    if (!sender.tab || !sender.tab.id) {
      sendResponse({
        ok: false,
        error: 'A solicitação do Dashboard não veio de uma página Fadiga válida.'
      });
      return;
    }
    const fatigueTabId = sender.tab.id;
    dashboardProgressTargetTabId = fatigueTabId;
    executarDashboardAuditOculto(message, sender.tab)
      .then((response) => entregarResultadoDashboard(fatigueTabId, response))
      .catch((error) => {
        console.error('[SLA][Dashboard Audit oculta] Não foi possível concluir:', error);
        return entregarResultadoDashboard(fatigueTabId, {
          ok: false,
          error: error.message || String(error)
        });
      });
    sendResponse({ ok: true, accepted: true });
    return;
  }
  if (message.type === 'getStatus') {
    chrome.alarms.get('sla-report', (alarm) => {
      sendResponse({ active: !!alarm });
    });
    return true;
  }
});
