(function (global) {
  'use strict';

  var SUMMARY_KEY = 'slaAutomaticAuthorSummary';
  var ACTIVE_KEY = 'slaAutomaticAuthorPopupActive';
  var POPUP_ID = 'goawake-author-popup';

  function isFatiguePage() {
    return global.location.protocol === 'https:' &&
      global.location.hostname === 'www.goawakecloud.com.br' &&
      (
        global.location.pathname.includes('/fatigue') ||
        global.location.hash.includes('/pages/f/fatigue')
      );
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function visible(element) {
    if (!element || !element.getBoundingClientRect) return false;
    var rect = element.getBoundingClientRect();
    var style = global.getComputedStyle ? global.getComputedStyle(element) : null;
    return rect.width > 0 && rect.height > 0 &&
      (!style || (style.display !== 'none' && style.visibility !== 'hidden'));
  }

  function candidateElements() {
    var selectors = [
      'nb-user .user-name',
      'nb-user [class*="name"]',
      'nb-user',
      '.user-name',
      '.username',
      '[data-testid*="user" i]',
      '[aria-label*="usuário" i]',
      '[aria-label*="usuario" i]',
      '[class*="profile" i] [class*="name" i]',
      '[class*="user" i] [class*="name" i]'
    ];
    var found = [];
    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (element) {
        if (!found.includes(element)) found.push(element);
      });
    });

    document.querySelectorAll('header span, header div, nav span, nav div, nb-layout-header span, nb-layout-header div')
      .forEach(function (element) {
        if (element.children.length > 2 || !visible(element)) return;
        var rect = element.getBoundingClientRect();
        if (rect.top > 190 || rect.left < global.innerWidth * 0.52 || rect.width > 360) return;
        if (!found.includes(element)) found.push(element);
      });
    return found.filter(visible);
  }

  function usefulTokens(value) {
    var ignored = new Set([
      'moby', 'ola', 'olá', 'bem', 'vindo', 'usuario', 'usuário',
      'perfil', 'conta', 'notificacao', 'notificacoes', 'sair'
    ]);
    return normalize(value).split(' ').filter(function (token) {
      return token.length >= 3 && !ignored.has(token);
    });
  }

  function authorMatchScore(label, author) {
    var left = normalize(label);
    var right = normalize(author);
    if (!left || !right) return 0;
    if (left === right) return 100;
    if (left.length >= 4 && right.includes(left)) return 92;
    if (right.length >= 4 && left.includes(right)) return 90;

    var leftTokens = usefulTokens(left);
    var rightTokens = usefulTokens(right);
    if (!leftTokens.length || !rightTokens.length) return 0;
    var common = rightTokens.filter(function (token) {
      return leftTokens.includes(token);
    }).length;
    if (!common) return 0;
    return 55 + Math.round((common / Math.max(leftTokens.length, rightTokens.length)) * 35);
  }

  function detectCurrentAuthor(authors) {
    var candidates = candidateElements();
    var best = null;
    candidates.forEach(function (element, candidateIndex) {
      var label = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (label.length < 2 || label.length > 100 || /^\d+$/.test(label)) return;
      var rect = element.getBoundingClientRect();
      var positionBonus = rect.left > global.innerWidth * 0.7 ? 5 : 0;

      (authors || []).forEach(function (item) {
        var score = authorMatchScore(label, item.author) + positionBonus - candidateIndex * 0.01;
        if (!best || score > best.score) {
          best = { label: label, author: item.author, count: item.count, score: score };
        }
      });
    });

    if (best && best.score >= 55) return best;

    var direct = candidates.find(function (element) {
      var text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      return text.length >= 2 && text.length <= 100 && !/^\d+$/.test(text);
    });
    return {
      label: direct ? String(direct.textContent || '').replace(/\s+/g, ' ').trim() : '',
      author: '',
      count: 0,
      score: 0
    };
  }

  function removePopup() {
    var current = document.getElementById(POPUP_ID);
    if (current) current.remove();
  }

  function render(summary) {
    if (!isFatiguePage() || !summary || !Array.isArray(summary.authors)) return;

    removePopup();
    var current = detectCurrentAuthor(summary.authors);
    var matched = Boolean(current.author);
    var displayName = matched ? current.author : (current.label || 'Autor não identificado');
    var updatedAt = summary.updatedAt ? new Date(summary.updatedAt) : new Date();

    var html = '<div id="' + POPUP_ID + '" style="position:fixed;top:82px;right:20px;' +
      'z-index:9999998;width:300px;overflow:hidden;background:#0f172a;border:1px solid #334155;' +
      'border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.55);font-family:Arial,sans-serif;color:#f8fafc;">' +
      '<div style="position:relative;padding:10px 36px 9px 12px;background:#1d4ed8;">' +
      '<div style="font-size:14px;font-weight:700;">Contagem atual do autor</div>' +
      '<div style="font-size:10px;color:#dbeafe;margin-top:2px;">Audit oculta · hoje até ' +
      escapeHtml(updatedAt.toLocaleTimeString('pt-BR')) + '</div>' +
      '<button id="goawake-author-popup-close" aria-label="Fechar" style="position:absolute;' +
      'right:8px;top:9px;width:23px;height:23px;border:0;border-radius:50%;cursor:pointer;' +
      'background:rgba(255,255,255,.2);color:#fff;">×</button></div>' +
      '<div style="padding:15px 14px;text-align:center;">' +
      '<div style="font-size:12px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
      escapeHtml(displayName) + '</div>' +
      '<strong style="display:block;color:' + (matched ? '#60a5fa' : '#94a3b8') +
      ';font-size:42px;line-height:1.15;margin:5px 0;">' + Number(current.count || 0) + '</strong>' +
      '<div style="font-size:10px;color:#94a3b8;">IDs únicos tratados no dia atual</div>' +
      (!matched
        ? '<div style="margin-top:9px;padding:7px;background:#3f2a0a;color:#fcd34d;border-radius:5px;font-size:10px;">' +
          'Não foi possível relacionar o nome do cabeçalho com o Autor da tratativa da Audit.</div>'
        : '') +
      '</div><div style="display:flex;justify-content:space-around;padding:7px;background:#111827;' +
      'border-top:1px solid #334155;text-align:center;">' +
      '<span style="font-size:9px;color:#94a3b8;">Audit total: <b style="color:#cbd5e1;">' +
      Number(summary.totalUniqueAudits || 0) + '</b></span>' +
      '<span style="font-size:9px;color:#94a3b8;">Páginas: <b style="color:#cbd5e1;">' +
      Number(summary.pagesRead || 0) + '</b></span></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('goawake-author-popup-close').addEventListener('click', removePopup);
  }

  chrome.runtime.onMessage.addListener(function (message) {
    if (message && message.type === 'slaAutomaticAuthorSummary') {
      render(message.summary);
    }
    if (message && message.type === 'slaAutomaticAuthorPopupStopped') {
      removePopup();
    }
  });

  if (isFatiguePage()) {
    chrome.storage.local.get([SUMMARY_KEY, ACTIVE_KEY], function (data) {
      if (data[ACTIVE_KEY] === true && data[SUMMARY_KEY]) {
        render(data[SUMMARY_KEY]);
      }
    });
  }

  global.GoAwakeCurrentAuthorDetector = Object.freeze({
    detect: detectCurrentAuthor,
    normalize: normalize,
    matchScore: authorMatchScore
  });
})(window);
