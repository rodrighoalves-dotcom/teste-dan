(function (global) {
  'use strict';

  var utils = global.GoAwakeAuditUtils;

  function createProgress() {
    removeProgress();

    var panel = document.createElement('div');
    panel.id = 'goawake-dashboard-progress';
    panel.className = 'goawake-dashboard-progress';
    panel.innerHTML = [
      '<strong>Dashboard Gerencial</strong>',
      '<div id="goawake-dashboard-progress-text">Preparando coleta...</div>'
    ].join('');

    document.body.appendChild(panel);
  }

  function updateProgress(data) {
    var target = document.getElementById('goawake-dashboard-progress-text');
    if (!target) return;

    target.innerHTML = [
      'Coleta não invasiva: <b>a paginação não será alterada</b>',
      'Página visível: <b>' + data.page + '</b>',
      'Linhas examinadas: <b>' + data.examined + '</b>',
      'Auditorias únicas: <b>' + data.unique + '</b>',
      'Duplicadas exatas: <b>' + data.duplicateRows + '</b>',
      'Eventos repetidos: <b>' + (data.repeatedEvents || 0) + '</b>',
      'Conflitos de autor: <b>' + (data.conflicts || 0) + '</b>',
      'Operadores Moby: <b>' + data.authors + '</b>'
    ].join('<br>');
  }

  function removeProgress() {
    var current = document.getElementById('goawake-dashboard-progress');
    if (current) current.remove();
  }

  function toInputDate(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function toInputTime(date) {
    return String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0');
  }

  function formatPeriodDateTime(date) {
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear()
    ].join('/') + ' ' + toInputTime(date);
  }

  function showPeriodSelector() {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.id = 'goawake-dashboard-period';
      overlay.className = 'goawake-dashboard-overlay';

      var periodOptions = global.GoAwakeDashboardPeriod.presets.map(function (preset) {
        return '<option value="' + preset.days + '">' +
          utils.escapeHtml(preset.label) +
          '</option>';
      }).join('') + '<option value="custom">Período personalizado</option>';

      overlay.innerHTML = `
        <div class="goawake-dashboard-dialog">
          <h2>Dashboard Gerencial</h2>
          <p>Somente autores que contenham “Moby” serão considerados. A extensão consultará uma guia Audit exclusiva em segundo plano e percorrerá as páginas necessárias sem movimentar a Audit usada pela equipe.</p>

          <label>Período com base no dia atual</label>
          <select id="gd-period-days">${periodOptions}</select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
            <label style="display:flex;flex-direction:column;gap:5px;">Data inicial
              <input id="gd-period-start" type="date">
            </label>
            <label style="display:flex;flex-direction:column;gap:5px;">Data final
              <input id="gd-period-end" type="date">
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
            <label style="display:flex;flex-direction:column;gap:5px;">Horário inicial
              <input id="gd-period-start-time" type="time" step="60">
            </label>
            <label style="display:flex;flex-direction:column;gap:5px;">Horário final
              <input id="gd-period-end-time" type="time" step="60">
            </label>
          </div>
          <p id="gd-period-preview" class="goawake-period-preview"></p>

          <div class="goawake-dashboard-actions">
            <button id="gd-cancel" class="secondary">Cancelar</button>
            <button id="gd-run" class="primary">Gerar dashboard</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      var periodSelect = overlay.querySelector('#gd-period-days');
      var startInput = overlay.querySelector('#gd-period-start');
      var endInput = overlay.querySelector('#gd-period-end');
      var startTimeInput = overlay.querySelector('#gd-period-start-time');
      var endTimeInput = overlay.querySelector('#gd-period-end-time');
      var preview = overlay.querySelector('#gd-period-preview');

      function applyPreset() {
        if (periodSelect.value === 'custom') return;
        var period = global.GoAwakeDashboardPeriod.fromDays(Number(periodSelect.value), new Date());
        startInput.value = toInputDate(period.start);
        endInput.value = toInputDate(period.end);
        startTimeInput.value = '00:00';
        endTimeInput.value = toInputTime(period.end);
      }

      function readPeriod() {
        return global.GoAwakeDashboardPeriod.fromRange(
          startInput.value,
          endInput.value,
          new Date(),
          startTimeInput.value,
          endTimeInput.value
        );
      }

      function updatePreview() {
        try {
          var period = readPeriod();
          preview.style.color = '';
          preview.textContent = period.label + ': ' +
            utils.formatDateTime(period.start) + ' até ' +
            utils.formatDateTime(period.end) +
            '. A extensão aplicará esse intervalo na Audit oculta e validará pelo campo “Tratado em”.';
        } catch (error) {
          preview.style.color = '#dc2626';
          preview.textContent = error.message || String(error);
        }
      }

      periodSelect.addEventListener('change', function () {
        applyPreset();
        updatePreview();
      });
      [startInput, endInput, startTimeInput, endTimeInput].forEach(function (input) {
        input.addEventListener('change', function () {
          periodSelect.value = 'custom';
          updatePreview();
        });
      });
      applyPreset();
      updatePreview();

      overlay.querySelector('#gd-cancel').addEventListener('click', function () {
        overlay.remove();
        resolve(null);
      });

      overlay.querySelector('#gd-run').addEventListener('click', function () {
        try {
          var period = readPeriod();
          overlay.remove();
          resolve(period);
        } catch (error) {
          preview.style.color = '#dc2626';
          preview.textContent = error.message || String(error);
        }
      });
    });
  }

  function barRows(entries, maxValue) {
    return entries.map(function (entry) {
      var label = entry[0];
      var value = entry[1];
      var width = maxValue ? Math.max(2, (value / maxValue) * 100) : 0;

      return `
        <div class="goawake-bar-row">
          <span>${utils.escapeHtml(label)}</span>
          <div class="goawake-bar-track"><div class="goawake-bar-fill" style="width:${width}%"></div></div>
          <strong>${value}</strong>
        </div>
      `;
    }).join('');
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function rowsToCsv(rows) {
    return rows.map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n');
  }

  function exportSummaryCsv(data, period) {
    var rows = [
      ['Autor', 'Auditorias consolidadas', 'Eventos analisados', 'Conflitos de autoria', 'Durações calculáveis', 'Cobertura de duração %', 'Tratativas até 2 min', 'Tratativas de 2 a 5 min', 'Tratativas acima de 5 min', 'Sem duração calculável', 'Tempo médio', 'Percentual até 2 min']
    ];

    data.authors.forEach(function (a) {
      rows.push([
        a.author,
        a.uniqueAudits,
        a.totalEventsObserved,
        a.authorConflictAudits,
        a.validDurationAudits,
        a.timeCoverageRate.toFixed(2).replace('.', ',') + '%',
        a.ok,
        a.attention,
        a.critical,
        a.unknown,
        utils.formatMinutes(a.averageMinutes),
        a.slaComplianceRate.toFixed(2).replace('.', ',') + '%'
      ]);
    });

    var csv = rowsToCsv(rows);

    utils.downloadText(
      'resumo-gerencial-moby-' + period.key + '-' +
        period.end.toISOString().slice(0, 10) + '.csv',
      csv,
      'text/csv;charset=utf-8'
    );
  }

  function exportDetailedCsv(data, period) {
    var rows = [[
      'ID da Auditoria',
      'Autor',
      'Placa',
      'Motorista',
      'Disponível em',
      'Tratado em',
      'Tempo em minutos',
      'Tratativa',
      'Classificação',
      'Fonte',
      'Ocorrências do ID',
      'Conflito de autoria',
      'Autores observados'
    ]];

    data.records.forEach(function (r) {
      rows.push([
        r.auditId,
        r.author,
        r.plate,
        r.driver,
        r.availableAtText,
        r.treatedAtText,
        r.durationMinutes == null ? '' : r.durationMinutes,
        r.treatment,
        r.classification,
        r.source || '',
        r.occurrences || 1,
        r.hasAuthorConflict ? 'Sim' : 'Não',
        (r.authorsObserved || []).join(' | ')
      ]);
    });

    var csv = rowsToCsv(rows);

    utils.downloadText(
      'tratativas-detalhadas-moby-' + period.key + '-' +
        period.end.toISOString().slice(0, 10) + '.csv',
      csv,
      'text/csv;charset=utf-8'
    );
  }

  function showDashboard(data, period, collectionMeta) {
    var previous = document.getElementById('goawake-dashboard-root');
    if (previous) previous.remove();

    var maxAuthor = Math.max.apply(null, data.authors.map(function (a) { return a.uniqueAudits; }).concat([1]));
    var maxHour = Math.max.apply(null, data.byHour.map(function (e) { return e[1]; }).concat([1]));

    var authorRows = data.authors.map(function (a, index) {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${utils.escapeHtml(a.author)}</td>
          <td>${a.uniqueAudits}</td>
          <td>${a.totalEventsObserved}</td>
          <td>${a.authorConflictAudits}</td>
          <td>${a.validDurationAudits}</td>
          <td>${a.timeCoverageRate.toFixed(1).replace('.', ',')}%</td>
          <td>${a.ok}</td>
          <td>${a.attention}</td>
          <td>${a.critical}</td>
          <td>${a.unknown}</td>
          <td>${utils.formatMinutes(a.averageMinutes)}</td>
          <td>${a.slaComplianceRate.toFixed(1).replace('.', ',')}%</td>
        </tr>
      `;
    }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'goawake-dashboard-root';
    overlay.className = 'goawake-dashboard-root';

    var coverageText = collectionMeta.coverageStart && collectionMeta.coverageEnd
      ? utils.formatDateTime(collectionMeta.coverageStart) + ' até ' +
        utils.formatDateTime(collectionMeta.coverageEnd)
      : 'nenhum evento válido no período';
    var paginationText = collectionMeta.pagination && collectionMeta.pagination.label
      ? collectionMeta.pagination.label
      : 'página ' + ((collectionMeta.pagination && collectionMeta.pagination.currentPage) || 1);
    var hiddenAuditMode = collectionMeta.collectionMode === 'dedicated-hidden-audit-pagination';
    var auditExecutionText = collectionMeta.auditExecutionMode === 'minimized-window'
      ? 'uma janela separada e minimizada'
      : 'uma guia inativa de compatibilidade';
    var scopeSectionHtml = hiddenAuditMode
      ? `<section class="goawake-card goawake-scope-warning">
          <h2>Base e rastreabilidade da análise</h2>
          <p><strong>Consulta dedicada em segundo plano.</strong> Foram percorridas ${collectionMeta.pagesRead || 0} páginas da Audit em ${auditExecutionText}, sem alterar a paginação utilizada pela equipe.</p>
          <p><strong>Cobertura temporal identificada:</strong> ${utils.escapeHtml(coverageText)} ·
          <strong>Auditorias consolidadas no período:</strong> ${collectionMeta.localEventsInPeriod || 0} ·
          <strong>Linhas examinadas:</strong> ${collectionMeta.examinedRows || 0}.</p>
          <p><strong>Filtro do período na Audit:</strong>
          ${collectionMeta.auditPeriodFilter && collectionMeta.auditPeriodFilter.applied
            ? 'aplicado (' + utils.escapeHtml(collectionMeta.auditPeriodFilter.reason || 'confirmado') + ')'
            : 'não confirmado; o intervalo foi validado localmente pelo campo “Tratado em” (' +
              utils.escapeHtml((collectionMeta.auditPeriodFilter && collectionMeta.auditPeriodFilter.reason) || 'sem detalhes') + ')' }.</p>
          <p>${collectionMeta.pageLimitReached
            ? '<strong>Atenção:</strong> o limite de segurança de páginas foi alcançado; confira a cobertura antes de considerar o período completo.'
            : 'A coleta chegou ao fim da paginação disponível. Cada ID é contado uma vez, usando o evento mais recente em “Tratado em”.'}</p>
        </section>`
      : `<section class="goawake-card goawake-scope-warning">
          <h2>Base e rastreabilidade da análise</h2>
          <p><strong>Coleta sem paginação automática.</strong> O dashboard combina a página visível (${utils.escapeHtml(paginationText)}) com eventos já observados e armazenados localmente.</p>
          <p><strong>Cobertura temporal observada:</strong> ${utils.escapeHtml(coverageText)} ·
          <strong>Eventos locais no período:</strong> ${collectionMeta.localEventsInPeriod || 0} ·
          <strong>Linhas aceitas da página atual:</strong> ${(collectionMeta.diagnostics && collectionMeta.diagnostics.acceptedRows) || 0}.</p>
          <p>Os totais são precisos para essa base local, mas não representam páginas que nunca foram exibidas neste navegador. As durações são calculadas somente quando “Disponível em” e “Tratado em” são reconhecidos.</p>
        </section>`;
    var footerText = hiddenAuditMode
      ? `Audit dedicada: ${collectionMeta.pagesRead || 0} páginas percorridas ·
          Linhas examinadas: ${collectionMeta.examinedRows || 0} ·
          Duplicadas exatas removidas: ${collectionMeta.duplicateRows || 0} ·
          Regra canônica: ID único com evento mais recente em “Tratado em”`
      : `Coleta sem paginação: página atual + histórico local ·
          Linhas examinadas agora: ${collectionMeta.examinedRows} ·
          Duplicadas exatas removidas: ${collectionMeta.duplicateRows} ·
          Eventos locais no período: ${collectionMeta.liveStoredEvents || 0} ·
          Regra canônica: ID único com evento mais recente em “Tratado em”`;
    var qualityNote = hiddenAuditMode
      ? 'A produção principal conta uma auditoria por ID. Quando o mesmo ID aparece mais de uma vez, prevalece o evento com “Tratado em” mais recente. Os CSVs permitem conferir os registros que formaram este resultado.'
      : 'A produção principal conta uma auditoria por ID. Quando o mesmo ID aparece mais de uma vez, prevalece o evento com “Tratado em” mais recente. O histórico bruto permanece armazenado para conferência.';

    overlay.innerHTML = `
      <div class="goawake-dashboard-shell">
        <header class="goawake-dashboard-header">
          <div>
            <h1>Goawake SLA Monitor</h1>
            <p><strong>Relatório Gerencial de Produtividade Operacional</strong> · Período analisado: ${formatPeriodDateTime(period.start)} a ${formatPeriodDateTime(period.end)}</p>
          </div>
          <button id="gd-close">×</button>
        </header>

        <section class="goawake-kpis">
          <article><span>Auditorias consolidadas</span><strong>${data.summary.uniqueAudits}</strong></article>
          <article><span>Eventos analisados</span><strong>${data.summary.observedEvents}</strong></article>
          <article><span>Operadores identificados</span><strong>${data.summary.operators}</strong></article>
          <article><span>Tempo médio por tratativa</span><strong>${utils.formatMinutes(data.summary.averageMinutes)}</strong></article>
          <article><span>Tratativas em até 2 min</span><strong>${data.summary.ok}</strong></article>
          <article><span>Percentual em até 2 min</span><strong>${data.summary.slaComplianceRate.toFixed(1).replace('.', ',')}%</strong></article>
          <article><span>Cobertura de duração</span><strong>${data.summary.timeCoverageRate.toFixed(1).replace('.', ',')}%</strong></article>
          <article><span>Integridade dos dados</span><strong>${data.summary.qualityScore.toFixed(1).replace('.', ',')}%</strong></article>
        </section>

        <section class="goawake-card goawake-quality-card">
          <h2>Legenda dos indicadores</h2>
          <p><strong>Auditorias consolidadas:</strong> cada ID é contado uma vez, considerando a tratativa mais recente. ·
          <strong>Duração:</strong> diferença entre “Disponível em” e “Tratado em”. ·
          <strong>Faixas:</strong> até 2 minutos, acima de 2 até 5 minutos e acima de 5 minutos. ·
          <strong>Sem duração calculável:</strong> horário ausente, inválido ou incompatível.</p>
        </section>

        ${scopeSectionHtml}

        <section class="goawake-dashboard-grid">
          <article class="goawake-card">
            <h2>Ranking por auditorias únicas</h2>
            ${barRows(data.authors.slice(0, 12).map(function (a) { return [a.author, a.uniqueAudits]; }), maxAuthor)}
          </article>

          <article class="goawake-card">
            <h2>Produção por hora</h2>
            ${barRows(data.byHour, maxHour)}
          </article>
        </section>

        <section class="goawake-card">
          <div class="goawake-card-title-row">
            <h2>Resumo por operador</h2>
            <div>
              <button id="gd-export-summary">CSV resumido</button>
              <button id="gd-export-detail">CSV detalhado</button>
              <button id="gd-print">Baixar PDF</button>
              ${hiddenAuditMode ? '' : '<button id="gd-clear-history" class="danger">Limpar histórico local</button>'}
            </div>
          </div>

          <div class="goawake-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Operador</th>
                  <th>Auditorias</th>
                  <th>Eventos</th>
                  <th>Conflitos</th>
                  <th>Durações calculáveis</th>
                  <th>Cobertura</th>
                  <th>Até 2 min</th>
                  <th>2 a 5 min</th>
                  <th>Acima de 5 min</th>
                  <th>Sem cálculo</th>
                  <th>Tempo médio</th>
                  <th>% até 2 min</th>
                </tr>
              </thead>
              <tbody>${authorRows}</tbody>
            </table>
          </div>
        </section>

        <section class="goawake-card goawake-quality-card">
          <h2>Integridade e consistência dos dados</h2>
          <p><strong>Índice de integridade:</strong> ${data.summary.qualityScore.toFixed(1).replace('.', ',')}% ·
          <strong>Durações calculáveis:</strong> ${data.summary.validDurationAudits}/${data.summary.uniqueAudits} ·
          <strong>Eventos repetidos do mesmo ID:</strong> ${data.summary.repeatedAuditEvents} ·
          <strong>IDs com autores diferentes:</strong> ${data.summary.conflictingAuthorAudits} ·
          <strong>Registros sem duração calculável:</strong> ${data.summary.unknown}</p>
          <p class="goawake-quality-note">${qualityNote}</p>
        </section>

        <footer class="goawake-dashboard-footer">
          <strong>DAVES TECH</strong> · Tecnologia aplicada à eficiência operacional<br>
          ${footerText}
        </footer>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#gd-close').addEventListener('click', function () {
      overlay.remove();
    });

    overlay.querySelector('#gd-export-summary').addEventListener('click', function () {
      exportSummaryCsv(data, period);
    });

    overlay.querySelector('#gd-export-detail').addEventListener('click', function () {
      exportDetailedCsv(data, period);
    });

    overlay.querySelector('#gd-print').addEventListener('click', function () {
      if (!global.GoAwakeDashboardPdf) {
        alert('O gerador de PDF não foi carregado. Feche o Dashboard e tente novamente.');
        return;
      }
      global.GoAwakeDashboardPdf.download(data, period, collectionMeta);
    });

    var clearHistoryButton = overlay.querySelector('#gd-clear-history');
    if (clearHistoryButton && global.GoAwakeAuditEventStore) {
      clearHistoryButton.addEventListener('click', async function () {
        var confirmed = confirm(
          'Apagar todos os eventos de auditoria armazenados localmente por esta extensão?'
        );
        if (!confirmed) return;

        await global.GoAwakeAuditEventStore.clear();
        alert('Histórico local apagado. Os dados exibidos neste dashboard permanecem até ele ser fechado.');
      });
    }
  }

  global.GoAwakeDashboardView = {
    createProgress: createProgress,
    updateProgress: updateProgress,
    removeProgress: removeProgress,
    showPeriodSelector: showPeriodSelector,
    showDashboard: showDashboard
  };
})(window);
