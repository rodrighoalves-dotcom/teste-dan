(function (global) {
  'use strict';

  var utils = global.GoAwakeAuditUtils;
  var PAGE_WIDTH = 842;
  var PAGE_HEIGHT = 595;
  var MARGIN = 36;

  var CP1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
  };

  function encodeCp1252(value) {
    var text = String(value == null ? '' : value);
    var bytes = [];
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      if (code <= 0xFF) {
        bytes.push(code);
      } else if (CP1252[code] != null) {
        bytes.push(CP1252[code]);
      } else {
        bytes.push(0x3F);
      }
    }
    return new Uint8Array(bytes);
  }

  function concatBytes(chunks) {
    var size = chunks.reduce(function (sum, chunk) {
      return sum + chunk.length;
    }, 0);
    var result = new Uint8Array(size);
    var offset = 0;
    chunks.forEach(function (chunk) {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    return result;
  }

  function pdfText(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\r\n\t]+/g, ' ');
  }

  function compactText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function shorten(value, maximum) {
    var text = compactText(value);
    if (text.length <= maximum) return text;
    return text.slice(0, Math.max(1, maximum - 3)) + '...';
  }

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function percent(value) {
    return finite(value, 0).toFixed(1).replace('.', ',') + '%';
  }

  function formatDateTime(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'não informado';
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear()
    ].join('/') + ' ' +
      String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0');
  }

  function formatPeriodRange(period) {
    var start = period && period.start instanceof Date
      ? period.start
      : new Date(period && period.start);
    var end = period && period.end instanceof Date
      ? period.end
      : new Date(period && period.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Período não informado';
    }
    var startDate = [
      String(start.getDate()).padStart(2, '0'),
      String(start.getMonth() + 1).padStart(2, '0'),
      start.getFullYear()
    ].join('/');
    var endDate = [
      String(end.getDate()).padStart(2, '0'),
      String(end.getMonth() + 1).padStart(2, '0'),
      end.getFullYear()
    ].join('/');
    var startTime = String(start.getHours()).padStart(2, '0') + ':' +
      String(start.getMinutes()).padStart(2, '0');
    var endTime = String(end.getHours()).padStart(2, '0') + ':' +
      String(end.getMinutes()).padStart(2, '0');
    return startDate === endDate
      ? startDate + ' · ' + startTime + ' a ' + endTime
      : startDate + ' ' + startTime + ' a ' + endDate + ' ' + endTime;
  }

  function safeFilenamePart(value) {
    return compactText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'periodo';
  }

  function createFilename(period) {
    var end = period && period.end instanceof Date ? period.end : new Date();
    var stamp = [
      end.getFullYear(),
      String(end.getMonth() + 1).padStart(2, '0'),
      String(end.getDate()).padStart(2, '0')
    ].join('-') + '_' +
      String(end.getHours()).padStart(2, '0') +
      String(end.getMinutes()).padStart(2, '0');
    return 'Relatorio_Executivo_Goawake_SLA_Monitor_' +
      safeFilenamePart(period && (period.key || period.label)) + '_' +
      stamp + '.pdf';
  }

  function textCommand(x, y, size, value, bold) {
    return 'BT /' + (bold ? 'F2' : 'F1') + ' ' + size +
      ' Tf 1 0 0 1 ' + x + ' ' + y +
      ' Tm (' + pdfText(value) + ') Tj ET\n';
  }

  function lineCommand(x1, y1, x2, y2, width) {
    return (width || 0.5) + ' w ' + x1 + ' ' + y1 +
      ' m ' + x2 + ' ' + y2 + ' l S\n';
  }

  function fillRectCommand(x, y, width, height, gray) {
    return finite(gray, 0.95) + ' g ' + x + ' ' + y + ' ' +
      width + ' ' + height + ' re f 0 g\n';
  }

  function fillRectRgbCommand(x, y, width, height, red, green, blue) {
    return red + ' ' + green + ' ' + blue + ' rg ' +
      x + ' ' + y + ' ' + width + ' ' + height + ' re f 0 g\n';
  }

  function textColorCommand(x, y, size, value, bold, red, green, blue) {
    return red + ' ' + green + ' ' + blue + ' rg ' +
      textCommand(x, y, size, value, bold) + '0 g\n';
  }

  function wrapText(value, maximumCharacters) {
    var words = compactText(value).split(' ');
    var lines = [];
    var current = '';
    words.forEach(function (word) {
      var candidate = current ? current + ' ' + word : word;
      if (candidate.length > maximumCharacters && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function roundedRectPath(x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, width / 2, height / 2));
    var k = r * 0.5522847498;
    return [
      (x + r) + ' ' + y + ' m',
      (x + width - r) + ' ' + y + ' l',
      (x + width - r + k) + ' ' + y + ' ' +
        (x + width) + ' ' + (y + r - k) + ' ' +
        (x + width) + ' ' + (y + r) + ' c',
      (x + width) + ' ' + (y + height - r) + ' l',
      (x + width) + ' ' + (y + height - r + k) + ' ' +
        (x + width - r + k) + ' ' + (y + height) + ' ' +
        (x + width - r) + ' ' + (y + height) + ' c',
      (x + r) + ' ' + (y + height) + ' l',
      (x + r - k) + ' ' + (y + height) + ' ' +
        x + ' ' + (y + height - r + k) + ' ' +
        x + ' ' + (y + height - r) + ' c',
      x + ' ' + (y + r) + ' l',
      x + ' ' + (y + r - k) + ' ' +
        (x + r - k) + ' ' + y + ' ' +
        (x + r) + ' ' + y + ' c',
      'h'
    ].join(' ') + '\n';
  }

  function fillRoundedRectRgbCommand(x, y, width, height, radius, red, green, blue) {
    return red + ' ' + green + ' ' + blue + ' rg ' +
      roundedRectPath(x, y, width, height, radius) + 'f 0 g\n';
  }

  function strokeRoundedRectRgbCommand(
    x,
    y,
    width,
    height,
    radius,
    red,
    green,
    blue,
    lineWidth
  ) {
    return red + ' ' + green + ' ' + blue + ' RG ' +
      (lineWidth || 0.6) + ' w ' +
      roundedRectPath(x, y, width, height, radius) + 'S 0 G\n';
  }

  function interpolateColor(start, end, ratio) {
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
      start[2] + (end[2] - start[2]) * ratio
    ];
  }

  function gradientRoundedHeader(page, x, y, width, height) {
    var start = [0.09, 0.25, 0.55];
    var end = [0.49, 0.22, 0.92];
    var strips = 48;
    var stripWidth = width / strips;
    page.commands.push(fillRoundedRectRgbCommand(
      x, y, width, height, 8, start[0], start[1], start[2]
    ));
    for (var i = 1; i < strips - 1; i += 1) {
      var color = interpolateColor(start, end, i / (strips - 1));
      page.commands.push(fillRectRgbCommand(
        x + i * stripWidth,
        y,
        stripWidth + 0.3,
        height,
        color[0],
        color[1],
        color[2]
      ));
    }
    page.commands.push(fillRoundedRectRgbCommand(
      x + width - stripWidth * 2,
      y,
      stripWidth * 2,
      height,
      8,
      end[0],
      end[1],
      end[2]
    ));
  }

  function approximateTextWidth(value, size, bold) {
    return compactText(value).length * size * (bold ? 0.54 : 0.49);
  }

  function rightTextCommand(rightX, y, size, value, bold, red, green, blue) {
    var x = Math.max(MARGIN, rightX - approximateTextWidth(value, size, bold));
    return textColorCommand(x, y, size, value, bold, red, green, blue);
  }

  function createPage(sectionTitle, period, compactHeader) {
    var page = { commands: ['0 g 0 G\n'], cursorY: compactHeader ? 520 : 505 };
    var headerY = compactHeader ? 541 : 520;
    var headerHeight = compactHeader ? 34 : 58;
    gradientRoundedHeader(
      page,
      MARGIN,
      headerY,
      PAGE_WIDTH - MARGIN * 2,
      headerHeight
    );

    if (!compactHeader) {
      page.commands.push(fillRoundedRectRgbCommand(
        MARGIN + 13, headerY + 11, 36, 36, 8, 0.29, 0.41, 0.68
      ));
      page.commands.push(strokeRoundedRectRgbCommand(
        MARGIN + 13, headerY + 11, 36, 36, 8, 0.55, 0.67, 0.90, 0.8
      ));
      page.commands.push(textColorCommand(
        MARGIN + 21, headerY + 24, 12, 'GA', true, 1, 1, 1
      ));
      page.commands.push(textColorCommand(
        MARGIN + 61,
        headerY + 33,
        16,
        sectionTitle || 'Relatório Executivo de Produtividade Operacional',
        true,
        1,
        1,
        1
      ));
      page.commands.push(textColorCommand(
        MARGIN + 61,
        headerY + 15,
        7.8,
        'Goawake SLA Monitor · Dashboard gerencial por autor',
        false,
        0.88,
        0.93,
        1
      ));
      page.commands.push(rightTextCommand(
        PAGE_WIDTH - MARGIN - 14,
        headerY + 32,
        9.5,
        formatPeriodRange(period),
        true,
        1,
        1,
        1
      ));
      page.commands.push(rightTextCommand(
        PAGE_WIDTH - MARGIN - 14,
        headerY + 15,
        7.4,
        'Período analisado · PDF gerado localmente',
        false,
        0.88,
        0.93,
        1
      ));
    } else {
      page.commands.push(textColorCommand(
        MARGIN + 14,
        headerY + 13,
        11,
        sectionTitle,
        true,
        1,
        1,
        1
      ));
      page.commands.push(rightTextCommand(
        PAGE_WIDTH - MARGIN - 14,
        headerY + 13,
        7.5,
        formatPeriodRange(period),
        false,
        1,
        1,
        1
      ));
    }
    return page;
  }

  function drawHorizontalBarChart(page, title, entries, x, topY, width, maximumRows) {
    var rows = entries.slice(0, maximumRows);
    page.commands.push(textCommand(x, topY, 11, title, true));
    page.commands.push(lineCommand(x, topY - 8, x + width, topY - 8, 0.5));
    if (!rows.length) {
      page.commands.push(textCommand(x, topY - 30, 8, 'Nenhum registro no período.', false));
      return;
    }

    var maximum = Math.max.apply(null, rows.map(function (entry) {
      return finite(Number(entry[1]), 0);
    }).concat([1]));
    var rowHeight = Math.min(17, 390 / rows.length);
    var labelWidth = 94;
    var barWidth = width - labelWidth - 38;

    rows.forEach(function (entry, index) {
      var value = finite(Number(entry[1]), 0);
      var y = topY - 27 - index * rowHeight;
      var widthValue = Math.max(value > 0 ? 2 : 0, (value / maximum) * barWidth);
      page.commands.push(textCommand(x, y, 7.2, shorten(entry[0], 17), false));
      page.commands.push(fillRectRgbCommand(
        x + labelWidth,
        y - 2,
        barWidth,
        8,
        0.91,
        0.94,
        0.98
      ));
      page.commands.push(fillRectRgbCommand(
        x + labelWidth,
        y - 2,
        widthValue,
        8,
        0.05,
        0.45,
        0.66
      ));
      page.commands.push(textCommand(x + labelWidth + barWidth + 6, y, 7.2, String(value), true));
    });
  }

  function addWrapped(page, value, options) {
    options = options || {};
    var x = finite(options.x, MARGIN);
    var size = finite(options.size, 9);
    var lineHeight = finite(options.lineHeight, size + 3);
    var lines = wrapText(value, finite(options.maximumCharacters, 125));
    lines.forEach(function (line) {
      page.commands.push(textCommand(x, page.cursorY, size, line, options.bold === true));
      page.cursorY -= lineHeight;
    });
    return lines.length;
  }

  function ringSegmentCommand(
    centerX,
    centerY,
    outerRadius,
    innerRadius,
    startDegrees,
    endDegrees,
    red,
    green,
    blue
  ) {
    var span = Math.max(0.1, endDegrees - startDegrees);
    var steps = Math.max(6, Math.ceil(span / 8));
    var points = [];
    var i;
    for (i = 0; i <= steps; i += 1) {
      var angle = (startDegrees + span * (i / steps)) * Math.PI / 180;
      points.push([
        centerX + Math.cos(angle) * outerRadius,
        centerY + Math.sin(angle) * outerRadius
      ]);
    }
    for (i = steps; i >= 0; i -= 1) {
      var innerAngle = (startDegrees + span * (i / steps)) * Math.PI / 180;
      points.push([
        centerX + Math.cos(innerAngle) * innerRadius,
        centerY + Math.sin(innerAngle) * innerRadius
      ]);
    }
    var path = points.map(function (point, index) {
      return point[0].toFixed(2) + ' ' + point[1].toFixed(2) +
        (index === 0 ? ' m' : ' l');
    }).join(' ') + ' h\n';
    return red + ' ' + green + ' ' + blue + ' rg ' + path + 'f 0 g\n';
  }

  function drawMetricCard(page, x, y, width, height, metric) {
    page.commands.push(fillRoundedRectRgbCommand(
      x, y, width, height, 6, 0.995, 0.997, 1
    ));
    page.commands.push(strokeRoundedRectRgbCommand(
      x, y, width, height, 6, 0.86, 0.90, 0.95, 0.65
    ));
    page.commands.push(fillRoundedRectRgbCommand(
      x + 9,
      y + height - 27,
      22,
      18,
      5,
      metric.tint[0],
      metric.tint[1],
      metric.tint[2]
    ));
    page.commands.push(textColorCommand(
      x + 16,
      y + height - 21,
      8.5,
      metric.symbol,
      true,
      metric.color[0],
      metric.color[1],
      metric.color[2]
    ));
    page.commands.push(textColorCommand(
      x + 10,
      y + 18,
      16,
      String(metric.value),
      true,
      metric.color[0],
      metric.color[1],
      metric.color[2]
    ));
    page.commands.push(textColorCommand(
      x + 10,
      y + 7,
      6.8,
      shorten(metric.label, 25),
      true,
      0.35,
      0.43,
      0.55
    ));
  }

  function drawDistributionPanel(page, data, x, y, width, height) {
    var total = finite(
      data.summary.validDurationAudits,
      finite(data.summary.ok, 0) +
        finite(data.summary.attention, 0) +
        finite(data.summary.critical, 0)
    );
    var rate = Math.max(0, Math.min(100, finite(data.summary.slaComplianceRate, 0)));
    page.commands.push(fillRoundedRectRgbCommand(
      x, y, width, height, 7, 1, 1, 1
    ));
    page.commands.push(strokeRoundedRectRgbCommand(
      x, y, width, height, 7, 0.86, 0.90, 0.95, 0.65
    ));
    page.commands.push(textColorCommand(
      x + 12, y + height - 20, 10.5,
      'Distribuição das tratativas', true, 0.06, 0.10, 0.19
    ));
    page.commands.push(textColorCommand(
      x + 12, y + height - 32, 7,
      'Percentual concluído em até 2 minutos', false, 0.35, 0.43, 0.55
    ));

    var centerX = x + 67;
    var centerY = y + 63;
    page.commands.push(ringSegmentCommand(
      centerX, centerY, 40, 29, 0, 359.7, 0.90, 0.93, 0.97
    ));
    if (rate > 0) {
      page.commands.push(ringSegmentCommand(
        centerX, centerY, 40, 29, 90, 90 + rate * 3.6,
        0.06, 0.65, 0.32
      ));
    }
    page.commands.push(textCommand(
      centerX - approximateTextWidth(percent(rate), 13, true) / 2,
      centerY + 2,
      13,
      percent(rate),
      true
    ));
    page.commands.push(textColorCommand(
      centerX - 22,
      centerY - 12,
      6.5,
      'até 2 minutos',
      false,
      0.40,
      0.48,
      0.60
    ));

    var legendX = x + 128;
    var legendWidth = width - 142;
    var legend = [
      ['Até 2 minutos', finite(data.summary.ok, 0), [0.06, 0.65, 0.32]],
      ['Acima de 2 e até 5 minutos', finite(data.summary.attention, 0), [0.90, 0.48, 0.02]],
      ['Acima de 5 minutos', finite(data.summary.critical, 0), [0.89, 0.10, 0.11]],
      ['Sem duração calculável', finite(data.summary.unknown, 0), [0.39, 0.45, 0.55]]
    ];
    legend.forEach(function (entry, index) {
      var itemY = y + 93 - index * 24;
      page.commands.push(fillRoundedRectRgbCommand(
        legendX,
        itemY,
        legendWidth,
        19,
        4,
        0.97,
        0.98,
        0.99
      ));
      page.commands.push(fillRoundedRectRgbCommand(
        legendX + 8,
        itemY + 6,
        7,
        7,
        3,
        entry[2][0],
        entry[2][1],
        entry[2][2]
      ));
      page.commands.push(textCommand(
        legendX + 22,
        itemY + 7,
        7,
        shorten(entry[0], 32),
        true
      ));
      page.commands.push(rightTextCommand(
        legendX + legendWidth - 8,
        itemY + 7,
        8,
        String(entry[1]),
        true,
        0.06,
        0.10,
        0.19
      ));
    });
    page.commands.push(textColorCommand(
      x + 12,
      y + 9,
      6.2,
      'Base com duração reconhecida: ' + total +
        (total === 1 ? ' auditoria' : ' auditorias'),
      false,
      0.40,
      0.48,
      0.60
    ));
  }

  function drawRankingPanel(page, data, x, y, width, height) {
    var authors = data.authors.slice(0, 5);
    var maximum = Math.max.apply(null, authors.map(function (author) {
      return finite(author.uniqueAudits, 0);
    }).concat([1]));
    page.commands.push(fillRoundedRectRgbCommand(
      x, y, width, height, 7, 1, 1, 1
    ));
    page.commands.push(strokeRoundedRectRgbCommand(
      x, y, width, height, 7, 0.86, 0.90, 0.95, 0.65
    ));
    page.commands.push(textColorCommand(
      x + 12, y + height - 20, 10.5,
      'Desempenho por operador', true, 0.06, 0.10, 0.19
    ));
    page.commands.push(textColorCommand(
      x + 12, y + height - 32, 7,
      'Ranking por auditorias consolidadas', false, 0.35, 0.43, 0.55
    ));
    if (!authors.length) {
      page.commands.push(textCommand(
        x + 12, y + height - 58, 8, 'Nenhum operador identificado.', false
      ));
      return;
    }
    authors.forEach(function (author, index) {
      var rowY = y + height - 58 - index * 23;
      var barX = x + 126;
      var barWidth = width - 168;
      var value = finite(author.uniqueAudits, 0);
      page.commands.push(textCommand(
        x + 12, rowY + 1, 7.2, shorten(author.author, 22), true
      ));
      page.commands.push(fillRoundedRectRgbCommand(
        barX, rowY - 1, barWidth, 6, 3, 0.90, 0.93, 0.97
      ));
      page.commands.push(fillRoundedRectRgbCommand(
        barX,
        rowY - 1,
        Math.max(value > 0 ? 3 : 0, (value / maximum) * barWidth),
        6,
        3,
        0.13,
        0.34,
        0.88
      ));
      page.commands.push(textCommand(
        x + width - 30, rowY + 1, 7.2, String(value), true
      ));
    });
  }

  function drawReportFooter(page, pageNumber, pageCount) {
    page.commands.push(lineCommand(MARGIN, 31, PAGE_WIDTH - MARGIN, 31, 0.35));
    page.commands.push(textColorCommand(
      MARGIN,
      17,
      6.6,
      'Goawake SLA Monitor · Relatório gerado localmente · DAVES TECH',
      true,
      0.33,
      0.41,
      0.53
    ));
    page.commands.push(rightTextCommand(
      PAGE_WIDTH - MARGIN,
      17,
      6.6,
      'Página ' + pageNumber + ' de ' + pageCount,
      false,
      0.33,
      0.41,
      0.53
    ));
  }

  function buildPagesLegacy(data, period, collectionMeta) {
    data = data || {};
    data.summary = data.summary || {};
    data.authors = Array.isArray(data.authors) ? data.authors : [];
    data.byHour = Array.isArray(data.byHour) ? data.byHour : [];
    collectionMeta = collectionMeta || {};

    var pages = [];
    var summary = createPage('Relatório Gerencial de Produtividade Operacional');
    pages.push(summary);

    summary.commands.push(fillRectRgbCommand(
      MARGIN,
      486,
      PAGE_WIDTH - MARGIN * 2,
      27,
      0.91,
      0.96,
      1
    ));
    summary.commands.push(textColorCommand(
      MARGIN + 10,
      496,
      9,
      'Período analisado: ' + formatDateTime(period && period.start) +
        ' a ' + formatDateTime(period && period.end),
      true,
      0.04,
      0.22,
      0.42
    ));
    summary.cursorY = 466;

    summary.commands.push(textCommand(MARGIN, summary.cursorY, 11, 'Base e rastreabilidade da análise', true));
    summary.commands.push(fillRectCommand(MARGIN, 407, PAGE_WIDTH - MARGIN * 2, 46, 0.96));
    summary.commands.push(textCommand(MARGIN + 10, 436, 8, 'Processamento', true));
    summary.commands.push(textCommand(
      MARGIN + 10,
      421,
      8,
      collectionMeta.auditExecutionMode === 'minimized-window'
        ? 'Audit em janela minimizada'
        : 'Audit dedicada em segundo plano',
      false
    ));
    summary.commands.push(textCommand(232, 436, 8, 'Páginas consultadas', true));
    summary.commands.push(textCommand(232, 421, 9, String(finite(collectionMeta.pagesRead, 0)), false));
    summary.commands.push(textCommand(380, 436, 8, 'Linhas examinadas', true));
    summary.commands.push(textCommand(380, 421, 9, String(finite(collectionMeta.examinedRows, 0)), false));
    summary.commands.push(textCommand(522, 436, 8, 'Auditorias consolidadas', true));
    summary.commands.push(textCommand(522, 421, 9, String(finite(data.summary.uniqueAudits, 0)), false));
    summary.commands.push(textCommand(680, 436, 8, 'Filtro Audit', true));
    summary.commands.push(textCommand(
      680,
      421,
      8,
      collectionMeta.auditPeriodFilter && collectionMeta.auditPeriodFilter.applied
        ? 'Confirmado'
        : 'Não confirmado',
      false
    ));
    summary.cursorY = 389;

    summary.commands.push(textCommand(MARGIN, summary.cursorY, 11, 'Indicadores executivos', true));
    summary.cursorY -= 19;
    var metrics = [
      ['Auditorias consolidadas', finite(data.summary.uniqueAudits, 0)],
      ['Eventos analisados', finite(data.summary.observedEvents, 0)],
      ['Operadores identificados', finite(data.summary.operators, 0)],
      ['Tempo médio por tratativa', utils.formatMinutes(finite(data.summary.averageMinutes, 0))],
      ['Tratativas em até 2 min', finite(data.summary.ok, 0)],
      ['Percentual em até 2 min', percent(data.summary.slaComplianceRate)],
      ['Tratativas de 2 a 5 min', finite(data.summary.attention, 0)],
      ['Tratativas acima de 5 min', finite(data.summary.critical, 0)],
      ['Sem duração calculável', finite(data.summary.unknown, 0)],
      ['Cobertura de duração', percent(data.summary.timeCoverageRate)],
      ['Integridade dos dados', percent(data.summary.qualityScore)]
    ];
    metrics.forEach(function (metric, index) {
      var column = index % 3;
      var row = Math.floor(index / 3);
      var x = MARGIN + column * 252;
      var y = summary.cursorY - row * 30;
      summary.commands.push(fillRectCommand(x, y - 8, 235, 24, 0.95));
      summary.commands.push(textCommand(x + 7, y + 5, 8, metric[0], false));
      summary.commands.push(textCommand(x + 170, y + 5, 10, String(metric[1]), true));
    });
    summary.cursorY -= Math.ceil(metrics.length / 3) * 30 + 5;

    summary.commands.push(textCommand(MARGIN, summary.cursorY, 11, 'Legenda dos indicadores', true));
    summary.cursorY -= 17;
    addWrapped(summary,
      'Auditorias consolidadas: cada ID é contado uma vez, considerando a tratativa mais recente.',
      { maximumCharacters: 136, size: 7.5, lineHeight: 10 }
    );
    addWrapped(summary,
      'Duração: diferença entre “Disponível em” e “Tratado em”. O tempo médio utiliza somente registros com os dois horários reconhecidos.',
      { maximumCharacters: 136, size: 7.5, lineHeight: 10 }
    );
    addWrapped(summary,
      'Faixas de produtividade: até 2 minutos; acima de 2 e até 5 minutos; acima de 5 minutos.',
      { maximumCharacters: 136, size: 7.5, lineHeight: 10 }
    );
    addWrapped(summary,
      'Sem duração calculável: registro com horário ausente, inválido ou incompatível. Integridade: indicador de completude e consistência da base.',
      { maximumCharacters: 136, size: 7.5, lineHeight: 10 }
    );

    var charts = createPage('Distribuição da produtividade no período');
    pages.push(charts);
    drawHorizontalBarChart(
      charts,
      'Produção por hora',
      data.byHour,
      MARGIN,
      506,
      365,
      24
    );
    drawHorizontalBarChart(
      charts,
      'Ranking por auditorias consolidadas',
      data.authors.map(function (author) {
        return [author.author, author.uniqueAudits];
      }),
      438,
      506,
      368,
      18
    );

    var columns = [
      { label: '#', x: 36, width: 20, key: 'rank' },
      { label: 'Operador', x: 58, width: 190, key: 'author' },
      { label: 'Aud.', x: 252, width: 42, key: 'uniqueAudits' },
      { label: 'Eventos', x: 298, width: 46, key: 'totalEventsObserved' },
      { label: 'Até 2m', x: 348, width: 38, key: 'ok' },
      { label: '2–5m', x: 390, width: 40, key: 'attention' },
      { label: '> 5m', x: 434, width: 38, key: 'critical' },
      { label: 'Sem cálculo', x: 476, width: 52, key: 'unknown' },
      { label: 'Cobertura', x: 532, width: 56, key: 'coverage' },
      { label: 'Tempo médio', x: 592, width: 66, key: 'average' },
      { label: '% até 2m', x: 662, width: 56, key: 'underTwoRate' }
    ];

    function newAuthorPage() {
      var page = createPage('Resumo por operador');
      page.commands.push(fillRectCommand(MARGIN, 493, 732, 21, 0.9));
      columns.forEach(function (column) {
        page.commands.push(textCommand(column.x + 2, 501, 7.5, column.label, true));
      });
      page.commands.push(lineCommand(MARGIN, 492, 768, 492, 0.5));
      page.cursorY = 478;
      pages.push(page);
      return page;
    }

    if (data.authors.length) {
      var authorPage = newAuthorPage();
      data.authors.forEach(function (author, index) {
        if (authorPage.cursorY < 47) authorPage = newAuthorPage();
        var rowValues = {
          rank: index + 1,
          author: shorten(author.author || 'Não informado', 29),
          uniqueAudits: finite(author.uniqueAudits, 0),
          totalEventsObserved: finite(author.totalEventsObserved, 0),
          ok: finite(author.ok, 0),
          attention: finite(author.attention, 0),
          critical: finite(author.critical, 0),
          unknown: finite(author.unknown, 0),
          coverage: percent(author.timeCoverageRate),
          average: utils.formatMinutes(finite(author.averageMinutes, 0)),
          underTwoRate: percent(author.slaComplianceRate)
        };
        if (index % 2 === 1) {
          authorPage.commands.push(fillRectCommand(MARGIN, authorPage.cursorY - 5, 732, 18, 0.96));
        }
        columns.forEach(function (column) {
          authorPage.commands.push(textCommand(
            column.x + 2,
            authorPage.cursorY,
            7.5,
            String(rowValues[column.key]),
            false
          ));
        });
        authorPage.cursorY -= 19;
      });
    }

    pages.forEach(function (page, index) {
      page.commands.push(lineCommand(MARGIN, 31, PAGE_WIDTH - MARGIN, 31, 0.4));
      page.commands.push(textCommand(
        MARGIN,
        17,
        7,
        'DAVES TECH · Tecnologia aplicada à eficiência operacional',
        false
      ));
      page.commands.push(textCommand(
        PAGE_WIDTH - 91,
        17,
        7,
        'Página ' + (index + 1) + ' de ' + pages.length,
        false
      ));
    });

    return pages.map(function (page) {
      return page.commands.join('');
    });
  }

  function buildPages(data, period, collectionMeta) {
    // MODELO_VISUAL_SLA_BASE_A4_LANDSCAPE
    data = data || {};
    data.summary = data.summary || {};
    data.authors = Array.isArray(data.authors) ? data.authors : [];
    data.byHour = Array.isArray(data.byHour) ? data.byHour : [];
    collectionMeta = collectionMeta || {};

    var pages = [];
    var summary = createPage(
      'Relatório Executivo de Produtividade Operacional',
      period,
      false
    );
    pages.push(summary);

    summary.commands.push(textColorCommand(
      MARGIN,
      505,
      8.5,
      'VISÃO EXECUTIVA',
      true,
      0.35,
      0.43,
      0.55
    ));
    var metrics = [
      {
        symbol: 'A',
        value: finite(data.summary.uniqueAudits, 0),
        label: 'Auditorias consolidadas',
        color: [0.02, 0.48, 0.75],
        tint: [0.88, 0.95, 0.99]
      },
      {
        symbol: 'O',
        value: finite(data.summary.operators, 0),
        label: 'Operadores identificados',
        color: [0.07, 0.64, 0.32],
        tint: [0.88, 0.97, 0.91]
      },
      {
        symbol: '2',
        value: finite(data.summary.ok, 0),
        label: 'Tratativas em até 2 min',
        color: [0.07, 0.64, 0.32],
        tint: [0.88, 0.97, 0.91]
      },
      {
        symbol: '5',
        value: finite(data.summary.attention, 0),
        label: 'Tratativas de 2 a 5 min',
        color: [0.87, 0.43, 0.01],
        tint: [0.99, 0.94, 0.86]
      },
      {
        symbol: '+',
        value: finite(data.summary.critical, 0),
        label: 'Tratativas acima de 5 min',
        color: [0.88, 0.10, 0.12],
        tint: [0.99, 0.89, 0.90]
      }
    ];
    var metricGap = 7;
    var metricWidth = (PAGE_WIDTH - MARGIN * 2 - metricGap * 4) / 5;
    metrics.forEach(function (metric, index) {
      drawMetricCard(
        summary,
        MARGIN + index * (metricWidth + metricGap),
        438,
        metricWidth,
        56,
        metric
      );
    });

    drawDistributionPanel(
      summary,
      data,
      MARGIN,
      272,
      378,
      151
    );
    drawRankingPanel(
      summary,
      data,
      MARGIN + 386,
      272,
      PAGE_WIDTH - MARGIN * 2 - 386,
      151
    );

    summary.commands.push(textColorCommand(
      MARGIN,
      256,
      8.5,
      'BASE E RASTREABILIDADE DA ANÁLISE',
      true,
      0.35,
      0.43,
      0.55
    ));
    summary.commands.push(fillRoundedRectRgbCommand(
      MARGIN,
      198,
      PAGE_WIDTH - MARGIN * 2,
      49,
      6,
      0.97,
      0.98,
      0.99
    ));
    var traceability = [
      ['Processamento', collectionMeta.auditExecutionMode === 'minimized-window'
        ? 'Audit em janela minimizada'
        : 'Audit em segundo plano'],
      ['Páginas consultadas', String(finite(collectionMeta.pagesRead, 0))],
      ['Linhas examinadas', String(finite(collectionMeta.examinedRows, 0))],
      ['Filtro Audit', collectionMeta.auditPeriodFilter &&
        collectionMeta.auditPeriodFilter.applied ? 'Confirmado' : 'Não confirmado']
    ];
    traceability.forEach(function (entry, index) {
      var x = MARGIN + 13 + index * 194;
      summary.commands.push(textColorCommand(
        x,
        229,
        6.8,
        entry[0],
        true,
        0.35,
        0.43,
        0.55
      ));
      summary.commands.push(textCommand(
        x,
        211,
        8,
        shorten(entry[1], 28),
        index > 0
      ));
    });

    drawHorizontalBarChart(
      summary,
      'Produção por hora · auditorias consolidadas',
      data.byHour,
      MARGIN,
      180,
      PAGE_WIDTH - MARGIN * 2,
      6
    );

    var columns = [
      { label: '#', x: 28, key: 'rank' },
      { label: 'OPERADOR', x: 49, key: 'author' },
      { label: 'AUDITORIAS', x: 248, key: 'uniqueAudits' },
      { label: 'EVENTOS', x: 310, key: 'totalEventsObserved' },
      { label: 'ATÉ 2M', x: 363, key: 'ok' },
      { label: '2 A 5M', x: 414, key: 'attention' },
      { label: 'ACIMA 5M', x: 464, key: 'critical' },
      { label: 'SEM DURAÇÃO', x: 526, key: 'unknown' },
      { label: 'COBERTURA', x: 602, key: 'coverage' },
      { label: 'TEMPO MÉDIO', x: 666, key: 'average' },
      { label: '% ATÉ 2M', x: 745, key: 'underTwoRate' }
    ];

    function newAuthorPage() {
      var page = createPage('Desempenho detalhado por operador', period, true);
      page.commands.push(textColorCommand(
        MARGIN,
        520,
        8.5,
        'DESEMPENHO DETALHADO POR OPERADOR',
        true,
        0.35,
        0.43,
        0.55
      ));
      page.commands.push(fillRectRgbCommand(
        MARGIN,
        489,
        PAGE_WIDTH - MARGIN * 2,
        21,
        0.95,
        0.97,
        0.99
      ));
      columns.forEach(function (column) {
        page.commands.push(textColorCommand(
          column.x + 2,
          497,
          6.3,
          column.label,
          true,
          0.28,
          0.35,
          0.46
        ));
      });
      page.commands.push(lineCommand(
        MARGIN,
        488,
        PAGE_WIDTH - MARGIN,
        488,
        0.4
      ));
      page.cursorY = 474;
      pages.push(page);
      return page;
    }

    if (data.authors.length) {
      var authorPage = newAuthorPage();
      data.authors.forEach(function (author, index) {
        if (authorPage.cursorY < 51) authorPage = newAuthorPage();
        var rowValues = {
          rank: index + 1,
          author: shorten(author.author || 'Não informado', 31),
          uniqueAudits: finite(author.uniqueAudits, 0),
          totalEventsObserved: finite(author.totalEventsObserved, 0),
          ok: finite(author.ok, 0),
          attention: finite(author.attention, 0),
          critical: finite(author.critical, 0),
          unknown: finite(author.unknown, 0),
          coverage: percent(author.timeCoverageRate),
          average: utils.formatMinutes(finite(author.averageMinutes, 0)),
          underTwoRate: percent(author.slaComplianceRate)
        };
        if (index % 2 === 1) {
          authorPage.commands.push(fillRectRgbCommand(
            MARGIN,
            authorPage.cursorY - 5,
            PAGE_WIDTH - MARGIN * 2,
            17,
            0.975,
            0.983,
            0.993
          ));
        }
        columns.forEach(function (column) {
          authorPage.commands.push(textCommand(
            column.x + 2,
            authorPage.cursorY,
            6.8,
            String(rowValues[column.key]),
            column.key === 'rank' || column.key === 'author'
          ));
        });
        authorPage.commands.push(lineCommand(
          MARGIN,
          authorPage.cursorY - 6,
          PAGE_WIDTH - MARGIN,
          authorPage.cursorY - 6,
          0.2
        ));
        authorPage.cursorY -= 18;
      });
    }

    pages.forEach(function (page, index) {
      drawReportFooter(page, index + 1, pages.length);
    });

    return pages.map(function (page) {
      return page.commands.join('');
    });
  }

  function modelCenterTextCommand(centerX, y, size, value, bold, red, green, blue) {
    var x = centerX - approximateTextWidth(value, size, bold) / 2;
    return textColorCommand(x, y, size, value, bold, red, green, blue);
  }

  function createMandatoryModelPage() {
    return {
      commands: [
        '0 g 0 G\n',
        fillRectRgbCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 1, 1, 1)
      ],
      cursorY: 0
    };
  }

  function drawMandatoryModelHeader(page, period, collectionMeta) {
    gradientRoundedHeader(page, 26, 508, PAGE_WIDTH - 52, 58);
    page.commands.push(fillRoundedRectRgbCommand(
      40, 521, 36, 36, 8, 0.29, 0.41, 0.68
    ));
    page.commands.push(strokeRoundedRectRgbCommand(
      40, 521, 36, 36, 8, 0.55, 0.67, 0.90, 0.8
    ));
    page.commands.push(textColorCommand(49, 535, 12, 'GA', true, 1, 1, 1));
    page.commands.push(textColorCommand(
      88, 541, 16.8, 'Relatório Executivo de Produtividade Operacional',
      true, 1, 1, 1
    ));
    page.commands.push(textColorCommand(
      88, 522, 7.8, 'GoAwake Cloud · Monitoramento operacional',
      false, 0.88, 0.93, 1
    ));
    page.commands.push(rightTextCommand(
      PAGE_WIDTH - 40, 541, 9.5, formatPeriodRange(period),
      true, 1, 1, 1
    ));
    page.commands.push(rightTextCommand(
      PAGE_WIDTH - 40, 522, 7.2, 'Relatório gerado pelo Goawake SLA Monitor',
      false, 0.88, 0.93, 1
    ));
    if (collectionMeta && collectionMeta.partialCompletion === true) {
      page.commands.push(rightTextCommand(
        PAGE_WIDTH - 40, 512, 6.2,
        'Coleta finalizada com os dados disponíveis antes da falha de rede',
        true, 1, 0.86, 0.55
      ));
    }
  }

  function drawMandatoryMetricCards(page, data) {
    var metrics = [
      {
        symbol: 'A',
        value: finite(data.summary.uniqueAudits, 0),
        label: 'Auditorias consolidadas',
        color: [0.02, 0.48, 0.75],
        tint: [0.88, 0.95, 0.99]
      },
      {
        symbol: 'O',
        value: finite(data.summary.operators, 0),
        label: 'Operadores identificados',
        color: [0.07, 0.64, 0.32],
        tint: [0.88, 0.97, 0.91]
      },
      {
        symbol: '2',
        value: finite(data.summary.ok, 0),
        label: 'Tratativas em até 2 min',
        color: [0.07, 0.64, 0.32],
        tint: [0.88, 0.97, 0.91]
      },
      {
        symbol: '5',
        value: finite(data.summary.attention, 0),
        label: 'Tratativas de 2 a 5 min',
        color: [0.87, 0.43, 0.01],
        tint: [0.99, 0.94, 0.86]
      },
      {
        symbol: '+',
        value: finite(data.summary.critical, 0),
        label: 'Tratativas acima de 5 min',
        color: [0.88, 0.10, 0.12],
        tint: [0.99, 0.89, 0.90]
      }
    ];
    var gap = 7;
    var width = (PAGE_WIDTH - 52 - gap * 4) / 5;
    metrics.forEach(function (metric, index) {
      drawMetricCard(page, 26 + index * (width + gap), 410, width, 66, metric);
      page.commands.push(ringSegmentCommand(
        26 + index * (width + gap) + width - 18,
        458,
        22,
        0.1,
        0,
        359.7,
        metric.tint[0],
        metric.tint[1],
        metric.tint[2]
      ));
    });
  }

  function drawMandatoryHourPanel(page, data, x, y, width, height) {
    var entries = (data.byHour || []).slice(0, 5);
    var maximum = Math.max.apply(null, entries.map(function (entry) {
      return finite(entry[1], 0);
    }).concat([1]));
    page.commands.push(fillRoundedRectRgbCommand(x, y, width, height, 7, 1, 1, 1));
    page.commands.push(strokeRoundedRectRgbCommand(
      x, y, width, height, 7, 0.86, 0.90, 0.95, 0.65
    ));
    page.commands.push(textColorCommand(
      x + 12, y + height - 20, 10.5,
      'Produção por hora', true, 0.06, 0.10, 0.19
    ));
    page.commands.push(textColorCommand(
      x + 12, y + height - 32, 7,
      'Auditorias consolidadas no período', false, 0.35, 0.43, 0.55
    ));
    if (!entries.length) {
      page.commands.push(textCommand(
        x + 12, y + height - 58, 8, 'Nenhuma tratativa no período.', false
      ));
      return;
    }
    entries.forEach(function (entry, index) {
      var rowY = y + height - 58 - index * 20;
      var value = finite(entry[1], 0);
      var barX = x + 70;
      var barWidth = width - 114;
      page.commands.push(textCommand(x + 12, rowY + 1, 7.2, entry[0], true));
      page.commands.push(fillRoundedRectRgbCommand(
        barX, rowY - 1, barWidth, 6, 3, 0.90, 0.93, 0.97
      ));
      page.commands.push(fillRoundedRectRgbCommand(
        barX,
        rowY - 1,
        Math.max(value > 0 ? 3 : 0, value / maximum * barWidth),
        6,
        3,
        0.13,
        0.34,
        0.88
      ));
      page.commands.push(rightTextCommand(
        x + width - 12, rowY + 1, 7.2, String(value),
        true, 0.06, 0.10, 0.19
      ));
    });
  }

  function drawMandatoryOperatorSummary(page, data, y, height) {
    var summary = [
      [finite(data.summary.uniqueAudits, 0), 'AUDITORIAS'],
      [finite(data.summary.ok, 0), 'ATÉ 2 MIN'],
      [finite(data.summary.attention, 0), 'DE 2 A 5 MIN'],
      [finite(data.summary.critical, 0), 'ACIMA DE 5 MIN'],
      [utils.formatMinutes(finite(data.summary.averageMinutes, 0)), 'TEMPO MÉDIO']
    ];
    var width = (PAGE_WIDTH - 52) / summary.length;
    summary.forEach(function (entry, index) {
      var x = 26 + index * width;
      page.commands.push(fillRectRgbCommand(
        x, y, width - 0.5, height, 0.972, 0.98, 0.988
      ));
      page.commands.push(modelCenterTextCommand(
        x + width / 2, y + height - 16, 11.5, String(entry[0]), true,
        index === 1 ? 0.07 : index === 2 ? 0.87 : index === 3 ? 0.88 : 0.11,
        index === 1 ? 0.64 : index === 2 ? 0.43 : index === 3 ? 0.10 : 0.31,
        index === 1 ? 0.32 : index === 2 ? 0.01 : index === 3 ? 0.12 : 0.85
      ));
      page.commands.push(modelCenterTextCommand(
        x + width / 2, y + 7, 6.2, entry[1], true, 0.35, 0.43, 0.55
      ));
    });
  }

  function drawMandatoryTableHeader(page, y) {
    page.commands.push(fillRectRgbCommand(
      26, y, PAGE_WIDTH - 52, 19, 0.972, 0.98, 0.988
    ));
    var headers = [
      ['OPERADOR', 50],
      ['AUDITORIAS', 330],
      ['ATÉ 2M', 420],
      ['2 A 5M', 495],
      ['ACIMA 5M', 565],
      ['TEMPO MÉDIO', 650],
      ['% ATÉ 2M', 758]
    ];
    headers.forEach(function (entry) {
      page.commands.push(textColorCommand(
        entry[1], y + 7, 6.2, entry[0], true, 0.28, 0.33, 0.41
      ));
    });
    page.commands.push(lineCommand(26, y, PAGE_WIDTH - 26, y, 0.35));
  }

  function drawMandatoryAuthorRow(page, author, rank, baseline, alternate) {
    if (alternate) {
      page.commands.push(fillRectRgbCommand(
        26, baseline - 6, PAGE_WIDTH - 52, 18, 0.975, 0.983, 0.993
      ));
    }
    page.commands.push(textCommand(34, baseline, 6.7, String(rank), true));
    page.commands.push(textCommand(
      50, baseline, 6.8, shorten(author.author || 'Não informado', 41), true
    ));
    page.commands.push(textCommand(
      330, baseline, 6.8, String(finite(author.uniqueAudits, 0)), false
    ));
    page.commands.push(textCommand(420, baseline, 6.8, String(finite(author.ok, 0)), false));
    page.commands.push(textCommand(
      495, baseline, 6.8, String(finite(author.attention, 0)), false
    ));
    page.commands.push(textCommand(
      565, baseline, 6.8, String(finite(author.critical, 0)), false
    ));
    page.commands.push(textCommand(
      650, baseline, 6.8, utils.formatMinutes(finite(author.averageMinutes, 0)), false
    ));
    page.commands.push(textCommand(
      758, baseline, 6.8, percent(author.slaComplianceRate), false
    ));
    page.commands.push(lineCommand(
      26, baseline - 6, PAGE_WIDTH - 26, baseline - 6, 0.2
    ));
  }

  function drawMandatoryModelFooter(page, pageNumber, pageCount) {
    var center = PAGE_WIDTH / 2;
    page.commands.push(modelCenterTextCommand(
      center, 25, 6.5, 'Goawake SLA Monitor', true, 0.06, 0.10, 0.19
    ));
    page.commands.push(modelCenterTextCommand(
      center, 15, 5.8,
      'Modelo SLA Base M1 · Build 3.2.14-R2 · DAVES TECH · Página ' +
        pageNumber + ' de ' + pageCount,
      false, 0.35, 0.43, 0.55
    ));
  }

  function buildPagesFromMandatoryModel(data, period, collectionMeta) {
    data = data || {};
    data.summary = data.summary || {};
    data.authors = Array.isArray(data.authors) ? data.authors : [];
    data.byHour = Array.isArray(data.byHour) ? data.byHour : [];

    var pages = [];
    var first = createMandatoryModelPage();
    pages.push(first);
    drawMandatoryModelHeader(first, period, collectionMeta);
    first.commands.push(textColorCommand(
      26, 490, 8.5, 'VISÃO GERAL', true, 0.35, 0.43, 0.55
    ));
    drawMandatoryMetricCards(first, data);
    drawDistributionPanel(first, data, 26, 258, 397, 136);
    drawMandatoryHourPanel(first, data, 432, 258, 384, 136);
    first.commands.push(textColorCommand(
      26, 241, 8.5, 'DETALHAMENTO POR OPERADOR', true, 0.35, 0.43, 0.55
    ));
    gradientRoundedHeader(first, 26, 197, PAGE_WIDTH - 52, 36);
    first.commands.push(textColorCommand(
      38, 216, 11.5, 'Consolidado operacional por autor', true, 1, 1, 1
    ));
    first.commands.push(textColorCommand(
      38, 203, 6.8, 'Cada ID de auditoria é contado uma única vez',
      false, 0.88, 0.93, 1
    ));
    first.commands.push(rightTextCommand(
      PAGE_WIDTH - 38, 211, 7.2,
      finite(data.summary.operators, 0) + ' operadores',
      true, 1, 1, 1
    ));
    drawMandatoryOperatorSummary(first, data, 159, 38);
    drawMandatoryTableHeader(first, 140);

    var index = 0;
    var baseline = 127;
    while (index < data.authors.length && baseline >= 55) {
      drawMandatoryAuthorRow(first, data.authors[index], index + 1, baseline, index % 2 === 1);
      index += 1;
      baseline -= 18;
    }

    while (index < data.authors.length) {
      var continuation = createMandatoryModelPage();
      pages.push(continuation);
      drawMandatoryOperatorSummary(continuation, data, 535, 32);
      drawMandatoryTableHeader(continuation, 516);
      baseline = 502;
      while (index < data.authors.length && baseline >= 52) {
        drawMandatoryAuthorRow(
          continuation,
          data.authors[index],
          index + 1,
          baseline,
          index % 2 === 1
        );
        index += 1;
        baseline -= 18;
      }
    }

    if (!data.authors.length) {
      first.commands.push(textCommand(
        50, 127, 7.5, 'Nenhum operador identificado no período selecionado.', false
      ));
    }

    pages.forEach(function (page, pageIndex) {
      drawMandatoryModelFooter(page, pageIndex + 1, pages.length);
    });
    return pages.map(function (page) {
      return page.commands.join('');
    });
  }

  function buildPdf(data, period, collectionMeta) {
    // O layout abaixo é derivado do modelo obrigatório:
    // docs/references/modelo_relatorio_sla_pdf_base.pdf
    var pageStreams = buildPagesFromMandatoryModel(data, period, collectionMeta);
    var objectCount = 4 + pageStreams.length * 2;
    var objects = new Array(objectCount + 1);
    var pageReferences = [];

    objects[1] = encodeCp1252('<< /Type /Catalog /Pages 2 0 R >>');
    objects[3] = encodeCp1252(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    );
    objects[4] = encodeCp1252(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    );

    pageStreams.forEach(function (stream, index) {
      var pageId = 5 + index * 2;
      var contentId = pageId + 1;
      var streamBytes = encodeCp1252(stream);
      pageReferences.push(pageId + ' 0 R');
      objects[pageId] = encodeCp1252(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        PAGE_WIDTH + ' ' + PAGE_HEIGHT +
        '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ' +
        '/Contents ' + contentId + ' 0 R >>'
      );
      objects[contentId] = concatBytes([
        encodeCp1252('<< /Length ' + streamBytes.length + ' >>\nstream\n'),
        streamBytes,
        encodeCp1252('endstream')
      ]);
    });

    objects[2] = encodeCp1252(
      '<< /Type /Pages /Count ' + pageStreams.length +
      ' /Kids [' + pageReferences.join(' ') + '] >>'
    );

    var chunks = [encodeCp1252('%PDF-1.4\n%âãÏÓ\n')];
    var offsets = new Array(objectCount + 1).fill(0);
    var byteOffset = chunks[0].length;
    for (var id = 1; id <= objectCount; id += 1) {
      offsets[id] = byteOffset;
      var objectBytes = concatBytes([
        encodeCp1252(id + ' 0 obj\n'),
        objects[id],
        encodeCp1252('\nendobj\n')
      ]);
      chunks.push(objectBytes);
      byteOffset += objectBytes.length;
    }

    var xrefOffset = byteOffset;
    var xref = 'xref\n0 ' + (objectCount + 1) +
      '\n0000000000 65535 f \n';
    for (var offsetIndex = 1; offsetIndex <= objectCount; offsetIndex += 1) {
      xref += String(offsets[offsetIndex]).padStart(10, '0') + ' 00000 n \n';
    }
    xref += 'trailer\n<< /Size ' + (objectCount + 1) +
      ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
    chunks.push(encodeCp1252(xref));

    return {
      bytes: concatBytes(chunks),
      filename: createFilename(period),
      pageCount: pageStreams.length
    };
  }

  function downloadBuilt(result) {
    if (!result || !(result.bytes instanceof Uint8Array)) {
      throw new Error('O documento PDF pronto para download é inválido.');
    }
    var blob = new Blob([result.bytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 5000);
    return result;
  }

  function download(data, period, collectionMeta) {
    return downloadBuilt(buildPdf(data, period, collectionMeta));
  }

  global.GoAwakeDashboardPdf = Object.freeze({
    build: buildPdf,
    downloadBuilt: downloadBuilt,
    download: download,
    createFilename: createFilename
  });
})(window);
