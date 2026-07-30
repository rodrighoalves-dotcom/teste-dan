# Integração do Dashboard — SLA Monitor 3.2.10

Este pacote foi criado como módulo adicional. Os arquivos existentes do monitor SLA não precisam ser substituídos.

## 1. Copiar os arquivos

Copie as pastas deste pacote para a raiz da extensão:

- `shared/productivity-config.js`
- `shared/audit-utils.js`
- `content/dashboard-collector.js`
- `content/dashboard-engine.js`
- `content/dashboard-view.js`
- `content/dashboard-controller.js`
- `content/dashboard.css`
- `popup/popup-controller.js`
- `popup.html`

## 3. Conferir manifest.json

O `manifest.json` precisa ter estas permissões:

```json
"permissions": [
  "storage",
  "alarms",
  "scripting",
  "activeTab"
]
```

Mantenha todas as permissões que já existem. Apenas adicione `scripting` e `activeTab` caso estejam ausentes.

Os `host_permissions` atuais do GoAwake devem ser preservados.

## 4. Recarregar

- Chrome: `chrome://extensions`
- Edge: `edge://extensions`

Ative o modo de desenvolvedor, clique em **Recarregar** e atualize a página Audit.

## 5. Uso

1. Abra o Audit.
2. Abra a extensão.
3. Clique em **Dashboard**.
4. Selecione o período.
5. O Dashboard combina a página visível com o histórico local sem alterar a paginação.
6. Confira a cobertura informada e exporte CSV resumido, CSV detalhado ou imprima em PDF.

## Garantia de isolamento

O módulo de Dashboard não altera:

- `content/report-runtime.js`;
- `content/report-print.js`;
- `background/service-worker.js`;
- `background/report-template.js`;
- `popup/monitor-injected.js`;
- lógica do resumo SLA manual ou automático.
