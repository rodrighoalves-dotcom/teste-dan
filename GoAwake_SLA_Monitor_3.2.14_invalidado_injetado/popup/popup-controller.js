var monitorAtivo = false;
var INTERVALO_MONITOR = SLA_CONFIG.monitor.intervalSeconds;

async function solicitarResumoSemRecarregar(tabId) {
  try {
    var response = await chrome.tabs.sendMessage(tabId, {
      type: 'slaGenerateSummaryNow'
    });
    if (response && response.ok) return response;
  } catch (error) {
    console.warn('[Popup] Runtime do Resumo SLA ainda não disponível; reinjetando.', error);
  }

  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: [
      'shared/config.js',
      'shared/sla-summary-calculator.js',
      'shared/company-preselection.js',
      'content/report-print.js',
      'content/report-runtime-v2.js'
    ]
  });

  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function () {
      if (typeof window.gerarResumoSLAAgora !== 'function') {
        return {
          ok: false,
          error: 'A função do Resumo SLA não foi carregada.'
        };
      }
      window.gerarResumoSLAAgora();
      return { ok: true };
    }
  });
  var retry = results[0] && results[0].result;
  if (!retry || retry.ok !== true) {
    throw new Error(
      retry && retry.error
        ? retry.error
        : 'A página Fadiga não confirmou a geração do Resumo SLA.'
    );
  }
  return retry;
}

function isGoAwakeRoute(url, route) {
  try {
    var parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.goawakecloud.com.br') return false;
    return parsed.pathname.includes('/' + route) || parsed.hash.includes('/pages/f/' + route);
  } catch (error) {
    return false;
  }
}

async function findGoAwakeTab(route) {
  var tabs = await chrome.tabs.query({ url: 'https://www.goawakecloud.com.br/*' });
  return tabs.find(function(tab) {
    return isGoAwakeRoute(tab.url, route);
  }) || null;
}

