// ============================================================
// SLA MONITOR - RELATÓRIO RESUMIDO (SEM CONTAGEM E SEM OUTRAS)
// ============================================================

(function() {
  console.log('[SLA] Iniciando script de relatórios...');

  var url = window.location.href;
  var isFadiga = url.includes('/fatigue');
  var isAudit = url.includes('/audit');
  var slaOperacional = typeof SLA_CONFIG !== 'undefined' && SLA_CONFIG.sla
    ? SLA_CONFIG.sla.operational
    : {
        valeArgenta: { attention: 3, critical: 5 },
        general: { attention: 8, critical: 10 }
      };
  var politicaValeArgenta = slaOperacional.valeArgenta;
  var politicaGeral = slaOperacional.general;

  // ================================================================
  // FUNÇÃO PARA DETECTAR A PRÉ-SELEÇÃO
  // ================================================================
  function detectarPreSelecao() {
    var selects = document.querySelectorAll('select');
    for (var i = 0; i < selects.length; i++) {
      var select = selects[i];
      var options = select.querySelectorAll('option');
      for (var j = 0; j < options.length; j++) {
        var txt = options[j].textContent.trim().toUpperCase();
        if ((txt.includes('GERAL') || txt.includes('TODAS')) && (options[j].selected || select.value === options[j].value)) {
          return 'GERAL';
        }
        if ((txt.includes('VALE') && txt.includes('ARGENTA')) && (options[j].selected || select.value === options[j].value)) {
          return 'VOR+ARG';
        }
        if ((txt.includes('VALE') && !txt.includes('ARGENTA')) && (options[j].selected || select.value === options[j].value)) {
          return 'VALE';
        }
        if ((txt.includes('ARGENTA') && !txt.includes('VALE')) && (options[j].selected || select.value === options[j].value)) {
          return 'ARGENTA';
        }
      }
    }
    return 'GERAL';
  }

  // ================================================================
  // FUNÇÃO PARA OBTER SLA CONFIG
  // ================================================================
  function getSLAConfig(empresa, preSelecao) {
    var policy = empresa === 'Vale' || empresa === 'Argenta'
      ? politicaValeArgenta
      : politicaGeral;
    return {
      slaLimite: policy.critical,
      slaAlerta: policy.attention
    };
  }

  // ================================================================
  // FUNÇÃO PARA GERAR RESUMO SLA (SEM CONTAGEM E SEM OUTRAS)
  // ================================================================
  async function gerarResumoSLAAgora() {
    console.log('[SLA] Gerando Resumo SLA...');

    try {
      var preSelecao = detectarPreSelecao();
      console.log('[SLA] Pré-seleção detectada:', preSelecao);

      var agora = new Date();
      var registros = obterRegistrosDaPaginaFadiga(agora);

      // Inicializa apenas Vale e Argenta (Outras não será exibida separadamente)
      var empresas = {
        'Vale': { dentro: 0, atencao: 0, critico: 0, total: 0, tempos: [] },
        'Argenta': { dentro: 0, atencao: 0, critico: 0, total: 0, tempos: [] }
      };

      // Se for GERAL, os dados de OUTRAS serão mesclados no card GERAL
      var totalGeral = 0, dentroGeral = 0, atencaoGeral = 0, criticoGeral = 0;
      var temposGerais = [];

      registros.forEach(function(r) {
        var empresa = 'Outras';
        if (r.vale && r.argent) empresa = 'Argenta';
        else if (r.vale) empresa = 'Vale';
        else if (r.argent) empresa = 'Argenta';

        // Se for VOR+ARG, ignora OUTRAS
        if (preSelecao === 'VOR+ARG' && empresa === 'Outras') return;
        // Se for GERAL, considera OUTRAS como parte do GERAL
        if (preSelecao === 'GERAL' && empresa === 'Outras') {
          // Trata como se fosse uma empresa separada para o cálculo do GERAL
          var config = getSLAConfig('Outras', preSelecao);
          var slaLimite = config.slaLimite;
          var slaAlerta = config.slaAlerta;
          var status = 'dentro';
          if (r.minutos > slaLimite) status = 'critico';
          else if (r.minutos >= slaAlerta) status = 'atencao';

          totalGeral++;
          temposGerais.push(r.availableAt);
          if (status === 'dentro') dentroGeral++;
          else if (status === 'atencao') atencaoGeral++;
          else if (status === 'critico') criticoGeral++;
          return;
        }

        // Processa Vale e Argenta normalmente
        var config = getSLAConfig(empresa, preSelecao);
        var slaLimite = config.slaLimite;
        var slaAlerta = config.slaAlerta;

        var status = 'dentro';
        if (r.minutos > slaLimite) status = 'critico';
        else if (r.minutos >= slaAlerta) status = 'atencao';

        empresas[empresa].total++;
        empresas[empresa].tempos.push(r.availableAt);
        if (status === 'dentro') empresas[empresa].dentro++;
        else if (status === 'atencao') empresas[empresa].atencao++;
        else if (status === 'critico') empresas[empresa].critico++;

        totalGeral++;
        temposGerais.push(r.availableAt);
        if (status === 'dentro') dentroGeral++;
        else if (status === 'atencao') atencaoGeral++;
        else if (status === 'critico') criticoGeral++;
      });

      function calcularTempoResumo(disponiveis) {
        return SLASummaryCalculator
          .fromAvailableTimes(disponiveis, agora)
          .elapsedMinutes;
      }

      var temposVale = empresas['Vale']?.tempos || [];
      var temposArgenta = empresas['Argenta']?.tempos || [];
      var tempoResumoVale = calcularTempoResumo(temposVale);
      var tempoResumoArgenta = calcularTempoResumo(temposArgenta);
      var tempoResumoGeral = calcularTempoResumo(temposGerais);

      var dataStr = agora.toLocaleDateString('pt-BR');
      var horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      var textoPreSelecao = preSelecao === 'VOR+ARG'
        ? 'Filtro: VOR + ARG (SLA 5min)'
        : 'Filtro: GERAL (SLA 10min)';

      var html = '<div id="resumo-sla-fadiga" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;background:#1e293b;border-radius:12px;border:1px solid #334155;padding:20px 24px;font-family:sans-serif;min-width:340px;max-width:460px;box-shadow:0 8px 30px rgba(0,0,0,0.6);color:#f1f5f9;">';

      // Cabeçalho
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
      html += '<div>';
      html += '<h3 style="margin:0;color:#f1f5f9;font-size:18px;">📊 Resumo SLA</h3>';
      html += '<div style="font-size:15px;font-weight:600;color:#60a5fa;margin-top:2px;">' + dataStr + ' · ' + horaStr + '</div>';
      html += '<div style="font-size:10px;color:#94a3b8;">' + textoPreSelecao + '</div>';
      html += '<div style="font-size:10px;color:#94a3b8;">Fórmula: horário atual − menor “Disponível em” da tela atual</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:5px;">';
      html += '<button id="btn-pdf-whats" style="background:#25D366;color:white;border:none;padding:4px 12px;border-radius:5px;font-size:11px;cursor:pointer;">📄 PDF + WhatsApp</button>';
      html += '<button onclick="document.getElementById(\'resumo-sla-fadiga\').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;font-size:14px;cursor:pointer;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;">✕</button>';
      html += '</div></div>';

      // ========== CARDS PRINCIPAIS (sem contagem de veículos) ==========
      html += '<div style="display:flex;gap:10px;margin:12px 0;justify-content:center;">';
      
      // VALE
      html += '<div style="flex:1;background:#0f172a;border-radius:8px;padding:12px 8px;text-align:center;border:2px solid #1e3a5f;">';
      html += '<div style="font-size:14px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">VALE</div>';
      html += '<div style="font-size:28px;font-weight:bold;color:#60a5fa;">' + tempoResumoVale + 'm</div>';
      html += '<div style="font-size:11px;color:#94a3b8;">SLA: 5min</div>';
      var statusVale = tempoResumoVale < politicaValeArgenta.attention ? '✅ OK' : tempoResumoVale <= politicaValeArgenta.critical ? '⚠️ Atenção' : '🚨 Crítico';
      var corVale = tempoResumoVale < politicaValeArgenta.attention ? '#22c55e' : tempoResumoVale <= politicaValeArgenta.critical ? '#eab308' : '#ef4444';
      html += '<div style="font-size:13px;font-weight:600;color:' + corVale + ';margin-top:2px;">' + statusVale + '</div>';
      html += '</div>';

      // ARGENTA
      html += '<div style="flex:1;background:#0f172a;border-radius:8px;padding:12px 8px;text-align:center;border:2px solid #5f1a1a;">';
      html += '<div style="font-size:14px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">ARGENTA</div>';
      html += '<div style="font-size:28px;font-weight:bold;color:#f87171;">' + tempoResumoArgenta + 'm</div>';
      html += '<div style="font-size:11px;color:#94a3b8;">SLA: 5min</div>';
      var statusArgenta = tempoResumoArgenta < politicaValeArgenta.attention ? '✅ OK' : tempoResumoArgenta <= politicaValeArgenta.critical ? '⚠️ Atenção' : '🚨 Crítico';
      var corArgenta = tempoResumoArgenta < politicaValeArgenta.attention ? '#22c55e' : tempoResumoArgenta <= politicaValeArgenta.critical ? '#eab308' : '#ef4444';
      html += '<div style="font-size:13px;font-weight:600;color:' + corArgenta + ';margin-top:2px;">' + statusArgenta + '</div>';
      html += '</div>';

      // GERAL (horário atual menos o menor "Disponível em" da tela)
      var slaGeral = politicaGeral.critical;
      var alertaGeral = politicaGeral.attention;
      var statusGeral = tempoResumoGeral < alertaGeral ? '✅ OK' : tempoResumoGeral <= slaGeral ? '⚠️ Atenção' : '🚨 Crítico';
      var corGeral = tempoResumoGeral < alertaGeral ? '#22c55e' : tempoResumoGeral <= slaGeral ? '#eab308' : '#ef4444';

      html += '<div style="flex:1;background:#0f172a;border-radius:8px;padding:12px 8px;text-align:center;border:2px solid #1a3f2a;">';
      html += '<div style="font-size:14px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">GERAL</div>';
      html += '<div style="font-size:28px;font-weight:bold;color:#4ade80;">' + tempoResumoGeral + 'm</div>';
      html += '<div style="font-size:11px;color:#94a3b8;">SLA: ' + slaGeral + 'min</div>';
      html += '<div style="font-size:13px;font-weight:600;color:' + corGeral + ';margin-top:2px;">' + statusGeral + '</div>';
      html += '</div>';

      html += '</div>';

      // ========== REMOVIDO O RESUMO POR EMPRESA (Vale, Argenta, Outras) ==========
      // ========== REMOVIDA A CONTAGEM DE VEÍCULOS ==========

      html += '</div>';

      document.getElementById('resumo-sla-fadiga')?.remove();
      document.body.insertAdjacentHTML('beforeend', html);

      var btnPDFWhats = document.getElementById('btn-pdf-whats');
      if (btnPDFWhats) {
        btnPDFWhats.addEventListener('click', function(e) {
          e.stopPropagation();
          if (typeof window.SLAReportPrint !== 'undefined' && window.SLAReportPrint.gerarPDFeWhatsApp) {
            window.SLAReportPrint.gerarPDFeWhatsApp();
          } else {
            alert('Módulo de impressão não disponível.');
          }
        });
      }

      console.log('[SLA] Resumo SLA exibido com sucesso.');

    } catch (e) {
      console.error('[SLA] Erro ao gerar resumo:', e);
      alert('Erro ao gerar resumo SLA: ' + e.message);
    }
  }

  // ================================================================
  // FUNÇÃO PARA OBTER REGISTROS DA PÁGINA DE FADIGA
  // ================================================================
  function obterRegistrosDaPaginaFadiga(agora) {
    var registros = [];
    agora = agora || new Date();
    var rows = document.querySelectorAll('tbody tr');

    rows.forEach(function(tr) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 7) return;
      var placaTexto = cells[3]?.textContent?.trim() || '';
      var motorista = cells[4]?.textContent?.trim() || '';
      var disponivelStr = cells[6]?.textContent?.trim() || '';
      if (!disponivelStr) return;

      var m = disponivelStr.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);
      if (!m) return;

      var dataDisponivel = new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], 0);
      var minutos = Math.floor((agora - dataDisponivel) / 60000);

      if (minutos < 0) return;

      var placa = extrairPlaca(placaTexto);
      var vale = isVale(placa);
      var argent = isArgenta(motorista);

      registros.push({
        placa: placa,
        motorista: motorista,
        minutos: minutos,
        availableAt: dataDisponivel.getTime(),
        vale: vale,
        argent: argent
      });
    });

    return registros;
  }

  // ================================================================
  // FUNÇÕES AUXILIARES
  // ================================================================
  function isArgenta(motorista) {
    if (!motorista) return false;
    var m = motorista.trim();
    return m.includes('(Re') || m.includes('[Fr') || m.includes('{Q');
  }

  function isVale(placa) {
    if (!placa) return false;
    placa = placa.toUpperCase().trim();
    return placa.charAt(0) === 'C' && placa.length >= 2 && placa.charAt(1) >= 'A' && placa.charAt(1) <= 'Z';
  }

  function extrairPlaca(texto) {
    if (!texto) return '';
    var partes = texto.split(/\s+/);
    var placa = partes[0] || '';
    placa = placa.replace(/[\(\{\[][^\)\}\]]*[\)\}\]]$/, '').replace(/-\d+$/, '').trim();
    return placa;
  }

  function parseData(str) {
    if (!str) return null;
    var m = str.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], 0);
  }

  // ================================================================
  // EXPOR FUNÇÃO PARA O POPUP
  // ================================================================
  window.gerarResumoSLAAgora = gerarResumoSLAAgora;

  // ================================================================
  // INICIALIZAÇÃO
  // ================================================================
  if (isFadiga) {
    console.log('[SLA] Modo Fadiga: inicializando...');

    chrome.storage.local.get('gerarResumoAgora', function(data) {
      console.log('[SLA] Configuração:', data);

      if (data.gerarResumoAgora) {
        chrome.storage.local.remove('gerarResumoAgora');
        setTimeout(function() {
          gerarResumoSLAAgora();
        }, 500);
      }
    });

    chrome.storage.onChanged.addListener(function(changes, namespace) {
      if (namespace === 'local' &&
          changes.gerarResumoAgora &&
          changes.gerarResumoAgora.newValue === true) {
        console.log('[SLA] gerarResumoAgora detectado.');
        chrome.storage.local.remove('gerarResumoAgora');
        setTimeout(function() {
          gerarResumoSLAAgora();
        }, 500);
      }
    });
  }

  if (isAudit) {
    console.log('[SLA] Modo Auditoria: inicializando...');
    window.gerarRelatorioCompleto = function() {
      alert('Função de relatório completo em desenvolvimento.');
    };
  }

  console.log('[SLA] Script de relatórios inicializado.');
})();
