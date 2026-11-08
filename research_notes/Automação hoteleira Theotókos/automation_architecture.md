# Operar 31 flats com automação controlada

**Data de corte das evidências: 8 de novembro de 2026.** Este relatório sintetiza as notas de pesquisa existentes para Theotókos Flats e transforma seus achados em uma arquitetura prática. Ele separa **Verificado** (documentado por fonte primária ou norma), **Provável** (inferência operacional bem apoiada, mas não confirmada para Theotókos) e **Requer confirmação** (capacidade, contrato ou dado que não deve ser assumido). Tudo que for decisão de desenho está marcado como **Proposto**.

## Decisão executiva: comprar o encanamento e construir o controle

**Recomendação central (Proposto):** manter Simpleshotel ou a combinação efetivamente contratada de PMS + channel manager como autoridade para reservas, disponibilidade, tarifas, ocupação, folio e status oficial da unidade; usar HSystem/HUNIT/HBOOK apenas no escopo comprovado; e construir uma camada fina de integração e exceções que una WhatsApp Business, telefone, balcão, site, motor de reservas, OTAs, pagamentos e tarefas operacionais. Essa camada não deve virar um segundo PMS. Deve normalizar eventos, aplicar políticas determinísticas, abrir tarefas, registrar auditoria, reconciliar divergências e dar à equipe uma fila única de exceções.

