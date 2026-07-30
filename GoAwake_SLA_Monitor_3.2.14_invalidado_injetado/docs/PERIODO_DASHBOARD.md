# Período do Dashboard

## Seleção

O Dashboard é solicitado na página Fadiga e permite escolher:

- Hoje;
- últimos 7, 15, 30 ou 90 dias;
- período personalizado com data e horário iniciais e finais.

Os atalhos começam às `00:00`. No período personalizado, o usuário escolhe as
horas e os minutos. O minuto final é inclusivo. Não é permitido selecionar um
horário futuro no dia atual.

Não são aceitos períodos futuros, datas invertidas ou intervalos superiores a
365 dias.

## Aplicação na Audit

A extensão abre uma guia Audit exclusiva em segundo plano e aguarda o componente
`Período`. No layout atual da Audit, ela preenche o primeiro campo com o início e
o segundo com o fim, ambos no formato compacto `DD/MM HH:mm`, e clica na lupa
vermelha pertencente ao mesmo bloco. Essa guia é fechada ao terminar.

O mapeamento do menu é:

- `gd-period-start` + `gd-period-start-time` → primeiro `input.dateInput`;
- `gd-period-end` + `gd-period-end-time` → segundo `input.dateInput`.

O primeiro campo é alterado e confirmado antes do segundo. A lupa só é acionada
depois que ambos os valores foram enviados ao componente Angular.

No componente PrimeNG mostrado na Audit, cada `input.dateInput` é clicado antes
do preenchimento para abrir o calendário correspondente. O valor é enviado pelos
eventos `input` e `change` e confirmado ao retirar o foco. Isso mantém sincronizados
o texto do campo, o dia selecionado e os controles de hora/minuto do calendário.

Quando o PrimeNG rejeita ou limpa algum valor, a extensão repete o preenchimento
uma vez. Se os dois campos ainda não conservarem exatamente o período solicitado,
a lupa não é acionada e a coleta mantém apenas a validação local por `Tratado em`.

Para o Dashboard solicitado pelo usuário, a lupa é obrigatória. A busca é
procurada também nos contêineres externos ao componente `Período`, pois o botão
vermelho pode ser irmão do bloco interno dos calendários. Depois do clique, a
extensão aguarda o carregamento terminar ou a tabela mudar e estabilizar. A coleta
do Dashboard começa somente depois dessa etapa; se a lupa não for localizada, o
Dashboard é interrompido para evitar resultados incorretos.

## Entrega do resultado

A solicitação mantém o canal de mensagem aberto durante toda a paginação da guia
Audit. Quando a última página termina, o próprio canal devolve os registros para
a página Fadiga e o Dashboard é montado imediatamente. Isso impede que o service
worker do Edge seja suspenso entre o fim da coleta e a exibição do relatório.

Se a coleta terminar sem resposta ou se a montagem visual falhar, o painel de
progresso é removido e uma mensagem mostra a causa concreta do erro.

O adaptador genérico para campos de data e horário separados ou combinados
continua disponível como compatibilidade para outras versões da tela.

Como validação obrigatória, cada linha coletada também é testada pelo campo
`Tratado em`, incluindo horas e minutos. Assim, registros fora do intervalo
nunca entram no Dashboard, mesmo quando o componente visual da Audit não
confirma o preenchimento.

O Dashboard informa:

- intervalo solicitado;
- cobertura temporal encontrada;
- quantidade de páginas e linhas examinadas;
- se o período foi confirmado na interface da Audit;
- se o limite de segurança da paginação foi alcançado.
