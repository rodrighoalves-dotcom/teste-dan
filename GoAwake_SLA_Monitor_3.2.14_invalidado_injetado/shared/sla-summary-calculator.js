(function (global) {
  'use strict';

  function timestamp(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value) return new Date(value).getTime();
    return NaN;
  }

  function fromAvailableTimes(values, now) {
    var nowTimestamp = timestamp(now || new Date());
    if (!Number.isFinite(nowTimestamp)) {
      throw new Error('Horário atual inválido para o cálculo do resumo SLA.');
    }

    var valid = (values || [])
      .map(timestamp)
      .filter(function (value) {
        return Number.isFinite(value) && value <= nowTimestamp;
      });

    if (!valid.length) {
      return {
        earliestAvailableAt: null,
        elapsedMinutes: 0,
        validRows: 0,
        formula: 'current-time-minus-earliest-available'
      };
    }

    var earliestTimestamp = Math.min.apply(null, valid);
    return {
      earliestAvailableAt: new Date(earliestTimestamp),
      elapsedMinutes: Math.floor((nowTimestamp - earliestTimestamp) / 60000),
      validRows: valid.length,
      formula: 'current-time-minus-earliest-available'
    };
  }

  function fromRecords(records, now) {
    return fromAvailableTimes((records || []).map(function (record) {
      return record && (
        record.availableAt !== undefined
          ? record.availableAt
          : record.availableAtTimestamp
      );
    }), now);
  }

  global.SLASummaryCalculator = Object.freeze({
    fromAvailableTimes: fromAvailableTimes,
    fromRecords: fromRecords
  });
})(globalThis);
