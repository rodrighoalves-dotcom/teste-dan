(function (global) {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function identify(value) {
    var text = normalize(value);
    if (!text) return null;

    if (
      (text.includes('VOR') && text.includes('ARG')) ||
      (text.includes('VALE') && text.includes('ARGENTA'))
    ) {
      return { code: 'VOR_ARG', label: 'VOR + ARG', sourceText: text };
    }
    if (text.includes('LIBERIA')) {
      return { code: 'LIBERIA', label: 'LIBÉRIA', sourceText: text };
    }
    if (text.includes('GERAL') || text.includes('TODAS')) {
      return { code: 'GENERAL', label: 'GERAL', sourceText: text };
    }
    if (text.includes('ARGENTA')) {
      return { code: 'ARGENTA', label: 'ARGENTA', sourceText: text };
    }
    if (text.includes('VALE') || text === 'VOR') {
      return { code: 'VALE', label: 'VALE', sourceText: text };
    }
    return null;
  }

  function candidateScore(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return 0;
    var rect = element.getBoundingClientRect();
    var width = global.innerWidth || 1;
    var height = global.innerHeight || 1;
    return (rect.left / width) + (rect.top / height);
  }

  function detect(documentRef) {
    var doc = documentRef || global.document;
    var candidates = [];

    Array.from(doc.querySelectorAll('select')).forEach(function (select) {
      var selected = select.options && select.options[select.selectedIndex];
      if (selected) {
        candidates.push({
          element: select,
          text: selected.textContent || selected.label || selected.value,
          priority: 20
        });
      }
    });

    Array.from(doc.querySelectorAll([
      '.p-dropdown-label',
      '.ui-dropdown-label',
      '.ng-value-label',
      '.mat-select-value-text',
      '.select2-selection__rendered',
      '[role="combobox"]',
      '[aria-haspopup="listbox"]'
    ].join(','))).forEach(function (element) {
      candidates.push({
        element: element,
        text: element.textContent || element.getAttribute('aria-label') || element.getAttribute('title'),
        priority: 10
      });
    });

    var recognized = candidates.map(function (candidate) {
      var selection = identify(candidate.text);
      if (!selection) return null;
      selection.score = (candidateScore(candidate.element) * 100) + candidate.priority;
      return selection;
    }).filter(Boolean).sort(function (a, b) {
      return b.score - a.score;
    });

    return recognized[0] || {
      code: 'UNKNOWN',
      label: 'NÃO IDENTIFICADA',
      sourceText: ''
    };
  }

  function acceptsCompany(selectionCode, company) {
    if (selectionCode === 'GENERAL') return true;
    if (selectionCode === 'VOR_ARG') return company === 'Vale' || company === 'Argenta';
    if (selectionCode === 'LIBERIA') return company === 'Libéria';
    if (selectionCode === 'VALE') return company === 'Vale';
    if (selectionCode === 'ARGENTA') return company === 'Argenta';
    return false;
  }

  function usesPriorityCompanyDetection(selectionCode) {
    // Regra operacional permanente:
    // GERAL nunca usa placa ou motorista para reclassificar Vale/Argenta.
    return selectionCode !== 'GENERAL';
  }

  function resolveDetectedCompany(selectionCode, detectedCompany) {
    return usesPriorityCompanyDetection(selectionCode)
      ? detectedCompany
      : 'Geral';
  }

  global.SLACompanyPreselection = Object.freeze({
    normalize: normalize,
    identify: identify,
    detect: detect,
    acceptsCompany: acceptsCompany,
    usesPriorityCompanyDetection: usesPriorityCompanyDetection,
    resolveDetectedCompany: resolveDetectedCompany
  });
})(globalThis);
