// ============================================================
// SCRIPT INJETADO NA PÁGINA (MONITOR) - COM AÇÕES INICIAIS
// ============================================================
function iniciarMonitorScript(intervalo) {
  console.log('[SLA] Iniciando monitor com intervalo', intervalo, 's');

  document.getElementById('goawake-sla-popup')?.remove();
  document.getElementById('goawake-alerta-argent')?.remove();
  if (window._timer) clearInterval(window._timer);

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
  // AÇÕES INICIAIS (executadas apenas uma vez)
  // ================================================================
  if (!window._acoesIniciaisExecutadas) {
    console.log('[SLA] Executando ações iniciais...');
    setTimeout(function() {
      executarAcoesIniciais();
    }, 2000);
  } else {
    console.log('[SLA] Ações iniciais já foram executadas anteriormente.');
  }

  // ================================================================
  // FUNÇÃO PARA EXECUTAR AÇÕES INICIAIS (COM RETRY)
  // ================================================================
  function executarAcoesIniciais() {
    var tentativas = 0;
    var maxTentativas = 10;

    function tentar() {
      tentativas++;
      console.log('[SLA] Tentativa ' + tentativas + ' de ' + maxTentativas);

      var ok1 = clicarAltoRisco();
      var ok2 = clicarOffline();
      var ok3 = clicarDisponivelEm();

      if (ok1 && ok2 && ok3) {
        window._acoesIniciaisExecutadas = true;
        console.log('[SLA] ✅ Todas as ações iniciais executadas com sucesso!');
        return;
      }

      if (tentativas >= maxTentativas) {
        console.warn('[SLA] ⚠️ Ações iniciais não completadas após ' + maxTentativas + ' tentativas.');
        window._acoesIniciaisExecutadas = true;
      } else {
        setTimeout(tentar, 1500);
      }
    }

    // ========== 1. SELECIONAR FILTRO "ALTO RISCO" ==========
    function clicarAltoRisco() {
      var seletor = "body > ngx-app > ngx-pages > ngx-sample-layout > nb-layout > div > div > div > div > div > nb-layout-column > filters-outlet > ngx-fatigue-v2 > div > div > div:nth-child(1) > div > div > div:nth-child(1) > nb-card > nb-card-body > div > div.box-risk-chart > i";
      var elemento = document.querySelector(seletor);
      if (elemento) {
        console.log('[SLA] Elemento "Alto Risco" encontrado pelo seletor específico.');
        elemento.click();
        elemento.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        console.log('[SLA] Ícone "Alto Risco" clicado.');
        return true;
      }

      // Fallback: procurar por texto
      var elementos = document.querySelectorAll('button, a, span, div, label, i');
      for (var i = 0; i < elementos.length; i++) {
        var txt = elementos[i].textContent.trim().toUpperCase();
        if (txt.includes('ALTO RISCO') || (txt.includes('ALTO') && txt.includes('RISCO'))) {
          elementos[i].click();
          elementos[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
          console.log('[SLA] "Alto Risco" clicado por texto (fallback).');
          return true;
        }
      }

      // Fallback: select
      var selects = document.querySelectorAll('select');
      for (var j = 0; j < selects.length; j++) {
        var options = selects[j].querySelectorAll('option');
        for (var k = 0; k < options.length; k++) {
          var txtOpt = options[k].textContent.trim().toUpperCase();
          if (txtOpt.includes('ALTO RISCO')) {
            selects[j].value = options[k].value;
            selects[j].dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[SLA] Select "Alto Risco" selecionado (fallback).');
            return true;
          }
        }
      }

      console.warn('[SLA] "Alto Risco" não encontrado.');
      return false;
    }

    // ========== 2. ATIVAR TOGGLE "OFFLINE" ==========
    function clicarOffline() {
      var elementos = document.querySelectorAll('button, a, span, div, label');
      for (var i = 0; i < elementos.length; i++) {
        var txt = elementos[i].textContent.trim();
        if (txt === 'Offline' || txt === 'OFFLINE' || txt.includes('offline')) {
          var input = elementos[i].querySelector('input[type="checkbox"]') ||
                      elementos[i].closest('label')?.querySelector('input[type="checkbox"]');
          if (input) {
            if (!input.checked) {
              input.click();
              input.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('[SLA] Toggle "Offline" ativado.');
            } else {
              console.log('[SLA] "Offline" já está ativo.');
            }
            return true;
          } else {
            if (elementos[i].click) {
              elementos[i].click();
              elementos[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
              console.log('[SLA] Botão "Offline" clicado.');
              return true;
            }
          }
        }
      }
      var btn = document.querySelector('.offline, .status-offline, [data-status="offline"]');
      if (btn) {
        btn.click();
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        console.log('[SLA] "Offline" clicado (fallback).');
        return true;
      }
      console.warn('[SLA] "Offline" não encontrado.');
      return false;
    }

    // ========== 3. ORDENAR POR "DISPONÍVEL EM" EM SORT UP ==========
    function clicarDisponivelEm() {
      function localizarIcone() {
        var thPorCampo = document.querySelector(
          'th[ng-reflect-field="availableMediaAt"], th[field="availableMediaAt"]'
        );

        if (thPorCampo) {
          var iconePorCampo = thPorCampo.querySelector('i.ui-sortable-column-icon');
          if (iconePorCampo) return iconePorCampo;
        }

        var cabecalhos = document.querySelectorAll(
          'th, .ui-sortable-column, [role="columnheader"]'
        );

        for (var i = 0; i < cabecalhos.length; i++) {
          var texto = (cabecalhos[i].textContent || '').trim().toUpperCase();

          if (texto.includes('DISPONÍVEL EM') || texto.includes('DISPONIVEL EM')) {
            var iconePorTexto = cabecalhos[i].querySelector(
              'i.ui-sortable-column-icon'
            );

            if (iconePorTexto) return iconePorTexto;
          }
        }

        return null;
      }

      function confirmarSortUp(tentativa) {
        var iconeAtual = localizarIcone();

        if (!iconeAtual) {
          console.warn('[SLA] Ícone de ordenação "Disponível em" não encontrado.');
          return;
        }

        if (iconeAtual.classList.contains('pi-sort-up')) {
          console.log('[SLA] "Disponível em" confirmado em SORT UP.');
          window._disponivelEmSortUp = true;
          return;
        }

        if (tentativa >= 3) {
          console.warn('[SLA] Não foi possível configurar "Disponível em" em SORT UP.');
          return;
        }

        console.log('[SLA] Ajustando "Disponível em" para SORT UP. Tentativa ' + (tentativa + 1));

        // Um único clique real. Não combinar click() com dispatchEvent,
        // pois isso pode gerar dois cliques e inverter a ordenação novamente.
        iconeAtual.click();

        setTimeout(function() {
          confirmarSortUp(tentativa + 1);
        }, 500);
      }

      var icone = localizarIcone();

      if (!icone) {
        console.warn('[SLA] "Disponível em" não encontrado.');
        return false;
      }

      if (icone.classList.contains('pi-sort-up')) {
        console.log('[SLA] "Disponível em" já está em SORT UP.');
        window._disponivelEmSortUp = true;
        return true;
      }

      confirmarSortUp(0);
      return true;
    }

    tentar();
  }

  // ================================================================
  // RESTANTE DO CÓDIGO (monitoramento SLA, alertas, etc.)
  // ================================================================
  const SLA_ALERTA = 3;
  const SLA_CRITICO = 5;

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

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function obterPaginaAtual() {
    var current = document.querySelector('.ui-paginator-current');
    if (current) {
      var texto = current.textContent || '';
      var match = texto.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    var ativo = document.querySelector('.ui-paginator-page.ui-state-active');
    if (ativo) {
      var num = ativo.textContent.trim();
      if (num) return parseInt(num);
    }
    return 1;
  }

  function navegarParaPagina(numero) {
    var links = document.querySelectorAll('.ui-paginator-page');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var txt = link.textContent.trim();
      if (parseInt(txt) === numero) {
        link.click();
        return true;
      }
    }
    var atual = obterPaginaAtual();
    while (atual < numero) {
      var next = document.querySelector('.ui-paginator-next:not(.ui-state-disabled)');
      if (!next) break;
      next.click();
      atual++;
      return false;
    }
    while (atual > numero) {
      var prev = document.querySelector('.ui-paginator-prev:not(.ui-state-disabled)');
      if (!prev) break;
      prev.click();
      atual--;
      return false;
    }
    return true;
  }

  function obterRegistrosDaPagina(paginaNum) {
    var registros = [];
    var agora = new Date();
    var rows = document.querySelectorAll('tbody tr');
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
      var vale = isVale(placa);
      var argent = isArgenta(motorista);

      registros.push({
        placa: placa,
        motorista: motorista,
        minutos: minutos,
        vale: vale,
        argent: argent,
        linhaRef: tr,
        pagina: paginaNum
      });
    });
    return registros;
  }

  async function coletarTodasPaginas() {
    var todosRegistros = [];
    var paginaAtual = obterPaginaAtual();
    var paginaOriginal = paginaAtual;
    var maxPaginas = 50;
    var pagina = 1;

    var firstBtn = document.querySelector('a.ui-paginator-first:not(.ui-state-disabled)');
    if (firstBtn) {
      firstBtn.click();
      await sleep(1200);
    }

    while (pagina <= maxPaginas) {
      var regs = obterRegistrosDaPagina(pagina);
      todosRegistros = todosRegistros.concat(regs);

      var nextBtn = document.querySelector('a.ui-paginator-next:not(.ui-state-disabled)');
      if (!nextBtn) break;

      nextBtn.click();
      await sleep(800);
      pagina++;
    }

    navegarParaPagina(paginaOriginal);
    await sleep(800);

    return todosRegistros;
  }

  function removerItemAlertaArgenta(placa) {
    var alertaDiv = document.getElementById('goawake-alerta-argent');
    if (!alertaDiv) return;
    var items = alertaDiv.querySelectorAll('.argent-item');
    items.forEach(function(item) {
      if (item.getAttribute('data-placa') === placa) {
        item.remove();
      }
    });
    var restantes = alertaDiv.querySelectorAll('.argent-item');
    if (restantes.length === 0) {
      alertaDiv.remove();
      delete window._registrosArgenta;
    }
  }

  function abrirTratativa(registro) {
    if (!registro) return;
    console.log('[SLA] Abrindo tratativa para:', registro.placa, 'na página', registro.pagina);

    var paginaAtual = obterPaginaAtual();
    if (paginaAtual !== registro.pagina) {
      navegarParaPagina(registro.pagina);
      setTimeout(function() {
        abrirTratativaNaPagina(registro);
      }, 800);
    } else {
      abrirTratativaNaPagina(registro);
    }
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
      return;
    }

    var botoes = linha.querySelectorAll('button, .btn-treatment, [class*="treatment"], a, [role="button"]');
    if (botoes.length > 0) {
      botoes[0].click();
      botoes[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      removerItemAlertaArgenta(registro.placa);
      return;
    }
    var celulas = linha.querySelectorAll('td');
    if (celulas.length > 6) {
      celulas[6].click();
      celulas[6].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      removerItemAlertaArgenta(registro.placa);
      return;
    }
    linha.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    removerItemAlertaArgenta(registro.placa);
  }

  function mostrarPainelSLA(registros) {
    document.getElementById('goawake-sla-popup')?.remove();

    var atrasados = registros.filter(function(r) {
      var alerta = r.vale ? 3 : 8;
      return r.minutos >= alerta;
    }).map(function(r) {
      var slaLimite = r.vale ? 5 : 10;
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
    if (registros.length === 0) return;

    window._registrosArgenta = registros;

    var html = '<div id="goawake-alerta-argent" style="position:fixed;top:20px;right:20px;z-index:9999999;background:#dc2626;color:white;border-radius:10px;box-shadow:0 8px 30px rgba(220,38,38,0.5);padding:12px 16px;font-family:sans-serif;max-width:300px;animation:pulsar 1.5s infinite;">';
    html += '<style>@keyframes pulsar { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); } 70% { box-shadow: 0 0 0 12px rgba(220,38,38,0); } 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); } }</style>';
    html += '<div style="display:flex;justify-content:center;align-items:center;margin-bottom:6px;position:relative;">';
    html += '<strong style="font-size:14px;text-align:center;">🚨 ARGENTA</strong>';
    html += '<button onclick="document.getElementById(\'goawake-alerta-argent\').remove()" style="position:absolute;top:0;right:0;background:rgba(255,255,255,0.3);border:none;color:white;font-size:14px;cursor:pointer;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;">X</button>';
    html += '</div>';
    html += '<div style="text-align:center;background:#fbbf24;color:#000;padding:3px 10px;border-radius:4px;font-weight:bold;font-size:11px;margin-bottom:8px;">TRATAR AGORA!</div>';
    html += '<div style="max-height:180px;overflow-y:auto;font-size:11px;">';
    for (var i = 0; i < Math.min(registros.length, 8); i++) {
      var r = registros[i];
      var slaLimite = r.vale ? 5 : 10;
      html += '<div class="argent-item" data-placa="' + r.placa + '" data-idx="' + i + '" style="background:rgba(255,255,255,0.15);padding:4px 8px;margin-bottom:3px;border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onmouseover="this.style.background=\'rgba(255,255,255,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">';
      html += '<div><strong>' + r.placa + '</strong> <span style="font-size:10px;">' + r.motorista + '</span></div>';
      html += '<div style="text-align:right;"><span style="font-weight:bold;">' + r.minutos + 'm</span> <span style="font-size:9px;color:#fca5a5;">SLA:' + slaLimite + 'm</span></div>';
      html += '</div>';
    }
    if (registros.length > 8) html += '<p style="text-align:center;font-size:10px;">...e mais ' + (registros.length - 8) + '</p>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    var alertaDiv = document.getElementById('goawake-alerta-argent');
    if (alertaDiv) {
      alertaDiv.removeEventListener('click', window._argentClickHandler);
      window._argentClickHandler = function(e) {
        var item = e.target.closest('.argent-item');
        if (!item) return;
        var idx = parseInt(item.getAttribute('data-idx'));
        var regs = window._registrosArgenta;
        if (regs && regs[idx]) {
          abrirTratativa(regs[idx]);
        }
      };
      alertaDiv.addEventListener('click', window._argentClickHandler);
    }
  }

  var _coletando = false;

  async function ciclo() {
    if (_coletando) return;
    _coletando = true;
    try {
      var todos = await coletarTodasPaginas();
      mostrarPainelSLA(todos);
      var argentas = todos.filter(function(r) { return r.argent; });
      mostrarAlertaArgenta(argentas);
    } catch (e) {
      console.error('[SLA] Erro no ciclo:', e);
    } finally {
      _coletando = false;
    }
  }

  window._timer = setInterval(ciclo, intervalo * 1000);
  ciclo();
}

function pararMonitorScript() {
  if (window._timer) { clearInterval(window._timer); window._timer = null; }
  document.getElementById('goawake-sla-popup')?.remove();
  document.getElementById('goawake-alerta-argent')?.remove();
}


function obterStatusMonitorScript() {
  return {
    active: Boolean(window._timer),
    invalidadoAutomation: Boolean(window.__slaInvalidadoAutomationInstalled)
  };
}

window.iniciarMonitorScript = iniciarMonitorScript;
window.pararMonitorScript = pararMonitorScript;
window.obterStatusMonitorScript = obterStatusMonitorScript;
