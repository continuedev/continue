# Governar automação hoteleira com supervisão humana

**Resumo executivo.** A automação segura para a Theotókos deve ser desenhada como uma camada operacional assistida, não como um recepcionista autônomo. O PMS ou PMS mais channel manager deve continuar sendo a fonte de verdade para reservas, disponibilidade, tarifas, ocupação e folio; a automação deve interpretar mensagens, consultar fatos aprovados, criar tarefas, priorizar exceções e propor ações; e uma pessoa autorizada deve confirmar toda decisão financeira, física, de segurança, acessibilidade, privacidade ou fora de política. Esse padrão é consistente com o NIST AI RMF e seu perfil de IA generativa, com ISO/IEC 42001 e 23894, com OWASP para aplicações LLM e com os fluxos de PMS/housekeeping documentados pela Oracle ([NIST AI RMF](https://nvlpubs.nist.gov/nistpubs/AI/NIST.AI.100-1.pdf), alta; [NIST AI 600-1](https://doi.org/10.6028/NIST.AI.600-1), alta; [ISO/IEC 42001](https://www.iso.org/standard/81230.html), alta; [OWASP Top 10 LLM 2025](https://genai.owasp.org/llm-top-10/), alta; [Oracle room status](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_room_status_mobile_app.htm), alta). A regra operacional é: **informar automaticamente, propor dentro de limites, agir somente com autorização verificável e nunca improvisar em dinheiro, acesso, identidade, emergência ou dados pessoais**.

O maior risco não é a fluência do modelo; é a divergência entre sistemas e o efeito físico ou financeiro de uma decisão errada: overbooking, preço incorreto, cobrança duplicada, código enviado à pessoa errada, unidade liberada sem inspeção, manutenção perigosa encerrada ou emergência atrasada. A arquitetura recomendada mantém uma autoridade por domínio, eventos idempotentes, reconciliação, filas de exceção, controles de acesso por função, logs append-only, base de conhecimento versionada, modo manual testado e um botão de parada. Cases de fornecedores mostram que mensagens, check-in web, roteamento de pedidos, housekeeping e manutenção são fluxos maduros quando estreitos e supervisionáveis; não comprovam a existência de um agente geral seguro para alterar reservas, cobrar, emitir acesso e encerrar incidentes sem revisão ([Mews](https://www.mews.com/en/products/api), alta para capacidades documentadas; [Cloudbeds webhooks](https://developers.cloudbeds.com/docs/webhooks-1), alta; [Akia Rambla](https://www.akia.com/case-studies/rambla-a-contactless-property-maintains-high-guest-services-with-ai-agents), média-baixa para resultados).

Este relatório traduz as notas de pesquisa em controles para recepção, reservas, housekeeping, manutenção, incidentes, comunicação, roteamento, alertas de SLA, handover e melhoria contínua. **Não é aconselhamento jurídico.** A aplicabilidade depende do país, município, classificação do estabelecimento, contratos, meios de pagamento, fornecedores e fatos da operação. As notas tratam principalmente de uma operação brasileira em Piumhi-MG, mas também contêm referências europeias e gregas; por isso, LGPD/ANPD é o baseline quando o tratamento ocorre no Brasil, enquanto GDPR e regras locais devem ser validados se a propriedade estiver na União Europeia ou atender requisitos extraterritoriais.

## Escopo, premissas e método de leitura

O escopo cobre automação de reservas e distribuição, recepção omnicanal, pré-chegada, check-in/out, acesso físico, housekeeping, manutenção preventiva e corretiva, incidentes, reclamações, pagamentos, concierge, roteamento de tarefas, alertas de SLA, handover, reputação e melhoria de modelos. Foram lidas as notas de pesquisa da pasta indicada, incluindo arquitetura, LGPD, pagamentos, avaliação, riscos multilíngues, fornecedores, operações, contexto local e matriz de cenários. A data de corte informada nas notas é **8 de novembro de 2026**.

As premissas de desenho são explicitamente condicionais: operação independente ou boutique; equipe enxuta; possível crescimento de 12 para 15 e depois 31 unidades; WhatsApp, web, telefone, balcão e OTAs; PMS ainda a confirmar; pagamentos por Pix/cartão; recepção não necessariamente contínua; e necessidade de operar em português brasileiro. O inventário real de unidades, PMS, channel manager, fechaduras, equipe, horários, políticas, contratos e localização da Theotókos deve substituir essas hipóteses antes de produção. As notas não comprovam publicamente o PMS, o número de unidades, o endereço ou o quadro de pessoal.

As fontes foram reconciliadas em quatro classes:

| Classe | Tratamento no relatório |
|---|---|
| **Obrigação legal ou regulatória** | Apresentada como requisito somente quando a fonte jurídica ou autoridade competente a sustenta; o escopo territorial é indicado. |
| **Padrão técnico ou de governança** | Tratado como referência voluntária ou prática recomendada, não como certificação automática. |
| **Capacidade de fornecedor** | Descrita como capacidade anunciada/documentada; não equivale a SLA, qualidade, segurança contratual ou adequação local. |
| **Proposta Theotókos** | Limiar, papel, prazo, KPI ou workflow recomendado; deve ser aprovado pelo proprietário, operação, encarregado/consultoria de privacidade e responsável de segurança. |

Claims de ROI, percentual de automação, número de clientes e produtividade de vendors foram rebaixados para hipótese comercial quando não havia metodologia independente. A ausência de documentação pública de uma API não prova que o recurso não exista; prova que ele não deve ser assumido sem contrato, sandbox e teste de aceitação.

## Estruture a governança em quatro linhas de defesa

### 1. Governar: autoridade, escopo e risco

A direção deve aprovar um inventário de casos de uso com proprietário, finalidade, dados, sistemas, risco, autoridade permitida, fornecedor, versão e critério de retirada. O registro deve distinguir o que a IA pode **ler**, **sugerir**, **criar** e **executar**. Cada fluxo recebe uma classificação:

| Nível | Exemplos | Regra de autonomia |
|---|---|---|
| **R0 — informativo** | FAQ aprovada, localização, horário confirmado, status de tarefa, link oficial | Automático se a fonte estiver vigente e houver evidência; abster-se se houver conflito. |
| **R1 — operacional reversível** | Criar pedido de toalha, abrir tarefa P2, enviar lembrete utility, sugerir roteamento | Automático dentro de schema, identidade e SLA; humano revisa amostra e exceções. |
| **R2 — impacto na estadia ou receita** | Alterar datas/ocupação, aplicar desconto, late checkout, upgrade, bloquear unidade, reembolso | Proposta + confirmação explícita; aprovação humana quando houver exceção, valor ou impacto em inventário. |
| **R3 — crítico/irreversível** | Cobrança, cancelamento com penalidade, emitir/revogar acesso, recusar check-in, decisão antifraude, dados sensíveis, emergência | Sem execução autônoma. Regra determinística, autenticação forte, aprovação humana e trilha completa. |

O NIST AI RMF organiza a governança em Govern, Map, Measure e Manage; ISO/IEC 42001 estrutura um sistema de gestão de IA; ISO/IEC 23894 orienta identificação, tratamento e revisão de riscos. São referências de governança, não prova de conformidade por simplesmente adotá-las ([NIST AI RMF](https://nvlpubs.nist.gov/nistpubs/AI/NIST.AI.100-1.pdf), alta; [ISO/IEC 42001](https://www.iso.org/standard/81230.html), alta; [ISO/IEC 23894](https://www.iso.org/standard/77304.html), alta).

### 2. Mapear: autoridade operacional e invariantes

O PMS/PMS+channel manager deve ser a autoridade para reserva, cancelamento, no-show, disponibilidade, tarifa, ocupação e folio; o PSP deve ser a autoridade para autorização, captura, estorno e chargeback; o sistema de tarefas deve ser a autoridade para execução de limpeza/manutenção; e o hub deve orquestrar, deduplicar, reconciliar e auditar. O hub não deve virar um segundo PMS.

O estado da unidade deve separar:

* `occupancy_state`: vaga, ocupada, chegada prevista, check-in, check-out;
* `cleaning_state`: suja, em limpeza, limpa, pickup, inspecionada;
* `availability_state`: vendável, fora de serviço, fora de ordem, bloqueada;
* `guest_service_state`: não perturbe, arrumar quarto, turndown, pedido aberto;
* `priority`: chegada iminente, impacto em hóspede, turnover normal, limpeza profunda, não urgente.

A Oracle documenta a distinção entre Dirty, Clean, Inspected, Pickup, Out of Service e Out of Order; Out of Order retira a unidade da disponibilidade e afeta métricas operacionais ([Oracle room-status mobile app](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_room_status_mobile_app.htm), alta; [Oracle housekeeping board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_housekeeping_using_the_housekeeping_board.htm), alta). A inferência para Theotókos é decisiva: **“limpa” não é automaticamente “vendável”**. A política deve definir se a inspeção é obrigatória, quais defeitos bloqueiam venda e quem pode liberar uma unidade.

Invariantes de aceitação:

1. Repetir um evento externo não cria segunda reserva, cobrança, mensagem, tarefa ou código.
2. Timeout depois de uma mutação externa vira `UNKNOWN` até reconciliação; nunca gera retry cego.
3. Toda mutação destrutiva registra motivo, versão anterior, nova versão, ator, aprovação e resultado externo.
4. Uma unidade `OO`, uma unidade não inspecionada quando a política exige inspeção, ou uma unidade com risco de segurança não pode ser vendida/liberada.
5. Um usuário nunca consulta ou altera recurso de outra propriedade, unidade ou reserva sem autorização explícita.
6. Um evento fora de ordem não sobrescreve uma versão mais nova.

### 3. Medir: evidência antes de autonomia

Antes do piloto, medir pelo menos quatro semanas ou uma janela suficiente para incluir dias úteis, fins de semana, feriados, chegadas tardias e manutenção: volume por canal, primeira resposta, resolução, repetição, handoff, atrasos de room-ready, retrabalho em 24 horas, falhas de acesso, tarefas vencidas, pagamentos pendentes, incidentes e reclamações. Não copiar metas de grandes hotéis ou cases de fornecedores.

O conjunto dourado deve conter pelo menos 200 casos representativos, revisados por operação brasileira, com intenção, slots, política, ação permitida, condição de abstinência, escalada e severidade. Incluir pt-BR informal, voz/ASR, nomes, CEP, datas, moeda, code-switching, acessibilidade, reclamações, pagamento, fraude e emergência. MASSIVE ajuda a testar intenção e slots multilíngues, mas não é benchmark de hotelaria; P3B3 demonstra que pt-BR e pt-PT precisam ser avaliados separadamente ([MASSIVE](https://aclanthology.org/2023.acl-long.235/), alta; [P3B3](https://arxiv.org/abs/2606.16753), média para o contexto hoteleiro; [Google Speech locales](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages), alta para suporte documentado).

Os gates de promoção devem privilegiar segurança e correção transacional:

* zero efeitos físicos/financeiros não autorizados;
* 100% de escalada dos casos P0;
* 100% de confirmação de campos críticos e consequência antes de mutação;
* zero vazamento cross-tenant;
* zero uso de fonte expirada para ação operacional;
* zero cartão completo/CVV em logs, chat, analytics ou tickets;
* nenhuma divergência de reconciliação sem dono e prazo;
* desempenho por canal, idioma e jornada não inferior ao baseline sem explicação.

### 4. Gerenciar: mudança, incidentes e retirada

Modelo, prompt, ferramenta, integração, embedding, base de conhecimento, regra de negócio e template de WhatsApp devem ter versão, proprietário, revisão, teste, aprovação e rollback. O ciclo recomendado é: offline → simulação → shadow mode → canário restrito → produção gradual → revisão semanal → calibração mensal → revisão trimestral. Um kill switch deve desativar uma ferramenta, fluxo, fornecedor ou versão e retornar à versão anterior ou ao atendimento manual.

OWASP 2025 identifica prompt injection, poisoning, improper output handling, excessive agency, fraquezas de vetor e desinformação como riscos distintos; MITRE ATLAS fornece técnicas para emulação de adversários. A defesa não é apenas um prompt: é conteúdo não confiável delimitado, autorização fora do modelo, allowlist, validação server-side, confirmação, limites e logs ([OWASP Top 10](https://genai.owasp.org/llm-top-10/), alta; [MITRE ATLAS](https://atlas.mitre.org/), alta).

## Aplique controles específicos a cada jornada

| Jornada | Automação permitida | Aprovação/override humano | Hard stop e evidência |
|---|---|---|---|
| **Recepção e inbox** | Classificar intenção, detectar idioma, buscar reserva autorizada, responder FAQ vigente, resumir e abrir caso | Baixa confiança, pedido explícito de humano, reclamação grave, discriminação, ameaça, privacidade, acessibilidade, cobrança, fraude | Não revelar reserva de terceiro; handoff leva histórico, idioma, reserva autorizada, tentativas e próximo passo. |
| **Reservas e cotação** | Consultar PMS/booking engine; gerar cotação com validade; deep link; detectar abandono; confirmar utility | Alteração de data/ocupação/unidade, grupo, overbooking, desconto, exceção de política, tarifa manual | Nunca confirmar por memória; revalidar inventário/preço no commit; registrar canal, versão, política, valor e ID externo. |
| **Cancelamento/no-show** | Explicar política publicada; preparar cálculo; abrir solicitação | Cancelar, aplicar multa, conceder crédito/reembolso, inferir no-show por ausência de mensagem | Escopo, identidade, política e consequência devem ser confirmados; no-show depende do estado/horário do PMS, não do silêncio do hóspede. |
| **Pré-chegada** | Mensagem utility, horário de chegada, instruções verificadas, coleta mínima, upsell com estoque | Acessibilidade não verificável, documento divergente, chegada fora de horário sem acesso comprovado, falha de pagamento | Não enviar código antes de reserva válida, autorização de pagamento/identidade e estado da unidade; template Meta aprovado fora da janela. |
| **Check-in/acesso** | Verificar pré-condições; emitir proposta de instrução; abrir tarefa de suporte | Emitir/revogar credencial, room move, recusar check-in, exceção de identidade, unidade não inspecionada | Código único, prazo de validade, revogação em cancelamento/checkout, logs de emissão e fallback físico; não expor código de outra unidade. |
| **Housekeeping** | Criar turnover/stayover, ordenar por chegada, distribuir tarefa P2, registrar início/fim/bloqueio | Liberar unidade com exceção; inspeção; bloqueio `OO`; alterar prioridade por risco; fechar falha crítica | `clean` não implica `sellable`; tarefa precisa de unidade, responsável, SLA, evidência e estado. |
| **Manutenção** | Classificar defeito, extrair unidade/ativo, criar work order, alertar vencimento, sugerir peças | Tornar seguro, isolar energia/água, bloquear unidade, autorizar gasto, fechar P0/P1 | Vazamento grave, gás, faísca, inundação, elevador preso ou risco elétrico interrompem troubleshooting e escalam imediatamente. |
| **Incidentes** | Criar registro, preservar evidência, classificar preliminarmente, notificar duty manager | Contenção, comunicação externa, polícia/emergência, decisão sobre titular/ANPD, compensação, encerramento | Incidente nunca é apagado; severidade, impacto, pessoas/ativos afetados, decisões e timeline são restritos e auditáveis. |
| **Comunicação durante estada** | Menu estruturado de toalha, limpeza, Wi-Fi, amenidade, ruído, recomendação e pedido técnico | Reembolso, promessa de segurança, ameaça legal, reclamação repetida, saúde, discriminação, vulnerabilidade | A resposta deve separar fato confirmado, estimativa e promessa; tarefa tem owner e prazo real. |
| **Task routing** | Roteamento por categoria, unidade, turno, capacidade, prioridade e skill; reatribuição por ausência | Reatribuição de P0/P1, alteração de prioridade, fechamento de tarefa crítica | Permissões impedem autoatribuição fora do escopo; toda mudança registra motivo e ator. |
| **SLA alerts** | Relógio de reconhecimento e restauração; lembretes; escalada por idade/impacto; painel de backlog | Pausar relógio, declarar blocker, alterar prazo, aceitar exceção | Só pausar com motivo codificado; “aguardando peça” não encerra SLA; medir response e restoration separadamente. |
| **Handover de turno** | Gerar resumo de pendências, bloqueios, hóspedes impactados, pagamentos e próximos prazos | Duty manager valida P0/P1 e aceite do próximo turno | Sem handover silencioso: cada item tem dono, estado, ETA, risco e confirmação de recebimento. |
| **Checkout/pós-estada** | Lembrete, link seguro, pesquisa, tarefa de limpeza, pedido de feedback | Dano, caução, item faltante, retenção de valor, disputa, publicação de resposta sensível | Checkout não é bloqueado por disputa não verificada; lost-and-found tem cadeia de custódia separada. |
| **Concierge local** | Sugerir item de catálogo aprovado, datado e com fonte; oferecer alternativa | Confirmar reserva de parceiro, segurança, acessibilidade, estrada, clima e cancelamento | “Listado” não significa “aberto”, “disponível”, “seguro” ou “credenciado”; registrar fonte e última confirmação. |

Para emergência potencial — incêndio, fumaça, gás, inundação grave, violência, ameaça, pessoa presa, desaparecimento, mal súbito ou risco elétrico — a automação deve usar mensagem curta, localização mínima, contato humano imediato e serviço público apropriado. Ela não deve diagnosticar, conduzir troubleshooting perigoso ou alegar ter chamado emergência sem confirmação auditável. No Brasil, os contatos locais devem ser validados; na Grécia/UE, 112 é o número europeu, mas isso não substitui a validação do protocolo local ([European Commission 112](https://digital-strategy.ec.europa.eu/en/policies/112), alta para a regra europeia; [NIST SP 800-61](https://csrc.nist.gov/pubs/sp/800/61/r2/final), alta para resposta a incidentes).

## Defina RACI, segregação e acesso mínimo

### Papéis de negócio

| Papel | Responsabilidade | Pode aprovar | Não deve acumular |
|---|---|---|---|
| **Proprietário/direção** | Apetite de risco, orçamento, políticas, fornecedores, exceções materiais | Reembolso alto, mudança de política, liberação de autonomia R2/R3, aceitação de risco | Operação diária de seu próprio incidente sem revisão posterior. |
| **Duty manager/gestor de operações** | Triagem, exceções, segurança, handover, escalada P0/P1 | Room move, bloqueio/liberação, compensação dentro do limite, override de SLA | Aprovar sozinho sua própria compensação ou fechar incidente causado por sua ação. |
| **Recepção/guest service** | Identidade operacional, reservas, comunicação e abertura de casos | Apenas ações R0/R1 delegadas | Acesso a PAN/CVV, aprovação de próprio reembolso, alteração de política. |
| **Housekeeping/supervisor** | Execução, checklist, inspeção, defeitos e estado de limpeza | Concluir tarefa própria; supervisor aprova inspeção conforme política | Liberar sozinho unidade com falha crítica ou alterar inventário financeiro. |
| **Manutenção** | Diagnóstico, tornar seguro, reparo, PM, peças e evidência | Fechar tarefas não críticas após verificação | Aprovar compra acima do limite ou remover bloqueio de segurança sem validação. |
| **Financeiro** | PSP, conciliação, reembolso, chargeback, fiscal | Reembolso dentro da alçada e com evidência | Alterar reserva e aprovar sua própria exceção financeira. |
| **Privacidade/encarregado** | ROPA, avisos, direitos, RIPD, operadores, incidentes de dados | Base documental, acesso a dados, resposta a titulares | Administrar produção sem trilha ou decidir sozinho risco operacional não jurídico. |
| **Segurança/infraestrutura** | IAM, segredos, logs, backups, vulnerabilidades, kill switch | Acesso técnico, bloqueio de integração, restauração | Alterar registros de negócio ou apagar evidência. |
| **Dono do produto/modelo** | Dataset, prompt, KB, testes, monitoramento, rollout | Mudança técnica dentro de risco aprovado | Promover versão que ele próprio avaliou sem revisão independente em R2/R3. |
| **Fornecedor/operador** | Executar instruções contratuais, segurança, suporte e incidente | Nenhuma autonomia além do contrato | Reutilizar dados para finalidade não aprovada. |

### Matriz de acesso

Aplicar RBAC por propriedade, função e escopo; MFA para administradores, financeiro, privacidade e suporte privilegiado; contas individuais; tokens de serviço separados; revisão mensal de privilegiados e trimestral de todos os acessos; desligamento no mesmo dia; acesso emergencial temporário com motivo e expiração. A ANPD recomenda controle de acesso, proteção de armazenamento, segurança das comunicações, gestão de vulnerabilidades, contratos e treinamento ([Guia ANPD para pequeno porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte), alta).

| Recurso | Recepção | Housekeeping | Manutenção | Financeiro | Gestor | Privacidade | IA |
|---|---:|---:|---:|---:|---:|---:|---:|
| Reserva e calendário | leitura/escrita delegada | mínimo necessário | mínimo necessário | leitura de cobrança | total operacional | leitura auditada | leitura via ferramenta |
| PII de hóspede | mínima e mascarada | nome somente se necessário | nome normalmente não | contato necessário | ampla justificada | acesso controlado | somente campos necessários |
| PAN/CVV | não | não | não | nunca PAN bruto; PSP | não | não por padrão | nunca |
| Pagamento/status/token | leitura status | não | não | escrita conforme alçada | leitura/aprovação | auditoria | solicitar link/status |
| Código/fechadura | solicitação controlada | não | suporte técnico limitado | não | emitir/revogar | auditoria | nunca credencial ampla |
| Tarefa própria | executar | executar | executar | não | triagem/override | leitura incidente | criar/rotear R1 |
| Logs/auditoria | próprios casos | próprios casos | próprios casos | próprios fluxos | ampla sem editar | ampla de privacidade | sem acesso direto ao armazenamento |
| Base de conhecimento | sugerir correção | sugerir SOP | sugerir instrução | sugerir política financeira | aprovar operacional | aprovar privacidade | ler snapshot publicado |

Segregação de funções mínima: quem cria uma exceção financeira não a aprova; quem executa manutenção crítica não libera sozinho a unidade; quem publica política não promove sozinho o modelo que a interpreta; quem administra IAM não edita logs de negócio; e quem responde a incidente de dados preserva a evidência antes de alterar o sistema.

## Use limiares de aprovação, override e confirmação

Os valores abaixo são **propostos para aprovação local**, não limites legais. Devem ser ajustados ao ADR, contrato, seguro, caixa e materialidade:

| Ação | Sem aprovação | Confirmação do hóspede | Aprovação humana | Dois aprovadores / direção |
|---|---|---|---|---|
| FAQ, status de tarefa, link oficial vigente | Sim, R0 | Não | Amostra e exceção | Não |
| Abrir tarefa P2 com campos válidos | Sim, R1 | Se houver custo ou entrada na unidade | Se dados conflitantes | Não |
| Mensagem utility necessária à hospedagem | Sim, template vigente | Quando alterar condição relevante | Se conteúdo sensível | Não |
| Upsell com preço/inventário aprovado | Propor | Sim | Se desconto, pacote ou capacidade incerta | Acima da alçada comercial |
| Alterar datas, ocupação ou unidade | Não | Sim, com resumo de impacto | Sempre validar PMS/política | Se gerar perda material/overbooking |
| Cancelar, aplicar multa ou no-show | Não | Sim, escopo e consequência | Sempre | Disputa, exceção ou valor acima da alçada |
| Reembolso/compensação | Não | Quando aplicável | Financeiro ou gestor conforme limite | Acima de **R$ 500** ou fora da política, proposta |
| Cobrança/depósito | Não | Sim, checkout seguro e termos | Financeiro aprova exceção | Acima de **R$ 1.000**, captura fora do fluxo ou cartão salvo |
| Emitir/revogar acesso | Não | Não basta mensagem | Gestor/sistema determinístico | Room move, identidade divergente ou exceção |
| Liberar unidade após limpeza | Não se houver inspeção exigida | Não | Supervisor ou regra aprovada | Falha crítica, dano, água/energia, segurança |
| Bloquear `OO`/retirar inventário | Pode sugerir | Não | Gestor/maintenance conforme severidade | Impacto em múltiplas unidades ou receita relevante |
| Emergência P0 | Alertar automaticamente | Não esperar confirmação | Duty manager + serviço apropriado | Direção notificada depois da contenção |
| Alterar política, prompt, modelo, KB crítica | Não | Não | Owner + revisão independente | Direção/privacidade para R2/R3 |

O limiar monetário é apenas um exemplo para tornar a regra operacional. Se a operação usar outro valor, registrar a decisão, vigência, aprovador e motivo. Nunca permitir que o modelo escolha o limiar, o aprovador ou a exceção.

Confirmação deve mostrar ação, entidade, campos normalizados, valor, moeda, política, impacto, destinatário, validade e `action_hash`; qualquer alteração invalida a confirmação. O backend deve recalcular identidade, escopo, estado e autorização, pois Structured Outputs/function calling validam formato, não autorização nem regra de negócio ([OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), alta para comportamento documentado; [OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/), alta).

## Minimize dados e proteja os sistemas

### Privacidade e LGPD

Para operação no Brasil, o inventário deve mapear finalidade, base legal, categorias de dados, titulares, origem, destinatários, operadores, países, retenção, controles e proprietário. A LGPD exige finalidade, adequação, necessidade, livre acesso, qualidade, transparência, segurança, prevenção, não discriminação e responsabilização; prevê bases legais, direitos, segurança, operadores e decisões automatizadas ([LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), alta; [ANPD direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares), alta).

Controles mínimos:

* ROPA antes de nova integração; RIPD para monitoramento sistemático, dados sensíveis, biometria, CCTV, scoring ou efeito relevante.
* Aviso em reserva, check-in, CCTV e primeiro contato WhatsApp; separar execução contratual de marketing e registrar opt-in/opt-out.
* Coletar somente nome/contato/datas/ocupação e campos necessários à hospedagem; não criar “perfil sensível” por inferência.
* Identidade: verificar o mínimo necessário; mascarar documento; evitar cópia integral sem finalidade e retenção documentadas.
* Saúde, biometria, acessibilidade e vulnerabilidade: fila restrita, motivo codificado, mínimo necessário, decisão humana e nenhuma nota subjetiva/discriminatória.
* WhatsApp, telefone e reviews: não solicitar PAN/CVV; anexos e transcrições têm retenção própria; não misturar notas internas com mensagem ao hóspede.
* Direitos: canal autenticado, busca por identificador, exportação sem dados de terceiros, correção, eliminação/anonimização quando cabível e preservação de legal hold.
* Operadores: DPA, suboperadores, finalidade, segurança, países, transferência internacional, assistência, auditoria, incidente, retorno/eliminação e exportação.
* Transferência internacional: mapear PMS, cloud, WhatsApp, CRM, analytics, suporte, gateway e locks; aplicar hipótese e cláusulas conforme LGPD e Resolução ANPD nº 19/2024 ([Resolução ANPD 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024), alta).

Não há na pesquisa uma tabela oficial universal de retenção para hotelaria. Portanto, aprovar uma tabela por finalidade, confrontando obrigações fiscais, consumeristas, trabalhistas, contratuais, segurança e litígio:

| Classe | Retenção proposta | Regra |
|---|---|---|
| Cotação/lead sem reserva | 90 dias | Excluir ou anonimizar, salvo marketing válido ou disputa. |
| Mensagem transacional | Duração da relação + prazo aprovado de defesa | Separar conteúdo necessário, metadados e marketing. |
| Reserva/folio/fiscal | Conforme obrigação aplicável | Legal hold suspende expurgo; financeiro aprova. |
| Documento de identidade | Mínimo necessário e prazo documentado | Não guardar cópia por conveniência; eliminação verificável. |
| Código de acesso | Até revogação/checkout + janela de segurança | Nunca reutilizar; preservar apenas evento auditável. |
| CCTV | Curto prazo baseado em risco | Preservar somente clipe de incidente autorizado. |
| Logs técnicos | 12 meses como proposta inicial | Ajustar ao risco, contrato e necessidade; mascarar PII. |
| Logs de auditoria de ação crítica | 24 meses como proposta inicial | Append-only, acesso restrito, legal hold. |
| Incidente/chargeback | Pelo prazo de defesa aplicável | Cadeia de custódia e acesso restrito. |

Esses prazos são pontos de partida, não safe harbours. Art. 16 da LGPD e obrigações específicas podem exigir conservação; a eliminação deve ser segura e comprovável.

### Pagamentos

Usar checkout hospedado ou campos tokenizados; o PMS recebe token/referência, status, valor, últimos quatro dígitos quando realmente necessários e IDs de reconciliação, nunca PAN/CVV. PCI DSS continua aplicável ao escopo correspondente mesmo quando o checkout hospedado o reduz ([PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/), alta; [Stripe PCI guide](https://docs.stripe.com/security/guide), alta).

Separar estados `payment_pending`, `authorized`, `captured`, `voided`, `refunded`, `disputed`, `unknown` e `reconciled`. Pix é pagamento confirmado/reembolsável, não presumida pré-autorização; cartão só pode ser capturado posteriormente quando provedor, adquirência, consentimento e regras da transação suportarem ([Mercado Pago Pix](https://www.mercadopago.com.br/developers/en/docs/checkout-api/payment-methods/pix), alta; [Stripe capture later](https://docs.stripe.com/payments/capture-later), alta; [Adyen authorization](https://docs.adyen.com/online-payments/authorisation), alta).

Webhooks de pagamento devem ser autenticados, persistidos, deduplicados, processados de forma assíncrona e reconciliados. Usar idempotency key em criação, captura e reembolso; timeout após envio consulta o provedor antes de repetir ([Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), alta; [Adyen API idempotency](https://docs.adyen.com/development-resources/api-idempotency), alta; [Mercado Pago idempotency](https://www.mercadopago.com.br/developers/en/docs/checkout-api/additional-content/notifications/idempotency), alta).

### Segurança de LLM, RAG e ferramentas

A base de conhecimento deve ter `document_id`, origem/URL, proprietário, versão, hash, idioma, unidade, vigência, classificação, aprovador e estado. Conteúdo externo, reviews, e-mails, PDFs e mensagens de hóspedes são dados não confiáveis, nunca instruções. Ingestão passa por quarentena, verificação de origem, malware/HTML, conflito, revisão e publicação. Uma regra expirada, conflitante ou sem proveniência retorna `CONFLICT`/`INSUFFICIENT_EVIDENCE` e encaminha.

Filtrar autorização, tenant, unidade, idioma, validade e status publicado antes da busca vetorial; combinar busca lexical para IDs/datas/nomes com semântica; citar `document_id@version#chunk`; e bloquear resposta factual sem evidência. Conteúdo recuperado e saída de ferramenta também devem ser validados fora do modelo.

Allowlist mínima de ferramentas: consultar reserva/política; criar pedido; cotar alteração; solicitar link de pagamento; abrir reembolso; emitir solicitação de acesso; escalar humano. Não expor SQL, shell, HTTP arbitrário, alteração direta de preço, credencial ampla, prompt interno ou ferramenta genérica de envio. O backend valida schema fechado, IDs opacos, timezone, tenant, papel, estado, idempotência e versão otimista.

Limites propostos: no máximo três chamadas de ferramenta por turno, no máximo uma mutação pendente sem confirmação, orçamento de tokens/custo, circuit breaker, rate limit e dead-letter. Os limites são controles de abuso e disponibilidade, não garantias contra ataque.

## Registre tudo que permita reconstruir uma decisão

O log de auditoria deve ser append-only ou tamper-evident, com acesso restrito, sincronização de relógio e exportação. Para cada interação/ação, guardar, conforme necessidade e minimização:

`correlation_id`, `property_id`, `reservation_id` autorizado, `unit_id`, `task_id`, `event_id`, canal, idioma, ator/papel, sessão, ação, estado antes/depois, motivo, política e versão, modelo e versão, prompt hash, `kb_snapshot_id`, ferramenta e versão, argumentos redigidos, confirmação/action hash, aprovação, resultado externo, latência, erro, retry, IP/dispositivo quando justificável e timestamp.

Não registrar documento completo, PAN/CVV, token secreto, senha, prompt protegido, conteúdo de outra reserva ou transcrição integral quando um resumo/ID for suficiente. Para suporte e incidente, manter relação entre log minimizado e cofre restrito que contenha a evidência original somente quando necessária.

O registro de integração deve persistir envelope bruto imutável, assinatura verificada, origem, versão, recebido/processado, tentativas, dead-letter, correlação e hash. OpenTelemetry oferece convenções para messaging, traces, métricas e logs; Google SRE fornece a disciplina de SLO/error budget/canário ([OpenTelemetry semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/), alta; [Google SRE SLO](https://sre.google/sre-book/service-level-objectives/), alta).

Uma amostra auditada deve ser reproduzível: dado de entrada autorizado, versão do modelo/prompt/política, snapshot da KB, resposta, ferramenta, decisão, aprovação e resultado. O objetivo proposto é reconstituir uma resposta crítica em até 10 minutos, sem depender de memória do atendente.

## Planeje fallback, incidentes e continuidade

### Modos de operação

| Falha | Modo seguro |
|---|---|
| LLM ou RAG indisponível | FAQ estática aprovada, formulário/telefone humano, nenhum efeito transacional. |
| PMS/channel manager indisponível | Leitura do último snapshot com marcação de desatualizado; bloquear mutações; planilha/registro manual numerado; reconciliação posterior. |
| Gateway indisponível | Não afirmar pagamento; link alternativo aprovado ou instrução humana; não repetir cobrança. |
| WhatsApp/telefone indisponível | Site, e-mail, número alternativo, quadro local e rádio/telefone da equipe. |
| Fechadura/internet sem resposta | Fallback físico/portaria/chave reserva; duty manager; revogar/confirmar depois; nunca expor código de outra unidade. |
| Sistema de tarefas indisponível | Checklist papel numerado ou quadro controlado; registrar horário/ator; importar após recuperação. |
| Falha de IA durante emergência | Alertar por canal independente; orientar 112/serviço local; duty manager assume; não esperar recuperação do bot. |

O fallback deve ser treinado e testado trimestralmente. ISO 22301 trata continuidade; NIST SP 800-61 trata preparação, detecção, contenção, erradicação, recuperação e lições aprendidas; NIST CSF 2.0 organiza Govern, Identify, Protect, Detect, Respond e Recover ([ISO 22301](https://www.iso.org/standard/75106.html), alta; [NIST SP 800-61](https://csrc.nist.gov/pubs/sp/800/61/r2/final), alta; [NIST CSF 2.0](https://www.nist.gov/cyberframework), alta).

### Incidente operacional e de dados

Classificar:

* **S0 segurança/vida:** emergência não escalada, instrução perigosa, acesso indevido, manutenção insegura, incêndio/gás/violência.
* **S1 privacidade/financeiro/transacional:** vazamento, PAN/CVV, cobrança duplicada, overbooking, cancelamento indevido, reserva ou código incorreto.
* **S2 serviço/confiabilidade:** handoff perdido, tarefa vencida, resposta factual errada, webhook atrasado, falha de fornecedor, reclamação reaberta.
* **S3 qualidade:** tom, tradução, FAQ incompleta, classificação ou UX sem impacto material.

Para S0/S1: parar o fluxo, preservar evidência, conter, nomear um responsável, notificar duty manager e segurança/privacidade, avaliar titulares, comunicar autoridades/pessoas quando aplicável, recuperar, fazer análise de causa-raiz e registrar prevenção. A LGPD exige comunicação de incidente que possa acarretar risco ou dano relevante e a Resolução CD/ANPD nº 15/2024 regulamenta o procedimento; prazo e materialidade devem ser confirmados no caso concreto ([ANPD comunicado de incidente](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis), alta; [LGPD art. 48](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), alta).

Incidentes de modelo devem registrar se a causa foi dado, prompt, modelo, ferramenta, política, integração, idioma, autorização, treinamento ou processo. Não culpar o atendente quando a falha é sistêmica. Revisar conjunto dourado, KB, regra, permissão e SOP antes de reativar.

## Monitore resultado, não apenas automação

O painel deve ser separado em segurança/privacidade, experiência, operação, integração, modelo e economia. Containment só conta quando há resolução confirmada ou ausência de repetição na janela definida; sessão encerrada pelo bot não é resolução. FCR, repeat-contact, CES, CSAT, escalada apropriada, tempo até humano e contexto preservado devem ser analisados juntos ([ICMI métricas 2025](https://www.icmi.com/resources/2025/what-contact-centers-are-measuring), média-alta; [TSIA](https://www.tsia.com/blog/top-support-services-questions-answered), média-alta; [COPC QA](https://www.copc.com/ai-quality-monitoring-contact-centers/), média-alta).

| Família | KPI | Definição/uso |
|---|---|---|
| Segurança | Escalada P0 correta | Casos P0 encaminhados ao destino correto antes do limite; alvo piloto 100%. |
| Segurança | Efeitos não autorizados | Reserva, cobrança, acesso, alteração, publicação ou bloqueio sem autorização; alvo 0. |
| Privacidade | Vazamento/cross-tenant | Dados de outra pessoa, unidade ou propriedade; alvo 0. |
| Pagamento | Duplicidade | Cobranças por mesmo pedido/idempotency key; alvo 0. |
| Integração | Reconciliação sem explicação | Divergências abertas além do prazo; reduzir a zero em operação estável. |
| Serviço | Resolução confirmada | Problema resolvido, não apenas sessão fechada. |
| Serviço | FCR e repetição | Primeira interação e novo contato sobre mesmo assunto. |
| Handoff | Tempo até aceite humano | Criação da escalada até humano assumir; P0/P1 têm limites próprios. |
| Handoff | Contexto preservado | Percentual sem o hóspede repetir dados essenciais. |
| Operação | Room-ready no horário | Unidade inspecionada e vendável antes da chegada. |
| Operação | Retrabalho em 24h | Falha/reabertura após limpeza, manutenção ou fechamento. |
| Operação | PM no prazo | Preventiva concluída no prazo e verificada. |
| SLA | Reconhecimento e restauração | Dois relógios; blocker explícito, nunca “done” falso. |
| Modelo | Factualidade/unsupported claim | Resposta não apoiada por fonte; alvo proposto ≤1% fora de risco crítico. |
| Modelo | Abstenção adequada | Não sabe/conflito/baixa confiança encaminhado sem recusa excessiva. |
| Modelo | Recall de classes críticas | Emergência, fraude, pagamento, acessibilidade e privacidade. |
| Modelo | Drift | Mudança por canal, idioma, versão, estação, evento ou fornecedor. |
| Experiência | CES/CSAT por jornada | Reserva, chegada, manutenção, reclamação, checkout separados. |
| Economia | Custo por atendimento/reserva | Inclui mensagens, modelo, integração, humano e custo de erro. |

Metas propostas de piloto, a calibrar após baseline: p95 conversacional inferior a 3 segundos sem dependência externa; disponibilidade do caminho de atendimento de 99,5%; 100% de confirmação antes de mutação irreversível; zero exposição de dados; recall de emergência de 100%; e nenhum aumento sustentado de repetição, reclamação ou CES negativo. Um único incidente S0/S1 esgota o error budget do fluxo e pausa a promoção.

Qualidade deve combinar amostra aleatória e amostra orientada a risco. Avaliação automática pode cobrir 100% para triagem, mas falhas críticas precisam de julgamento humano e calibração; a NICE recomenda validar scores automáticos e separar itens críticos de desenvolvimento ([NICE quality management](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center), média-alta; [COPC](https://www.copc.com/ai-quality-monitoring-contact-centers/), média-alta).

## Roteiro de implementação controlado

### 0–30 dias: fundação e linha de base

Confirmar endereço, unidades, PMS, channel manager, PSP, locks, canais, equipe, turnos, políticas, acessibilidade, contatos de emergência e contratos. Criar ROPA, mapa de dados, ownership, matriz de acesso, tabela de retenção, classificação de risco, catálogo de fontes e matriz de incidentes. Instrumentar correlação, eventos, logs, métricas e exportação. Medir baseline sem automação.

### 31–90 dias: baixo risco e fallback

Implantar FAQ com KB aprovada, busca de reserva autorizada, mensagens de confirmação/pré-chegada, handoff com contexto, abertura de tarefas P2, checklists móveis, inspeção, manutenção com SLA e handover. Integrar em leitura primeiro. Testar WhatsApp oficial, templates utility/marketing/authentication e opt-out; a Meta exige templates aprovados fora da janela de atendimento e não traduz os textos fornecidos pelo hotel ([Meta templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/), alta).

Executar offline/simulação e red team: prompt injection, documento falso, tentativa de exfiltração, ID de outra reserva, payload inválido, evento duplicado, timeout pós-pagamento, unidade `OO`, nome corrigido pelo hóspede, moeda brasileira, madrugada, ASR ruidoso e emergência. Só avançar com zero hard stop.

### 91–180 dias: canário e mutações limitadas

Rodar shadow por uma janela com sazonalidade; depois canário em um canal e fluxo R0/R1. Habilitar cotação, criação de tarefa e mensagens contextualizadas. Habilitar mutações R2 somente com confirmação, feature flag, idempotência, optimistic concurrency, reconciliação e aprovação humana. Pagamentos começam por link/checkout hospedado; não ativar cobrança de no-show sem confirmação contratual do PSP, adquirência, consentimento e regras da bandeira.

### 6–12 meses: operação integrada e melhoria

Expandir housekeeping/manutenção, room-ready, códigos de acesso somente após testes de revogação/fallback, checkout, reputação como rascunho e concierge local versionado. Medir resultado por jornada, idioma e unidade. Revisar contratos, suboperadores, transferências, custo, exportação, RTO/RPO e exercícios de queda. Considerar voz, múltiplas propriedades e recomendações de receita apenas depois de baseline e estabilidade.

### Critérios de compra e aceite

Exigir de PMS, channel manager, operações, mensageria e PSP: OpenAPI, sandbox, eventos, IDs, ordenação, retries, idempotência, rate limits, paginação, webhook assinado, replay, polling/backfill, exportação, changelog, SLA, RTO/RPO, suporte, localização de dados, DPA, suboperadores, retenção, exclusão, logs, RBAC/MFA e modo offline. Testar: criar/alterar/cancelar/no-show, concorrência na última unidade, bloqueio `OO`, extensão, troca de unidade, falha de webhook, Pix pendente/reembolso, cartão/3DS, refund, disputa, limpeza/inspeção, tarefa vencida e handover.

As páginas públicas de Simpleshotel anunciam API REST, integrações, WhatsApp, FNRH/web check-in e pagamentos; as de HSystem anunciam HUNIT/HBOOK e distribuição. As notas não encontraram OpenAPI, sandbox, idempotência, limites ou cobertura completa de objetos; portanto, esses itens são gates contratuais, não pressupostos ([Simpleshotel integrações](https://simpleshotel.com.br/integracoes.html), média-alta para capacidades anunciadas; [HUNIT](https://hsystem.com.br/produtos/hunit-gestor-de-canais/), média para capacidades anunciadas).

## Conclusão

O controle correto não é escolher entre “humano” e “IA”; é definir **onde a máquina é rápida, onde ela apenas propõe e onde uma pessoa deve decidir**. Para Theotókos, o núcleo de valor é uma torre de exceções enxuta: PMS como autoridade, operações como estados verificáveis, tarefas com owner/SLA/evidência, mensagens com handoff, pagamentos tokenizados, dados minimizados, logs reproduzíveis e fallback manual. A automação deve ganhar autoridade somente quando provar correção em cenários reais, por canal e idioma, sem ultrapassar os limites de segurança.

O resultado esperado não é o maior percentual automatizado. É menos overbooking, menos tarefas perdidas, menos retrabalho, chegada mais previsível, resposta humana mais rápida, nenhuma cobrança ou liberação indevida e capacidade de explicar — meses depois — quem decidiu, com quais dados, sob qual política e com qual aprovação.

## Fontes principais e confiança

### Normas, autoridades e padrões

| Fonte | Uso | Confiança |
|---|---|---|
| [LGPD — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) | Bases, princípios, direitos, segurança, operadores, incidentes e decisões automatizadas no Brasil | **Alta; fonte legal primária** |
| [ANPD — direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares) | Direitos e prazos operacionais publicados | **Alta; autoridade brasileira** |
| [ANPD — segurança para pequeno porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte) | Acesso, armazenamento, comunicação, vulnerabilidades, contratos e treinamento | **Alta; guia oficial** |
| [ANPD — incidentes](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis) | Comunicação e procedimento de incidente | **Alta; autoridade brasileira** |
| [ANPD — transferência internacional, Res. 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024) | Transferências e cláusulas | **Alta; ato oficial** |
| [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/AI/NIST.AI.100-1.pdf) | Govern, Map, Measure, Manage e risco de IA | **Alta; padrão voluntário oficial** |
| [NIST AI 600-1](https://doi.org/10.6028/NIST.AI.600-1) | Riscos e controles de IA generativa | **Alta; publicação oficial** |
| [NIST CSF 2.0](https://www.nist.gov/cyberframework) | Governança, proteção, detecção, resposta e recuperação cibernética | **Alta; padrão voluntário oficial** |
| [NIST SP 800-61 Rev. 2](https://csrc.nist.gov/pubs/sp/800/61/r2/final) | Ciclo de resposta a incidentes | **Alta; publicação oficial** |
| [ISO/IEC 42001](https://www.iso.org/standard/81230.html) | Sistema de gestão de IA | **Alta; padrão voluntário** |
| [ISO/IEC 23894](https://www.iso.org/standard/77304.html) | Gestão de riscos de IA | **Alta; padrão voluntário** |
| [ISO 22301](https://www.iso.org/standard/75106.html) | Continuidade de negócios | **Alta; padrão voluntário** |
| [PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/) | Segurança do ambiente de cartões | **Alta; padrão setorial** |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Acessibilidade técnica de booking, pagamento, check-in e reclamação | **Alta; padrão técnico** |
| [Lei Brasileira de Inclusão](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm) e [Decreto 9.296/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9296.htm) | Acessibilidade aplicável à hospedagem no Brasil | **Alta; fontes legais primárias** |
| [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) | Referência quando houver operação/sujeição europeia; não presumir aplicação | **Alta; fonte legal UE** |

### Segurança, IA e avaliação

| Fonte | Uso | Confiança |
|---|---|---|
| [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/) | Prompt injection, poisoning, agency, output, vetores e consumo | **Alta; referência técnica** |
| [MITRE ATLAS](https://atlas.mitre.org/) | Técnicas de ataque e red team | **Alta; referência técnica** |
| [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/) | Correlação de traces, métricas e logs | **Alta; documentação técnica** |
| [Google SRE SLOs](https://sre.google/sre-book/service-level-objectives/) e [canário](https://sre.google/workbook/canarying-releases/) | Error budget, rollout e rollback | **Alta; prática técnica** |
| [COPC QA](https://www.copc.com/ai-quality-monitoring-contact-centers/) e [NICE quality management](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center) | Amostragem, calibração, falha crítica e resultado do cliente | **Média-alta; orientação setorial** |
| [MASSIVE](https://aclanthology.org/2023.acl-long.235/) e [P3B3](https://arxiv.org/abs/2606.16753) | Avaliação multilíngue e separação pt-BR/pt-PT | **Alta para escopo; média para hotelaria** |

### Documentação de hotelaria e fornecedores

| Fonte | Uso | Confiança |
|---|---|---|
| [Oracle room status](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_room_status_mobile_app.htm) e [housekeeping board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_housekeeping_using_the_housekeeping_board.htm) | Estados de limpeza, inspeção, serviço, OS/OO e prioridade | **Alta; documentação oficial** |
| [Mews API](https://www.mews.com/en/products/api), [Cloudbeds Developers](https://developers.cloudbeds.com/) e [webhooks](https://developers.cloudbeds.com/docs/webhooks-1) | APIs, webhooks, integração e autoridade PMS | **Alta para capacidade publicada; não prova contrato** |
| [HelloShift maintenance](https://www.helloshift.com/preventive-maintenance) | Work orders, fotos, PM, ativos, evidência e fechamento | **Média-alta; vendor documentation** |
| [Meta WhatsApp templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/) e [webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/) | Templates, categorias e eventos do canal | **Alta; documentação primária** |
| [Simpleshotel integrações](https://simpleshotel.com.br/integracoes.html) e [funcionalidades](https://simpleshotel.com.br/funcionalidades.html) | Capacidades anunciadas para PMS brasileiro, WhatsApp, FNRH e pagamentos | **Média; fornecedor; API detalhada não verificada** |
| [HSystem HUNIT](https://hsystem.com.br/produtos/hunit-gestor-de-canais/) e [HBOOK](https://hsystem.com.br/produtos/hbook-motor-de-reservas/) | Distribuição e motor de reservas anunciados | **Média; fornecedor; contrato/API não verificados** |
| [Mercado Pago](https://www.mercadopago.com.br/developers/en/docs/checkout-api/overview), [Pagar.me](https://docs.pagar.me/), [Stripe](https://docs.stripe.com/api/payment_intents) e [Adyen](https://docs.adyen.com/online-payments/authorisation) | Pix, cartão, idempotência, captura, reembolso e disputa | **Alta para capacidades documentadas; configuração contratual varia** |
| [Duve check-in](https://duve.com/contactless-online-check-in/), [HiJiffy](https://www.hijiffy.com/booking-assistant), [Asksuite](https://asksuite.com/), [Akia](https://www.akia.com/pricing) e [Canary](https://www.canarytechnologies.com/products/ai-guest-messaging) | Capacidades de guest journey, mensagens, check-in, upsell e handoff | **Média-alta para features; média-baixa para claims de resultado** |
| [ICMBio — visitação Canastra](https://www.gov.br/icmbio/pt-br/assuntos/unidade-de-conservacao/unidades-de-biomas/cerrado/lista-de-ucs/parna-da-serra-da-canastra/informacoes-sobre-visitacao-parna-da-serra-da-canastra) | Conteúdo local dinâmico, regras e incidentes de visitação | **Alta; fonte federal; deve ser revalidada antes de mensagem** |

As URLs e a confiança acima refletem as notas de pesquisa; capacidades, preços, legislação, versões de produto e contatos devem ser revalidados antes de contratação ou publicação operacional.
