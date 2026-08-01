'use strict';

(function() {
  function abrirWhatsApp(mensagem) {
    try {
      var nomeJanela = 'whatsapp_sla_monitor';
      var whatsWin = window.open(
        'https://web.whatsapp.com/send?text=' + mensagem,
        nomeJanela,
        'width=400,height=600'
      );
      
      if (!whatsWin || whatsWin.closed) {
        whatsWin = window.open('https://web.whatsapp.com/send?text=' + mensagem, '_blank');
      }
      
      if (whatsWin) {
        whatsWin.focus();
        console.log('[SLA] WhatsApp aberto com sucesso.');
        return true;
      } else {
        alert(
          '⚠️ O popup do WhatsApp foi bloqueado.\n\n' +
          'Clique no ícone de popup bloqueado na barra de endereço e permita.\n\n' +
          'Ou copie a mensagem abaixo e cole manualmente no WhatsApp:\n\n' +
          decodeURIComponent(mensagem)
        );
        return false;
      }
    } catch (e) {
      console.error('[SLA] Erro ao abrir WhatsApp:', e);
      return false;
    }
  }

  function gerarPDFeWhatsApp() {
    console.log('[SLA] Gerando PDF e preparando WhatsApp...');

    var enviarWhats = confirm(
      '📄 Gerar PDF e enviar para o grupo "Alinhamentos Operacionais Creare" no WhatsApp?'
    );

    var popup = document.getElementById('resumo-sla-fadiga');
    if (!popup) {
      alert('Nenhum relatório encontrado. Gere o relatório primeiro.');
      return;
    }
    var selectionCode = popup.getAttribute('data-selection-code') || 'UNKNOWN';

    var conteudo = popup.cloneNode(true);
    var botoes = conteudo.querySelectorAll('button');
    botoes.forEach(function(btn) { btn.remove(); });

    var htmlConteudo = conteudo.innerHTML;

    var htmlImpressao = '<!DOCTYPE html>';
    htmlImpressao += '<html><head>';
    htmlImpressao += '<meta charset="UTF-8">';
    htmlImpressao += '<title>Relatório SLA</title>';
    htmlImpressao += '<style>';
    htmlImpressao += 'body { font-family: "Segoe UI", Arial, sans-serif; padding: 20px; background: white; color: #1e293b; }';
    htmlImpressao += '.container { max-width: 700px; margin: 0 auto; }';
    htmlImpressao += '.header { text-align: center; margin-bottom: 15px; }';
    htmlImpressao += '.header h1 { font-size: 22px; color: #1e293b; margin: 0; }';
    htmlImpressao += '.header .data { font-size: 16px; font-weight: 600; color: #1e293b; }';
    htmlImpressao += '.header .sub { font-size: 12px; color: #64748b; }';
    htmlImpressao += '.sla-destaque { display: flex; gap: 12px; margin: 15px 0; justify-content: center; }';
    htmlImpressao += '.sla-destaque .card { background: #f8fafc; border-radius: 10px; padding: 12px 16px; text-align: center; border: 1px solid #e2e8f0; min-width: 100px; flex: 1; }';
    htmlImpressao += '.sla-destaque .card .label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }';
    htmlImpressao += '.sla-destaque .card .tempo { font-size: 28px; font-weight: bold; }';
    htmlImpressao += '.sla-destaque .card .sla { font-size: 12px; color: #64748b; }';
    htmlImpressao += '.sla-destaque .card .status { font-size: 13px; font-weight: 600; margin-top: 4px; }';
    htmlImpressao += '.sla-destaque .card.vale .tempo { color: #2563eb; }';
    htmlImpressao += '.sla-destaque .card.argenta .tempo { color: #dc2626; }';
    htmlImpressao += '.sla-destaque .card.geral .tempo { color: #16a34a; }';
    htmlImpressao += '.resumo-empresas { display: flex; gap: 8px; margin: 10px 0; }';
    htmlImpressao += '.resumo-empresas .item { flex: 1; background: #f8fafc; border-radius: 6px; padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0; }';
    htmlImpressao += '.resumo-empresas .item .nome { font-size: 10px; color: #64748b; }';
    htmlImpressao += '.resumo-empresas .item .num { font-size: 16px; font-weight: bold; }';
    htmlImpressao += '.resumo-empresas .item .sla-info { font-size: 9px; color: #94a3b8; }';
    htmlImpressao += '.footer { margin-top: 15px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }';
    htmlImpressao += '.no-print { display: none; }';
    htmlImpressao += '@media print { body { padding: 10px; } }';
    htmlImpressao += '</style>';
    htmlImpressao += '</head><body>';
    htmlImpressao += '<div class="container">';
    htmlImpressao += htmlConteudo;
    htmlImpressao += '<div class="footer">';
    htmlImpressao += 'GoAwake Cloud · Relatório gerado automaticamente pelo SLA Monitor<br>';
    htmlImpressao += selectionCode === 'GENERAL'
      ? 'Pré-seleção GERAL: referência operacional geral de 10min, sem classificação Vale/Argenta por placa ou motorista'
      : 'Vale e Argenta: SLA 5min | Geral, Libéria e demais: SLA 10min';
    htmlImpressao += '</div>';
    htmlImpressao += '</div>';
    htmlImpressao += '</body></html>';

    var win = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (!win) {
      alert('Por favor, permita popups para esta página.');
      return;
    }

    win.document.write(htmlImpressao);
    win.document.close();

    if (enviarWhats) {
      setTimeout(function() {
        win.focus();
        win.print();
        
        var mensagem = encodeURIComponent(
          '📊 *RELATÓRIO SLA - ' + new Date().toLocaleString('pt-BR') + '*\n\n' +
          '📋 Resumo do monitoramento em tempo real.\n\n' +
          '🔗 ' + window.location.href
        );

        var checkPrint = setInterval(function() {
          if (win.closed) {
            clearInterval(checkPrint);
            abrirWhatsApp(mensagem);
          }
        }, 500);

        setTimeout(function() {
          clearInterval(checkPrint);
          if (!win.closed) {
            abrirWhatsApp(mensagem);
          }
        }, 10000);
      }, 1500);
    } else {
      setTimeout(function() {
        win.focus();
        win.print();
      }, 1000);
    }
  }

  window.SLAReportPrint = Object.freeze({
    abrirWhatsApp: abrirWhatsApp,
    gerarPDFeWhatsApp: gerarPDFeWhatsApp
  });
})();
