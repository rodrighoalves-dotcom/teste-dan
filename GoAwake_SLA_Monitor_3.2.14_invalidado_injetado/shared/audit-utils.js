(function (global) {
  'use strict';

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeHeader(value) {
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function parseBrazilianDate(value) {
    var text = normalizeText(value);
    var match = text.match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;

    var year = Number(match[3]);
    var month = Number(match[2]) - 1;
    var day = Number(match[1]);
    var hour = Number(match[4]);
    var minute = Number(match[5]);
    var second = Number(match[6] || 0);
    var date = new Date(
      year,
      month,
      day,
      hour,
      minute,
      second,
      0
    );

    if (Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second) {
      return null;
    }
    return date;
  }

  function isMobyAuthor(author, config) {
    var text = normalizeText(author);
    if (!config.authorFilter.enabled) return Boolean(text);

    var target = config.authorFilter.contains;
    if (!config.authorFilter.caseSensitive) {
      text = text.toLowerCase();
      target = target.toLowerCase();
    }

    return text.includes(target);
  }

  function calculateMinutes(start, end) {
    if (!(start instanceof Date) || !(end instanceof Date)) return null;
    var result = (end.getTime() - start.getTime()) / 60000;
    return Number.isFinite(result) ? result : null;
  }

  function withinPeriod(date, start, end) {
    if (!(date instanceof Date)) return false;
    return date >= start && date <= end;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(date) {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(date);
  }

  function formatMinutes(value) {
    var total = Number.isFinite(value) ? Math.max(0, value) : 0;
    var totalSeconds = Math.round(total * 60);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    return String(hours).padStart(2, '0') + ':' +
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0');
  }

  function downloadText(filename, content, mimeType) {
    var blob = new Blob(['\uFEFF' + content], {
      type: mimeType || 'text/plain;charset=utf-8'
    });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  global.GoAwakeAuditUtils = {
    normalizeText: normalizeText,
    normalizeHeader: normalizeHeader,
    parseBrazilianDate: parseBrazilianDate,
    isMobyAuthor: isMobyAuthor,
    calculateMinutes: calculateMinutes,
    withinPeriod: withinPeriod,
    escapeHtml: escapeHtml,
    formatDateTime: formatDateTime,
    formatMinutes: formatMinutes,
    downloadText: downloadText
  };
})(window);
