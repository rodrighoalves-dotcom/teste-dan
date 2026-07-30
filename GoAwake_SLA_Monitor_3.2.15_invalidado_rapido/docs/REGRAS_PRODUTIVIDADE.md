# Regras do Dashboard Gerencial

## Escopo

O módulo é independente do painel de SLA existente. Ele não altera:

- relatório SLA automático por hora;
- relatório SLA manual;
- timers;
- alarmes;
- templates atuais;
- regras existentes do monitor.

## Filtro de operadores

Somente registros cujo campo **Autor Tratativa** contenha `Moby` são considerados.

A comparação não diferencia letras maiúsculas de minúsculas.

## Período

O período é aplicado sobre o campo **Tratado em**.

O início e o fim são inclusivos.

O usuário seleciona um período relativo ao dia atual: Hoje ou últimos 7, 15,
30 ou 90 dias. O início é 00:00 do primeiro dia incluído e o fim é o horário
atual no momento em que o Dashboard é gerado.

## Identificador único

A chave única é o campo **ID da Auditoria**.

Quando o mesmo ID aparece novamente na página visível ou no histórico local, a ocorrência repetida é ignorada para o ranking principal.

## Ranking principal

O ranking utiliza **auditorias únicas por operador**.

## Indicadores de SLA do dashboard

- OK: até 2 minutos;
- Atenção: de 3 a 5 minutos;
- Crítico: acima de 5 minutos.

O tempo é calculado entre **Disponível em** e **Tratado em**.

O cálculo mantém precisão de segundos. O percentual de SLA considera somente registros com duração válida, e o dashboard exibe separadamente a cobertura de tempo da base.

Essas regras pertencem somente ao Dashboard Gerencial e não modificam o painel SLA já existente.