O mercado já demonstra automação madura para FAQ, venda direta, mensagens transacionais, pré-chegada, check-in web, upsell condicionado, roteamento de pedidos e tarefas de housekeeping. Não há evidência pública equivalente de um agente geral que possa, sem supervisão, alterar reserva, cobrar, emitir acesso físico, decidir reembolso, liberar uma unidade, acionar manutenção e publicar uma resposta sensível em todos os sistemas. Mews, Cloudbeds, Duve, Akia, Asksuite, HiJiffy, Canary e plataformas operacionais documentam fluxos estreitos e integrados, não autoridade irrestrita ([Mews](https://www.mews.com/en/products/api), consultado em 08/11/2026; [Cloudbeds webhooks](https://developers.cloudbeds.com/docs/webhooks-1), consultado em 08/11/2026; [Duve](https://duve.com/contactless-online-check-in/), consultado em 08/11/2026; [Akia Rambla](https://www.akia.com/case-studies/rambla-a-contactless-property-maintains-high-guest-services-with-ai-agents), consultado em 08/11/2026).

Para a escala assumida de **12 → 15 → 31 unidades**, a ordem correta é: (1) inventário, políticas, dados e fallback; (2) distribuição e comunicação confiáveis; (3) chegada e operação móvel; (4) receita incremental e reputação; (5) voz, recomendações e autonomia limitada. O investimento deve ser aprovado por redução observada de erro e tempo, não por percentuais de marketing de fornecedores. Cases como Rambla, Estrel, Staycity e HiJiffy são sinais de que fluxos digitais funcionam, mas seus resultados são vendor-reported e não benchmarks transferíveis ([hotelkit Estrel](https://hotelkit.net/customer-stories/germanys-largest-hotel/), consultado em 08/11/2026; [Staycity/Optii](https://hoteltechreport.com/success-stories/marketing/optii/staycity-aparthotels), consultado em 08/11/2026).

**Decisões que não devem esperar a compra:**

| Decisão | Padrão proposto |
|---|---|
| Fonte de verdade | PMS/channel manager para reserva, ARI, folio e disponibilidade; hub como cache, log e orquestrador |
| Canal primário | WhatsApp Business Platform oficial + site; telefone, balcão e OTA entram na mesma fila |
| Mutação financeira/física | Regra determinística, confirmação e/ou aprovação humana; nunca decisão livre do LLM |
| Operação | Tarefa por unidade/ativo, SLA, responsável, evidência, inspeção e handover |
| Disponibilidade | Estado por tipo e, quando necessário, por unidade física; manutenção altera sellability somente por regra autorizada |
| Segurança | Tokenização de pagamentos, menor privilégio, RBAC/MFA, logs append-only e fallback manual |
| IA | Informar automaticamente; propor e classificar; agir apenas dentro de allowlist e limites |
| Critério de sucesso | Baseline próprio por jornada, erro, resolução, esforço, receita líquida e incidentes |

## O que está confirmado sobre a stack brasileira — e o que não está

### Simpleshotel

**Verificado:** o Simpleshotel publica um PMS com mapa de reservas, reservas individuais/grupo/day-use, hóspede, acomodação, tarifa, política, comentários, extras, histórico, recebimentos, checkout, no-show, governança, manutenção, web check-in/FNRH, NPS e módulos fiscais. A página de integrações anuncia API REST para consultar disponibilidade, vender reservas e obter preços; lista HSystem e Bukly como gestores de canais e Booking.com, Expedia Group, Decolar, Airbnb, Google Hotel Ads e TripAdvisor como canais ou integrações relacionadas. Também lista WhatsApp Business API com templates aprovados, gatilhos, logs e estatísticas; Asaas para Pix/cartão, reembolso e estorno; OFX/Open Finance; Gov.BR; NFSe e NFCe ([Simpleshotel funcionalidades](https://simpleshotel.com.br/funcionalidades.html), consultado em 08/11/2026; [integrações](https://simpleshotel.com.br/integracoes.html), consultado em 08/11/2026).

**Verificado:** a página de preços informa planos Standard, Master e Premium, taxa de implantação, contrato inicial de 12 meses, suporte remoto em horário comercial e canal emergencial, com gestor de canais, motor de reservas e módulos adicionais cobrados conforme o pacote ([Simpleshotel preços](https://simpleshotel.com.br/precos.html), consultado em 08/11/2026).

**Requer confirmação:** não foi localizada documentação pública com URL base, endpoints, payloads, autenticação, OAuth, versionamento, sandbox, webhooks, idempotência, rate limits, paginação, SLA, retry, cobertura de hóspedes, pagamentos, check-in/out, manutenção, FNRH ou fiscalidade por API. “API REST”, “tempo real” e “0 overbookings” são capacidades ou linguagem comercial anunciada, não prova de contrato técnico. Antes de construir, obter OpenAPI/Swagger, exemplos, matriz de objetos/eventos, política de mudanças, exportação e ambiente de homologação.

### HSystem

**Verificado:** HUNIT é apresentado como gestor de canais para tarifas, disponibilidade, políticas, restrições e mínimos de noites, com Booking.com, Expedia, Decolar e outros canais; HBOOK é motor de reservas direto com promoções, cupons, extras, orçamento, cartão, Pix e depósito; HCORP conecta hotéis a operadoras e empresas. O fornecedor publica alegações de 750+ canais e 3.000+ hotéis para HUNIT, que devem ser tratadas como marketing não auditado ([HUNIT](https://hsystem.com.br/produtos/hunit-gestor-de-canais/), consultado em 08/11/2026; [HBOOK](https://hsystem.com.br/produtos/hbook-motor-de-reservas/), consultado em 08/11/2026; [HCORP](https://hsystem.com.br/produtos/hcorp-integracao-hotel-operadoras-e-agencias/), consultado em 08/11/2026).

**Requer confirmação:** as páginas públicas não definem se HSystem será PMS, channel manager, motor de reserva ou combinação contratada para Theotókos; não há OpenAPI, webhook, esquema de dados, semântica de conflitos, idempotência, latência garantida, sandbox, limites, SLA ou matriz de eventos. HSystem deve entrar na arquitetura somente no papel que o contrato e a prova técnica confirmarem.

### WhatsApp Business, telefone, balcão, site e OTAs

**Verificado:** fora da janela de atendimento do cliente, a Meta exige templates aprovados, classificados como utility, marketing ou authentication; o hotel fornece o texto e as versões por idioma, e a Meta não traduz o template ([Meta WhatsApp templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/), consultado em 08/11/2026). WhatsApp Cloud API documenta webhooks para mensagens e eventos de conta ([WhatsApp webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/), consultado em 08/11/2026).

**Proposto:** WhatsApp não deve ser o registro oficial. A mensagem é capturada em `Conversation`/`Message`, associada a reserva ou lead quando autenticada, e convertida em evento/tarefa. Telefone e balcão devem usar a mesma busca de reserva, política e fila; a pessoa que atende registra o resultado em vez de manter um histórico paralelo em grupo de WhatsApp. O site e o motor de reservas devem consultar disponibilidade real, não uma cópia editorial.

**Requer confirmação:** o canal OTA específico, método de conexão, escopo de reservas/modificações/cancelamentos, mensagens, conteúdo, pagamentos, comissão, limites e responsabilidade por overbooking devem ser confirmados por canal. A documentação de Booking.com demonstra APIs para conectividade, reservas e rates/availability para parceiros aprovados, mas isso não autoriza assumir acesso direto da Theotókos ([Booking.com Connectivity](https://developers.booking.com/connectivity/home), consultado em 08/11/2026; [Rates & Availability](https://connect.booking.com/portal/solutions/rates-and-availability-api), consultado em 08/11/2026).

### Capacidade, probabilidade e lacunas

| Item | Classificação | Consequência |
|---|---|---|
| PMS possui reservas, mapa, hóspedes e operações básicas | Verificado no material público do Simpleshotel | Pode ser base operacional, sujeito a contrato |
| HUNIT distribui ARI e regras | Verificado como posicionamento do fornecedor | Testar campos e latência por canal |
| Simpleshotel anuncia API REST | Verificado como anúncio | Não desenvolver sem documentação técnica |
| WhatsApp tem templates e webhooks | Verificado pela Meta e pelo Simpleshotel | Separar utility/marketing e registrar entrega |
| Integração bidirecional completa de cancelamento, hóspede, pagamento e manutenção | Requer confirmação | Não assumir por existir “integração” |
| Sincronização “em tempo real” evita overbooking | Probável apenas como atualização automática; não como garantia | Exigir SLA, teste de concorrência e reconciliação |
| Theotókos possui 12, 15 e 31 unidades | Assunção recebida nas notas | Confirmar inventário, tipos, unidades e datas |
| Theotókos usa hoje Simpleshotel, HSystem, Asaas, locks ou WhatsApp oficial | Não confirmado publicamente | Fazer inventário interno antes de escolher conector |

## Arquitetura proposta

### Diagrama lógico

```text
Visitante / hóspede / equipe
  WhatsApp ─ telefone ─ balcão ─ site ─ OTA
                    │
          Inbox omnicanal + autenticação
                    │
             Integration Hub
   canonical model | event log | inbox/outbox
   policy engine   | queues/retry | reconciliation
   audit           | metrics     | exception console
        │              │                │
 PMS/channel manager  PSP/fiscal       Ops/work
 (reservas, ARI,     (Asaas ou         (limpeza,
 folio, unidade)      provedor)         manutenção)
        │              │                │
  Booking engine   token/link         equipe móvel
  e OTAs           sem PAN/CVV        + gerente
```

O **PMS/channel manager** permanece autoridade para reservas, inventário vendável, tarifas e folio. O **PSP** permanece autoridade para autorização, captura, estorno e chargeback. O **hub** mantém um modelo canônico, envelopes de eventos, correlação, políticas e projeções de leitura. O sistema de tarefas mantém execução de limpeza/manutenção; se o PMS oferecer essa função, o contrato deve definir qual sistema vence cada campo. Uma réplica no hub é cache/auditoria, não um segundo calendário.

### Modelo de dados canônico

**Property** (`property_id`, timezone `America/Sao_Paulo`, moeda BRL, políticas, conectores, país, responsável). **UnitType** representa uma categoria vendável; **Unit** representa a unidade física, atributos de acessibilidade, cama, cozinha, vaga, lock e status. **RatePlan** contém ocupação, cancelamento, impostos/taxas, inclusões, moeda, canal, janela de venda, mínimo de noites, CTA/CTD e vigência. **InventorySnapshot** guarda data, tipo/unidade, allotment, out-of-service/out-of-order, restrições, origem, versão e timestamp.

**GuestProfile** separa identificação mínima, contatos, preferências não sensíveis, consentimentos, origem dos dados e referências externas. **Reservation** contém `reservation_id`, IDs por canal, versão, estado, origem, datas, ocupação, tarifa, hóspedes, unidade/tipo, valores, impostos, política, cancelamento, no-show e timestamps. **Stay/Folio** contém check-in/out, ocupantes, encargos, depósitos, pagamentos, saldo, recibos e referências de PSP; não contém PAN/CVV.

**Conversation/Message/Call** contém canal, thread, direção, idioma, remetente, status de entrega, template, consentimento, gravação/transcrição quando autorizada, vínculo com lead/reserva e handoff. **Task** contém classe (limpeza, inspeção, manutenção, pedido, incidente), unidade/ativo, prioridade, SLA de reconhecimento/restauração, responsável, estado, evidência, bloqueio, custo e confirmação. **IntegrationEvent** guarda provedor, `source_event_id`, tipo, versão, payload bruto imutável, assinatura verificada, recebido/processado, tentativas, erro e correlação. **AuditEntry** guarda ator, papel, ação, objeto, antes/depois ou hash, motivo, política, aprovação, timestamp e correlação.

**Invariantes propostas:** uma reserva externa repetida não cria segunda reserva; uma atualização de ARI declara data/categoria/versão e não soma cegamente; toda mutação destrutiva tem política e auditoria; qualquer recurso de outro tenant/unidade é negado antes da recuperação; estado de unidade vendável exige regra de prontidão; timeout após mutação vira `UNKNOWN` até reconciliação.

### Estado da unidade: não confundir “limpa” com “vendável”

Separar cinco dimensões:

1. `occupancy_state`: vacant, occupied, expected_arrival, checked_in, checked_out.
2. `cleaning_state`: dirty, cleaning, clean, pickup, inspected.
3. `availability_state`: sellable, out_of_service, out_of_order, blocked.
4. `guest_service_state`: do_not_disturb, make_up_room, turndown, request_open.
5. `priority`: imminent_arrival, occupied_impact, standard_turn, deep_clean, non_urgent.

Oracle documenta Dirty, Clean, Inspected, Pickup, Out of Service e Out of Order; Out of Order remove a unidade do inventário e afeta métricas como ocupação e RevPAR ([Oracle room-status mobile](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_room_status_mobile_app.htm), consultado em 08/11/2026; [housekeeping board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_housekeeping_using_the_housekeeping_board.htm), consultado em 08/11/2026). **Proposto:** somente `inspected` + `sellable` + condições de pagamento/identidade satisfeitas podem liberar acesso e chegada, salvo política explícita para check-in assistido.

## Jornadas completas e autoridade humana

### 1. Descoberta, consulta e reserva

O visitante chega por site, WhatsApp, telefone, balcão ou OTA. O sistema classifica intenção, coleta datas, ocupação, categoria, idioma e canal, e consulta o booking engine/PMS. A resposta deve mostrar valor, moeda, taxas relevantes, política de cancelamento, condições de pagamento, acessibilidade factual e link de reserva. Nunca confirmar vaga por memória do modelo. Se houver múltiplas intenções (“vou chegar tarde e preciso de berço”), separar os slots e confirmar o que é pedido.

**Automático:** FAQ aprovada, busca de disponibilidade, deep link, cotação, captura de lead e lembrete de abandono. **Com confirmação:** aplicar cupom, alterar tarifa, garantir exceção de política. **Humano obrigatório:** promessa fora da política, acessibilidade incerta, grupo, overbooking, ameaça, suspeita de fraude ou pagamento contestado.

### 2. Criação, alteração, cancelamento e no-show

Cada criação grava canal, ID externo, versão, política, valores e fonte de pagamento. Alteração identifica o objeto e recalcula tarifa, imposto, disponibilidade e penalidade. Cancelamento mostra escopo, política, valor a reter, valor a reembolsar e efeito no inventário antes de executar. No-show não deve ser inferido apenas por silêncio de WhatsApp; exige regra de horário e confirmação do PMS/equipe.

**Requer confirmação:** cobertura de eventos de alteração/cancelamento/no-show em Simpleshotel/HSystem. O hub deve suportar polling de janela recente, deduplicação e reconciliação diária mesmo que não haja webhook.

### 3. Pré-chegada

Idealmente 3–7 dias antes, ajustado à antecedência da reserva, enviar template utility com confirmação, endereço/link, estacionamento, previsão de chegada, contato, regras essenciais e portal web. O portal pode coletar horário/modo de chegada, dados mínimos de check-in, assinatura e pagamento por link seguro, desde que o fornecedor e o fluxo jurídico sejam validados. Upsells (early check-in, late checkout, upgrade, kit, café, transporte e experiências) somente aparecem se houver inventário/capacidade e preço calculado pelo sistema.

**Humano obrigatório:** pedido de acessibilidade não verificável, chegada fora de horário sem acesso comprovado, divergência de identidade, documento inválido, criança/pessoa vulnerável em situação incomum, suspeita de fraude ou falha de pagamento.

### 4. Check-in, identidade e acesso

O workflow recomendado é `pending → verified → checked_in`, com identidade mínima necessária, ocupantes, horário, unidade, pagamento/autorização e exceções. O envio de uma mensagem não prova que o hóspede pode entrar. Código/credencial, se houver, deve ser único por reserva, ter janela de validade, ser revogado no cancelamento/checkout e ter fallback físico. Sem fechadura compatível ou documentação de integração, usar instrução assistida e confirmação humana.

O fluxo deve oferecer dois caminhos equivalentes: portal sem aplicativo e telefone/balcão. A WCAG 2.2 exige conteúdo perceptível, operável, compreensível e robusto, incluindo alternativas de texto, teclado, contraste e mensagens de erro ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), 2023; consultado em 08/11/2026). No Brasil, a Lei Brasileira de Inclusão e o Decreto 9.296/2018 tornam acessibilidade uma obrigação de serviço e infraestrutura, não mero atributo de marketing ([Lei 13.146/2015](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm); [Decreto 9.296/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9296.htm)).

### 5. Estada e concierge

O hóspede deve poder selecionar pedidos estruturados: toalhas, limpeza, amenidade, Wi-Fi, ar-condicionado, água, ruído, estacionamento, item esquecido, extensão, manutenção, recomendação e emergência. Cada pedido vira tarefa com unidade, autenticidade suficiente, prioridade, responsável, tempo prometido e confirmação. Recomendações locais devem usar catálogo aprovado e datado, não memória generativa. Piumhi é posicionada pela Prefeitura e pelo Circuito Nascentes das Gerais e Canastra como base turística regional; horários, estradas, atrativos e parceiros devem ser revalidados antes de publicar ([Prefeitura de Piumhi](https://prefeiturapiumhi.mg.gov.br/piumhi-alcanca-marco-historico-e-passa-a-integrar-a-categoria-municipio-turistico-do-mapa-do-turismo-brasileiro/), 08/07/2026; [Rota Essência da Canastra](https://nascentesecanastra.com.br/rota-essencia-da-canastra/), consultado em 08/11/2026).

**P0 imediato:** incêndio, gás, inundação grave, emergência médica, violência, ameaça, pessoa presa, risco elétrico, invasão. **P1 em minutos:** sem acesso, overbooking, unidade sem condições, água/energia, cobrança contestada, lock falho. **P2 no SLA do turno:** manutenção, limpeza, amenidades, ruído não crítico. **P3 automatizável:** FAQ, localização, horários confirmados, regras públicas e catálogo curado.

### 6. Checkout e pós-estada

Enviar lembrete de horário, devolução de chave, consumo, saldo e late checkout apenas se a disponibilidade for consultada. Checkout operacional registra saída, folio e pendências; não deve bloquear fisicamente a saída por disputa não verificada. Depois do checkout, abrir limpeza, inspeção e manutenção; item esquecido entra em cadeia de custódia separada. Emitir documento fiscal conforme integração local validada. Pesquisa e pedido de review distinguem atendimento transacional de marketing; opt-in de reativação é separado.

### 7. Housekeeping e manutenção

O PMS gera tarefa de turnover, stayover ou inspeção; a equipe recebe por zona/turno, marca iniciar, bloqueado, precisa inspeção e concluído, e anexa evidência quando necessário. Um defeito encontrado na limpeza vira work order ligado à unidade e ao ativo, não uma mensagem solta. O circuito é: reportar → tornar seguro → triar → atribuir → diagnosticar → reservar peça → reparar → testar → verificar → fechar com causa e recorrência. HelloShift documenta work orders com foto, responsável, prazo e histórico; Oracle documenta estados de quarto distintos ([HelloShift preventive maintenance](https://www.helloshift.com/preventive-maintenance), consultado em 08/11/2026).

Manutenção crítica pode bloquear unidade (`out_of_order`) até inspeção autorizada. Lost-and-found deve registrar item, localização, descobridor, descrição neutra, foto somente se necessária, embalagem, armazenamento, handoffs, verificação do reclamante, envio/disposição e retenção.

### 8. Reviews e recuperação

Review não é apenas texto para gerar resposta. Classificar tema, unidade/estadia se autorizado, severidade, fato verificável e tarefa de causa-raiz. Rascunho automático pode tratar elogio e questão simples; notas baixas, segurança, discriminação, acessibilidade, ameaça legal, reembolso e acusação de fraude exigem aprovação. Uma resposta pública não deve inventar fatos nem prometer compensação. Medir tempo de resposta, resolução interna, reabertura e nota pós-recuperação; referências como MARA/ReviewPro/TrustYou demonstram agregação e análise, mas não causalidade de melhoria de nota ([MARA](https://www.mara-solutions.com/post/best-hotel-reputation-management-software-2026), consultado em 08/11/2026).

## Segurança, LGPD, pagamentos e risco de IA

### Dados e contratos

**Verificado:** a LGPD define finalidade, adequação, necessidade, transparência, segurança, prevenção, não discriminação e responsabilização; bases legais variam por finalidade. Titulares têm direitos de acesso, correção, eliminação/anonimização quando aplicável, informação sobre compartilhamento e revisão de decisões unicamente automatizadas. A ANPD orienta pequenos agentes sobre controle de acesso, armazenamento, comunicações, vulnerabilidades, contratos e treinamento ([LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm); [Guia ANPD para pequeno porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte), consultados em 08/11/2026). A Resolução ANPD nº 19/2024 trata transferências internacionais e a nº 15/2024 de incidentes; validar a versão vigente com jurídico/DPO ([ANPD transferências](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024); [incidentes](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)).

**Proposto:** manter ROPA por fluxo; mapear nome, telefone, reserva, documento, pagamento, lock, CCTV, mensagens, fotos, logs e preferências; separar hospedagem de marketing; registrar base/finalidade, operador, suboperadores, país, retenção e eliminação. Contratos devem exigir DPA, exportação, assistência a titulares/incidentes, suboperadores, segurança, uso para treinamento, portabilidade, eliminação ao término e SLA.

### Pagamentos

PCI DSS se aplica ao ambiente que armazena, processa ou transmite cartão. Usar checkout hospedado/tokenização, deixando no PMS somente token, últimos quatro dígitos, status e referência de conciliação; nunca PAN/CVV em WhatsApp, e-mail, planilha, prompt, log ou ticket ([PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/), consultado em 08/11/2026). Separar autorização, captura, estorno, chargeback, depósito e folio. Timeout após envio deve ficar `UNKNOWN`, consultar o PSP e não cobrar novamente cegamente.

O Simpleshotel anuncia Asaas para Pix/cartão, reembolso e estorno, mas isso não confirma autorização de cartão para no-show, captura posterior, parcelas, chargeback ou token portátil. Mercado Pago e Pagar.me documentam Pix, cartões, reembolsos, webhooks e idempotência; Stripe e Adyen documentam PaymentIntents/autorizações, 3-D Secure, tokens, disputas e APIs de reembolso, enquanto a elegibilidade e os termos brasileiros dependem da conta, adquirência e contrato ([Asaas via Simpleshotel](https://simpleshotel.com.br/integracoes.html), consultado em 08/11/2026; [Mercado Pago](https://www.mercadopago.com.br/developers/en/docs/checkout-api/overview); [Pagar.me](https://docs.pagar.me/); [Stripe Pix e PaymentIntents](https://docs.stripe.com/payments/pix); [Adyen Pix](https://docs.adyen.com/payment-methods/pix), consultados em 08/11/2026). **Requer confirmação:** nenhum desses materiais públicos prova que a configuração contratada suporta caução hoteleira, pré-autorização válida até o checkout ou cobrança de no-show nas regras da Theotókos. Pix deve ser tratado como pagamento/depósito confirmado por webhook e conciliação, não como reserva paga porque o navegador voltou à página.

### IA e ferramentas

O modelo não é autoridade. A base de conhecimento deve ser versionada, aprovada, ter URL/origem, hash, idioma, unidade, vigência, aprovador e estado; conteúdo de hóspede, review, PDF ou página externa é dado não confiável, não instrução. NIST identifica confabulação, proveniência, privacidade e segurança como riscos GenAI; OWASP destaca prompt injection, poisoning, improper output handling, excessive agency e unbounded consumption ([NIST AI 600-1](https://doi.org/10.6028/NIST.AI.600-1); [OWASP Top 10 LLM 2025](https://genai.owasp.org/llm-top-10/), consultados em 08/11/2026).

**Allowlist proposta:** `get_reservation`, `get_availability`, `get_policy`, `create_service_request`, `create_maintenance_task`, `request_payment_link`, `quote_change`, `escalate_human`, `draft_review_reply`, `request_refund_approval`, `generate_access_token` somente se política e integração permitirem. Não expor SQL, HTTP arbitrário, envio genérico, alteração direta de preço ou credencial ampla.

Structured Outputs e function calling validam formato, não autorização. O backend deve verificar sessão, vínculo hóspede–reserva, papel, unidade, estado, política, versão/ETag, idempotência e limite monetário antes de chamar PMS, PSP, lock ou mensageria ([OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [Function calling](https://developers.openai.com/api/docs/guides/function-calling), consultados em 08/11/2026).

### Critérios de confiança e takeover

**Proposto — quatro dimensões, não um único score:** `retrieval_confidence`, `policy_confidence`, `identity_confidence`, `action_risk`. Um score alto de linguagem não libera ação de alto risco.

| Situação | Automação |
|---|---|
| FAQ em KB aprovada, vigente, uma resposta, sem PII/ação | Responder automaticamente se evidência ≥0,90 e sem conflito |
| FAQ de menor impacto com duas fontes concordantes | Responder se evidência ≥0,85 e citar fonte; amostrar para QA |
| Cotação/disponibilidade | Consultar sistema ao vivo; não usar score sem estado transacional |
| Criar tarefa de limpeza/manutenção P2 | Automático se reserva/unidade autenticada e campos válidos |
| Alterar reserva, cancelar, refund, desconto, cobrança | `PENDING_CONFIRMATION` e/ou humano; nunca livre |
| Emitir acesso físico | Aprovação por estado de pagamento/identidade e lock; humano em exceção |
| Emergência, segurança, acessibilidade, saúde, discriminação, ameaça | Handoff imediato; IA só coleta localização e transmite instrução aprovada |
| Conflito, fonte vencida, ausência de citação, baixa confiança | Abster-se, informar limite e escalar |

Os limiares são **critérios de release propostos**, não benchmark externo. A unidade de segurança é o resultado: se containment sobe e aumentam repetição, CES, falha factual ou escalada tardia, a mudança falha. Medir containment como resolução confirmada, não como conversa encerrada; TSIA, ICMI, COPC e NICE recomendam combinar resolução, esforço, satisfação, escalada e QA ([TSIA](https://www.tsia.com/blog/top-support-services-questions-answered); [ICMI](https://www.icmi.com/resources/2025/what-contact-centers-are-measuring); [NICE](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center), consultados em 08/11/2026).

Para pt-BR, não usar “suporta português” como evidência de qualidade. MASSIVE separa pt-BR e pt-PT, CLINC/OOS mede rejeição fora de escopo, Banking77 ajuda a desenhar intents próximas e corpora de reviews hoteleiros brasileiros ajudam a testar aspectos; nenhum deles é um benchmark completo de reservas, emergência, pagamento e manutenção em WhatsApp. **Proposto:** gold set local de pelo menos 200 conversas, com acentos, abreviações, nomes, CEP, datas, R$, Pix, code-switching, áudio transcrito, reclamações, acessibilidade e P0/P1. Reportar macro-F1/recall por classe, slot exact match, ECE/Brier, selective risk-coverage e falso aceite OOS, separados por canal e locale ([MASSIVE](https://aclanthology.org/2023.acl-long.235/); [CLINC/OOS](https://aclanthology.org/D19-1131/); [Banking77](https://arxiv.org/abs/2003.04807); [corpus de reviews de hotéis brasileiros](https://data.mendeley.com/datasets/2w3kvrg97m/1), consultados em 08/11/2026).

## Eventos, auditoria e observabilidade

### Taxonomia de eventos

Todos os eventos devem carregar `event_id`, `event_type`, `event_version`, `occurred_at`, `received_at`, `source`, `property_id`, `correlation_id`, `causation_id`, `actor_type`, `actor_id` quando aplicável, `reservation_id`/`unit_id`/`task_id`, payload redigido, hash, versão da política e resultado.

| Domínio | Eventos mínimos |
|---|---|
| Lead/reserva | `lead.created`, `quote.requested`, `quote.returned`, `reservation.created`, `reservation.modified`, `reservation.cancelled`, `reservation.no_show_marked`, `reservation.duplicate_detected` |
| ARI | `inventory.published`, `rate.published`, `restriction.changed`, `channel.acknowledged`, `parity.diverged`, `overbooking.detected`, `reconciliation.failed` |
| Hóspede | `guest.created`, `guest.updated`, `consent.granted`, `consent.revoked`, `privacy.requested`, `privacy.fulfilled` |
| Pagamento | `payment.link_requested`, `payment.authorized`, `payment.captured`, `payment.failed`, `refund.requested`, `refund.approved`, `refund.completed`, `chargeback.received`, `payment.unknown` |
| Mensagem | `conversation.started`, `message.received`, `message.drafted`, `message.sent`, `message.delivered`, `message.failed`, `template.rejected`, `handoff.requested`, `handoff.accepted` |
| Chegada | `prearrival.sent`, `checkin.started`, `identity.verified`, `checkin.completed`, `access.issued`, `access.revoked`, `access.failed`, `arrival.exception` |
| Estada | `guest_request.created`, `service.started`, `service.completed`, `extension.requested`, `late_checkout.requested`, `incident.opened`, `incident.escalated`, `incident.closed` |
| Unidade | `room.dirty`, `room.cleaning`, `room.clean`, `room.inspected`, `room.out_of_service`, `room.out_of_order`, `room.released`, `room.blocked` |
| Trabalho | `task.created`, `task.assigned`, `task.started`, `task.blocked`, `task.overdue`, `task.completed`, `task.reopened`, `task.verified`, `maintenance.recurring_due` |
| IA/governança | `kb.published`, `kb.superseded`, `kb.stale`, `retrieval.abstained`, `tool.proposed`, `tool.confirmed`, `tool.denied`, `policy.conflict`, `model.changed`, `kill_switch.enabled` |

### Auditoria mínima

O log é append-only, com retenção por finalidade, acesso restrito e exportação. Registrar prompt hash, versão do modelo, versão do prompt, snapshot da KB, trechos recuperados, ferramenta, argumentos redigidos, decisão da política, confirmação, resultado externo, latência, erro, ator e correlação. Não guardar documento completo, cartão, tokens ou conteúdo sensível sem necessidade.

Para eventos externos, usar **webhook-first, polling-assisted**: validar assinatura; persistir envelope antes de responder 2xx; processar assíncrono; buscar recurso atual quando o evento for parcial/fora de ordem; aplicar cursor e janela sobreposta; reconciliar reservas, cancelamentos, modificações, pagamentos, ARI e tarefas. Repetir somente erros transitórios e apenas em operações idempotentes. Google Cloud documenta backoff/jitter e Pub/Sub dead-letter; OpenTelemetry fornece convenções de mensageria ([Cloud retry strategy](https://cloud.google.com/storage/docs/retry-strategy); [Pub/Sub retry](https://cloud.google.com/pubsub/docs/retry); [OpenTelemetry messaging](https://opentelemetry.io/docs/specs/semconv/messaging/), consultados em 08/11/2026).

### Painel operacional

Monitorar por canal, jornada, idioma, unidade, fornecedor e versão de política:

- atraso webhook → processamento, polling lag, eventos duplicados/fora de ordem;
- erro por endpoint/status, 429, circuit breaker, dead-letter e replay;
- divergência de reserva/ARI e idade da exceção;
- overbooking detectado/evitado, alteração manual e recuperação;
- mensagens entregues/falhadas, primeira resposta, handoff, reabertura e containment verificado;
- check-in digital concluído, falha de identidade, acesso emitido/revogado/falho;
- turnover p50/p90, unidades prontas no horário, falha de inspeção, retrabalho em 24h;
- chamados reconhecidos/restaurados no SLA, reincidência, PM no prazo, unidades fora de serviço;
- pagamentos recusados, `UNKNOWN`, conciliação PMS–PSP, estornos e chargebacks;
- incidentes LGPD, acesso privilegiado, exportações, exclusões e solicitações de titulares;
- custo por reserva, mensagem, chamada, integração e hora realmente liberada.

**SLOs iniciais propostos:** 100% de eventos críticos duráveis antes de ack; zero duplicidade de reserva/cobrança/acesso por mesma idempotency key; zero vazamento cross-tenant; stale source use = 0 para mutações; p95 de recuperação interna ≤500 ms; reconciliação diária concluída; P0 encaminhado imediatamente; qualquer mudança que viole um bloqueador desativa o fluxo via kill switch. Medir disponibilidade, não prometer “tempo real” sem SLA.

## KPIs e método de decisão

O dicionário deve definir fórmula, denominador, janela, exclusões, fonte, canal, versão do bot/KB e responsável. **Containment** é contato resolvido sem humano, confirmado pelo hóspede ou pela ausência de repetição em janela definida; “sessão encerrada” não é resolução. **FCR**, repeat contact, CES, CSAT e tempo até humano devem aparecer juntos.

| Área | KPI |
|---|---|
| Receita/distribuição | conversão lead→reserva; reserva direta; antecedência; cancelamento; no-show; comissão; receita líquida; ocupação; ADR; RevPAR; paridade; pickup 7/14/30 dias |
| Comunicação | primeira resposta p50/p90; entrega/falha; containment verificado; fallback; repeat contact; FCR; handoff com contexto; abandono |
| Chegada | pré-check-in concluído; falha de identidade; chegada fora do horário; acesso bem-sucedido; falha de lock; tempo até humano |
| Operação | room-ready no horário; turnover p50/p90; retrabalho 24h; inspeção; tarefa sem responsável; backlog e handover |
| Manutenção | reconhecimento, chegada e restauração; reincidência 30 dias; PM no prazo; custo; unidades OO; incidentes críticos |
| Financeiro | pagamento recusado; conciliação; estorno pendente; chargeback; divergência PMS–PSP; upsell líquido após custo |
| Experiência | CSAT por jornada; CES por tarefa; reclamações/100 estadias; nota e temas; recuperação confirmada |
| IA/risco | factualidade; unsupported claim; abstenção; conflito; tool denial; ação sem autorização; PII leakage; calibração QA |

Não estabelecer metas copiadas de HiJiffy, Akia, Infor, Cloudbeds ou outros cases. Fazer duas semanas de baseline e quatro de piloto; comparar a mesma unidade, canal, mix e demanda quando possível. Containment só pode ser meta se resolução, esforço, incidentes e escalada permanecerem no piso.

## Contratação e testes de aceitação

Solicitar a Simpleshotel e HSystem, por escrito:

1. papel exato de cada produto e fonte de verdade;
2. catálogo de endpoints/objetos/eventos e IDs externos;
3. webhooks, polling, assinatura, retry, ordem, replay, rate limit, paginação e idempotência;
4. cobertura de criar/alterar/cancelar/no-show, ocupação, tipo de unidade, tarifa, política, extras, pagamentos, FNRH, fiscal, housekeeping e manutenção;
5. comportamento de bloqueio, out-of-order, troca de unidade e retorno ao inventário;
6. sandbox, dados sintéticos, changelog, versionamento e janela de mudança;
7. exportação completa, retenção, eliminação, DPA, suboperadores e países;
8. SLA, RTO/RPO, suporte, status page, contingência e responsabilidade em overbooking;
9. custo mínimo por unidade/usuário/mensagem/reserva/API, implantação, treinamento, migração, reajuste e rescisão;
10. procedimento de operação manual durante queda do PMS, internet, Meta, PSP, lock ou hub.

Testar cinco cenários ponta a ponta: (a) reserva direta e OTA; (b) alteração de datas/ocupação; (c) cancelamento com política e reembolso; (d) unidade bloqueada por manutenção; (e) duplicidade/atraso/timeout de webhook. Adicionar concorrência de duas reservas, 429, indisponibilidade de 30 minutos, replay manual, evento fora de ordem, pagamento `UNKNOWN`, acesso revogado e exclusão de um hóspede. A aprovação exige estado final observável no PMS, canal, mensageria, tarefa e financeiro.

## Roadmap 12 → 15 → 31 unidades

### Fase 0 — fundação e descoberta (2–4 semanas)

Confirmar inventário físico, tipos, atributos, equipe, horários, política, locks, internet, estacionamento, pets, acessibilidade, café/cozinha/lavanderia, fornecedores, canais, pagamentos e fiscalidade. Escolher fonte de verdade. Criar modelo canônico, cofre de segredos, RBAC/MFA, ROPA, DPA checklist, KB aprovada, inbox, auditoria, métricas e console de exceções. Começar com leitura/paridade e respostas FAQ; não liberar mutações destrutivas.

### Fase 1 — 12 unidades: comunicação e pré-venda

Ativar site + WhatsApp oficial, templates utility, busca de disponibilidade, cotação, link de reserva, confirmação, alteração e cancelamento assistidos. Telefone e balcão usam a mesma ficha. Medir baseline e 30 dias de operação. Criar catálogo local versionado e playbooks P0/P1. Housekeeping pode começar com checklist móvel simples, sem tentar automatizar cada regra.

**Gate:** nenhuma duplicidade; reservas e cancelamentos reconciliados; handoff com contexto; zero cartão em logs; templates aprovados; equipe consegue operar manualmente.

### Fase 2 — 15 unidades: chegada e operação controlada

Adicionar portal web de pré-chegada, horário de chegada, pagamento por link/token, FNRH/check-in apenas após validação contratual/regulatória, tarefas de turnover, inspeção, manutenção e handover. Habilitar mutações selecionadas por feature flag e limites. Se houver lock compatível, testar emissão/revogação; manter fallback físico.

**Gate:** acesso não é emitido sem condições; unidade não fica vendável com defeito bloqueador; p90 de handoff e room-ready dentro do SLA local; reconciliação automática e replay testados.

### Fase 3 — 31 unidades: torre de controle e receita

Separar zonas/turnos, tarefas por prioridade, PM por ativo, inventário de peças/enxoval, lost-and-found, inspeção por risco, SLA de manutenção e fila de exceções. Adicionar paridade de canais, calendário de eventos de Piumhi/Canastra, revenue rules com aprovação e upsell condicionado. Reputação abre tarefas de causa-raiz. O coordenador recebe apenas atrasos, bloqueios, P0/P1, divergências e casos repetidos.

**Gate:** quatro semanas sem perda de tarefa crítica; reconciliação diária; custos e horas liberadas mensurados; cada integração tem dono e fallback; operação não depende de um único operador ou grupo de WhatsApp.

### Fase 4 — somente após baseline: voz e agentes limitados

Avaliar voz (Goodcall, Canary, PolyAI ou telefonia genérica) somente com volume de chamadas suficiente e transcrições pt-BR. Avaliar sentimento, tradução, recomendação e revenue assistido como classificação/proposta. Liberar autonomia apenas para ações de baixo risco com score calibrado, auditoria e kill switch. Não usar agente para emergência, acessibilidade incerta, pagamento, reembolso, cancelamento, desconto, identidade ou acesso sem regra e humano.

## Riscos que devem permanecer visíveis

- **LGPD e transferência internacional:** mapear operadores, países, suboperadores, retenção, direitos e incidentes; não confundir selo comercial com conformidade.
- **Pagamentos:** tokenizar e manter PSP como autoridade; divergência, chargeback e timeout precisam de reconciliação humana.
- **Overbooking e tarifas:** integração listada não prova atomicidade; usar uma autoridade, paridade e reconciliação, com stop-sell manual.
- **Identidade e acesso:** documento mínimo, código expirável, revogação, fallback físico e revisão humana em exceções.
- **Acessibilidade:** dados objetivos de largura, degraus, elevador, banheiro, alarmes e rota; nunca prometer “acessível” por inferência.
- **Hallucinated recommendations:** catálogo com fonte, validade, proprietário e última verificação; se vencido, abster-se.
- **Prompt injection/poisoning:** conteúdo externo em quarentena; autorização fora do modelo; ferramentas allowlisted; DLP.
- **Escalada tardia:** pedido explícito de humano, risco físico, cobrança, acesso, discriminação, saúde, ameaça e falha repetida interrompem automação.
- **Dependência e lock-in:** exportação, IDs externos, modelo canônico, cláusulas de saída, logs e operação manual desde o primeiro dia.
- **Adoção:** app lento, conectividade ruim, idioma da equipe e excesso de campos fazem a equipe voltar ao papel/WhatsApp; testar com trabalho real.
- **Métrica enganosa:** conter conversas ou limpar fila não significa resolver; acompanhar repeat contact, esforço, incidentes e resultado.

## Conclusão

Theotókos deve tratar automação como **controle de estados e exceções**, não como chatbot. A escolha mais segura é um PMS/channel manager brasileiro documentado e testável, com WhatsApp oficial, motor de reservas e PSP adequados, sobre o qual uma camada pequena implemente modelo canônico, eventos, reconciliação, tarefas, auditoria e handoff. Simpleshotel oferece a superfície pública mais concreta para operação brasileira, FNRH, fiscalidade, WhatsApp e planos; HSystem pode ser forte em distribuição e vendas, mas a API, o papel do produto e a semântica operacional precisam de confirmação contratual.

O desenho alcança 31 unidades sem perder controle se cada reserva, mensagem, pagamento, acesso, unidade, tarefa e decisão tiver estado, dono, prazo, evidência e fallback. O produto de IA deve ser medido por respostas corretas, resolução confirmada, menor esforço e ausência de efeitos não autorizados. Qualquer fornecedor que não demonstre esses estados em sandbox, exportação e reconciliação deve permanecer em avaliação, independentemente do número de canais, integrações ou percentual de automação anunciado.
