# Regra permanente — Pré-seleção GERAL

Quando o campo **Pré-seleção de empresas** for identificado como `GERAL` ou `TODAS`:

- nenhum padrão de placa será usado para identificar Vale;
- nenhum padrão de motorista será usado para identificar Argenta;
- todos os registros serão tratados pela política operacional Geral;
- a referência operacional será de atenção a partir de 8 minutos e crítica acima de 10 minutos;
- o alerta prioritário Vale + Argenta não será exibido;
- o Resumo SLA manual apresentará somente o resultado Geral;
- o relatório automático não separará Vale ou Argenta por placa/motorista.

Nas pré-seleções `VOR + ARG`, `VALE` e `ARGENTA`, as identificações específicas continuam habilitadas.

O Dashboard Gerencial por autor não é alterado porque sua consolidação não depende de regras de placa ou motorista.
