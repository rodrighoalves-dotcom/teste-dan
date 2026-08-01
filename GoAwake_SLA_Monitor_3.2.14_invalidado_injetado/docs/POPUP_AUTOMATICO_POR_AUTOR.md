# Popup automático por autor

## Fonte obrigatória

O popup automático de produção usa exclusivamente a página **Audit** e o campo
**Autor da tratativa**. O nome do usuário exibido no cabeçalho da Fadiga não é
usado para atribuir produção.

## Fluxo

1. O usuário mantém a página Fadiga aberta e ativa a opção
   **Contagem por autor (Audit oculta)** no menu da extensão.
2. A extensão cria uma nova guia Audit com `active: false`.
3. Somente essa guia recebe autorização temporária para paginação programática.
4. A extensão lê as páginas Audit, considera o período do início do dia atual até
   o momento da coleta e filtra os autores previstos na configuração de produtividade.
5. Cada ID da auditoria é contado uma única vez. Se o ID se repetir, prevalece o
   registro com `Tratado em` mais recente.
6. A página Fadiga identifica o usuário exibido no cabeçalho e relaciona esse nome
   com o `Autor da tratativa` encontrado na Audit.
7. O popup mostra a contagem do autor conectado. O nome do cabeçalho apenas
   seleciona o autor; a quantidade vem obrigatoriamente da Audit.
8. A guia Audit dedicada é fechada ao terminar ou quando ocorre erro.

## Isolamento

- Uma guia Audit aberta pela equipe nunca é reutilizada.
- A extensão não coloca a guia dedicada em primeiro plano.
- O bloqueio de paginação programática permanece ativo em todas as guias Audit
  normais.
- Desativar **Contagem por autor (Audit oculta)** cancela o alarme, fecha uma
  coleta de autor em andamento e remove somente esse popup.
- Os botões **Iniciar Monitor** e **Parar Monitor** controlam apenas o monitor SLA
  da Fadiga.
- A coleta é encerrada na reinicialização do navegador e só volta após novo clique
  em **Iniciar**.

## Atualização

A primeira coleta começa ao ativar a opção própria de contagem por autor. As
próximas são executadas a cada 10 minutos enquanto essa opção estiver ativa.

## Escopo

Este fluxo é independente:

- do resumo SLA manual baseado na pré-seleção de empresas;
- do relatório SLA automático geral;
- do popup operacional SLA iniciado pelo botão **Iniciar Monitor**;
- do Dashboard Gerencial solicitado manualmente.

## Dashboard Gerencial

O Dashboard solicitado na Fadiga usa outra coleta Audit dedicada. Essa coleta
percorre até 1.000 páginas para incluir registros anteriores dentro do período
selecionado. Se o limite for atingido antes do fim da paginação, o próprio
Dashboard exibe um aviso de cobertura incompleta.
