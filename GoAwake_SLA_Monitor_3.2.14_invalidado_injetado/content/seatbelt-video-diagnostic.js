(function (global) {
  'use strict';

  if (global.__goAwakeSeatbeltDiagnosticInstalled) return;
  global.__goAwakeSeatbeltDiagnosticInstalled = true;

  var PANEL_ID = 'goawake-seatbelt-diagnostic';
  var BODY_ID = 'goawake-seatbelt-diagnostic-body';
  var STATUS_ID = 'goawake-seatbelt-diagnostic-status';
  var DETAILS_ID = 'goawake-seatbelt-diagnostic-details';
  var BUTTON_ID = 'goawake-seatbelt-diagnostic-run';
  var scanTimer = null;
  var scanRunning = false;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function visible(element) {
    if (!element || !element.isConnected || !element.getBoundingClientRect) {
      return false;
    }
    var rect = element.getBoundingClientRect();
    var style = global.getComputedStyle ? global.getComputedStyle(element) : null;
    return rect.width > 0 && rect.height > 0 &&
      (!style || (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || 1) !== 0
      ));
  }

  function elementValue(element) {
    if (!element) return '';
    if (element.matches && element.matches('select')) {
      var selected = element.options && element.options[element.selectedIndex];
      return String(selected ? selected.textContent : element.value || '').trim();
    }
    if ('value' in element && String(element.value || '').trim()) {
      return String(element.value).trim();
    }
    return String(element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function hasTypeLabelNearby(element) {
    var current = element;
    var depth = 0;
    while (current && current !== document.body && depth < 5) {
      var ownText = normalize(current.textContent);
      if (ownText.includes('tipo de alerta')) return true;
      current = current.parentElement;
      depth += 1;
    }

    var elementRect = element.getBoundingClientRect
      ? element.getBoundingClientRect()
      : null;
    if (!elementRect) return false;

    return Array.from(document.querySelectorAll('label, legend, span, div'))
      .filter(function (candidate) {
        return visible(candidate) &&
          normalize(candidate.textContent) === 'tipo de alerta';
      })
      .some(function (label) {
        var rect = label.getBoundingClientRect();
        var verticalDistance = elementRect.top - rect.bottom;
        var horizontalDistance = Math.abs(
          (elementRect.left + elementRect.width / 2) -
          (rect.left + rect.width / 2)
        );
        return verticalDistance >= -20 &&
          verticalDistance <= 150 &&
          horizontalDistance <= 240;
      });
  }

  function findAlertTypeField() {
    var selectors = [
      'select',
      'input',
      '.ui-dropdown-label',
      '.p-dropdown-label',
      '.ng-value-label',
      '.mat-select-value-text',
      '[role="combobox"]'
    ];
    var candidates = Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(visible);

    for (var i = 0; i < candidates.length; i++) {
      var value = elementValue(candidates[i]);
      if (normalize(value) !== 'sem cinto') continue;
      if (!hasTypeLabelNearby(candidates[i])) continue;
      return {
        element: candidates[i],
        value: value,
        normalized: 'sem cinto'
      };
    }
    return null;
  }

  function mediaDimensions(element, kind) {
    if (kind === 'video') {
      return {
        width: Number(element.videoWidth || element.clientWidth || 0),
        height: Number(element.videoHeight || element.clientHeight || 0)
      };
    }
    if (kind === 'image') {
      return {
        width: Number(element.naturalWidth || element.clientWidth || 0),
        height: Number(element.naturalHeight || element.clientHeight || 0)
      };
    }
    return {
      width: Number(element.width || element.clientWidth || 0),
      height: Number(element.height || element.clientHeight || 0)
    };
  }

  function mediaCandidates() {
    var candidates = [];
    Array.from(document.querySelectorAll('video')).forEach(function (element, index) {
      if (element.closest && element.closest('#' + PANEL_ID)) return;
      candidates.push({
        kind: 'video',
        element: element,
        label: 'Vídeo ' + (index + 1)
      });
    });

    Array.from(document.querySelectorAll('canvas')).forEach(function (element, index) {
      if (element.closest && element.closest('#' + PANEL_ID)) return;
      var dimensions = mediaDimensions(element, 'canvas');
      if (dimensions.width < 80 || dimensions.height < 45) return;
      candidates.push({
        kind: 'canvas',
        element: element,
        label: 'Canvas ' + (index + 1)
      });
    });

    Array.from(document.querySelectorAll('img')).forEach(function (element, index) {
      if (element.closest && element.closest('#' + PANEL_ID)) return;
      var dimensions = mediaDimensions(element, 'image');
      var source = String(element.currentSrc || element.src || '').toLowerCase();
      var description = normalize([
        element.alt,
        element.title,
        element.className
      ].join(' '));
      if (dimensions.width < 80 || dimensions.height < 45) return;
      if (/icon|logo|avatar|branding|sprite/.test(description + ' ' + source)) return;
      candidates.push({
        kind: 'image',
        element: element,
        label: 'Imagem ' + (index + 1)
      });
    });
    return candidates;
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function frameFingerprint(data) {
    var hash = 2166136261;
    var stride = Math.max(4, Math.floor(data.length / 4096));
    for (var i = 0; i < data.length; i += stride) {
      hash ^= data[i];
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function frameStatistics(data) {
    var samples = 0;
    var sum = 0;
    var sumSquares = 0;
    var opaque = 0;
    var stride = Math.max(4, Math.floor(data.length / 6000));
    stride -= stride % 4;
    if (stride < 4) stride = 4;

    for (var i = 0; i < data.length; i += stride) {
      var alpha = data[i + 3];
      if (alpha > 0) opaque += 1;
      var luminance = (
        Number(data[i] || 0) +
        Number(data[i + 1] || 0) +
        Number(data[i + 2] || 0)
      ) / 3;
      sum += luminance;
      sumSquares += luminance * luminance;
      samples += 1;
    }
    var average = samples ? sum / samples : 0;
    var variance = samples
      ? Math.max(0, sumSquares / samples - average * average)
      : 0;
    return {
      average: Math.round(average),
      variance: Math.round(variance),
      opaqueRatio: samples ? opaque / samples : 0
    };
  }

  function captureFrame(candidate) {
    var dimensions = mediaDimensions(candidate.element, candidate.kind);
    if (candidate.kind === 'video' &&
        (candidate.element.readyState < 2 ||
         dimensions.width <= 0 ||
         dimensions.height <= 0)) {
      return {
        ok: false,
        reason: 'not-ready',
        message: 'vídeo ainda sem quadro disponível'
      };
    }
    if (candidate.kind === 'image' &&
        (!candidate.element.complete ||
         dimensions.width <= 0 ||
         dimensions.height <= 0)) {
      return {
        ok: false,
        reason: 'not-ready',
        message: 'imagem ainda não carregada'
      };
    }
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      return {
        ok: false,
        reason: 'no-dimensions',
        message: 'mídia sem dimensões válidas'
      };
    }

    var targetWidth = Math.min(320, dimensions.width);
    var targetHeight = Math.max(
      1,
      Math.round(dimensions.height * (targetWidth / dimensions.width))
    );
    var canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    var context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return {
        ok: false,
        reason: 'canvas-unavailable',
        message: 'canvas 2D indisponível'
      };
    }

    try {
      context.drawImage(candidate.element, 0, 0, targetWidth, targetHeight);
      var imageData = context.getImageData(0, 0, targetWidth, targetHeight);
      var statistics = frameStatistics(imageData.data);
      if (statistics.opaqueRatio < 0.5 || statistics.variance < 2) {
        return {
          ok: false,
          reason: 'blank-frame',
          message: 'quadro vazio ou sem informação visual'
        };
      }
      return {
        ok: true,
        width: dimensions.width,
        height: dimensions.height,
        fingerprint: frameFingerprint(imageData.data),
        statistics: statistics
      };
    } catch (error) {
      var securityBlocked = error && (
        error.name === 'SecurityError' ||
        /cross-origin|tainted|insecure/i.test(String(error.message || error))
      );
      return {
        ok: false,
        reason: securityBlocked ? 'security-blocked' : 'capture-error',
        message: securityBlocked
          ? 'leitura bloqueada pela segurança do navegador (CORS)'
          : 'falha ao capturar: ' + String(error.message || error)
      };
    }
  }

  async function testCandidate(candidate) {
    var frameCount = candidate.kind === 'video' ? 3 : 1;
    var results = [];
    for (var i = 0; i < frameCount; i++) {
      results.push(captureFrame(candidate));
      if (i < frameCount - 1) await wait(350);
    }
    var successful = results.filter(function (result) { return result.ok; });
    var fingerprints = new Set(successful.map(function (result) {
      return result.fingerprint;
    }));
    var firstFailure = results.find(function (result) { return !result.ok; });
    return {
      label: candidate.label,
      kind: candidate.kind,
      successfulFrames: successful.length,
      attemptedFrames: results.length,
      distinctFrames: fingerprints.size,
      blocked: results.some(function (result) {
        return result.reason === 'security-blocked';
      }),
      message: successful.length
        ? successful.length + ' de ' + results.length +
          ' quadro(s) acessível(is); ' + fingerprints.size + ' distinto(s)'
        : (firstFailure ? firstFailure.message : 'captura não concluída')
    };
  }

  function setStatus(text, tone) {
    var target = document.getElementById(STATUS_ID);
    if (!target) return;
    var colors = {
      success: { background: '#dcfce7', color: '#166534' },
      warning: { background: '#fef3c7', color: '#92400e' },
      error: { background: '#fee2e2', color: '#991b1b' },
      neutral: { background: '#e2e8f0', color: '#334155' }
    };
    var style = colors[tone] || colors.neutral;
    target.textContent = text;
    target.style.background = style.background;
    target.style.color = style.color;
  }

  function renderDetails(results) {
    var target = document.getElementById(DETAILS_ID);
    if (!target) return;
    target.textContent = '';
    results.forEach(function (result) {
      var row = document.createElement('div');
      row.style.cssText =
        'padding:5px 0;border-top:1px solid #e2e8f0;font-size:10px;color:#475569;';
      row.textContent = result.label + ': ' + result.message;
      target.appendChild(row);
    });
  }

  async function runDiagnostic() {
    if (scanRunning) return;
    scanRunning = true;
    var button = document.getElementById(BUTTON_ID);
    if (button) {
      button.disabled = true;
      button.textContent = 'Testando...';
    }
    setStatus('Procurando vídeos e verificando acesso aos quadros...', 'neutral');
    renderDetails([]);

    try {
      var alertType = findAlertTypeField();
      if (!alertType || alertType.normalized !== 'sem cinto') {
        setStatus('O campo Tipo de Alerta não está definido como “Sem cinto”.', 'warning');
        return;
      }

      var candidates = mediaCandidates();
      if (!candidates.length) {
        setStatus(
          'Nenhum vídeo ou quadro foi localizado. Abra ou reproduza o vídeo e teste novamente.',
          'warning'
        );
        return;
      }

      var results = [];
      for (var i = 0; i < candidates.length; i++) {
        results.push(await testCandidate(candidates[i]));
      }
      renderDetails(results);

      var videoAccessible = results.some(function (result) {
        return result.kind === 'video' && result.successfulFrames > 0;
      });
      var visualAccessible = results.some(function (result) {
        return result.successfulFrames > 0;
      });
      var securityBlocked = results.some(function (result) {
        return result.blocked;
      });

      if (videoAccessible) {
        setStatus(
          'Captura do vídeo permitida. A integração do modelo visual local é viável.',
          'success'
        );
      } else if (visualAccessible) {
        setStatus(
          'Miniaturas acessíveis, mas nenhum quadro de vídeo foi capturado. Abra e reproduza o vídeo.',
          'warning'
        );
      } else if (securityBlocked) {
        setStatus(
          'A leitura visual foi bloqueada pelo navegador. Será necessária outra forma autorizada de acesso ao vídeo.',
          'error'
        );
      } else {
        setStatus(
          'As mídias foram encontradas, mas ainda não possuem um quadro utilizável.',
          'warning'
        );
      }
    } catch (error) {
      console.error('[SLA][Cinto][Diagnóstico]', error);
      setStatus(
        'Falha no diagnóstico: ' + String(error.message || error),
        'error'
      );
    } finally {
      scanRunning = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Testar acesso ao vídeo';
      }
    }
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    var panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Diagnóstico local para detecção de cinto');
    panel.style.cssText =
      'position:fixed;right:20px;bottom:20px;z-index:9999997;width:330px;' +
      'background:#fff;border:1px solid #cbd5e1;border-radius:10px;' +
      'box-shadow:0 10px 30px rgba(15,23,42,.28);font-family:Arial,sans-serif;' +
      'color:#0f172a;overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:9px 11px;background:#0f766e;color:#fff;';
    var title = document.createElement('strong');
    title.style.fontSize = '12px';
    title.textContent = 'Diagnóstico IA — Sem cinto';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '−';
    toggle.setAttribute('aria-label', 'Minimizar diagnóstico');
    toggle.style.cssText =
      'width:22px;height:22px;border:0;border-radius:50%;background:rgba(255,255,255,.2);' +
      'color:#fff;cursor:pointer;font-weight:bold;';
    header.appendChild(title);
    header.appendChild(toggle);

    var body = document.createElement('div');
    body.id = BODY_ID;
    body.style.padding = '10px 11px';

    var explanation = document.createElement('p');
    explanation.style.cssText =
      'margin:0 0 8px;font-size:10px;line-height:1.35;color:#475569;';
    explanation.textContent =
      'Este teste apenas verifica se os quadros podem ser lidos localmente. ' +
      'Não classifica, não invalida e não envia imagens.';

    var status = document.createElement('div');
    status.id = STATUS_ID;
    status.style.cssText =
      'padding:7px 8px;border-radius:5px;font-size:10px;line-height:1.35;' +
      'background:#e2e8f0;color:#334155;';
    status.textContent = 'Alerta “Sem cinto” identificado. Abra o vídeo para testar.';

    var details = document.createElement('div');
    details.id = DETAILS_ID;
    details.style.marginTop = '7px';

    var button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Testar acesso ao vídeo';
    button.style.cssText =
      'width:100%;margin-top:9px;padding:7px 9px;border:0;border-radius:5px;' +
      'background:#0f766e;color:#fff;font-size:11px;font-weight:700;cursor:pointer;';
    button.addEventListener('click', runDiagnostic);

    toggle.addEventListener('click', function () {
      var hidden = body.style.display === 'none';
      body.style.display = hidden ? 'block' : 'none';
      toggle.textContent = hidden ? '−' : '+';
      toggle.setAttribute(
        'aria-label',
        hidden ? 'Minimizar diagnóstico' : 'Expandir diagnóstico'
      );
    });

    body.appendChild(explanation);
    body.appendChild(status);
    body.appendChild(details);
    body.appendChild(button);
    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);
  }

  function removePanel() {
    var panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
  }

  function scan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      if (findAlertTypeField()) createPanel();
      else removePanel();
    }, 150);
  }

  var observer = new MutationObserver(scan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['value', 'aria-label', 'aria-selected']
  });
  global.addEventListener('hashchange', scan);
  global.addEventListener('popstate', scan);
  scan();

  global.GoAwakeSeatbeltVideoDiagnostic = Object.freeze({
    scan: scan,
    run: runDiagnostic,
    findAlertTypeField: findAlertTypeField,
    mediaCandidates: mediaCandidates,
    captureFrame: captureFrame,
    normalize: normalize
  });
})(window);
