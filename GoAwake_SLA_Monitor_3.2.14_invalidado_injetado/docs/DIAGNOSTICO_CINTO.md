# Diagnóstico local para alertas “Sem cinto”

## Objetivo

Validar se a extensão consegue ler quadros dos vídeos ou miniaturas exibidos na
tela de tratativa do GoAwake Cloud.

Esta etapa não identifica o cinto e não executa nenhuma ação operacional.

## Ativação

O painel aparece somente quando o campo “Tipo de Alerta” está com o valor
“Sem cinto”.

O operador deve abrir ou reproduzir o vídeo e clicar em
“Testar acesso ao vídeo”.

## Resultados

- **Captura do vídeo permitida:** podemos integrar um modelo visual local.
- **Somente miniaturas acessíveis:** o vídeo precisa ser aberto ou reproduzido.
- **Bloqueado pelo navegador:** a mídia usa uma origem que não permite leitura
  de pixels; será necessário outro acesso autorizado ao vídeo.
- **Sem quadro utilizável:** o player ainda não carregou conteúdo visual.

## Privacidade e segurança

- Nenhuma imagem é enviada pela rede.
- Nenhum quadro é armazenado.
- Nenhum alerta é classificado.
- “Alerta invalidado” não é selecionado.
- A tratativa não é finalizada.

## Etapa posterior

Depois de validar a captura, um modelo local deverá classificar vários quadros
como “cinto visível”, “cinto não visível” ou “inconclusivo”.

Somente a classificação “cinto visível”, seguida da confirmação do operador,
poderá acionar a automação existente de “Alerta invalidado”.
