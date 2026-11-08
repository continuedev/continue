# Métodos de avaliação e confiabilidade para a automação do Theotókos Flats

## 1. Princípios de avaliação

### Objetivo e escopo

O objetivo não é maximizar a quantidade de conversas encerradas pelo bot. É demonstrar que cada automação do Theotókos Flats resolve tarefas autorizadas, preserva segurança e privacidade, reduz esforço do hóspede e melhora ou mantém os resultados operacionais sem esconder falhas. Essa distinção é necessária porque contenção pode significar apenas encerramento da sessão, enquanto resolução exige evidência de que a necessidade foi atendida; FCR, repeat-contact rate, CES, CSAT e escalada devem ser analisados em conjunto. [ICMI](https://www.icmi.com/resources/2025/what-contact-centers-are-measuring); [TSIA](https://www.tsia.com/blog/top-support-services-questions-answered); [COPC](https://www.copc.com/ai-quality-monitoring-contact-centers/)

O NIST AI RMF organiza a governança em Govern, Map, Measure e Manage e trata validade e confiabilidade como características que precisam ser avaliadas no contexto de uso, acompanhadas durante a operação e revistas quando o sistema, os dados ou o ambiente mudam. [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf); [NIST AI RMF Playbook — Measure](https://airc.nist.gov/airmf-resources/playbook/measure/). Para um agente conversacional de hospedagem, isso significa avaliar não apenas a resposta textual, mas também a decisão operacional, os campos extraídos, a integração com PMS, o handoff, o tempo de atendimento e o desfecho do hóspede.

ISO/IEC 42001 define requisitos para um sistema de gestão de IA e melhoria contínua, enquanto ISO/IEC 23894 orienta identificação, análise, tratamento, monitoramento e revisão de riscos de IA ao longo do ciclo de vida. Os padrões são complementares: 42001 estrutura governança e melhoria; 23894 ajuda a operacionalizar o processo de risco. [ISO/IEC 42001](https://www.iso.org/standard/81230.html); [ISO/IEC 23894](https://www.iso.org/standard/77304.html). A adoção abaixo é uma recomendação de implementação, não uma afirmação de conformidade ou certificação.

### Risco por jornada

O primeiro artefato deve ser um registro de risco por jornada, versão do modelo, prompt, ferramenta, base de conhecimento, canal e idioma. O inventário do Theotókos deve separar, no mínimo, pré-estadia/reserva, confirmação de chegada tardia, check-in e acesso, pedidos durante a estadia, housekeeping, manutenção, reclamações, checkout, pagamentos/reembolsos, acessibilidade e emergência. A separação é importante porque estados de quarto como “limpo”, “inspecionado”, “fora de serviço” e “fora de ordem” não são equivalentes em sistemas hoteleiros; uma unidade “limpa” não deve ser tratada automaticamente como vendável. [Oracle OPERA Cloud — room status](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_room_status_mobile_app.htm); [Oracle housekeeping board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_housekeeping_using_the_housekeeping_board.htm)

**Recomendação para Theotókos:** classificar reserva e FAQ como risco moderado; alterações de reserva, cancelamento, pagamento, compensação, acessibilidade e manutenção como risco alto; e emergência, ameaça, incêndio/gás/inundação, violência, emergência médica, fraude e exposição de dados como risco crítico. A classificação é uma inferência operacional baseada na necessidade de julgamento humano em decisões de alto impacto e nos riscos de segurança, privacidade e informação incorreta descritos pelo NIST e pela NICE. [NIST AI RMF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf); [NICE quality management](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center); [NIST AI 600-1](https://doi.org/10.6028/NIST.AI.600-1)

### Métricas que representam o serviço

O dicionário do Theotókos deve definir fórmula, denominador, janela de repetição, exclusões, atribuição de causa, canal, idioma, jornada e versão do sistema. FCR deve indicar resolução na primeira interação; repeat-contact rate deve contar novo contato sobre o mesmo assunto em uma janela definida; containment deve ser confirmado por resolução ou ausência de repetição, não por fechamento automático. FCR bruto e líquido têm interpretações diferentes e as exclusões do líquido precisam ser auditáveis. [ICMI — FCR](https://www.icmi.com/resources/2018/the-link-between-customer-satisfaction-and-first-contact-resolution); [TSIA](https://www.tsia.com/blog/top-support-services-questions-answered)

O painel mínimo deve conter: resolução confirmada; FCR; repetição; containment verificado; fallback humano; abandono; “não sei”; erro factual; escalada apropriada e evitável; tempo até aceitação humana; contexto preservado; repetição exigida no handoff; resolução após escalada; CES; CSAT por jornada; cobertura e concordância de QA; falhas críticas; latência; indisponibilidade de integração; duplicidade de tarefas; e custo por atendimento. A ICMI alerta que velocidade, produtividade e benchmarks não garantem boa experiência, e a COPC recomenda medir resultado do cliente e causas-raiz, não somente aderência à política. [ICMI](https://www.icmi.com/resources/2025/what-contact-centers-are-measuring); [COPC](https://www.copc.com/contact-center-qa-roi-resolution-targets/)

## 2. Métodos práticos e controles

### Conjunto dourado offline

O conjunto dourado deve ser uma coleção versionada de casos reais consentidos e desidentificados, casos sintéticos revisados por operação e casos adversariais. Cada caso precisa registrar intenção, campos esperados, política aplicável, resposta aceitável, ação permitida, condição de abstinência, destino de escalada e severidade. O conjunto deve manter o texto original, especialmente nomes, endereços, números, datas, códigos de reserva e valores monetários; normalização deve ser separada do valor original e confirmada antes de mutações. Estudos e benchmarks multilíngues distinguem intenção, slots e exact match, mas dados localizados não substituem conversas brasileiras de hotel coletadas organicamente. [MASSIVE](https://aclanthology.org/2023.acl-long.235/); [P3B3](https://arxiv.org/abs/2606.16753); [VarDial 2025](https://aclanthology.org/2025.vardial-1.2/)

As fatias mínimas são: pt-BR limpo; WhatsApp informal; transcrição de voz; erros de digitação; regionalismos; code-switching; datas e números; nomes e endereços; reclamações; baixa confiança; acessibilidade; pagamentos; e emergência. Para cada intenção, medir macro-F1 e recall por classe; exact match de slots críticos; erro de caracteres para identificadores; precisão de correção; factualidade; decisão de política; qualidade da pergunta de esclarecimento; e correção do destino de escalada. A escolha de pt-BR separado de pt-PT é justificada por evidência de diferenças mensuráveis entre variedades e por tabelas de provedores que tratam os locales e recursos de voz separadamente. [P3B3](https://arxiv.org/abs/2606.16753); [Google Speech locales](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages); [Azure Speech language support](https://learn.microsoft.com/pt-br/azure/ai-services/speech-service/language-support)

**Critérios recomendados, a validar contra a linha de base:** 100% de preservação de campos críticos em casos sem ambiguidade; 100% de abstinência ou esclarecimento quando data, unidade, identidade, escopo ou consequência estiverem conflitantes; zero execução automática de pagamento, reembolso, cancelamento, compensação ou abertura de acesso sem confirmação e autorização; e 100% de escalada dos casos críticos. Estes números são recomendações de aceitação, não benchmarks publicados.

### Simulação de cenários

Simular conversas completas com estado controlado do PMS, inventário, tarefas e conectividade. O simulador deve injetar eventos de reserva criada/alterada/cancelada, no-show, extensão, troca de unidade, bloqueio por manutenção, falha de webhook, atraso de sincronização, indisponibilidade de canal, duplicação de evento e mudança de status de limpeza/inspeção. APIs hoteleiras e plataformas de conectividade documentam reservas, ARI, hóspedes, operações e webhooks como objetos e eventos distintos; por isso, o teste deve verificar invariantes e reconciliação, não apenas texto de resposta. [Mews API](https://www.mews.com/en/products/api); [Cloudbeds webhooks](https://developers.cloudbeds.com/docs/webhooks-1); [SiteMinder APIs](https://developer.siteminder.com/get-started/siteminder-apis)

O cenário deve verificar: fonte de verdade correta; idempotência; ordenação; retry com backoff; dead-letter ou fila de exceção; trilha de auditoria; permissões; atualização reversível; e mensagem ao hóspede coerente com o estado confirmado. Retries seguros dependem de operações idempotentes, e convenções de observabilidade facilitam correlacionar envio, recebimento, processamento e falha. [Google Cloud retry strategy](https://cloud.google.com/storage/docs/retry-strategy); [OpenTelemetry messaging](https://opentelemetry.io/docs/specs/semconv/messaging/)

**Critérios recomendados:** nenhuma reserva duplicada ou cancelamento duplicado em 1.000 reexecuções do mesmo evento; 100% dos eventos não processados em dead-letter ou fila operacional; reconciliação diária sem divergência não explicada; e rastreabilidade ponta a ponta por `reservation_id`, `guest_id` autorizado, `room_id`, `task_id`, `event_id`, versão do agente e correlação de atendimento. São metas propostas para o piloto, não fatos de mercado.

### Shadow mode

Em shadow mode, a nova versão recebe entradas reais em paralelo, mas seus resultados não são mostrados ao hóspede nem executam ações. Comparam-se intenção, campos, resposta, política, ferramenta sugerida, risco, latência e custo com a versão estável e com avaliação humana. A técnica permite testar a distribuição real sem expor hóspedes à nova versão; sua utilidade é maior quando o sistema tem risco operacional ou dados difíceis de reproduzir. [Google SRE — canarying](https://sre.google/workbook/canarying-releases/); [NIST AI RMF Playbook](https://airc.nist.gov/AI_RMF_Playbook/)

**Aplicação ao Theotókos:** rodar pelo menos uma janela que atravesse dias úteis, fins de semana, feriados, chegada tardia e manutenção, mantendo as ações do agente bloqueadas. Amostrar 100% dos casos de risco alto/crítico para revisão humana e uma amostra aleatória de risco moderado. Avançar somente se não houver falha crítica, se o recall de escalada crítica for 100% e se a taxa de erro factual e de divergência de política não exceder a linha de base acordada. As porcentagens de amostragem e a janela são recomendações.

### Canary rollout

Canary expõe a nova versão a uma fração controlada do tráfego, mantendo a versão estável para o restante e usando os mesmos indicadores de serviço para comparação; o princípio SRE é interromper ou reverter quando o canário degrada os SLOs ou consome o error budget de forma indevida. [Google SRE — SLOs](https://sre.google/sre-book/service-level-objectives/); [Google SRE — canarying](https://sre.google/workbook/canarying-releases/)

**Recomendação:** começar com um único fluxo de baixo risco, um canal e um segmento de hóspedes, sem permitir ações irreversíveis. Aumentar gradualmente somente após revisão diária de incidentes, reclamações, repetição, escalada tardia, latência, custo e indisponibilidade. Definir kill switch que retorne ao fallback humano ou à versão anterior sem alteração de dados. Qualquer falha crítica, exposição de dado, instrução de emergência incorreta, mutação indevida de reserva ou divergência de inventário deve parar o rollout imediatamente; o limiar é uma recomendação de segurança.

### A/B test

A/B deve responder se a nova versão melhora um resultado previamente definido, não apenas se é tecnicamente segura. Randomizar por hóspede ou reserva, evitando que a mesma estadia receba versões diferentes sem uma regra explícita; manter um controle estável; definir métrica primária, guardrails, janela, tamanho mínimo, análise por segmento e regra de interrupção antes do teste. Em jornadas de alto risco, o A/B deve comparar apenas respostas assistidas ou roteamento, nunca autorizar decisões que o sistema ainda não provou executar com segurança. A distinção entre segurança, melhoria causal e rollout progressivo é coerente com práticas de canary e SLO. [Google SRE — SLOs](https://sre.google/sre-book/service-level-objectives/); [NIST AI RMF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)

### Guardrails e SLOs

Usar SLIs de serviço e de resultado: sucesso/erro de integração; p95 de latência; disponibilidade do canal; entrega de mensagem; tempo até humano; resolução; repeat-contact; erro factual; escalada crítica; CES; e reclamações. OpenTelemetry recomenda convenções semânticas para nomes e atributos consistentes em traces, métricas e logs, permitindo correlação entre serviços. [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)

**Metas propostas para o piloto, não fatos publicados:** p95 de resposta conversacional inferior a 3 s quando não houver dependência externa; 99,5% de disponibilidade mensal do caminho de atendimento, excluindo indisponibilidade do provedor documentada; 100% de encaminhamento de emergência e fraude; 100% de confirmação antes de mutação irreversível; 0 incidentes de exposição de dados; e repeat-contact, CES, CSAT e taxa de reclamação não piores que a linha de base por mais de uma janela semanal. Se um guardrail de segurança ou privacidade falhar, o error budget deve ser considerado esgotado para aquele fluxo e mudanças de funcionalidade devem parar até a correção. A ideia de error budget e pausa de releases quando a confiabilidade excede o limite vem do SRE; os valores são inferências para Theotókos. [Google SRE — error budgets](https://sre.google/workbook/implementing-slos/); [Google SRE — service level objectives](https://sre.google/sre-book/service-level-objectives/)

### Taxonomia de incidentes

Registrar incidente com severidade, jornada, canal, idioma, versão, causa provável, impacto, detecção, contenção, correção, prevenção e evidência. A taxonomia recomendada é:

- **Segurança crítica:** não escalou emergência, atrasou ajuda, inventou instrução de segurança, liberou acesso indevido ou fechou manutenção perigosa.
- **Privacidade e LGPD:** revelou dado, reteve além da política, enviou informação ao destinatário errado ou registrou dado sensível sem base/processo definido. A LGPD estabelece direitos, deveres de segurança e papéis de controlador/operador; a classificação operacional deve ser validada juridicamente. [ANPD/LGPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lgpd-en-lei-no-13-709-capa.pdf)
- **Transacional:** reserva, data, hóspede, valor, pagamento, cancelamento ou unidade incorretos; duplicidade; perda de evento; ou divergência PMS/canal.
- **Serviço:** resposta incorreta, promessa não autorizada, handoff sem contexto, repetição exigida, reclamação reaberta ou resolução falsa.
- **Idioma e acessibilidade:** erro pt-BR/pt-PT, nome ou número alterado, resposta incompreensível, recusa indevida de acessibilidade ou falha de canal assistivo. [P3B3](https://arxiv.org/abs/2606.16753); [Lei Brasileira de Inclusão](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm)
- **Confiabilidade técnica:** timeout, indisponibilidade, latência, webhook perdido, retry não idempotente, fila acumulada, falha de observabilidade ou custo anormal.
- **Qualidade de modelo:** alucinação, classificação errada, slot incorreto, recusa indevida, prompt injection, regressão ou drift.

**Recomendação:** severidade 0/1 deve gerar contenção imediata, preservação de evidências e revisão humana; severidade 2 exige correção priorizada e análise de recorrência; severidade 3 entra no backlog de melhoria. Essa escala é proposta, não padrão normativo.

### QA, calibração e feedback loop

Combinar amostra aleatória representativa com amostra orientada a risco. A COPC descreve amostras manuais históricas pequenas e observa que automação pode analisar 100%, mas volume não substitui desenho, calibração e julgamento; a NICE recomenda validar scores automáticos contra avaliação humana e separar falhas críticas de itens de desenvolvimento. [COPC](https://www.copc.com/ai-quality-monitoring-contact-centers/); [NICE](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center)

O scorecard do Theotókos deve separar: autenticidade/autorização; correção factual; decisão de política; preservação de campos; segurança; privacidade; escalada; contexto do handoff; clareza; tom; esforço; e desfecho. Dois avaliadores devem pontuar casos calibrados, discutir divergências e versionar o critério. A calibração deve ocorrer após mudança de prompt, modelo, política, base ou canal e, como recomendação, mensalmente no piloto.

O loop operacional é: interação → evento/telemetria → QA e classificação → causa-raiz → correção de conteúdo, prompt, integração, política ou treinamento → teste dourado/regressão → shadow → rollout controlado → revisão de resultado. COPC e NICE destacam que falhas repetidas podem vir de processo, política, conhecimento, ferramenta, roteamento ou segmento, e não somente do atendente. [COPC](https://www.copc.com/contact-center-qa-roi-resolution-targets/); [NICE](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center)

## 3. Plano de teste e aceitação do Theotókos Flats

### Fase 0 — linha de base e instrumentação

1. Medir por quatro semanas, ou por uma janela suficiente para incluir sazonalidade local, os fluxos atuais por canal e jornada: volume, tempo até resposta, resolução, repetição, escalada, CES/CSAT, reclamações, falhas de PMS, manutenção e prontidão de unidade. **Recomendação:** não definir metas de automação antes dessa linha de base.
2. Versionar casos, prompts, políticas, conhecimento, integrações e permissões.
3. Implementar correlação de atendimento, reserva, hóspede autorizado, unidade, tarefa, evento e versão; não registrar dados desnecessários em logs. [OpenTelemetry](https://opentelemetry.io/docs/concepts/semantic-conventions/); [ANPD/LGPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lgpd-en-lei-no-13-709-capa.pdf)
4. Criar dashboard separado para segurança, resultado do hóspede, operação, modelo, integração, custo e privacidade.

### Fase 1 — offline e simulação

Executar o conjunto dourado e a matriz de cenários com os oito fluxos prioritários: reserva; cancelamento; chegada tardia; acessibilidade; reclamação; manutenção; emergência; pagamento. Os casos devem incluir datas sem ano, virada de meia-noite, “não quero cancelar”, números falados, nomes com diacríticos, gíria, code-switching, ruído de ASR, duplicidade de webhook, PMS indisponível e pedido explícito de humano. Essa matriz é uma recomendação operacional apoiada por evidência sobre pt-BR, slots, recursos de voz e acessibilidade. [MASSIVE](https://aclanthology.org/2023.acl-long.235/); [Google Speech locales](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages); [Lei Brasileira de Inclusão](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm)

**Gate de aceitação recomendado:** zero falhas críticas; 100% de escalada crítica; 100% de confirmação de campos e consequência antes de mutações; nenhum erro não explicado de reconciliação; e desempenho não inferior à linha de base nos casos de risco moderado. Onde não houver amostra suficiente, registrar “não avaliado”, não converter em aprovação.

### Fase 2 — shadow mode

Rodar a versão candidata sem efeito externo, comparar com a versão estável e revisar 100% dos casos de risco alto/crítico. Amostrar aleatoriamente os demais casos e registrar divergência de intenção, slots, resposta, ação, escalada, latência e custo. **Gate recomendado:** nenhum incidente crítico; recall de escalada crítica de 100%; ausência de piora material nos guardrails; e causas das divergências documentadas antes do canary.

### Fase 3 — canary reversível

Começar por FAQ e pré-estadia informativa em um canal, com fallback humano, sem alteração de reserva, pagamento, acesso ou compensação. Expandir para pedidos de baixa consequência somente depois de uma revisão operacional. Ativar kill switch, alerta de erro budget, auditoria de mutações e reconciliação diária. **Recomendação:** qualquer incidente de segurança, privacidade, mutação indevida ou divergência PMS interrompe o canary.

### Fase 4 — experimento controlado

Quando a segurança estiver demonstrada, testar uma única hipótese de negócio, por exemplo: “o novo fluxo reduz esforço sem aumentar repetição”. Randomizar por reserva/hóspede, manter controle, definir métrica primária e guardrails antes do início, analisar por canal, idioma, tipo de estadia, jornada e horário. Não usar containment como métrica primária isolada. [TSIA](https://www.tsia.com/blog/top-support-services-questions-answered); [ICMI](https://www.icmi.com/resources/2025/what-contact-centers-are-measuring)

### Fase 5 — operação contínua

Revisar diariamente alertas e incidentes; semanalmente repetição, reclamações, escaladas, falhas de integração e top três causas-raiz; mensalmente scorecard e calibração; e trimestralmente risco, políticas, incentivos, segmentos, retenção e limites. A frequência é recomendação de governança local; a necessidade de monitoramento, revisão, calibração e melhoria contínua é coerente com NIST, ISO/IEC, NICE e COPC. [NIST AI RMF Playbook](https://airc.nist.gov/AI_RMF_Playbook/); [ISO/IEC 42001](https://www.iso.org/standard/81230.html); [NICE](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center)

### Critério de decisão final

Liberar uma automação somente quando ela tiver: caso de uso e autoridade definidos; conjunto dourado versionado; simulação aprovada; shadow concluído; canary reversível; guardrails mensuráveis; handoff com contexto; logs e métricas correlacionáveis; taxonomia de incidentes; dono operacional; procedimento de rollback; e evidência de que a mudança melhora o desfecho ou reduz esforço sem degradar segurança, privacidade, resolução ou confiança. Esses requisitos são critérios propostos para Theotókos, fundamentados nas práticas e fontes citadas, e não uma lista de requisitos legais ou um benchmark universal.

Não há benchmark público confiável que transfira diretamente containment, FCR, CSAT, latência ou ganhos de produtividade de grandes redes para 31 unidades/apartamentos do Theotókos; os próprios cases de fornecedores devem ser tratados como hipóteses, pois não demonstram causalidade com controle independente. [hotelkit Estrel case](https://hotelkit.net/customer-stories/germanys-largest-hotel/); [Staycity/Optii case](https://hoteltechreport.com/success-stories/marketing/optii/staycity-aparthotels). A linha de base local e os gates acima são, portanto, a evidência decisória principal.
