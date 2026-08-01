(function (global) {
  'use strict';

  var PRESETS = Object.freeze([
    Object.freeze({ days: 1, label: 'Hoje' }),
    Object.freeze({ days: 7, label: 'Últimos 7 dias' }),
    Object.freeze({ days: 15, label: 'Últimos 15 dias' }),
    Object.freeze({ days: 30, label: 'Últimos 30 dias' }),
    Object.freeze({ days: 90, label: 'Últimos 90 dias' })
  ]);

  function fromDays(days, referenceDate) {
    var selectedDays = Number(days);
    var now = referenceDate instanceof Date
      ? new Date(referenceDate.getTime())
      : new Date(referenceDate || Date.now());

    if (!Number.isInteger(selectedDays) || selectedDays < 1 || selectedDays > 365) {
      throw new Error('Período inválido para o Dashboard.');
    }
    if (Number.isNaN(now.getTime())) {
      throw new Error('Data atual inválida para o Dashboard.');
    }

    var start = new Date(now);
    start.setDate(start.getDate() - (selectedDays - 1));
    start.setHours(0, 0, 0, 0);

    var preset = PRESETS.find(function (item) {
      return item.days === selectedDays;
    });

    return {
      start: start,
      end: now,
      days: selectedDays,
      key: selectedDays === 1 ? 'hoje' : 'ultimos-' + selectedDays + '-dias',
      label: preset ? preset.label : 'Últimos ' + selectedDays + ' dias',
      referenceDay: new Date(now.getFullYear(), now.getMonth(), now.getDate())
    };
  }

  function parseDateInput(value, fieldName) {
    if (value instanceof Date) {
      var copy = new Date(value.getTime());
      if (!Number.isNaN(copy.getTime())) return copy;
    }
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error(fieldName + ' inválida para o Dashboard.');
    var parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (
      parsed.getFullYear() !== Number(match[1]) ||
      parsed.getMonth() !== Number(match[2]) - 1 ||
      parsed.getDate() !== Number(match[3])
    ) {
      throw new Error(fieldName + ' inválida para o Dashboard.');
    }
    return parsed;
  }

  function dateLabel(date) {
    return String(date.getDate()).padStart(2, '0') + '/' +
      String(date.getMonth() + 1).padStart(2, '0') + '/' +
      date.getFullYear();
  }

  function parseTimeInput(value, fieldName, fallback) {
    var selected = String(value || fallback || '');
    var match = selected.match(/^(\d{2}):(\d{2})$/);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      throw new Error(fieldName + ' inválido para o Dashboard.');
    }
    return { hours: Number(match[1]), minutes: Number(match[2]), text: selected };
  }

  function timeLabel(date) {
    return String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0');
  }

  function fromRange(startValue, endValue, referenceDate, startTimeValue, endTimeValue) {
    var now = referenceDate instanceof Date
      ? new Date(referenceDate.getTime())
      : new Date(referenceDate || Date.now());
    if (Number.isNaN(now.getTime())) throw new Error('Data atual inválida para o Dashboard.');

    var start = parseDateInput(startValue, 'Data inicial');
    var endDay = parseDateInput(endValue, 'Data final');
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (endDay > today) throw new Error('A data final não pode ser posterior ao dia atual.');

    var startTime = parseTimeInput(startTimeValue, 'Horário inicial', '00:00');
    start.setHours(startTime.hours, startTime.minutes, 0, 0);

    var end;
    if (endTimeValue) {
      var endTime = parseTimeInput(endTimeValue, 'Horário final');
      end = new Date(
        endDay.getFullYear(),
        endDay.getMonth(),
        endDay.getDate(),
        endTime.hours,
        endTime.minutes,
        59,
        999
      );
      if (endDay.getTime() === today.getTime() && end > now) {
        if (endTime.hours === now.getHours() && endTime.minutes === now.getMinutes()) {
          end = new Date(now.getTime());
        } else {
          throw new Error('O horário final não pode ser posterior ao horário atual.');
        }
      }
    } else {
      end = endDay.getTime() === today.getTime()
        ? new Date(now.getTime())
        : new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999);
    }
    if (start > end) {
      throw new Error('A data e o horário iniciais devem ser anteriores ao final.');
    }

    var startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    var days = Math.floor(
      (new Date(end.getFullYear(), end.getMonth(), end.getDate()) - startDay) / 86400000
    ) + 1;
    if (days > 365) throw new Error('O período máximo do Dashboard é de 365 dias.');

    return {
      start: start,
      end: end,
      days: days,
      key: 'periodo-' +
        start.getFullYear() + String(start.getMonth() + 1).padStart(2, '0') +
        String(start.getDate()).padStart(2, '0') + '-' + timeLabel(start).replace(':', '') + '-' +
        endDay.getFullYear() + String(endDay.getMonth() + 1).padStart(2, '0') +
        String(endDay.getDate()).padStart(2, '0') + '-' + timeLabel(end).replace(':', ''),
      label: dateLabel(start) + ' ' + timeLabel(start) +
        ' a ' + dateLabel(endDay) + ' ' + timeLabel(end),
      referenceDay: today
    };
  }

  global.GoAwakeDashboardPeriod = Object.freeze({
    presets: PRESETS,
    fromDays: fromDays,
    fromRange: fromRange
  });
})(globalThis);
