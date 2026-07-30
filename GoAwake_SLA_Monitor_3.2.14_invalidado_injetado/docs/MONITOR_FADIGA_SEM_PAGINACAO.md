# Monitor da Fadiga sem paginação automática

## Regra

O monitor nunca clica em primeira, anterior, número de página, próxima ou última
página da Fadiga. A paginação manual do usuário continua permitida.

## Ações iniciais

Ao iniciar o monitor:

1. seleciona `Online`;
2. seleciona `Alto Risco` somente na primeira inicialização naquela página;
3. ordena `Disponível em` de forma crescente;
4. lê somente as linhas da página visível;
5. observa alterações no corpo da tabela com `MutationObserver`;
6. mantém o ciclo periódico como verificação de segurança.

Depois que `Alto Risco` é localizado e aplicado, a página recebe uma marca
temporária. Parar e reiniciar o monitor na mesma página não repete esse clique.
Se a primeira tentativa falhar, a marca não é criada e um novo início pode
tentar novamente. Recarregar ou fechar a página remove naturalmente a marca.

Como os registros mais antigos ficam no início da ordenação crescente, os
alertas mais urgentes permanecem na página visível sem exigir varredura das
outras páginas.

## Vale e Argenta

Registros identificados como Vale ou Argenta com tempo a partir de 3 minutos são
exibidos no alerta prioritário **Vale + Argenta**. O limite crítico continua sendo
superior a 5 minutos. A regra Geral, incluindo Libéria e demais empresas,
permanece com atenção a partir de 8 minutos e crítico superior a 10 minutos.

Se o operador mudar manualmente de página e depois clicar em um alerta antigo, a
extensão procura a placa somente na página atual. Quando não a encontra, informa
o usuário e não altera a paginação.

## Proteção

Um content script carregado em `document_start` bloqueia cliques programáticos no
paginador da Fadiga. Eventos manuais (`isTrusted`) não são bloqueados.
