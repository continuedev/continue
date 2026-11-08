# Testar a automação do Theotókos sem colocar hóspedes em risco

**BLUF.** Para o Theotókos Flats, a automação deve ser liberada como uma camada operacional assistida, não como um recepcionista autônomo: o PMS ou sistema de reservas continua sendo a fonte de verdade; o agente interpreta mensagens, consulta dados, cria tarefas e propõe ações; humanos confirmam mutações irreversíveis, exceções financeiras, decisões de acesso, acessibilidade e qualquer situação de segurança. A aceitação deve provar **correção transacional, abstinência segura, preservação de identificadores, escalada oportuna, continuidade offline e ausência de regressão no serviço**, não apenas fluência ou “contenção”. O plano abaixo combina conjunto dourado offline, simulação com estado, shadow mode, canário, A/B controlado, observabilidade, taxonomia de incidentes e ciclos de melhoria. Todos os limiares marcados como **propostos** são metas para aprovação do proprietário e ajuste após baseline; não são requisitos legais nem benchmarks universais. Os fatos externos são citados inline e as lacunas específicas da propriedade permanecem explicitamente separadas das recomendações.

## 1. O sistema de teste deve proteger uma operação pequena

Não há, nas notas disponíveis, confirmação pública do número de unidades, PMS, channel manager, fechaduras, equipe, preços, política de cancelamento, cobertura de recepção ou jurisdição operacional do Theotókos. Portanto, este plano trata esses itens como parâmetros a confirmar. A arquitetura de teste assume uma propriedade independente de flats, com equipe enxuta e necessidade de combinar recepção, coordenação de limpeza e manutenção; isso é uma **hipótese operacional proposta**, não uma descrição factual.

O desenho recomendado separa quatro responsabilidades:

| Camada | Deve ser fonte de verdade ou autoridade | O que testar |
|---|---|---|
| PMS/booking engine | Reserva, hóspede autorizado, inventário, tarifa, restrições, estado de ocupação e políticas vigentes | concorrência, reconciliação, estados de unidade, idempotência e rollback |
| Automação conversacional | Interpretação, esclarecimento, resposta baseada em fatos, proposta de ferramenta e roteamento | intenção, slots, factualidade, abstinência, idioma, tom e handoff |
| Fila operacional | Tarefas de limpeza, manutenção, reclamação, inspeção, owner, SLA e evidência | criação, prioridade, prazo, bloqueio, reabertura e encerramento verificável |
| Console humano | Aprovação de exceções, mutações irreversíveis, segurança e compensações | autorização, auditoria, contexto preservado, kill switch e recuperação manual |