document.addEventListener('DOMContentLoaded', function() {
  var versaoEl = document.getElementById('versaoExtensao');
  if (versaoEl) versaoEl.textContent = chrome.runtime.getManifest().version;
  var statusEl = document.getElementById('status');
  var btnIniciar = document.getElementById('btnIniciar');
  var btnParar = document.getElementById('btnParar');
  var btnDashboard = document.getElementById('btnDashboard');
  var btnResumoAgora = document.getElementById('btnResumoAgora');
  var chkAuto = document.getElementById('chkAutoRelatorio');
  var chkAutoAutor = document.getElementById('chkAutoAutor');

  function atualizarStatus(texto, classe) {
    if (statusEl) {
      statusEl.textContent = texto;
      statusEl.className = 'status ' + (classe || '');
    }
  }

  function mostrarEstadoMonitor(ativo) {
    monitorAtivo = ativo === true;
    btnIniciar.style.display = monitorAtivo ? 'none' : 'block';
    btnParar.style.display = monitorAtivo ? 'block' : 'none';
    atualizarStatus(
      monitorAtivo
        ? 'Monitoramento ativo (' + INTERVALO_MONITOR + 's)'
        : 'Monitoramento aguardando início.',
      monitorAtivo ? 'active' : 'waiting'
    );
  }

  async function sincronizarEstadoRealDoMonitor() {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabs[0];
      if (!tab || !tab.id || !isGoAwakeRoute(tab.url, 'fatigue')) {
        mostrarEstadoMonitor(false);
        return;
      }
      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: window.obterStatusMonitorScript
      });
      var status = results[0] && results[0].result;
      mostrarEstadoMonitor(Boolean(status && status.active));
    } catch (error) {
      console.warn('[Popup] Não foi possível consultar o estado real do monitor.', error);
      mostrarEstadoMonitor(false);
    }
  }

  sincronizarEstadoRealDoMonitor();

  chrome.storage.local.get('relatorioAutomatico', function(data) {
    if (data.relatorioAutomatico) {
      chkAuto.checked = true;
    }
  });

  chkAuto.addEventListener('change', async function() {
    var ativo = chkAuto.checked;
    await chrome.storage.local.set({ relatorioAutomatico: ativo });
    console.log('[Popup] Relatório automático:', ativo ? 'ATIVADO' : 'DESATIVADO');

    if (ativo) {
      var fatigueTab = await findGoAwakeTab('fatigue');
      if (!fatigueTab) {
        await chrome.tabs.create({ url: SLA_CONFIG.urls.fatigue, active: true });
      } else {
        await chrome.tabs.update(fatigueTab.id, { active: true });
      }
    }
  });

  chrome.storage.local.get('slaAutomaticAuthorPopupActive', function(data) {
    if (data.slaAutomaticAuthorPopupActive) {
      chkAutoAutor.checked = true;
    }
  });

  chkAutoAutor.addEventListener('change', async function() {
    try {
      if (!chkAutoAutor.checked) {
        await chrome.runtime.sendMessage({ type: 'stopAutomaticAuthorPopup' });
        console.log('[Popup] Contagem automática por autor: DESATIVADA');
        return;
      }

      var fatigueTab = await findGoAwakeTab('fatigue');
      if (!fatigueTab) {
        chkAutoAutor.checked = false;
        atualizarStatus('Abra a página Fadiga para ativar a contagem por autor.', 'stopped');
        return;
      }

      await chrome.runtime.sendMessage({
        type: 'startAutomaticAuthorPopup',
        fatigueTabId: fatigueTab.id
      });
      console.log('[Popup] Contagem automática por autor: ATIVADA');
    } catch (error) {
      chkAutoAutor.checked = false;
      atualizarStatus('Erro ao configurar a contagem por autor.', 'stopped');
      console.error('[Popup] Contagem automática por autor:', error);
    }
  });

  // ========== BOTÃO INICIAR ==========
  if (btnIniciar) {
    btnIniciar.addEventListener('click', async function() {
      try {
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        var tab = tabs[0];
        if (!tab || !isGoAwakeRoute(tab.url, 'fatigue')) {
          atualizarStatus('Abra a pagina de Fadiga do GoAwake.', 'stopped');
          return;
        }

        // Verifica se a função está disponível no contexto do popup
        if (typeof window.iniciarMonitorScript !== 'function') {
          console.error('[Popup] Função iniciarMonitorScript não encontrada!');
          atualizarStatus('Erro: função não carregada.', 'stopped');
          return;
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: window.iniciarMonitorScript,
          args: [INTERVALO_MONITOR, SLA_CONFIG.sla.operational]
        });

        mostrarEstadoMonitor(true);
      } catch (err) {
        atualizarStatus('Erro: ' + err.message, 'stopped');
        console.error(err);
      }
    });
  }

  // ========== BOTÃO PARAR ==========
  if (btnParar) {
    btnParar.addEventListener('click', async function() {
      try {
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        var tab = tabs[0];
        if (!tab || !isGoAwakeRoute(tab.url, 'fatigue')) {
          atualizarStatus('Abra a pagina de Fadiga do GoAwake.', 'stopped');
          return;
        }
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: window.pararMonitorScript
        });
        mostrarEstadoMonitor(false);
        atualizarStatus('Monitoramento parado.', 'stopped');
      } catch (err) {
        atualizarStatus('Erro: ' + err.message, 'stopped');
        console.error(err);
      }
    });
  }

  // ========== BOTÃO DASHBOARD ==========
  if (btnDashboard) {
    btnDashboard.addEventListener('click', async function() {
      try {
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        var tab = tabs[0];

        if (!tab || !tab.id || !isGoAwakeRoute(tab.url, 'fatigue')) {
          atualizarStatus('Abra a página Fadiga do GoAwake.', 'stopped');
          return;
        }

        btnDashboard.disabled = true;
        btnDashboard.textContent = 'Abrindo...';

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/dashboard.css']
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'shared/productivity-config.js',
            'shared/audit-utils.js',
            'shared/dashboard-period.js',
            'shared/audit-normalizer.js',
            'shared/integrity-validator.js',
            'content/dashboard-engine.js',
            'content/dashboard-pdf.js',
            'content/dashboard-view.js',
            'content/hidden-dashboard-runtime.js'
          ]
        });

        window.close();
      } catch (err) {
        console.error('[Popup] Erro ao abrir dashboard:', err);
        atualizarStatus('Erro ao abrir o Dashboard.', 'stopped');
        btnDashboard.disabled = false;
        btnDashboard.textContent = '📊 Dashboard';
      }
    });
  }

  // ========== BOTÃO RESUMO SLA ==========
  if (btnResumoAgora) {
    btnResumoAgora.addEventListener('click', async function() {
      try {
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        var tabAtual = tabs[0];
        var fatigueTab = tabAtual && isGoAwakeRoute(tabAtual.url, 'fatigue')
          ? tabAtual
          : await findGoAwakeTab('fatigue');

        if (!fatigueTab) {
          atualizarStatus('Abra a página Fadiga para gerar o Resumo SLA.', 'stopped');
          return;
        }

        if (!tabAtual || tabAtual.id !== fatigueTab.id) {
          await chrome.tabs.update(fatigueTab.id, { active: true });
        }
        await solicitarResumoSemRecarregar(fatigueTab.id);
        setTimeout(function() { window.close(); }, 300);
      } catch (err) {
        console.error('[Popup] Erro ao gerar resumo:', err);
        alert('Erro ao gerar resumo: ' + err.message);
      }
    });
  }
});
