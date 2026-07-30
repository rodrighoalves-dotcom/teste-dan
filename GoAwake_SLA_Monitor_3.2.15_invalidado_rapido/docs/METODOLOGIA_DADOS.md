# Metodologia de Dados — Dashboard Gerencial

## Objetivo

Produzir totais reproduzíveis por autor e ID da auditoria, preservando o histórico necessário para explicar divergências.

## Fontes

1. **Página Audit visível:** leitura somente das linhas exibidas no momento, sem clicar em primeira, próxima ou qualquer outra página.
2. **Histórico local observado:** captura os registros que aparecem na página Audit enquanto ela permanece aberta e guarda eventos localmente no navegador.

O painel SLA automático e manual existente não é modificado.

## Filtro

Somente eventos cujo campo **Autor Tratativa** contenha `Moby`, sem diferenciar maiúsculas e minúsculas.

## Período

O período é aplicado ao campo **Tratado em**, incluindo o início e o fim informados.

O dashboard mostra a cobertura temporal realmente observada. Os totais são precisos para a base local, sem afirmar que representam páginas que nunca foram exibidas.

## Evento exato

Um evento é considerado repetição exata quando coincidem:

- ID da Auditoria;
- Autor Tratativa;
- Tratado em;
- Tratativa;
- Classificação.

Repetições exatas são descartadas sem apagar o registro original.

## Auditoria canônica

A produção principal conta apenas uma vez cada **ID da Auditoria**.

Quando há mais de um evento para o mesmo ID, prevalece, de forma determinística, o evento com **Tratado em mais recente**. Em caso de empate, usa-se **Tratativa iniciada mais recente** e, por último, uma ordenação estável pela assinatura do evento.

## Conflito de autoria

Quando um mesmo ID aparece associado a autores diferentes, o ID é marcado como conflito. Ele continua sendo atribuído ao autor do evento canônico, mas todos os autores observados ficam registrados no CSV detalhado.

## Qualidade da base

O validador informa:

- IDs ausentes;
- autores ausentes;
- datas inválidas;
- ausência de data Disponível em;
- duração negativa;
- duplicidades exatas;
- conflitos de autoria.

O percentual de SLA usa somente auditorias com **Disponível em** e **Tratado em** válidos. A cobertura de tempo é exibida separadamente para evitar que registros incompletos distorçam o indicador.

## Rastreabilidade

O CSV detalhado inclui fonte, quantidade de ocorrências do ID, indicador de conflito e autores observados. Isso permite reproduzir e auditar o total exibido.

## Limitação importante

O monitor online captura apenas dados que efetivamente aparecem na página Audit enquanto ela está aberta no navegador. Ele não substitui uma API oficial ou acesso direto ao banco de dados da plataforma. A extensão não movimenta mais a paginação para ampliar artificialmente a coleta.
