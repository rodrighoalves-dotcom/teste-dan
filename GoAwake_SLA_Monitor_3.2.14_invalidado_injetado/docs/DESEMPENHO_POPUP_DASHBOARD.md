# Desempenho do popup SLA e do Dashboard

## Popup SLA

O popup SLA localizado no canto inferior esquerdo possui duas formas de
atualização:

- mudanças observadas na tabela da Fadiga são processadas após 100 ms;
- um ciclo de segurança verifica a tela a cada 3 segundos.

O conteúdo visual só é reconstruído quando placa, motorista, tempo ou estado SLA
mudam. Isso evita redesenhos idênticos e reduz oscilações no popup.

## Dashboard

A coleta do Dashboard continua acontecendo em uma guia Audit dedicada e oculta.
As páginas visíveis usadas pela equipe não são paginadas pela extensão.

Para cada página da Audit oculta, a extensão:

1. aguarda a assinatura da tabela mudar após o clique em Próxima;
2. confirma a estabilidade em duas leituras consecutivas de 100 ms;
3. lê os registros e continua.

A espera mínima artificial por página caiu de aproximadamente 1.750 ms para
300 ms. O tempo real total ainda depende da resposta do GoAwake, da quantidade de
páginas e da conexão.