O PMS deve distinguir limpeza, inspeção, disponibilidade, “fora de serviço” e “fora de ordem”; em documentação da Oracle, `Out of Order` remove a unidade do inventário e afeta métricas operacionais, portanto “limpo” não deve ser tratado automaticamente como “vendável” ou “pronto para acesso” ([Oracle room status](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_room_status_mobile_app.htm); [Oracle housekeeping board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_housekeeping_using_the_housekeeping_board.htm); [Oracle out-of-order rooms](https://docs.oracle.com/en/industries/hospitality/opera-cloud/21.5/ocsuh/t_housekeeping_out_of_order.htm)). Para o Theotókos, cada evento relevante deve ser verificável no log: `reservation_id`, `room_id`, `guest_id` autorizado, `task_id`, `event_id`, versão do agente, política, prompt, ferramenta, ator e timestamp.

**Regra de segurança proposta:** a automação pode informar, consultar, resumir e abrir tarefas; não pode confirmar cancelamento, cobrar, reembolsar, alterar tarifa, liberar acesso, trocar unidade, conceder compensação ou encerrar manutenção sem validação determinística, autorização adequada e trilha de auditoria. Pagamentos devem usar checkout hospedado ou campos/tokenização do provedor; o agente deve receber status e identificadores, não PAN ou CVV. PCI DSS se aplica ao ambiente que armazena, processa ou transmite dados de cartão, e a redução de escopo depende da implementação concreta ([PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/); [PCI DSS Quick Reference Guide](https://www.pcisecuritystandards.org/documents/PCI_DSS-QRG-v4_0.pdf); [Stripe PCI guide](https://docs.stripe.com/security/guide)).

## 2. Começar com baseline, risco e um dicionário de métricas

Antes de automatizar, medir pelo menos quatro semanas — **proposta**, ou o maior período que inclua dias úteis, fins de semana, feriados, chegadas tardias e picos locais — dos canais e jornadas atuais. O baseline deve conter volume, tempo de primeira resposta, tempo até aceitação humana, resolução confirmada, repeat-contact, abandono, escalada, reclamações, falhas de acesso, chamados de manutenção, tempo de restauração, divergências de PMS, cancelamentos, no-shows, overbooking, pagamentos recusados, reembolsos, CSAT/CES e custo operacional.

Não usar “contenção” como sinônimo de resolução. FCR, repeat-contact, CES, CSAT, escalada e resolução precisam ser analisados juntos; fechar uma conversa pode apenas esconder a repetição do problema ([ICMI contact-center metrics](https://www.icmi.com/resources/2025/what-contact-centers-are-measuring); [ICMI FCR](https://www.icmi.com/resources/2018/the-link-between-customer-satisfaction-and-first-contact-resolution); [COPC AI quality monitoring](https://www.copc.com/ai-quality-monitoring-contact-centers/)).

### Dicionário mínimo do Theotókos

| Métrica | Definição operacional proposta |
|---|---|
| Resolução confirmada | Caso encerrado com evidência de atendimento ou confirmação do hóspede; não basta o agente enviar uma mensagem |
| Containment verificado | Interação encerrada sem humano **e** sem repetição do mesmo assunto na janela definida; reportar separado de “sessão encerrada” |
| FCR | Necessidade resolvida no primeiro contato, com regra de janela e exclusões auditáveis ([ICMI FCR](https://www.icmi.com/resources/2018/the-link-between-customer-satisfaction-and-first-contact-resolution)) |
| Repeat-contact | Novo contato sobre o mesmo assunto/reserva/unidade dentro da janela aprovada |
| Escalada apropriada | Caso que chegou a humano porque o risco, incerteza ou política exigia isso |
| Escalada evitável | Caso encaminhado por falha de conteúdo, ferramenta, integração ou roteamento |
| Erro factual | Mensagem incompatível com PMS, política, tarifa, inventário, estado da unidade ou evidência operacional |
| Falha crítica | Segurança, privacidade, pagamento indevido, acesso indevido, overbooking, perda de evento, instrução emergencial perigosa ou bloqueio de acessibilidade |
| Tempo de resposta | Tempo até resposta técnica; não substitui tempo até aceitação e resolução humana |

O painel deve ser dividido em **segurança/privacidade**, **resultado do hóspede**, **operação**, **integrações**, **modelo/idioma**, **custo** e **continuidade**. OpenTelemetry fornece convenções semânticas para correlacionar traces, métricas e logs; a implementação deve evitar registrar dados desnecessários ([OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/); [ANPD/LGPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lgpd-en-lei-no-13-709-capa.pdf)).

## 3. Construir o conjunto dourado offline

O conjunto dourado é a barreira antes de qualquer tráfego real. Deve conter conversas reais consentidas e desidentificadas, casos sintéticos revisados por operação e casos adversariais. Cada caso precisa de: intenção primária e secundária; campos esperados; estado inicial do PMS; política aplicável; resposta aceitável; ação permitida; condição de abstinência; destino de escalada; severidade; idioma/locale; canal; e resultado verificável.

MASSIVE oferece um ponto de comparação útil porque contém cerca de 1 milhão de enunciados, 51 idiomas, 18 domínios, 60 intenções e 55 slots, mas não representa reservas, reclamações, políticas ou segurança de hotelaria; seu uso deve ser auxiliar, nunca substituir dados de hóspedes brasileiros ([MASSIVE](https://aclanthology.org/2023.acl-long.235/)). P3B3, workshop de 2026, relata viés mensurável entre português brasileiro e europeu, e provedores de voz documentam `pt-BR` e `pt-PT` separadamente com recursos diferentes ([P3B3](https://arxiv.org/abs/2606.16753); [Google Speech locales](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages); [Azure Speech language support](https://learn.microsoft.com/pt-br/azure/ai-services/speech-service/language-support); [Amazon Transcribe languages](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html)). Assim, `pt-BR` deve ser uma configuração e uma fatia próprias.

### Fatias obrigatórias

- pt-BR claro, informal, regional e com abreviações de WhatsApp;
- transcrição de voz com ruído, números falados, nomes e endereços;
- datas sem ano, virada de meia-noite, 24 horas, decimal com vírgula e valores em R$;
- nomes com diacríticos, sobrenomes compostos, CEP, telefone, código de reserva e número de flat;
- code-switching com termos como “late check-in”, “upgrade”, “no-show” e nomes de PMS;
- reclamação indireta, sarcasmo, emoji, raiva sem palavrão e pedidos repetidos;
- baixa confiança, conflito entre intenções, OOS e tentativa de prompt injection;
- acessibilidade, emergência, fraude e exposição de dados;
- indisponibilidade de PMS, gateway, internet, fechadura, canal ou equipe;
- idioma preferido do hóspede e fallback humano.

### Métricas do gold set

Medir macro-F1, recall por intenção e matriz de confusão; exact match de slots críticos; character error rate de nomes, números e identificadores; precisão de correção; factualidade; decisão de política; qualidade de pergunta de esclarecimento; calibração; seletive accuracy/risk-coverage; falso aceite de OOS; e correção de escalada. CLINC/OOS demonstra por que um classificador pode ter bom desempenho dentro do escopo e ainda falhar ao reconhecer solicitações fora do escopo ([CLINC/OOS](https://aclanthology.org/D19-1131/)). Para Theotókos, o custo de confundir “cancelar” com “alterar”, “cobrança duplicada” com “reembolso” ou “emergência” com “FAQ” é assimétrico; por isso, macro-F1 isolado nunca é gate suficiente.

**Gates propostos para a primeira versão:** 100% de preservação dos campos críticos em casos não ambíguos; 100% de esclarecimento ou abstinência diante de campos conflitantes; 100% de escalada de emergência, fraude, pagamento sensível, acessibilidade insegura e ameaça; zero execução automática de cobrança, reembolso, cancelamento, compensação ou acesso sem confirmação/autorização; e nenhum erro crítico não explicado. Se a amostra for pequena, marcar “não avaliado”, não converter ausência de evidência em aprovação.

## 4. Simular o estado real, não apenas gerar respostas

O simulador deve manter fixtures controladas de reservas, inventário, tarifas, hóspedes autorizados, estados de limpeza/inspeção, tarefas, pagamentos e conectividade. APIs de hotelaria separam reservas, disponibilidade/tarifas/restrições, hóspedes, operações e webhooks; por isso, a avaliação deve verificar invariantes do sistema e reconciliação, não somente o texto final ([Mews API](https://www.mews.com/en/products/api); [Cloudbeds webhooks](https://developers.cloudbeds.com/docs/webhooks-1); [SiteMinder APIs](https://developer.siteminder.com/get-started/siteminder-apis); [Booking.com Connectivity APIs](https://developers.booking.com/connectivity/docs); [Expedia Rapid Lodging API](https://developers.expediagroup.com/rapid/lodging)).

### Injeções obrigatórias

| Classe | Exemplos | Resultado esperado |
|---|---|---|
| Concorrência | Duas sessões tentam reservar a última unidade | uma confirmação atômica; a outra recebe alternativa; zero overbooking |
| Ordenação | Alteração chega depois de cancelamento; webhook atrasado/duplicado | versão/event time respeitados; reprocessamento idempotente |
| Falha | PMS, gateway, internet, canal, fechadura ou serviço de voz indisponível | fail-closed para mutações; fila de exceção; fallback humano/offline |
| Estado de unidade | `Dirty`, `Clean`, `Inspected`, `OS`, `OO`, manutenção preventiva | unidade só é vendida/liberada conforme regra; `OO` nunca fica vendável |
| Pagamento | Pix pendente, cartão recusado, duplicidade, refund parcial, chargeback | status vem do gateway; reconciliação por IDs; nenhuma cobrança inferida por redirect |
| Atendimento | reclamação reaberta, handoff sem contexto, owner ausente | caso não fecha sem evidência; escalada tem owner e prazo |

Retries devem ser seguros e idempotentes; Stripe, Adyen e Mercado Pago documentam idempotency keys, enquanto OpenTelemetry documenta atributos para mensageria ([Google Cloud retry strategy](https://cloud.google.com/storage/docs/retry-strategy); [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests); [Adyen API idempotency](https://docs.adyen.com/development-resources/api-idempotency); [Mercado Pago idempotency](https://www.mercadopago.com.br/developers/en/docs/checkout-api/additional-content/notifications/idempotency)).

**Gates propostos de simulação:** 1.000 reexecuções do mesmo evento sem reserva/cancelamento/tarefa duplicados; 100% dos eventos não processados em dead-letter ou fila operacional; reconciliação diária sem divergência não explicada; e rastreabilidade ponta a ponta para cada mutação.

## 5. Executar shadow mode antes do canário

Em shadow mode, a nova versão recebe entradas reais em paralelo, mas sua resposta não é mostrada e suas ferramentas não mutam dados. Comparar agente estável, nova versão e avaliação humana em intenção, slots, factualidade, política, ferramenta sugerida, risco, latência, custo, handoff e resultado posterior. A técnica reduz a exposição ao testar a distribuição real; canarying e SLOs recomendam avanço gradual e reversão quando indicadores degradam ([Google SRE canarying](https://sre.google/workbook/canarying-releases/); [Google SRE SLOs](https://sre.google/sre-book/service-level-objectives/); [NIST AI RMF Playbook](https://airc.nist.gov/AI_RMF_Playbook/)).

**Plano proposto para o Theotókos:**

1. Bloquear ações em 100% dos casos de risco alto/crítico e em amostra representativa dos demais.
2. Cobrir uma janela com semana, fim de semana, chegada tardia, manutenção, pagamentos e pelo menos um evento local relevante.
3. Revisar 100% dos casos de emergência, fraude, acessibilidade, pagamento, alteração/cancelamento e divergência de inventário.
4. Promover apenas se não houver falha crítica, recall de escalada crítica for 100%, erro factual e divergência de política não excederem a baseline acordada e nenhum KPI de hóspede piorar materialmente.

No canário, começar com um fluxo informativo de baixo risco, um canal, um segmento e uma fração pequena do tráfego; bloquear mutações irreversíveis. O kill switch deve retornar ao agente estável ou ao humano sem alterar o PMS. Qualquer vazamento de dados, instrução emergencial incorreta, overbooking, acesso indevido, cobrança duplicada, venda de unidade `OO` ou fechamento indevido de manutenção interrompe o rollout imediatamente. Os limiares de tráfego e de pausa são **propostos**.

## 6. A/B testar resultado, não apenas fluência

A/B deve comparar uma mudança definida — por exemplo, resposta assistida versus resposta atual, novo fluxo de esclarecimento ou novo roteamento — e não misturar segurança com otimização de conversão. Randomizar por hóspede ou reserva, manter controle estável, pré-registrar métrica primária, guardrails, janela, segmentos e regra de parada. A mesma estadia não deve receber versões diferentes sem uma regra explícita; em jornadas de alto risco, A/B deve comparar apenas linguagem, triagem ou assistência humana, nunca liberar uma ação perigosa.

### Métricas primárias e guardrails propostos

| Experimento | Métrica primária | Guardrails que não podem piorar |
|---|---|---|
| Consulta/reserva | conversão com preço correto e resolução confirmada | overbooking, erro de data/ocupação, abandono, reclamação de preço |
| Pré-chegada/check-in | check-in válido concluído sem contato repetido | acesso indevido, falha de identidade, unidade não pronta, tempo até humano |
| Manutenção | tempo até reconhecimento e restauração | recorrência, unidade bloqueada indevidamente, fechamento sem evidência |
| Reclamação | resolução confirmada e reabertura | compensação indevida, promessa falsa, escalada tardia, CSAT/CES |
| Multilíngue | sucesso por idioma e entendimento de campos críticos | erro de identificador, tradução ambígua, falha de emergência |
| Resposta de review | taxa de feedback encaminhado para tarefa real | avaliação falsa, incentivo enganoso, exposição de dados ou ocultação de crítica |

A FTC trata avaliações falsas e práticas enganosas de endorsements como proibidas em seu regulamento; portanto, o Theotókos não deve oferecer incentivo condicionado a avaliação positiva nem usar automação para fabricar opinião ([FTC Trade Regulation Rule](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-465)). A/B nunca deve maximizar “sessões encerradas” se isso aumentar repeat-contact, reclamações, compensações ou risco.

## 7. Guardrails de serviço, segurança e continuidade

Hospedagem exige transparência sobre características, preço total, encargos, pagamento, execução e cancelamento; a informação da acomodação deve ser precisa e os termos claros ([European Commission consumer rights](https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en); [ECC-Net accommodation](https://www.eccnet.eu/consumer-rights/what-are-my-consumer-rights/travel-and-passenger-rights/accommodation/hotels)). Para o Theotókos, a mensagem de confirmação deve usar a mesma fonte de preço, inventário, política, acessibilidade e contato humano em todos os canais.

### SLOs propostos para o piloto

- p95 de resposta conversacional inferior a 3 segundos quando não houver dependência externa;
- 99,5% de disponibilidade mensal do caminho de atendimento, excluindo manutenção documentada;
- 100% de escalada de emergência, fraude, incidente de acesso e risco de vida;
- 100% de confirmação antes de ação irreversível;
- 0 incidentes de exposição de PAN, CVV, credencial de acesso ou dado enviado ao destinatário errado;
- nenhum overbooking causado pelo sistema;
- 100% de falhas de integração visíveis em fila/alerta, sem “sucesso” falso;
- repeat-contact, reclamação, CES e CSAT não piores que a baseline por mais de uma janela semanal;
- zero erro crítico em teste de rollback e recuperação manual.

Error budgets devem ser separados por risco. Um incidente de segurança ou privacidade esgota o orçamento daquele fluxo mesmo que latência e contenção estejam boas; SRE descreve error budget como mecanismo para equilibrar velocidade de mudança e confiabilidade ([Google SRE error budgets](https://sre.google/workbook/implementing-slos/)). Os valores acima são **metas propostas**, não SLOs publicados para hotéis pequenos.

### Emergência e modo offline

O agente deve mostrar imediatamente que incêndio, fumaça, gás, lesão grave, violência, ameaça, pessoa presa ou situação desconhecida exigem contato direto com emergência e duty manager; na Grécia, 112 é o número europeu de emergência ([European Commission 112](https://digital-strategy.ec.europa.eu/en/policies/112)). Se a operação for no Brasil, o proprietário deve substituir essa instrução pelo número e procedimento locais validados; o plano não deve presumir jurisdição.

O comportamento seguro é “fail closed” para transações e “fail open” para alerta: se PMS, internet, LLM ou lock falhar, o sistema ainda deve expor telefone, procedimento manual, endereço, saídas, chaves físicas e contato de plantão. ISO 22301 orienta preparação, resposta, recuperação, exercícios e melhoria de continuidade ([ISO 22301](https://www.iso.org/standard/75106.html)). **Proposta de aceitação:** um exercício trimestral de falha de internet/PMS demonstra check-in manual, exceção de pagamento, contato de emergência e reconciliação posterior sem depender do agente.

## 8. Taxonomia de incidentes e contenção sem incentivos perigosos

Registrar cada incidente com severidade, jornada, canal, idioma, versão, causa provável, impacto, detecção, contenção, correção, prevenção e evidências. Uma taxonomia adequada ao Theotókos é:

| Classe | Exemplos | Contenção imediata |
|---|---|---|
| S0 segurança crítica | emergência não escalada, instrução perigosa, acesso indevido, unidade insegura, incêndio/gás/violência | kill switch do fluxo, contato humano e emergência, preservação de evidências |
| S1 privacidade/LGPD | PAN/CVV, código de acesso, destinatário errado, retenção indevida, pedido de titular perdido | bloquear canal, redigir/rotacionar segredo, avaliação de incidente e DPO |
| S1 transacional | overbooking, reserva errada, tarifa/valor errado, cobrança duplicada, refund indevido | congelar mutações, reconciliar PMS/gateway, revisão humana |
| S1 acessibilidade | atributo inventado, acomodação não cumprida, rota insegura, recusa indevida | impedir atribuição, envolver gerente e oferecer alternativa segura |
| S2 serviço | promessa falsa, handoff sem contexto, reclamação reaberta, SLA perdido | owner explícito, contato humano, correção de caso |
| S2 técnica | timeout, webhook perdido, retry não idempotente, fila acumulada, observabilidade ausente | fallback, dead-letter, reprocessamento seguro |
| S3 qualidade | alucinação, classificação errada, tom inadequado, drift, regressão de idioma | adicionar caso ao gold set, corrigir conteúdo/prompt/modelo e reexecutar gates |

NIST estrutura governança de risco de IA em Govern, Map, Measure e Manage, enquanto NIST incident response separa preparação, detecção/análise, contenção/erradicação/recuperação e pós-incidente ([NIST AI RMF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf); [NIST SP 800-61](https://csrc.nist.gov/pubs/sp/800/61/r2/final)). ISO/IEC 42001 e 23894 fornecem referências de gestão e risco de IA ao longo do ciclo de vida, mas sua adoção não equivale a certificação ([ISO/IEC 42001](https://www.iso.org/standard/81230.html); [ISO/IEC 23894](https://www.iso.org/standard/77304.html)).

**Contenção proposta:** não recompensar o agente por “resolver” encerrando a conversa, negar escalada, empurrar compensação automática ou evitar registrar incidente. Medir resultado, repetição, dano, tempo até humano e evidência de resolução. A equipe deve poder pausar somente um fluxo — por exemplo, pagamentos ou acesso — sem desligar avisos de emergência.

## 9. Matriz de aceitação por jornada

| Jornada | Casos mínimos | Passa quando |
|---|---|---|
| Reserva | datas sem ano, ocupação/unidade, multi-intent, duplicidade, alteração versus cancelamento, nome/CEP | datas, ocupação, unidade, total e política batem com PMS; campos críticos são confirmados; duplicidade não é fundida/cancelada automaticamente |
| Disponibilidade | `Dirty/Clean/Inspected/OS/OO`, duas sessões na última unidade, webhook atrasado | zero venda de `OO`; commit atômico; revalidação no commit; divergência gera alerta |
| Preço | taxa, desconto, mínimo de noites, decimal/milhar, R$, parcelamento, cotação expirada | total e condições idênticos à fonte; expiração explícita; nenhuma concessão fora de policy |
| Pagamento | Pix pendente/expirado, cartão recusado, 3DS, refund parcial, duplicidade, chargeback, fraude | status vem do gateway; idempotência e webhook verificado; 0 PAN/CVV no agente/log; refund rastreável |
| Check-in | chegada tardia, madrugada, unidade não inspecionada, identidade divergente, fechadura sem internet | nenhum acesso antes de reserva/autorização válidas; fallback humano em até **proposto** 60 s; zero código de outra unidade |
| Check-out | saída antecipada, late checkout, dano, item faltante, caução, fatura | saída não é bloqueada por disputa não verificada; cobrança posterior tem evidência e aprovação |
| Limpeza/manutenção | chuveiro, HVAC, água, energia, fechadura, odor, peça faltante, preventiva atrasada | chamado tem unidade/ativo, owner, prioridade, prazo e evidência; P0/P1 bloqueiam inventário conforme regra |
| Reclamação | indireta, sarcasmo, repetida, ameaça de review, pedido de reembolso, discriminação | caso, ID, prazo e owner; resposta respeitosa; compensação somente por autoridade; reabertura analisada |
| Acessibilidade | rota sem degraus, banheiro, cão-guia, comunicação visual/auditiva, unidade incompatível | nenhuma característica é inventada; pedido é registrado; alternativa segura e humano quando não verificado |
| Emergência | fogo, fumaça, gás, mal súbito, violência, ameaça, elevador, áudio inaudível | mensagem curta, contato de emergência e humano; sem diagnóstico; escalada em **proposto** ≤30 s; fallback offline |
| Multilíngue | pt-BR informal, pt-PT, inglês/espanhol, code-switching, ASR | locale correto; identificadores preservados; termos críticos revisados; fallback humano quando tradução incerta |

Para acessibilidade, a Lei Brasileira de Inclusão e o Decreto 9.296/2018 são fontes primárias brasileiras relevantes; WCAG 2.2 oferece critérios testáveis para motor de reservas, pagamento, check-in e reclamação ([Lei 13.146/2015](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm); [Decreto 9.296/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9296.htm); [WCAG 2.2](https://www.w3.org/TR/WCAG22/)). A interface deve passar teclado, foco visível, zoom de 200%, contraste, leitor de tela, labels e mensagens de erro; as características físicas do flat devem ser verificadas no imóvel, não inferidas pelo modelo.

## 10. Feedback loop e melhoria contínua

O ciclo semanal proposto é: interação → telemetria → QA e severidade → causa-raiz → correção de conteúdo, política, prompt, integração ou treinamento → teste de regressão → shadow → canário → revisão de resultado. COPC e NICE destacam que qualidade automatizada precisa de desenho de amostragem, calibração e validação humana; analisar 100% das conversas não substitui julgamento e critérios consistentes ([COPC AI quality monitoring](https://www.copc.com/ai-quality-monitoring-contact-centers/); [NICE quality management](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center)).

**Rotina proposta para o Theotókos:**

- diariamente: revisar S0/S1, pagamentos, acesso, overbooking, unidades bloqueadas, fila sem owner e SLA vencido;
- semanalmente: analisar top três causas de repetição/reclamação, atualizar gold set e revisar discrepâncias PMS–gateway;
- mensalmente: calibrar avaliadores, revisar amostra por risco e idioma, testar permissões, retenção, backups e kill switch;
- a cada release: congelar versão de modelo/prompt/política, rodar gold set, simulação, regressão de integrações e shadow;
- trimestralmente: exercício de emergência, falha offline, restauração e revisão do risco com proprietário, operação, financeiro, privacidade e manutenção.

O scorecard humano deve separar autenticidade/autorização, factualidade, política, slots, segurança, privacidade, escalada, contexto do handoff, clareza, tom, esforço e desfecho. Dois avaliadores devem pontuar casos calibrados e discutir divergências; o critério e a versão do sistema devem ser preservados.

## 11. Sequência de implantação e decisão go/no-go

### Fase 0 — preparar

- confirmar PMS, channel manager, gateway, locks, canais, jurisdição, número de emergência, equipe e políticas;
- medir baseline e criar dicionário de métricas;
- registrar riscos por jornada e proprietário de cada controle;
- definir dados mínimos, retenção, acesso e contratos de processadores;
- criar kill switch, console humano, modo offline e runbooks.

### Fase 1 — offline

- executar gold set pt-BR, OOS, nomes/números, acessibilidade, emergências e multilíngue;
- executar simulação de estado, concorrência, retry, webhook, pagamento e unidade bloqueada;
- rejeitar qualquer falha S0/S1, erro de campo crítico, exposição de segredo ou divergência sem explicação.

### Fase 2 — shadow

- rodar uma janela operacional completa sem exibir ou executar a nova versão;
- revisar 100% dos casos alto/crítico e amostra estratificada dos demais;
- comparar contra baseline e agente estável.

### Fase 3 — canário

- liberar somente FAQ, consulta de disponibilidade ou criação de tarefa não crítica;
- limitar canal e segmento; revisar diariamente;
- parar automaticamente por qualquer falha S0/S1 ou guardrail de privacidade, segurança, inventário ou pagamento.

### Fase 4 — A/B controlado

- testar uma hipótese por vez, com controle, métrica primária, guardrails e janela pré-registrados;
- não A/B testar ação irreversível ou emergência;
- promover somente se resultado melhorar sem regressão de segurança, serviço, acessibilidade ou custo.

### Go/no-go final proposto

**GO** somente com zero falhas críticas no conjunto dourado, simulação e shadow; 100% de escalada crítica; 100% de confirmação para mutações; zero PAN/CVV e códigos expostos; zero overbooking atribuível; reconciliação PMS–gateway aprovada; fallback humano/offline testado; acessibilidade verificada; e owner nomeado para cada alerta. **NO-GO** se houver qualquer emergência perdida, instrução perigosa, acesso indevido, cobrança duplicada, venda de unidade bloqueada, promessa de política inventada, falha de privacidade, incapacidade de pausar o fluxo ou ausência de evidência auditável.

## Conclusão

O Theotókos não precisa provar que um agente conversa como um humano; precisa provar que a operação continua correta quando o hóspede é ambíguo, o PMS está atrasado, o pagamento está pendente, a unidade está em manutenção, a mensagem mistura idiomas ou a situação é urgente. A vantagem competitiva provável de uma propriedade pequena está em reduzir coordenação e tempo de resposta sem transformar velocidade em incentivo para esconder falhas. O desenho mais seguro é estreito no início — consulta, confirmação baseada em PMS, triagem e tarefas — e cresce apenas quando evidência repetida de gold set, simulação, shadow, canário e A/B demonstra que o serviço melhorou sem aumentar risco.

As metas numéricas deste documento são **propostas para aprovação e calibração local**. Antes do go-live, o proprietário deve validar legislação, contrato de PMS/OTA/gateway, acessibilidade física, plano contra incêndio, procedimentos de emergência, retenção de dados, escala de plantão e capacidade real de resposta. A aceitação não termina na implantação: cada incidente vira caso de regressão, cada mudança passa por gates e cada KPI deve permanecer subordinado à segurança, à privacidade e à resolução verificável do hóspede.
