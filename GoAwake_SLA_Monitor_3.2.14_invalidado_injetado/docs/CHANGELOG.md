## 3.2.14
- Integra a automação de fechamento do “Alerta invalidado” à base funcional atual.
- Adiciona diagnóstico local e não operacional para validar acesso aos quadros de alertas “Sem cinto”.
- Reposiciona o alerta Argenta no centro do lado direito e amplia o botão “Tratar agora”.
- Preserva as ações iniciais Online → Alto Risco → Disponível em crescente.
- Remove a paginação automática da Fadiga e mantém a paginação da Audit somente sob solicitação do Dashboard.
- Mantém o alerta Argenta no canto superior direito e o Vale no Monitor SLA inferior esquerdo.
- Remove o falso encerramento do Dashboard após dois minutos sem mensagem de progresso.
- Fecha automaticamente a guia Audit dedicada após a conclusão do relatório.

## 3.2.13
- Corrige o gatilho do fechamento automático: captura diretamente o clique no item PrimeNG `li.ui-dropdown-item` com texto "Alerta invalidado".
- Mantém o fluxo OK → Finalizar → Finalizar → OK com espera entre etapas.

# Changelog

## 3.2.10

- Corrigida a entrega final do Dashboard após a paginação da Audit: o canal de mensagem permanece aberto até o resultado completo.
- O resultado agora retorna diretamente à página Fadiga, evitando suspensão do service worker antes da montagem do relatório.
- Falhas de conexão ou de renderização passam a ser exibidas ao usuário em vez de deixar o progresso sem conclusão.

- Popup SLA da Fadiga atualizado em ciclo de segurança de 3 segundos e em cerca de 100 ms após mudanças observadas na tabela.
- O popup SLA não é reconstruído quando seu conteúdo não mudou, reduzindo trabalho visual e possíveis oscilações.
- Coleta oculta do Dashboard passou de três confirmações de estabilidade para duas, com leitura a cada 100 ms.
- Removida uma segunda espera de estabilidade que era repetida desnecessariamente em cada página da Audit oculta.

- O filtro `Alto Risco` é acionado somente na primeira inicialização do monitor em cada página Fadiga.
- Parar e reiniciar o monitor na mesma página não repete o clique em `Alto Risco`.
- Se a primeira tentativa não localizar o filtro, a marca não é gravada e uma nova inicialização pode tentar novamente.

- Removido o observador automático e todo carregamento automático do Dashboard na página Audit.
- O Dashboard agora é carregado exclusivamente após o clique do usuário no botão `Dashboard`.
- Adicionada proteção no início da página contra cliques programáticos nos controles de paginação do Audit.
- Cliques manuais reais da equipe na paginação continuam permitidos.
- O monitor que percorre páginas recebeu uma segunda validação e só pode iniciar na rota Fadiga.

## 3.2.9

- O período do Dashboard passa a ser sempre calculado com base no dia atual.
- Adicionados os períodos Hoje, últimos 7, 15, 30 e 90 dias.
- O início corresponde a 00:00 do primeiro dia e o fim ao horário atual.
- O filtro continua sendo aplicado sobre o campo `Tratado em`.
- Exportações CSV identificam o período selecionado no nome do arquivo.

## 3.2.8

- Resumos SLA manual e automático passaram a usar uma única fórmula oficial.
- Fórmula: horário atual menos o menor horário válido da coluna `Disponível em`.
- A leitura considera exclusivamente as linhas exibidas na tela atual.
- Removido o uso de média para o tempo principal dos resumos.
- O cálculo foi centralizado em `shared/sla-summary-calculator.js` e protegido por testes.

## 3.2.7

- Regra operacional permanente corrigida: Vale e Argenta com SLA de 5 minutos.
- Regra Geral, incluindo Libéria e demais empresas, mantida em 10 minutos.
- Faixa de atenção: 3 minutos para Vale/Argenta e 8 minutos para Geral.
- Política operacional centralizada em `shared/config.js` e protegida por testes contra regressões.
- Mantidas separadas as faixas do Dashboard de produtividade das auditorias.

## 3.2.6

- Removida toda navegação automática pela paginação da página Audit.
- O Dashboard usa somente a página visível e o histórico observado localmente.
- Substituído o botão `Relatório` por `Dashboard` no menu principal.
- Removido o botão dinâmico duplicado do Dashboard.
- Tempos calculados com precisão de segundos, sem arredondamento prematuro.
- SLA calculado somente sobre auditorias com duração válida.
- Adicionadas cobertura temporal, cobertura de tempo, mediana e escopo da base.
- Qualidade da base passou a considerar completude temporal e conflitos de autoria.
- Eventos repetidos no armazenamento local agora atualizam campos mais completos.

## 3.2.5

- Restaurada a sequência `Online` > `Alto Risco` > `Disponível em` crescente.
- Ampliada a detecção de `Online` para componentes Angular, toggles, textos e atributos.
- Removida a regressão que acionava `Offline`.
- Mantido apenas um clique por ação para não desfazer filtros ou inverter a ordenação.
- As tentativas pendentes são canceladas ao parar ou reiniciar o monitor.

## 3.2.3

- Restauradas integralmente as ações iniciais da versão funcional.
- Alterado somente o passo de ordenação da coluna `Disponível em`.
- A seta é consultada novamente após cada atualização do Angular.
- Removido o clique duplo apenas da ordenação, evitando inverter novamente o sentido.

## 3.2.2

- Corrigida a sequência inicial do monitor para executar `Online`, `Alto Risco` e, por último, `Disponível em`.
- Removido o acionamento incorreto do filtro `Offline`.
- Removidos cliques duplicados que podiam desfazer filtros ou inverter novamente a ordenação.
- A ordenação consulta novamente o cabeçalho após cada atualização do Angular.
- O monitor confirma `aria-sort="ascending"` ou uma classe visual de seta para cima antes de concluir.
- As ações iniciais são executadas a cada novo início do monitor e são canceladas ao parar.

## 3.2.1

- Corrigido o controle do relatório automático para respeitar a opção do usuário.
- Removido o segundo temporizador concorrente da página de Fadiga.
- O relatório automático não redireciona mais a aba ativa e só usa uma página de Fadiga já aberta.
- Corrigida a contagem artificial de duplicidades ao combinar eventos atuais e armazenados.
- A coleta paginada não é mais encerrada por páginas sem registros Moby no período.
- Adicionada validação estrita do domínio GoAwake antes de injetar scripts.
- Adicionado botão para apagar o histórico local de auditoria.
- Adicionada proteção contra injeção de fórmulas nos CSVs.
- Datas brasileiras inválidas deixam de ser normalizadas para outra data pelo navegador.
- Pacote de distribuição limpo, sem uma segunda cópia da extensão dentro da pasta `popup`.

## 3.2.0

- Adicionado motor de normalização por ID da Auditoria.
- Adicionada deduplicação de eventos exatos.
- Definida regra canônica: evento mais recente em `Tratado em`.
- Adicionada detecção de conflitos de autoria.
- Adicionado validador de integridade e índice de qualidade da base.
- Adicionado armazenamento local de eventos observados online na página Audit.
- CSV resumido e detalhado ampliados com rastreabilidade.
- Dashboard passou a exibir eventos observados, conflitos e qualidade.
- Mantidos inalterados o painel SLA automático e o painel SLA manual.
- Corrigido o alarme para limpar somente `sla-report`, sem remover outros alarmes futuros.

## 3.1.0

- Reestruturação modular da extensão.
- Inclusão inicial do Dashboard Gerencial.
