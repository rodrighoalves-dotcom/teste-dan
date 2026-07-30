# Audit minimizada e posições dos popups

Estado: alteração experimental aplicada somente ao protótipo.

## Dashboard

- A consulta do Dashboard cria uma janela separada do Edge.
- A janela abre sem foco e já minimizada.
- A janela é encerrada automaticamente ao concluir ou interromper a coleta.
- Se o navegador não permitir essa criação, a extensão usa uma guia inativa como
  modo de compatibilidade.
- A paginação da guia Fadiga e das guias Audit utilizadas pela equipe não é
  alterada.

## Monitor SLA

- O popup dos alertas voltou ao canto inferior esquerdo.
- O formato anterior foi restaurado, com 280 px de largura.
- O cabeçalho usa `TUDO EM ORDEM!!!`, `Atenção SLA` ou `SLA Crítico`.
- A lista mostra placa, motorista, tempo, limite e ação `Abrir`.
- Até doze alertas são exibidos antes do contador adicional.

## Andamento do Dashboard

- O aviso `Dashboard Gerencial` fica no canto superior esquerdo.
- O aviso desaparece ao concluir ou interromper a coleta.
- Assim, o aviso do Dashboard e o popup de alertas não ocupam a mesma posição.

Nenhum pacote definitivo foi criado por esta alteração.
