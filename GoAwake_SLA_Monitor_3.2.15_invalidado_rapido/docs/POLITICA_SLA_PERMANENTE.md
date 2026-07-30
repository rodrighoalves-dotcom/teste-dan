# Política SLA permanente

Esta regra é operacional e não deve ser unificada:

| Escopo | Atenção | SLA / tolerância | Crítico |
|---|---:|---:|---:|
| Vale | a partir de 3 min | 5 min | acima de 5 min |
| Argenta | a partir de 3 min | 5 min | acima de 5 min |
| Geral | a partir de 8 min | 10 min | acima de 10 min |
| Libéria e demais | a partir de 8 min | 10 min | acima de 10 min |

A origem técnica única é `shared/config.js`. O monitor da Fadiga, o resumo SLA
manual, o PDF e o relatório automático devem consumir essa configuração.

O Dashboard Gerencial de produtividade mantém indicadores próprios e
independentes; ele não pode sobrescrever a política operacional acima.
