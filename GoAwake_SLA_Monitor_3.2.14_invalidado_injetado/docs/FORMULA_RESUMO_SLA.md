# Fórmula oficial do Resumo SLA

O resumo manual e o relatório automático devem utilizar sempre a mesma regra:

`tempo do resumo = horário atual − menor horário válido da coluna Disponível em`

Regras permanentes:

- considerar somente as linhas visíveis na tela atual;
- ignorar valores vazios, inválidos ou posteriores ao horário atual;
- escolher o horário cronologicamente mais antigo de `Disponível em`;
- calcular minutos completos com arredondamento para baixo;
- não calcular média dos tempos individuais;
- aplicar a mesma fórmula aos recortes Vale, Argenta, Libéria e Geral.

Exemplo: se a tela mostra `20:03`, `20:06` e `20:09`, e o horário atual é
`20:13`, o menor `Disponível em` é `20:03` e o tempo do resumo é `10 minutos`.
