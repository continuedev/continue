# Arquitetura e critérios para automação hoteleira

**Escopo e data:** pesquisa vendor-neutral para um apart-hotel boutique pequeno no Brasil, atualizada em 2026-11-08.  
**Convenção:** fatos são acompanhados de fonte; **Recomendação** e **Inferência** são decisões propostas, não afirmações sobre um fornecedor.

## 1. Princípio de arquitetura

### Fatos

- APIs abertas de PMS podem abranger reservas, hóspedes, quartos, tarifas, disponibilidade, inventário, pagamentos e operações; Mews descreve Open API, webhooks, Connector API, Channel Manager API e Booking Engine API ([Mews API](https://www.mews.com/en/products/api)).
- Cloudbeds documenta API REST/GraphQL e webhooks para eventos como criação de reserva e atualização de hóspede ([Cloudbeds Developers](https://developers.cloudbeds.com/), [Cloudbeds Webhooks](https://developers.cloudbeds.com/docs/webhooks-1)).
- A SiteMinder separa APIs para PMS/RMS, distribuição de canais, reservas, ARI (availability, rates, inventory) e booking direto ([SiteMinder APIs](https://developer.siteminder.com/get-started/siteminder-apis), [SiteConnect](https://developer.siteminder.com/siteconnect-api)).
- A Booking.com expõe APIs de reservas e de tarifas/disponibilidade para parceiros aprovados; o portal também descreve um serviço de notificações de conectividade ([Booking.com Connectivity](https://developers.booking.com/connectivity/home), [Rates & Availability](https://connect.booking.com/portal/solutions/rates-and-availability-api), [Reservations](https://connect.booking.com/portal/solutions/reservations-api)).

### Recomendação

Adotar um **núcleo de integração próprio, pequeno e orientado a eventos**, mas manter o PMS (ou PMS+channel manager escolhido) como **sistema de registro operacional**. O núcleo deve traduzir APIs externas para um modelo canônico, aplicar políticas de segurança/repetição/reconciliação e expor automações internas; não deve duplicar calendário, reservas ou inventário como fonte concorrente.

```text
OTAs / booking direto / telefone / walk-in
                 │
        PMS + channel manager
        (fonte operacional)
                 │ APIs, webhooks, polling
        ┌────────▼────────┐
        │ Integration Hub │
        │ canonical model │
        │ event log       │
        │ queues/retries  │
        │ reconciliation  │
        └───┬─────────┬───┘
            │         │
      staff console  automations
      / audit        (mensagens, tarefas,
                      pagamentos, locks)
```

### Inferência

Para uma propriedade pequena, o risco dominante não é throughput; é **divergência de estado** (overbooking, tarifa errada, check-in sem pagamento, tarefa de limpeza perdida). Por isso, consistência operacional, rastreabilidade e recuperação devem pesar mais que um grande número de conectores.

## 2. Modelo canônico mínimo

### Fatos

- APIs de PMS e distribuição tratam reservas e ARI como objetos distintos: reservas representam a transação/estadia; ARI representa disponibilidade, tarifas e restrições ([SiteMinder APIs](https://developer.siteminder.com/get-started/siteminder-apis), [Booking.com Rates & Availability](https://connect.booking.com/portal/solutions/rates-and-availability-api)).
- APIs de PMS também incluem perfis de hóspede, pagamentos e operações ([Mews API](https://www.mews.com/en/products/api), [Cloudbeds Developers](https://developers.cloudbeds.com/)).

### Recomendação: entidades e invariantes

1. **Property**: propriedade, fuso `America/Sao_Paulo`, moeda BRL, políticas e conectores.
2. **UnitType**: categoria vendável (ex.: studio, 1 quarto).
3. **Unit**: unidade física, número interno e status.
4. **RatePlan**: plano, ocupação, cancelamento, impostos/taxas, canal e vigência.
5. **InventorySnapshot**: data, unit type, allotment, out-of-order, restrições (CTA/CTD/min-stay), origem e versão.
6. **GuestProfile**: identidade, contatos, preferências, consentimentos, origem dos dados e referências externas; separar PII de dados operacionais.
7. **Reservation**: IDs externos por sistema, estado, timestamps, canal, rate plan, hóspedes, unidades, valores, impostos, pagamentos, cancelamento/no-show e versão.
8. **Stay/Folio**: check-in/out, ocupantes, encargos, pagamentos, depósitos, saldo e recibos.
9. **Task**: limpeza, inspeção, manutenção, prioridade, unidade, SLA, responsável, evidência e estado.
10. **Conversation/Message/Call**: canal, thread, mensagem, status de entrega, consentimento e vínculo com reserva.
11. **IntegrationEvent**: `event_id`, `source`, `source_event_id`, tipo, payload imutável, versão, recebido/processado, tentativas, erro e correlação.
12. **AuditEntry**: ator, ação, objeto, antes/depois (ou hash), motivo, timestamp e correlação.

### Invariantes recomendadas

- Uma reserva externa pode ser processada várias vezes sem criar segunda reserva.
- Um update de inventário deve declarar a data, categoria e versão/origem; nunca “somar” cegamente um valor recebido.
- Estado local é derivado do PMS para reservas/inventário; a automação pode propor ou solicitar mutações, mas registra resultado externo.
- Toda mutação destrutiva ou de alto impacto (cancelamento, no-show, refund, mudança de tarifa/inventário, abertura de quarto) exige política explícita e trilha de auditoria.

## 3. Fonte de verdade, paridade e ownership

### Fatos

- Booking.com define conectividade de parceiro para sincronizar disponibilidade, tarifas e reservas; a documentação de implementação é voltada a parceiros/canal managers aprovados ([Booking.com Connectivity](https://developers.booking.com/connectivity/home)).
- SiteMinder descreve sincronização bidirecional entre canais e PMS/RMS por APIs distintas ([SiteConnect](https://developer.siteminder.com/siteconnect-api)).
- Cloudbeds documenta webhooks para mudanças de reserva e hóspede ([Cloudbeds Webhooks](https://developers.cloudbeds.com/docs/webhooks-1)).

### Recomendação

Usar uma matriz formal de ownership:

| Domínio | Fonte autoritativa recomendada | Ações do hub |
|---|---|---|
| Reserva, cancelamento, no-show | PMS/channel manager | Normalizar, distribuir eventos, reconciliar |
| Disponibilidade/tarifa/restrições | PMS/RMS/channel manager | Validar paridade, publicar mudanças aprovadas |
| Perfil operacional | PMS, com cópia mínima no hub | Deduplicar, consentimento, sincronizar campos permitidos |
| Folio/pagamento/fiscal | PMS + PSP/fiscal local | Conciliar, nunca inferir liquidação por mensagem |
| Limpeza/manutenção | PMS ou task system | Criar/atualizar tarefas, medir SLA |
| Mensagens | Provedor de mensagens | Orquestrar templates, consentimento, status |
| Automação | Hub | Decidir, mas sempre com referência à reserva/estadia |

Implementar **parity checks** por canal e data: preço público, moeda, ocupação, disponibilidade, restrições, impostos e conteúdo essencial. Alertar divergência; não corrigir automaticamente tarifa/inventário sem regra de precedência e janela de segurança.

### Inferência

Mesmo que o hub mantenha uma réplica local para leitura rápida, ela é **cache/audit log**, não um segundo PMS. Em conflito, a resolução padrão deve ser “PMS vence” para reserva e inventário, salvo exceção documentada.

## 4. Eventos, webhooks e polling

### Fatos

- Cloudbeds oferece assinatura de webhooks para eventos de reserva e hóspedes ([Cloudbeds Webhooks](https://developers.cloudbeds.com/docs/webhooks-1)).
- Mews descreve webhooks para manter sistemas externos sincronizados com mudanças em tempo real ([Mews API](https://www.mews.com/en/products/api)).
- Booking.com oferece notificações de conectividade para atualizações de reserva ([Booking.com Connectivity](https://developers.booking.com/connectivity/home)).
- A SiteMinder documenta APIs de conectividade para ARI e reservas, inclusive fluxos bidirecionais ([SiteMinder APIs](https://developer.siteminder.com/get-started/siteminder-apis)).

### Recomendação

Usar **webhook-first, polling-assisted**:

1. Receber webhook rapidamente, validar assinatura/autenticação, persistir envelope bruto e responder 2xx somente após durabilidade mínima.
2. Enfileirar processamento assíncrono; não executar automações lentas no request do webhook.
3. Buscar o recurso atual no provedor quando o evento for apenas “changed”, quando a ordem não for garantida ou quando houver risco de payload parcial.
4. Fazer polling periódico de reservas recentes, cancelamentos, modificações e janelas futuras de inventário.
5. Executar reconciliação completa em horários de baixa demanda e após incidentes.
6. Manter cursor/watermark por conector e janela sobreposta para tolerar atraso de relógio.

### Gaps a validar em due diligence

Os materiais públicos consultados não garantem uniformemente ordem, entrega única, retenção ou política de retry de cada webhook. Exigir do fornecedor: assinatura, timestamp/nonce, identificador único, replay protection, ordem/versão, retry schedule, timeout, rate limit, paginação, janela de consulta e procedimento de replay.

## 5. Idempotência, retries e reconciliação

### Fatos

- A documentação do Google Cloud recomenda retries com exponential backoff e jitter e relaciona retries seguros a operações idempotentes ([Cloud Storage retry strategy](https://cloud.google.com/storage/docs/retry-strategy)).
- Pub/Sub documenta políticas de retry, backoff e dead-letter topics ([Pub/Sub retry policy](https://cloud.google.com/pubsub/docs/retry)).
- OpenTelemetry define convenções semânticas para operações de messaging, permitindo correlação consistente de envio, recebimento, processamento e falhas ([OpenTelemetry messaging](https://opentelemetry.io/docs/specs/semconv/messaging/)).
- Stripe, Twilio e WhatsApp documentam webhooks como mecanismo de eventos de pagamento/mensagem ([Stripe webhooks](https://stripe.com/docs/webhooks), [Twilio webhooks](https://www.twilio.com/docs/usage/webhooks), [WhatsApp Cloud API webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/)).

### Recomendação operacional

- Chave de deduplicação: `(provider, property, source_event_id)`; fallback determinístico para operações sem event ID.
- Para comandos mutáveis, usar idempotency key própria, persistida com request, resposta, status e hash dos parâmetros.
- Retry somente em timeout, conexão, 408, 429 e 5xx conforme contrato; não repetir erro de validação/autorização sem intervenção.
- Exponential backoff com jitter, limite de tentativas, circuit breaker e fila de dead-letter.
- Após falha ambígua (timeout depois de enviar), consultar o recurso antes de repetir.
- Manter “outbox” transacional para publicar evento depois de persistir mudança local; usar inbox para deduplicar eventos recebidos.
- Reconciliação compara totais e registros por janela: novas, modificadas, canceladas, no-show, pagamentos, inventário e tarefas. Gerar exceção operacional, não sobrescrever silenciosamente.

### Critérios de aceitação

O fornecedor deve demonstrar em sandbox: evento duplicado, evento fora de ordem, webhook atrasado, timeout após mutação, 429, indisponibilidade de 30 minutos, replay manual e reconciliação sem duplicar reservas.

## 6. Jornadas operacionais

### Pré-estadia

**Recomendação:** confirmar reserva, detectar duplicidade, enviar mensagem transacional em português, coletar dados permitidos, instruções de chegada e pagamento/depósito. O envio deve ser rastreável à reserva e ter opt-out/consentimento quando for marketing.

### Check-in

**Recomendação:** tratar check-in como workflow com estados `pending → verified → checked_in`, contendo identidade mínima necessária, horário, unidade, ocupantes, pagamento/autorização e exceções. Nunca liberar acesso apenas porque uma mensagem foi enviada; exigir confirmação do PMS/controle de acesso.

### Durante a estadia

**Recomendação:** pedidos viram tickets/tasks com prioridade, SLA, unidade, fotos/notas e escalonamento humano. Mensagens automáticas podem classificar/encaminhar, mas não devem prometer reembolso, alterar reserva ou decidir incidente sensível sem regra/aprovação.

### Check-out e pós-estadia

**Recomendação:** confirmar folio/saldo, check-out no PMS, liberar unidade para limpeza, emitir/encaminhar documento fiscal conforme integração local, registrar itens esquecidos e enviar pesquisa. A ordem deve evitar marcar quarto limpo antes de check-out efetivo.

### Housekeeping e manutenção

**Recomendação:** separar `cleaning`, `inspection`, `out_of_order`, `repair` e `preventive_maintenance`; cada tarefa deve ter SLA, responsável e evidência. Mudança de `ready` para venda deve depender do estado operacional confirmado, não apenas do fim do timer.

### Telefonia e mensagens

### Fatos

- Twilio documenta webhooks para chamadas e mensagens ([Twilio webhooks](https://www.twilio.com/docs/usage/webhooks)).
- WhatsApp Cloud API documenta webhooks para mensagens e eventos de conta ([WhatsApp webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/)).

### Recomendação

Criar um adaptador de omnichannel que normalize SMS/WhatsApp/voz/e-mail em `Conversation`, `Message` e `Call`, retenha IDs do provedor, status de entrega, tentativas e gravação/transcrição quando legalmente autorizada. Separar mensagens transacionais de marketing; configurar janela/template e fallback humano por canal.

## 7. Brasil: critérios de localização e proteção de dados

### Fatos

- A LGPD é a Lei nº 13.709/2018 e a ANPD disponibiliza o texto legal e materiais oficiais ([ANPD/LGPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lgpd-en-lei-no-13-709-capa.pdf)).
- A LGPD prevê bases legais, direitos dos titulares, deveres de segurança, regras para operadores/controladores e sanções administrativas; a aplicação concreta depende do caso e de orientação jurídica ([ANPD/LGPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lgpd-en-lei-no-13-709-capa.pdf)).

### Recomendação de seleção

Exigir:

- português brasileiro, BRL, `America/Sao_Paulo`, feriados e formatação local;
- PIX/cartão/parcelamento e integração fiscal/financeira compatível com o município, validados com contador;
- DPA/contrato de operador, suboperadores, localização/transferência internacional, retenção, exclusão, exportação e resposta a titulares;
- minimização de documento, criptografia, segregação por propriedade, RBAC/MFA e logs de acesso;
- WhatsApp oficial ou parceiro autorizado, opt-in/opt-out e templates auditáveis;
- suporte no Brasil, SLA em horário local e exportação de reservas, hóspedes, tarefas, mensagens e auditoria em formato aberto.

### Cuidado jurídico

Não presumir que “consentimento” seja a base para todo tratamento de check-in, faturamento ou segurança; mapear finalidade e base legal com assessoria brasileira. A arquitetura deve permitir retenção diferenciada e atendimento de solicitações sem apagar registros cuja conservação seja legalmente necessária.

## 8. Build versus buy

| Construir no hub | Comprar/usar como serviço |
|---|---|
| Modelo canônico, regras de precedência, orquestração, deduplicação, outbox/inbox, reconciliação, console de exceções, auditoria, métricas e automações específicas | PMS, channel manager, conectividade OTA, motor de reservas certificado, PSP, mensageria/telefonia, fiscal/local e eventualmente housekeeping |
| Diferencial da propriedade e controle de dados | Domínios com certificação, contratos de canal, manutenção 24x7 e alta variabilidade |

### Recomendação

Para uma operação pequena, comprar o “plumbing” crítico e construir a camada de diferenciação. Construir um channel manager próprio ou conectividade direta com OTAs somente se houver volume, equipe de suporte e necessidade comprovada; Booking.com limita a conectividade a parceiros aprovados, o que aumenta custo e risco de entrada ([Booking.com Connectivity](https://developers.booking.com/connectivity/home)).

### Critérios de pontuação sugeridos

1. **Correção operacional (30%)**: reservas, cancelamentos, ARI, overbooking controls, estados e reconciliação.
2. **API/eventos (20%)**: documentação, sandbox, webhooks assinados, versionamento, rate limits, paginação, exportação.
3. **Confiabilidade (15%)**: SLA, incidentes, status page, retry/replay, RTO/RPO, suporte.
4. **Brasil (15%)**: BRL/PIX/fiscal, português, LGPD, suporte local.
5. **Segurança (10%)**: MFA/RBAC, criptografia, DPA, logs, segregação, pentest/certificações pertinentes.
6. **Economia e saída (10%)**: preço total, implantação, custos por reserva/mensagem, portabilidade, cláusulas de rescisão.

## 9. Observabilidade e controle operacional

### Fatos

- OpenTelemetry recomenda convenções semânticas para que traces, métricas e logs tenham nomes/atributos consistentes ([OpenTelemetry semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)).
- Google SRE usa SLOs, error budgets e práticas de engenharia para operar serviços confiáveis ([Google SRE](https://sre.google/sre-book/service-best-practices/)).

### Recomendação

Instrumentar cada fluxo com `correlation_id`, `reservation_id`, `property_id`, `connector`, `provider_event_id`, `attempt`, `latency`, `result`, `error_class` e `policy_version`. Medir:

- atraso webhook→processamento e polling lag;
- taxa de eventos duplicados/fora de ordem;
- falhas por endpoint/status, 429 e circuit-breaker opens;
- divergências de reserva/ARI por canal e idade das exceções;
- overbooking evitado/detectado;
- mensagens entregues/falhadas e tempo de primeira resposta;
- tarefas de limpeza/manutenção vencidas;
- check-ins sem pagamento/verificação e reversões manuais.

Manter log de auditoria append-only, acesso restrito, retenção definida e exportação. Não registrar documento completo, dados de cartão, tokens ou conteúdo sensível sem necessidade.

## 10. Roadmap recomendado

1. **Descoberta (2–4 semanas, recomendação):** inventariar canais, PMS, pagamentos, tarefas, telefonia, mensagens, fiscais, políticas e incidentes; definir ownership e KPIs.
2. **Fundação:** hub, cofre de segredos, modelo canônico, inbox/outbox, webhook ingress, polling, auditoria, métricas e console de exceções.
3. **Reserva/ARI:** começar em modo leitura/paridade; depois habilitar mutações com feature flags, limites e reconciliação.
4. **Jornada do hóspede:** mensagens pré-estadia, check-in/out assistido, pagamentos e escalonamento humano.
5. **Operações:** housekeeping/maintenance, telefonia e WhatsApp, com testes de indisponibilidade e duplicação.
6. **Otimização:** regras de revenue/upsell somente após confiança nos dados; revisar fornecedor e custo trimestralmente.

## 11. Checklist de due diligence

- Existe documentação pública atualizada, changelog e versionamento?
- Há sandbox real com dados sintéticos e webhook replay?
- O fornecedor documenta IDs, ordenação, retries, rate limits, paginação e idempotência?
- É possível recuperar todas as reservas e alterações por janela?
- Qual sistema vence conflitos de reserva, ARI, folio e status de quarto?
- Há exportação completa e prazo de entrega após rescisão?
- Como o fornecedor trata LGPD, suboperadores, transferências e solicitações de titulares?
- Quais são SLA, RTO/RPO, status page, suporte e comunicação de incidentes?
- Quais custos variáveis existem por quarto, reserva, chamada, mensagem, API ou conector?
- A equipe consegue operar manualmente durante queda do PMS, internet, provedor de mensagens ou hub?

## 12. Síntese

**Recomendação final:** selecionar um PMS/channel manager com conectividade certificada e bom suporte brasileiro como registro operacional; construir apenas um hub fino, observável e reversível para normalizar eventos, executar automações e administrar exceções. Exigir webhook + polling, idempotência testável, reconciliação, exportação, trilha de auditoria e controles LGPD antes de ativar automações de alto impacto. As fontes públicas confirmam que os principais ecossistemas oferecem APIs de reserva/ARI e, em alguns casos, webhooks; detalhes de entrega, retry e idempotência devem ser tratados como itens de contrato e prova técnica, não como pressupostos ([Mews](https://www.mews.com/en/products/api), [Cloudbeds](https://developers.cloudbeds.com/docs/webhooks-1), [SiteMinder](https://developer.siteminder.com/get-started/siteminder-apis), [Booking.com](https://developers.booking.com/connectivity/home)).
