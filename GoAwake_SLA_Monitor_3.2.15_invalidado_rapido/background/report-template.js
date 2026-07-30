function gerarRelatorioBackgroundBase(dados) {
  var registros = dados.registros;
  var agora = new Date(dados.timestamp);
  var slaOperacional = SLA_CONFIG.sla.operational;
  var politicaValeArgenta = slaOperacional.valeArgenta;
  var politicaGeral = slaOperacional.general;

  var generalSelection = dados.preselectionCode === 'GENERAL';
  var stats = generalSelection
    ? {
        'Geral': { total: 0, dentro: 0, atencao: 0, critico: 0, availableTimes: [], policy: politicaGeral, sla: politicaGeral.critical }
      }
    : {
        'Argenta': { total: 0, dentro: 0, atencao: 0, critico: 0, availableTimes: [], policy: politicaValeArgenta, sla: politicaValeArgenta.critical },
        'Vale': { total: 0, dentro: 0, atencao: 0, critico: 0, availableTimes: [], policy: politicaValeArgenta, sla: politicaValeArgenta.critical },
        'Libéria': { total: 0, dentro: 0, atencao: 0, critico: 0, availableTimes: [], policy: politicaGeral, sla: politicaGeral.critical },
        'Outras': { total: 0, dentro: 0, atencao: 0, critico: 0, availableTimes: [], policy: politicaGeral, sla: politicaGeral.critical }
      };

  for (var i = 0; i < registros.length; i++) {
    var r = registros[i];
    var emp = generalSelection ? 'Geral' : r.empresa;
    var sla = stats[emp].sla;
    var alerta = stats[emp].policy.attention;

    stats[emp].total++;
    stats[emp].availableTimes.push(r.availableAt);

    if (r.minutos > sla) stats[emp].critico++;
    else if (r.minutos >= alerta) stats[emp].atencao++;
    else stats[emp].dentro++;
  }

  for (var emp in stats) {
    var d = stats[emp];
    var summaryTime = SLASummaryCalculator.fromAvailableTimes(d.availableTimes, agora);
    d.media = summaryTime.elapsedMinutes;
    d.earliestAvailableAt = summaryTime.earliestAvailableAt;
    d.percentual = d.total > 0 ? Math.round((d.dentro / d.total) * 100) : 0;
  }

  var totalGeral = 0, totalDentro = 0, totalAtencao = 0, totalCritico = 0;
  for (var e in stats) {
    totalGeral += stats[e].total;
    totalDentro += stats[e].dentro;
    totalAtencao += stats[e].atencao;
    totalCritico += stats[e].critico;
  }
  var percentualGeral = totalGeral > 0 ? Math.round((totalDentro / totalGeral) * 100) : 0;

  var ordem = generalSelection
    ? ['Geral']
    : ['Argenta', 'Vale', 'Libéria', 'Outras'];
  var desempenhoHTML = '';
  for (var o = 0; o < ordem.length; o++) {
    var emp = ordem[o];
    var d = stats[emp];
    desempenhoHTML += '<tr><td>' + emp + '</td><td>' + (d.total > 0 ? d.percentual + '%' : '—') + '</td></tr>';
  }

  var cores = { 'Geral': '#16a34a', 'Argenta': '#e53e3e', 'Vale': '#2b6cb0', 'Libéria': '#38a169', 'Outras': '#805ad5' };
  var detalhamentoHTML = '';

  for (var o = 0; o < ordem.length; o++) {
    var empresa = ordem[o];
    var d = stats[empresa];
    if (d.total === 0) continue;

    var cor = cores[empresa] || '#2b6cb0';
    detalhamentoHTML += '<div class="empresa-section">';
    detalhamentoHTML += '<div class="empresa-header" style="background:' + cor + ';"><span><strong>' + empresa + '</strong></span><span>SLA: ' + d.sla + ' min</span></div>';
    detalhamentoHTML += '<div class="empresa-resumo">';
    detalhamentoHTML += '<div class="resumo-item"><span class="num">' + d.total + '</span><span class="label">TOTAL</span></div>';
    detalhamentoHTML += '<div class="resumo-item"><span class="num" style="color:#38a169;">' + d.dentro + '</span><span class="label">OK</span></div>';
    detalhamentoHTML += '<div class="resumo-item"><span class="num" style="color:#d69e2e;">' + d.atencao + '</span><span class="label">⚠</span></div>';
    detalhamentoHTML += '<div class="resumo-item"><span class="num" style="color:#e53e3e;">' + d.critico + '</span><span class="label">✗</span></div>';
    detalhamentoHTML += '<div class="resumo-item"><span class="num" style="color:#2b6cb0;">' + d.media + ' min</span><span class="label">MÉDIA</span></div>';
    detalhamentoHTML += '</div></div>';
  }

  return '<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>Relatório SLA</title>\n<style>\n*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:30px;background:#f0f4f8;color:#1a202c}.container{max-width:1100px;margin:0 auto;background:#fff;border-radius:16px;padding:35px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}.header{border-bottom:3px solid #2b6cb0;padding-bottom:20px;margin-bottom:25px;display:flex;justify-content:space-between;align-items:flex-end}.header h1{font-size:26px;color:#2b6cb0}.header .subtitle{color:#4a5568;font-size:14px}.header .timestamp{text-align:right;font-size:14px;color:#4a5568}.header .timestamp strong{display:block;font-size:18px;color:#2b6cb0}.visao-geral{background:#f7fafc;border-radius:12px;padding:20px 25px;margin-bottom:25px}.visao-geral h2{font-size:16px;color:#2d3748;margin-bottom:15px}.indicadores{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}.indicador{text-align:center;background:#fff;border-radius:8px;padding:15px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}.indicador .numero{font-size:32px;font-weight:700;color:#2b6cb0}.indicador .numero.critico{color:#e53e3e}.indicador .numero.atencao{color:#d69e2e}.indicador .numero.ok{color:#38a169}.indicador .label{font-size:12px;color:#4a5568;margin-top:4px}.desempenho-empresas{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px;background:#f7fafc;border-radius:12px;padding:20px 25px}.desempenho-empresas h2{grid-column:1/-1;font-size:16px;color:#2d3748}.desempenho-empresas .grid-2{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:20px}.desempenho-empresas table{width:100%;border-collapse:collapse;font-size:14px}.desempenho-empresas th{text-align:left;color:#4a5568;padding:6px 8px;border-bottom:1px solid #e2e8f0}.desempenho-empresas td{padding:6px 8px;border-bottom:1px solid #e2e8f0}.card-resultado{display:flex;flex-direction:column;justify-content:center;align-items:center;background:#fff;border-radius:8px;padding:15px}.card-resultado .grande{font-size:48px;font-weight:700;color:#2b6cb0}.card-resultado .rotulo{font-size:13px;color:#4a5568}.card-resultado .detalhes{margin-top:8px;font-size:12px;color:#718096}.card-resultado .detalhes .ok{color:#38a169}.card-resultado .detalhes .atencao{color:#d69e2e}.card-resultado .detalhes .critico{color:#e53e3e}.empresa-section{margin-bottom:25px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.empresa-header{padding:12px 20px;display:flex;justify-content:space-between;align-items:center;color:#fff}.empresa-header strong{font-size:16px}.empresa-header span:last-child{background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:12px}.empresa-resumo{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:15px 20px;background:#f7fafc;border-bottom:1px solid #e2e8f0}.empresa-resumo .resumo-item{text-align:center}.empresa-resumo .num{font-size:20px;font-weight:700;display:block}.empresa-resumo .label{font-size:11px;color:#4a5568;margin-top:2px}.footer{margin-top:30px;padding-top:20px;border-top:2px solid #e2e8f0;text-align:center;font-size:12px;color:#718096}.footer .legenda{font-size:11px;color:#a0aec0;margin-top:4px}@media print{body{padding:15px;background:#fff}.container{box-shadow:none;padding:20px}.visao-geral{background:#f7fafc}.desempenho-empresas{background:#f7fafc}}@media(max-width:768px){body{padding:15px}.container{padding:20px}.indicadores{grid-template-columns:repeat(2,1fr)}.empresa-resumo{grid-template-columns:repeat(3,1fr)}.header{flex-direction:column;align-items:flex-start;gap:10px}.header .timestamp{text-align:left}.desempenho-empresas{grid-template-columns:1fr}.desempenho-empresas .grid-2{grid-template-columns:1fr}}\n</style>\n</head><body>\n<div class="container">\n<div class="header"><div><h1>📊 Relatório Executivo de SLA</h1><div class="subtitle">GoAwake Cloud · Monitoramento em tempo real</div></div><div class="timestamp"><strong>' + agora.toLocaleString('pt-BR') + '</strong><div style="font-size:12px;color:#718096;">Atualização automática</div></div></div>\n\n<div class="visao-geral"><h2>VISÃO GERAL</h2><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span style="font-size:13px;color:#4a5568;font-weight:600;">Indicador geral de SLA</span><span style="font-size:13px;color:#4a5568;">Percentual de veículos dentro do prazo</span></div>\n<div class="indicadores">\n<div class="indicador"><div class="numero ok">' + totalDentro + '</div><div class="label">Dentro do SLA</div></div>\n<div class="indicador"><div class="numero atencao">' + totalAtencao + '</div><div class="label">Atenção</div></div>\n<div class="indicador"><div class="numero critico">' + totalCritico + '</div><div class="label">Crítico</div></div>\n<div class="indicador"><div class="numero" style="color:#2b6cb0;">' + percentualGeral + '%</div><div class="label">Cumprimento geral</div></div>\n</div></div>\n\n<div class="desempenho-empresas"><h2>Desempenho por empresa</h2>\n<div class="grid-2"><div><table><thead><tr><th>Empresa</th><th>Percentual de conformidade</th></tr></thead><tbody>' + desempenhoHTML + '</tbody></table></div>\n<div class="card-resultado"><div class="grande">' + percentualGeral + '%</div><div class="rotulo">resultado geral</div><div class="detalhes">' + totalGeral + ' veículos monitorados <span class="ok">✓ ' + totalDentro + '</span> <span class="atencao">! ' + totalAtencao + '</span> <span class="critico">× ' + totalCritico + '</span></div></div></div></div>\n\n<h2 style="font-size:16px;color:#2d3748;margin-bottom:15px;">DETALHAMENTO POR EMPRESA</h2>\n' + detalhamentoHTML + '\n\n<div class="footer"><p>GoAwake Cloud · Relatório gerado automaticamente</p><div class="legenda">Argenta, Vale e Libéria: SLA 5 min | Outras: SLA 10 min</div><div class="legenda" style="font-size:10px;">Libéria: 4 letras + hífen + 2 números (ex: ABCD-12)</div></div>\n</div></body></html>';
}

function gerarRelatorioBackground(dados) {
  var html = gerarRelatorioBackgroundBase(dados);
  var footerPolicy = dados.preselectionCode === 'GENERAL'
    ? 'Pré-seleção GERAL: SLA geral 10 min; sem classificação Vale/Argenta por placa ou motorista'
    : 'Vale e Argenta: SLA 5 min | Geral, Libéria e demais: SLA 10 min';
  return html
    .replace(
      /(<div class="footer"><p>.*?<\/p><div class="legenda">).*?(<\/div>)/,
      '$1' + footerPolicy + '$2'
    )
    .replace(/>MÉDIA</g, '>TEMPO SLA<')
    .replace(
      '<div class="subtitle">GoAwake Cloud · Monitoramento em tempo real</div>',
      '<div class="subtitle">GoAwake Cloud · Monitoramento em tempo real</div>' +
      '<div class="subtitle">Fórmula: horário atual − menor “Disponível em” da tela atual</div>'
    );
}
