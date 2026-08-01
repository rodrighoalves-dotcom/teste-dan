// ============================================================
// SCRIPT INJETADO NA PÁGINA (MONITOR) - COM AÇÕES INICIAIS
// ============================================================

// Garantir que a função seja global
window.iniciarMonitorScript = function(intervalo, slaPolicy) {
  console.log('[SLA] Iniciando monitor com intervalo', intervalo, 's');

  var paginaFadiga = location.protocol === 'https:' &&
    location.hostname === 'www.goawakecloud.com.br' &&
    (
      location.pathname.includes('/fatigue') ||
      location.hash.includes('/pages/f/fatigue')
    );
  if (!paginaFadiga) {
    console.warn('[SLA] Monitor não iniciado: a paginação só é permitida na página de Fadiga.');
    return;
  }

  var politicaSLA = slaPolicy || {
    valeArgenta: { attention: 3, critical: 5 },
    general: { attention: 8, critical: 10 }
  };
  var politicaValeArgenta = politicaSLA.valeArgenta ||
    { attention: 3, critical: 5 };
  var politicaGeral = politicaSLA.general ||
    { attention: 8, critical: 10 };

  document.getElementById('goawake-sla-popup')?.remove();
  document.getElementById('goawake-alerta-argent')?.remove();
  document.getElementById('goawake-alerta-vale-argenta')?.remove();
  if (window._timer) clearInterval(window._timer);
  if (window._fadigaTableObserver) window._fadigaTableObserver.disconnect();
  clearTimeout(window._fadigaCycleDebounce);

  // ============================================================
  // AUTOMAÇÃO: FECHAMENTO DE ALERTA INVALIDADO
  // Gatilho real: clique no item <li> "Alerta invalidado"
  // Fluxo: OK -> FINALIZAR -> FINALIZAR -> OK
  // ============================================================
  (function instalarAutomacaoAlertaInvalidado() {
    if (window.__slaInvalidadoAutomationInstalled) return;
    window.__slaInvalidadoAutomationInstalled = true;

    var executando = false;
    var selecaoInvalidadoPendente = false;
    var bloqueadoAte = 0;

    function normalizar(texto) {
      return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    function visivel(el) {
      if (!el || !el.isConnected || el.disabled) return false;
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function clicar(el, etapa) {
      if (!visivel(el)) throw new Error('Elemento indisponível na etapa: ' + etapa);
      try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
      try { el.focus({ preventScroll: true }); } catch (_) {}
      el.click();
      console.log('[SLA][INVALIDADO] Clique executado:', etapa);
    }

    function localizarVisivel(seletor, textoEsperado) {
      var lista = Array.from(document.querySelectorAll(seletor));
      return lista.find(function(el) {
        if (!visivel(el)) return false;
        return !textoEsperado || normalizar(el.textContent) === normalizar(textoEsperado);
      }) || null;
    }

    function aguardarElemento(seletor, textoEsperado, timeoutMs) {
      timeoutMs = timeoutMs || 15000;
      return new Promise(function(resolve, reject) {
        var inicio = Date.now();
        var timer = setInterval(function() {
          var el = localizarVisivel(seletor, textoEsperado);
          if (el) {
            clearInterval(timer);
            resolve(el);
            return;
          }
          if (Date.now() - inicio >= timeoutMs) {
            clearInterval(timer);
            reject(new Error('Tempo esgotado aguardando: ' + seletor + ' / ' + (textoEsperado || '')));
          }
        }, 100);
      });
    }

    function aguardarDesaparecer(elemento, timeoutMs) {
      timeoutMs = timeoutMs || 8000;
      return new Promise(function(resolve) {
        var inicio = Date.now();
        var timer = setInterval(function() {
          if (!elemento || !elemento.isConnected || !visivel(elemento) || Date.now() - inicio >= timeoutMs) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    }

    function itemEhAlertaInvalidado(alvo) {
      if (!alvo || !alvo.closest) return false;
      var item = alvo.closest('li.ui-dropdown-item, li[role="option"]');
      if (!item) return false;
      return normalizar(item.textContent) === 'alerta invalidado';
    }

    async function executarFluxo() {
      if (executando || !selecaoInvalidadoPendente || Date.now() < bloqueadoAte) return;

      executando = true;
      selecaoInvalidadoPendente = false;
      bloqueadoAte = Date.now() + 3000;
      console.log('[SLA][INVALIDADO] Opção "Alerta invalidado" selecionada. Aguardando primeiro OK.');

      try {
        var primeiroOk = await aguardarElemento(
          'button.ajs-button.btn.btn-creare',
          'Ok',
          15000
        );
        clicar(primeiroOk, 'primeiro OK');
        await aguardarDesaparecer(primeiroOk, 8000);

        var primeiroFinalizar = await aguardarElemento(
          'button.btn.btn-error:not(.confirm-error-btn)',
          'Finalizar',
          15000
        );
        clicar(primeiroFinalizar, 'primeiro FINALIZAR');
        await aguardarDesaparecer(primeiroFinalizar, 8000);

        var segundoFinalizar = await aguardarElemento(
          'button.btn.btn-error.confirm-error-btn',
          'Finalizar',
          15000
        );
        clicar(segundoFinalizar, 'segundo FINALIZAR');
        await aguardarDesaparecer(segundoFinalizar, 8000);

        var ultimoOk = await aguardarElemento(
          'button.ajs-button.btn.btn-creare',
          'Ok',
          15000
        );
        clicar(ultimoOk, 'último OK');
        await aguardarDesaparecer(ultimoOk, 8000);

        bloqueadoAte = Date.now() + 8000;
        console.log('[SLA][INVALIDADO] ✅ Tratativa finalizada automaticamente.');
      } catch (erro) {
        bloqueadoAte = Date.now() + 2000;
        console.error('[SLA][INVALIDADO] Falha no fechamento automático:', erro);
      } finally {
        executando = false;
      }
    }

    // O PrimeNG renderiza as opções como <li>. O clique é capturado antes de o
    // Angular remover o menu, tornando este gatilho mais confiável que ler o select.
    document.addEventListener('click', function(evento) {
      if (!itemEhAlertaInvalidado(evento.target)) return;
      selecaoInvalidadoPendente = true;
      console.log('[SLA][INVALIDADO] Clique detectado no item da lista.');
      setTimeout(executarFluxo, 50);
    }, true);

    // Fallback: Enter/teclado em opção destacada.
    document.addEventListener('keydown', function(evento) {
      if (evento.key !== 'Enter') return;
      var item = document.querySelector('li.ui-dropdown-item.ui-state-highlight, li[role="option"][aria-selected="true"]');
      if (!item || normalizar(item.textContent) !== 'alerta invalidado') return;
      selecaoInvalidadoPendente = true;
      console.log('[SLA][INVALIDADO] Seleção por teclado detectada.');
      setTimeout(executarFluxo, 50);
    }, true);

    console.log('[SLA][INVALIDADO] Automação instalada. Gatilho: item da lista "Alerta invalidado".');
  })();

  // ================================================================
  // AÇÕES INICIAIS: ONLINE > ALTO RISCO > DISPONÍVEL EM (SETA PARA CIMA)
  // ================================================================
  window._monitorSessionId = (window._monitorSessionId || 0) + 1;
  var monitorSessionId = window._monitorSessionId;
  clearTimeout(window._acoesIniciaisTimeout);
  window._acoesIniciaisTimeout = setTimeout(function() {
    executarAcoesIniciais(monitorSessionId);
  }, 1500);

  function aguardar(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function sessaoAtiva(sessionId) {
    return window._monitorSessionId === sessionId;
  }

  function normalizarTexto(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function elementoVisivel(elemento) {
    if (!elemento) return false;
    if (elemento.matches && elemento.matches('input[type="checkbox"], input[type="radio"]')) {
      return true;
    }
    var estilo = window.getComputedStyle ? window.getComputedStyle(elemento) : null;
    if (estilo && (estilo.display === 'none' || estilo.visibility === 'hidden')) return false;
    return !elemento.getClientRects || elemento.getClientRects().length > 0;
  }

  function obterInputAssociado(elemento) {
    if (!elemento) return null;
    if (elemento.matches && elemento.matches('input[type="checkbox"], input[type="radio"]')) {
      return elemento;
    }

    var input = elemento.querySelector &&
      elemento.querySelector('input[type="checkbox"], input[type="radio"]');
    if (input) return input;

    var label = elemento.closest && elemento.closest('label');
    if (label) {
      input = label.querySelector('input[type="checkbox"], input[type="radio"]');
      if (input) return input;
      if (label.htmlFor) {
        input = document.getElementById(label.htmlFor);
        if (input && input.matches('input[type="checkbox"], input[type="radio"]')) return input;
      }
    }

    return null;
  }

  function controleJaSelecionado(elemento) {
    if (!elemento) return false;
    var input = obterInputAssociado(elemento);
    if (input) return input.checked;

    var valoresAtivos = [
      elemento.getAttribute && elemento.getAttribute('aria-pressed'),
      elemento.getAttribute && elemento.getAttribute('aria-selected'),
      elemento.getAttribute && elemento.getAttribute('aria-checked')
    ];
    if (valoresAtivos.some(function(valor) { return String(valor).toLowerCase() === 'true'; })) {
      return true;
    }

    var classes = String(elemento.className || '').toLowerCase();
    return /(^|\s)(active|selected|checked)(\s|$)/.test(classes);
  }

  function acionarControle(elemento, descricao) {
    if (!elemento) return false;

    var input = obterInputAssociado(elemento);
    if (input) {
      if (!input.checked) input.click();
      console.log('[SLA] "' + descricao + '" localizado por controle de seleção.');
      return true;
    }

    var clicavel = elemento.closest && elemento.closest(
      'button, a, label, [role="button"], nb-toggle, nb-checkbox, .toggle, .switch, .custom-control'
    );
    clicavel = clicavel || elemento;

    if (controleJaSelecionado(clicavel)) {
      console.log('[SLA] "' + descricao + '" já está selecionado.');
      return true;
    }

    if (typeof clicavel.click !== 'function') return false;
    clicavel.click();
    console.log('[SLA] "' + descricao + '" clicado em <' +
      String(clicavel.tagName || 'elemento').toLowerCase() + '>.');
    return true;
  }

  async function tentarAcao(acao, descricao, sessionId, maxTentativas) {
    for (var tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      if (!sessaoAtiva(sessionId)) return false;
      if (acao()) {
        console.log('[SLA] ' + descricao + ' concluído.');
        return true;
      }
      console.log('[SLA] Aguardando "' + descricao + '" (' + tentativa + '/' + maxTentativas + ')...');
      await aguardar(600);
    }
    return false;
  }

  async function executarAcoesIniciais(sessionId) {
    if (window._acoesIniciaisEmExecucao === sessionId || !sessaoAtiva(sessionId)) return;
    window._acoesIniciaisEmExecucao = sessionId;
    window._acoesIniciaisExecutadas = false;

    try {
      console.log('[SLA] Executando sequência: Online > Alto Risco > Disponível em crescente.');

      var onlineOk = await tentarAcao(clicarOnline, 'Online', sessionId, 12);
      if (!onlineOk) throw new Error('Botão Online não encontrado.');
      await aguardar(900);
      if (!sessaoAtiva(sessionId)) return;

      if (window._slaAltoRiscoAplicadoNestaPagina === true) {
        console.log('[SLA] Alto Risco já foi aplicado nesta página; clique não repetido.');
      } else {
        var altoRiscoOk = await tentarAcao(clicarAltoRisco, 'Alto Risco', sessionId, 12);
        if (!altoRiscoOk) throw new Error('Filtro Alto Risco não encontrado.');
        window._slaAltoRiscoAplicadoNestaPagina = true;
        await aguardar(1000);
        if (!sessaoAtiva(sessionId)) return;
      }

      var ordenacaoOk = await garantirDisponivelEmCrescente(sessionId);
      if (!ordenacaoOk) throw new Error('Não foi possível confirmar a seta para cima em Disponível em.');

      window._acoesIniciaisExecutadas = true;
      console.log('[SLA] ✅ Sequência inicial concluída: Online > Alto Risco (uma vez) > Disponível em ↑');
    } catch (error) {
      console.warn('[SLA] ⚠️ Sequência inicial incompleta:', error.message || error);
    } finally {
      if (window._acoesIniciaisEmExecucao === sessionId) {
        window._acoesIniciaisEmExecucao = null;
      }
    }
  }

  // ========== 1. SELECIONAR "ONLINE" ==========
  function clicarOnline() {
    var seletoresDiretos = [
      '[data-status="online"]',
      '[data-value="online"]',
      '[data-testid*="online" i]',
      '[aria-label*="online" i]',
      '[title*="online" i]',
      'input[value="online" i]',
      'input[name*="online" i]',
      'input[id*="online" i]',
      'button.status-online',
      'a.status-online',
      '.box-online-chart'
    ].join(',');

    var diretos = document.querySelectorAll(seletoresDiretos);
    for (var i = 0; i < diretos.length; i++) {
      if (elementoVisivel(diretos[i]) && acionarControle(diretos[i], 'Online')) return true;
    }

    var elementos = document.querySelectorAll(
      'button, a, label, [role="button"], nb-toggle, nb-checkbox, span, div, p, strong, small'
    );
    for (var j = 0; j < elementos.length; j++) {
      var texto = normalizarTexto(elementos[j].textContent);
      if (!/^ONLINE(?:\s+\d+)?$/.test(texto)) continue;
      if (!elementoVisivel(elementos[j])) continue;

      var filhoOnline = Array.prototype.some.call(elementos[j].children || [], function(filho) {
        return /^ONLINE(?:\s+\d+)?$/.test(normalizarTexto(filho.textContent));
      });
      if (filhoOnline) continue;

      if (acionarControle(elementos[j], 'Online')) return true;
    }

    return false;
  }

  // ========== 2. SELECIONAR FILTRO "ALTO RISCO" ==========
  function clicarAltoRisco() {
    var seletorDireto = [
      '.box-risk-chart i',
      '.box-risk-chart',
      '[data-risk="high"]',
      '[data-risk="alto"]',
      '[data-testid*="high-risk" i]',
      '[aria-label*="alto risco" i]',
      '[title*="alto risco" i]'
    ].join(',');
    var diretos = document.querySelectorAll(seletorDireto);
    for (var i = 0; i < diretos.length; i++) {
      if (elementoVisivel(diretos[i]) && acionarControle(diretos[i], 'Alto Risco')) return true;
    }

    var elementos = document.querySelectorAll(
      'button, a, label, [role="button"], nb-card, span, div, p, strong, i'
    );
    for (var j = 0; j < elementos.length; j++) {
      var texto = normalizarTexto(elementos[j].textContent);
      if (!texto.includes('ALTO RISCO') || texto.length > 80) continue;
      if (!elementoVisivel(elementos[j])) continue;
      if (acionarControle(elementos[j], 'Alto Risco')) return true;
    }

    var selects = document.querySelectorAll('select');
    for (var s = 0; s < selects.length; s++) {
      var options = selects[s].querySelectorAll('option');
      for (var o = 0; o < options.length; o++) {
        if (normalizarTexto(options[o].textContent).includes('ALTO RISCO')) {
          selects[s].value = options[o].value;
          selects[s].dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[SLA] "Alto Risco" selecionado em lista.');
          return true;
        }
      }
    }

    return false;
  }

  // ========== 3. GARANTIR "DISPONÍVEL EM" CRESCENTE ==========
  function encontrarCabecalhoDisponivelEm() {
    var cabecalhos = document.querySelectorAll('th, [role="columnheader"]');
    for (var i = 0; i < cabecalhos.length; i++) {
      if (normalizarTexto(cabecalhos[i].textContent).includes('DISPONIVEL EM')) {
        return cabecalhos[i];
      }
    }

    return document.querySelector(
      'th[ng-reflect-field="availableMediaAt"], th[field="availableMediaAt"], [data-field="availableMediaAt"]'
    );
  }

  function estaOrdenadoParaCima(cabecalho) {
    if (!cabecalho) return false;
    var ariaSort = String(cabecalho.getAttribute('aria-sort') || '').toLowerCase();
    if (ariaSort === 'ascending') return true;

    var icone = cabecalho.querySelector(
      'i.ui-sortable-column-icon, p-sorticon i, .p-sortable-column-icon, .sort-icon, i'
    );
    if (!icone) return false;

    var classes = String(icone.className || '').toLowerCase();
    return classes.includes('pi-sort-up') ||
      classes.includes('pi-sort-amount-up') ||
      classes.includes('pi-sort-asc') ||
      classes.includes('fa-sort-asc') ||
      classes.includes('sort-asc') ||
      classes.includes('sort-up') ||
      classes.includes('arrow-up');
  }

  async function garantirDisponivelEmCrescente(sessionId) {
    for (var tentativa = 1; tentativa <= 6; tentativa++) {
      if (!sessaoAtiva(sessionId)) return false;

      var cabecalho = encontrarCabecalhoDisponivelEm();
      if (!cabecalho) {
        await aguardar(600);
        continue;
      }

      if (estaOrdenadoParaCima(cabecalho)) {
        console.log('[SLA] "Disponível em" já está com a seta para cima.');
        return true;
      }

      console.log('[SLA] Ajustando "Disponível em" para crescente (' + tentativa + '/6)...');
      cabecalho.click();
      await aguardar(750);

      cabecalho = encontrarCabecalhoDisponivelEm();
      if (estaOrdenadoParaCima(cabecalho)) {
        console.log('[SLA] "Disponível em" confirmado com a seta para cima.');
        return true;
      }
    }

    return false;
  }

  // ================================================================
  // RESTANTE DO CÓDIGO (monitoramento SLA, alertas, etc.)
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

  function usaDeteccaoValeArgenta() {
    try {
      var helper = window.SLACompanyPreselection;
      if (!helper || typeof helper.detect !== 'function') return true;
      var selection = helper.detect(document);
      return typeof helper.usesPriorityCompanyDetection === 'function'
        ? helper.usesPriorityCompanyDetection(selection.code)
        : selection.code !== 'GENERAL';
    } catch (error) {
      console.warn('[SLA] Pré-seleção não pôde ser verificada; mantendo detecção padrão.', error);
      return true;
    }
  }

  function politicaParaRegistro(registro) {
    return registro && (registro.vale || registro.argent)
      ? politicaValeArgenta
      : politicaGeral;
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

  function encontrarTabelaFadiga() {
    var tables = Array.from(document.querySelectorAll('table'));
    return tables.find(function(table) {
      var headers = Array.from(table.querySelectorAll('thead th')).map(function(header) {
        return normalizarTexto(header.textContent);
      });
      return headers.some(function(text) { return text.includes('PLACA'); }) &&
        headers.some(function(text) { return text.includes('MOTORISTA'); }) &&
        headers.some(function(text) { return text.includes('DISPONIVEL EM'); });
    }) || null;
  }

  function obterRegistrosDaPaginaVisivel(permitirDeteccaoValeArgenta) {
    var registros = [];
    var agora = new Date();
    var table = encontrarTabelaFadiga();
    if (!table) return registros;
    var rows = table.querySelectorAll('tbody tr');
    rows.forEach(function(tr) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 7) return;
      var placaTexto = cells[3]?.textContent?.trim() || '';
      var motorista = cells[4]?.textContent?.trim() || '';
      var disponivelStr = cells[6]?.textContent?.trim() || '';
      if (!disponivelStr) return;

      var dataDisponivel = parseData(disponivelStr);
      if (!dataDisponivel) return;
      var minutos = Math.floor((agora - dataDisponivel) / 60000);
      if (minutos < 0) return;

      var placa = extrairPlaca(placaTexto);
      var vale = permitirDeteccaoValeArgenta && isVale(placa);
      var argent = permitirDeteccaoValeArgenta && isArgenta(motorista);

      registros.push({
        placa: placa,
        motorista: motorista,
        minutos: minutos,
        vale: vale,
        argent: argent,
        linhaRef: tr
      });
    });
    return registros;
  }

  function removerItemAlertaPrioritario(placa) {
    var alertaDiv = document.getElementById('goawake-alerta-argenta');
    if (!alertaDiv) return;
    var items = alertaDiv.querySelectorAll('.priority-item');
    items.forEach(function(item) {
      if (item.getAttribute('data-placa') === placa) {
        item.remove();
      }
    });
    var restantes = alertaDiv.querySelectorAll('.priority-item');
    if (restantes.length === 0) {
      alertaDiv.remove();
      delete window._registrosPrioritarios;
    }
  }

  function abrirTratativa(registro) {
    if (!registro) return;
    console.log('[SLA] Abrindo tratativa visível para:', registro.placa);
    abrirTratativaNaPagina(registro);
  }

  function abrirTratativaNaPagina(registro) {
    var linha = registro.linhaRef;
    if (!linha || !linha.parentNode) {
      var rows = document.querySelectorAll('tbody tr');
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].querySelectorAll('td');
        if (cells.length < 7) continue;
        var placaTexto = (cells[3]?.textContent || '').trim();
        var placa = extrairPlaca(placaTexto);
        if (placa === registro.placa) {
          linha = rows[r];
          break;
        }
      }
    }

    if (!linha || !linha.parentNode) {
      console.warn('[SLA] Linha não encontrada para:', registro.placa);
      alert('O alerta de ' + registro.placa + ' não está mais na página visível. A paginação não será alterada automaticamente.');
      return;
    }

    var botoes = linha.querySelectorAll('button, .btn-treatment, [class*="treatment"], a, [role="button"]');
    if (botoes.length > 0) {
      botoes[0].click();
      botoes[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      removerItemAlertaPrioritario(registro.placa);
      return;
    }
    var celulas = linha.querySelectorAll('td');
    if (celulas.length > 6) {
      celulas[6].click();
      celulas[6].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      removerItemAlertaPrioritario(registro.placa);
      return;
    }
    linha.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    removerItemAlertaPrioritario(registro.placa);
  }

  function mostrarPainelSLA(registros) {
    var atrasados = registros.filter(function(r) {
      var alerta = politicaParaRegistro(r).attention;
      return r.minutos >= alerta;
    }).map(function(r) {
      var slaLimite = politicaParaRegistro(r).critical;
      var status = r.minutos > slaLimite ? 'critico' : 'atencao';
      return { registro: r, minutos: r.minutos, slaLimite: slaLimite, status: status };
    }).sort(function(a, b) { return b.minutos - a.minutos; });

    var cor = '#10b981';
    var titulo = 'TUDO EM ORDEM!!!';
    if (atrasados.length > 0) {
      var crit = atrasados.filter(function(a) { return a.status === 'critico'; }).length;
      cor = crit > 0 ? '#dc2626' : '#eab308';
      titulo = crit > 0 ? 'SLA Crítico' : 'Atenção SLA';
    }

    var painelSignature = titulo + '|' + atrasados.map(function(item) {
      return [
        item.registro.placa,
        item.registro.motorista,
        item.minutos,
        item.status
      ].join(':');
    }).join('|');
    var painelAtual = document.getElementById('goawake-sla-popup');
    if (painelAtual && window._slaPainelSignature === painelSignature) return;
    if (painelAtual) painelAtual.remove();
    window._slaPainelSignature = painelSignature;

    var fontSize = (titulo === 'TUDO EM ORDEM!!!') ? '20px' : '12px';

    var html = '<div id="goawake-sla-popup" style="position:fixed;bottom:20px;left:20px;z-index:9999999;background:#1e293b;border-radius:8px;border:1px solid #334155;width:280px;max-height:400px;overflow:hidden;font-family:sans-serif;box-shadow:0 4px 15px rgba(0,0,0,0.5);">';
    html += '<div style="position:relative;padding:6px 10px;background:' + cor + ';color:white;border-radius:7px 7px 0 0;text-align:center;font-weight:bold;font-size:12px;">';
    html += '<span style="font-size:' + fontSize + ';">' + titulo + '</span>';
    html += '<button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:50%;right:8px;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:white;font-size:12px;cursor:pointer;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;">✕</button>';
    html += '</div>';

    if (atrasados.length > 0) {
      html += '<div style="max-height:280px;overflow-y:auto;padding:4px 8px;">';
      html += '<p style="font-size:10px;color:#94a3b8;margin:2px 0 6px 0;text-align:center;">Clique para abrir</p>';
      window._slaAtrasados = atrasados;
      for (var i = 0; i < Math.min(atrasados.length, 12); i++) {
        var item = atrasados[i];
        var r = item.registro;
        var bg = item.status === 'critico' ? '#450a0a' : '#3b2a0a';
        var borderColor = item.status === 'critico' ? '#ef4444' : '#eab308';
        var textColor = item.status === 'critico' ? '#fca5a5' : '#fcd34d';

        html += '<div class="sla-item" data-idx="' + i + '" style="background:' + bg + ';border-left:3px solid ' + borderColor + ';padding:4px 8px;margin-bottom:3px;border-radius:4px;cursor:pointer;transition:background 0.2s;display:flex;justify-content:space-between;align-items:center;font-size:11px;" onmouseover="this.style.background=\'#334155\'" onmouseout="this.style.background=\'' + bg + '\'">';
        html += '<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;">';
        html += '<div style="display:flex;align-items:center;gap:6px;">';
        html += '<span style="font-weight:bold;font-size:12px;color:#f1f5f9;">' + r.placa + '</span>';
        html += '<span style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + r.motorista + '</span>';
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:6px;font-size:10px;">';
        html += '<span style="color:' + textColor + ';font-weight:bold;">⏱️ ' + item.minutos + 'm</span>';
        html += '<span style="color:#64748b;">SLA: ' + item.slaLimite + 'm</span>';
        html += '</div>';
        html += '</div>';
        html += '<button class="sla-abrir-btn" data-idx="' + i + '" style="background:#fbbf24;color:#000;padding:2px 8px;border:none;border-radius:3px;font-size:10px;font-weight:bold;cursor:pointer;white-space:nowrap;">Abrir</button>';
        html += '</div>';
      }
      if (atrasados.length > 12) {
        html += '<p style="text-align:center;font-size:10px;color:#94a3b8;">...e mais ' + (atrasados.length - 12) + '</p>';
      }
      html += '</div>';
    } else {
      html += '<div style="padding:10px;text-align:center;color:#10b981;font-size:13px;">✅ Tudo ok</div>';
    }

    html += '</div>';
    document.body.insertAdjacentHTML('beforeend', html);

    var popupDiv = document.getElementById('goawake-sla-popup');
    if (popupDiv) {
      popupDiv.removeEventListener('click', window._slaClickHandler);
      window._slaClickHandler = function(e) {
        var item = e.target.closest('.sla-item');
        if (!item) return;
        var idx = parseInt(item.getAttribute('data-idx'));
        var list = window._slaAtrasados;
        if (list && list[idx]) {
          abrirTratativa(list[idx].registro);
        }
      };
      popupDiv.addEventListener('click', window._slaClickHandler);

      var botoesAbrir = popupDiv.querySelectorAll('.sla-abrir-btn');
      botoesAbrir.forEach(function(btn) {
        btn.removeEventListener('click', window._slaAbrirHandler);
        window._slaAbrirHandler = function(e) {
          e.stopPropagation();
          var idx = parseInt(this.getAttribute('data-idx'));
          var list = window._slaAtrasados;
          if (list && list[idx]) {
            abrirTratativa(list[idx].registro);
          }
        };
        btn.addEventListener('click', window._slaAbrirHandler);
      });
    }
  }

  function mostrarAlertaArgenta(registros) {
    document.getElementById('goawake-alerta-argent')?.remove();
    document.getElementById('goawake-alerta-vale-argenta')?.remove();
    document.getElementById('goawake-alerta-argenta')?.remove();
    if (registros.length === 0) return;

    window._registrosPrioritarios = registros;

    var html = '<div id="goawake-alerta-argenta" style="position:fixed;top:50%;right:24px;transform:translateY(-50%);z-index:9999999;background:#dc2626;color:white;border-radius:12px;box-shadow:0 10px 36px rgba(220,38,38,0.55);padding:16px 18px;font-family:sans-serif;width:380px;max-width:calc(100vw - 48px);animation:pulsar 1.5s infinite;">';
    html += '<style>@keyframes pulsar { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); } 70% { box-shadow: 0 0 0 12px rgba(220,38,38,0); } 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); } }</style>';
    html += '<div style="display:flex;justify-content:center;align-items:center;margin-bottom:10px;position:relative;min-height:28px;">';
    html += '<strong style="font-size:16px;text-align:center;letter-spacing:0.4px;">🚨 ARGENTA</strong>';
    html += '<button onclick="document.getElementById(\'goawake-alerta-argenta\').remove()" aria-label="Fechar alerta Argenta" style="position:absolute;top:0;right:0;background:rgba(255,255,255,0.28);border:1px solid rgba(255,255,255,0.55);color:white;font-size:16px;font-weight:bold;cursor:pointer;width:27px;height:27px;border-radius:50%;display:flex;align-items:center;justify-content:center;">X</button>';
    html += '</div>';
    html += '<div style="max-height:min(360px,calc(100vh - 180px));overflow-y:auto;font-size:12px;">';
    for (var i = 0; i < Math.min(registros.length, 8); i++) {
      var r = registros[i];
      html += '<div class="priority-item" data-placa="' + r.placa + '" data-idx="' + i + '" style="background:rgba(255,255,255,0.16);padding:10px 12px;margin-bottom:6px;border-radius:7px;display:flex;justify-content:space-between;align-items:center;gap:14px;">';
      html += '<strong style="font-size:15px;letter-spacing:0.5px;">' + r.placa + '</strong>';
      html += '<button type="button" class="priority-treat-button" data-idx="' + i + '" aria-label="Tratar agora o alerta da placa ' + r.placa + '" style="background:#facc15;color:#111827;padding:9px 14px;min-width:128px;border:2px solid #fff;border-radius:7px;font-size:12px;line-height:1.2;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 3px 9px rgba(0,0,0,0.28);">TRATAR AGORA</button>';
      html += '</div>';
    }
    if (registros.length > 8) html += '<p style="text-align:center;font-size:10px;">...e mais ' + (registros.length - 8) + '</p>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    var alertaDiv = document.getElementById('goawake-alerta-argenta');
    if (alertaDiv) {
      alertaDiv.removeEventListener('click', window._priorityClickHandler);
      window._priorityClickHandler = function(e) {
        var button = e.target.closest('.priority-treat-button');
        if (!button) return;
        e.preventDefault();
        e.stopPropagation();
        var idx = parseInt(button.getAttribute('data-idx'));
        var regs = window._registrosPrioritarios;
        if (regs && regs[idx]) {
          abrirTratativa(regs[idx]);
        }
      };
      alertaDiv.addEventListener('click', window._priorityClickHandler);
    }
  }

  var _coletando = false;

  function agendarCicloPorMudanca() {
    clearTimeout(window._fadigaCycleDebounce);
    window._fadigaCycleDebounce = setTimeout(ciclo, 100);
  }

  function conectarObservadorTabela() {
    var table = encontrarTabelaFadiga();
    var tbody = table && table.querySelector('tbody');
    if (!tbody || window._fadigaObservedTbody === tbody) return;
    if (window._fadigaTableObserver) window._fadigaTableObserver.disconnect();

    window._fadigaObservedTbody = tbody;
    window._fadigaTableObserver = new MutationObserver(agendarCicloPorMudanca);
    window._fadigaTableObserver.observe(tbody, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  async function ciclo() {
    if (_coletando) return;
    _coletando = true;
    try {
      conectarObservadorTabela();
      var permitirDeteccaoValeArgenta = usaDeteccaoValeArgenta();
      var todos = obterRegistrosDaPaginaVisivel(permitirDeteccaoValeArgenta);
      var registrosPainelSLA = todos.filter(function(r) {
        return !r.argent;
      });
      mostrarPainelSLA(registrosPainelSLA);
      var prioritarios = permitirDeteccaoValeArgenta
        ? todos.filter(function(r) {
            return r.argent &&
              r.minutos >= politicaValeArgenta.attention;
          })
        : [];
      mostrarAlertaArgenta(prioritarios);
    } catch (e) {
      console.error('[SLA] Erro no ciclo:', e);
    } finally {
      _coletando = false;
    }
  }

  window._timer = setInterval(ciclo, intervalo * 1000);
  window._slaMonitorActive = true;
  ciclo();
};

window.obterStatusMonitorScript = function() {
  return {
    active: window._slaMonitorActive === true && Boolean(window._timer),
    hasTimer: Boolean(window._timer)
  };
};

// ============================================================
// FUNÇÃO PARA PARAR O MONITOR
// ============================================================
window.pararMonitorScript = function() {
  window._slaMonitorActive = false;
  window._monitorSessionId = (window._monitorSessionId || 0) + 1;
  clearTimeout(window._acoesIniciaisTimeout);
  window._acoesIniciaisTimeout = null;
  if (window._timer) { clearInterval(window._timer); window._timer = null; }
  clearTimeout(window._fadigaCycleDebounce);
  if (window._fadigaTableObserver) {
    window._fadigaTableObserver.disconnect();
    window._fadigaTableObserver = null;
    window._fadigaObservedTbody = null;
  }
  document.getElementById('goawake-sla-popup')?.remove();
  document.getElementById('goawake-alerta-argent')?.remove();
  document.getElementById('goawake-alerta-vale-argenta')?.remove();
  document.getElementById('goawake-alerta-argenta')?.remove();
};
