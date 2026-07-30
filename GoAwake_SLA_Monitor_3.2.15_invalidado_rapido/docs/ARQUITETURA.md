# Arquitetura

## Princípio
Cada pasta possui uma responsabilidade específica, reduzindo o risco de uma alteração atingir funções não relacionadas.

## Pontos de manutenção
- Regras gerais: `shared/config.js`
- Interface: `popup/popup-controller.js`
- Monitor executado na página: `popup/monitor-injected.js`
- Impressão e WhatsApp: `content/report-print.js`
- Resumo e rotinas de relatório: `content/report-runtime.js`
- Alarmes: `background/service-worker.js`
- Modelo HTML do relatório automático: `background/report-template.js`

## Atualizações
Antes de publicar uma alteração:
1. atualize `manifest.json` e `version.txt`;
2. registre a mudança em `CHANGELOG.md`;
3. teste no Chrome e no Edge;
4. mantenha o ZIP da versão anterior.