'use strict';

var SLA_LOG = Object.freeze({
  info: function(message, data) { console.info('[SLA]', message, data === undefined ? '' : data); },
  warn: function(message, data) { console.warn('[SLA]', message, data === undefined ? '' : data); },
  error: function(message, error) { console.error('[SLA]', message, error === undefined ? '' : error); }
});