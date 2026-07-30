(function (global) {
  'use strict';

  if (global.__slaReportRuntimeV2Installed) return;
  global.__slaReportRuntimeV2Installed = true;

  function isFatiguePage() {
    return location.hostname === 'www.goawakecloud.com.br' &&
      (location.pathname.includes('/fatigue') || location.hash.includes('/pages/f/fatigue'));
  }

  function parseAvailable(value) {
    var match = String(value || '').match(
      /(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (!match) return null;
    var date = new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function plateFrom(value) {
    return String(value || '').trim().split(/\s+/)[0].toUpperCase();
  }

  function companyFrom(plate, driver) {
    var isArgenta = String(driver || '').includes('(Re') ||
      String(driver || '').includes('[Fr') ||
      String(driver || '').includes('{Q');
    var isVale = /^C[A-Z]/.test(plate);
    var isLiberia = /^[A-Z]{4}-\d{2}$/.test(plate);
    if (isArgenta) return 'Argenta';
    if (isVale) return 'Vale';
    if (isLiberia) return 'Libéria';
    return 'Outras';
  }

  function collectVisibleRows(now, selectionCode) {
    var records = [];
    Array.from(document.querySelectorAll('tbody tr')).forEach(function (row) {
      var cells = row.querySelectorAll('td');
      if (cells.length < 7) return;
      var availableAt = parseAvailable(cells[6] && cells[6].textContent);
      if (!availableAt || availableAt > now) return;
      var plate = plateFrom(cells[3] && cells[3].textContent);
      var driver = String(cells[4] && cells[4].textContent || '').trim();
      records.push({
        plate: plate,
        driver: driver,
        company: SLACompanyPreselection.resolveDetectedCompany(
          selectionCode,
          companyFrom(plate, driver)
        ),
        availableAt: availableAt.getTime()
      });
    });
    return records;
  }

  function bucketDefinitions(selection) {
    if (selection.code === 'GENERAL') {
      return [{ key: 'GENERAL', label: 'GERAL', companies: null }];
    }
    if (selection.code === 'VOR_ARG') {
      return [
        { key: 'VALE', label: 'VALE', companies: ['Vale'] },
        { key: 'ARGENTA', label: 'ARGENTA', companies: ['Argenta'] }
      ];
    }
    if (selection.code === 'LIBERIA') {
      return [{ key: 'LIBERIA', label: 'LIBÉRIA', companies: ['Libéria'] }];
    }
    if (selection.code === 'VALE') {
      return [{ key: 'VALE', label: 'VALE', companies: ['Vale'] }];
    }
    if (selection.code === 'ARGENTA') {
      return [{ key: 'ARGENTA', label: 'ARGENTA', companies: ['Argenta'] }];
    }
    return [];
  }

  function policyForBucket(bucket) {
    return bucket.key === 'VALE' || bucket.key === 'ARGENTA'
      ? SLA_CONFIG.sla.operational.valeArgenta
      : SLA_CONFIG.sla.operational.general;
  }

  function statusFor(minutes, hasData, policy) {
    if (!hasData) return { label: 'SEM DADOS', color: '#64748b' };
    if (minutes < policy.attention) {
      return { label: '✅ OK', color: '#22c55e' };
    }
    if (minutes <= policy.critical) {
      return { label: '⚠️ ATENÇÃO', color: '#eab308' };
    }
    return { label: '🚨 CRÍTICO', color: '#ef4444' };
  }

  function cardHtml(bucket, records, now) {
    var policy = policyForBucket(bucket);
    var selectedRecords = bucket.companies
      ? records.filter(function (record) {
          return bucket.companies.includes(record.company);
        })
      : records;
    var calculation = SLASummaryCalculator.fromAvailableTimes(
      selectedRecords.map(function (record) { return record.availableAt; }),
      now
    );
    var status = statusFor(
      calculation.elapsedMinutes,
      calculation.validRows > 0,
      policy
    );
    var time = calculation.validRows ? calculation.elapsedMinutes + 'm' : '—';

    return '<div style="flex:1;min-width:130px;background:#0f172a;border-radius:8px;padding:14px 10px;text-align:center;border:2px solid #334155;">' +
      '<div style="font-size:14px;font-weight:700;color:#e2e8f0;">' + bucket.label + '</div>' +
      '<div style="font-size:30px;font-weight:bold;color:#60a5fa;margin:4px 0;">' + time + '</div>' +
      '<div style="font-size:11px;color:#94a3b8;">SLA: ' + policy.critical +
      'min · ' + calculation.validRows + ' registros</div>' +
      '<div style="font-size:13px;font-weight:700;color:' + status.color + ';margin-top:4px;">' + status.label + '</div>' +
      '</div>';
  }

  async function generateSummaryNow() {
    if (!isFatiguePage()) {
      alert('O Resumo SLA deve ser gerado na página Fadiga.');
      return;
    }

    var selection = SLACompanyPreselection.detect(document);
    if (selection.code === 'UNKNOWN') {
      alert('Não foi possível identificar a pré-seleção de empresas no canto inferior direito. O resumo não foi gerado para evitar dados incorretos.');
      return;
    }

    var now = new Date();
    var allRecords = collectVisibleRows(now, selection.code);
    var records = allRecords.filter(function (record) {
      return SLACompanyPreselection.acceptsCompany(selection.code, record.company);
    });
    var buckets = bucketDefinitions(selection);
    var cards = buckets.map(function (bucket) {
      return cardHtml(bucket, records, now);
    }).join('');

    var html = '<div id="resumo-sla-fadiga" data-selection-code="' + selection.code + '" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;background:#1e293b;border-radius:12px;border:1px solid #334155;padding:20px 24px;font-family:sans-serif;min-width:340px;max-width:620px;box-shadow:0 8px 30px rgba(0,0,0,.6);color:#f1f5f9;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
      '<div><h3 style="margin:0;font-size:18px;">📊 Resumo SLA — ' + selection.label + '</h3>' +
      '<div style="font-size:13px;color:#60a5fa;margin-top:3px;">' + now.toLocaleString('pt-BR') + '</div>' +
      '<div style="font-size:10px;color:#94a3b8;margin-top:3px;">Fórmula: horário atual − menor “Disponível em” da tela atual</div></div>' +
      '<div style="display:flex;gap:5px;"><button id="btn-pdf-whats" style="background:#25D366;color:white;border:0;padding:5px 10px;border-radius:5px;cursor:pointer;">PDF + WhatsApp</button>' +
      '<button id="sla-summary-close" style="background:#475569;color:white;border:0;width:28px;height:28px;border-radius:50%;cursor:pointer;">×</button></div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">' + cards + '</div>' +
      '<div style="font-size:10px;color:#94a3b8;text-align:center;margin-top:12px;">Pré-seleção detectada: ' + selection.label + ' · somente página visível da Fadiga</div></div>';

    document.getElementById('resumo-sla-fadiga')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('sla-summary-close').addEventListener('click', function () {
      document.getElementById('resumo-sla-fadiga')?.remove();
    });
    document.getElementById('btn-pdf-whats').addEventListener('click', function () {
      if (global.SLAReportPrint && global.SLAReportPrint.gerarPDFeWhatsApp) {
        global.SLAReportPrint.gerarPDFeWhatsApp();
      }
    });
  }

  global.gerarResumoSLAAgora = generateSummaryNow;

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== 'slaGenerateSummaryNow') return;
    try {
      generateSummaryNow();
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message || String(error)
      });
    }
  });

  if (isFatiguePage()) {
    chrome.storage.local.get('gerarResumoAgora', function (data) {
      if (data.gerarResumoAgora) {
        chrome.storage.local.remove('gerarResumoAgora');
        setTimeout(function () { global.gerarResumoSLAAgora(); }, 500);
      }
    });
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      if (
        namespace === 'local' &&
        changes.gerarResumoAgora &&
        changes.gerarResumoAgora.newValue === true
      ) {
        chrome.storage.local.remove('gerarResumoAgora');
        setTimeout(function () { global.gerarResumoSLAAgora(); }, 500);
      }
    });
  }
})(window);
