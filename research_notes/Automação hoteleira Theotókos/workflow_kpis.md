# Escale 31 unidades com controle operacional

**BLUF.** Para sair de 12 para 31 unidades sem perder serviço, a Theotókos deve operar como uma pequena “torre de controle”: o PMS/channel manager continua autoridade para reserva, disponibilidade, tarifa, folio e ocupação; uma fila operacional única governa limpeza, manutenção, solicitações, incidentes e inspeções; e a automação interpreta, roteia, lembra, reconcilia e mede — mas não decide sozinha sobre dinheiro, acesso físico, segurança, acessibilidade ou exceções de política. O desenho abaixo transforma cada etapa em gatilhos, estados, papéis, dados, automações, decisões humanas, exceções e métricas. A distinção central é entre **fato sourced** (documentado por fonte oficial ou evidência explicitamente atribuída), **inferência operacional** (síntese apoiada pelas notas) e **proposta de design** (regra recomendada para Theotókos, a validar em piloto). A meta não é “automatizar tudo”: é tornar cada trabalho verificável, cada exceção visível e cada promessa ao hóspede auditável.

## Método, confiança e limites da evidência

### Como ler este relatório

A data de corte das notas é **8 de novembro de 2026**. “**Fato — confiança alta**” significa documentação primária, norma ou lei identificável; “**Fato — confiança média**” significa documentação de fornecedor, case ou fonte setorial, útil para capacidade, mas não para provar desempenho transferível; “**Inferência — confiança média/alta**” é uma conclusão operacional derivada de mais de uma fonte; “**Proposta**” é uma decisão de desenho sugerida, não uma obrigação legal nem benchmark universal. Cases comerciais — por exemplo hotelkit/Estrel, Flexkeeping, Optii, HiJiffy e Stayntouch — são sinais de maturidade, não garantias de ROI em 31 unidades. Percentuais de automação, produtividade ou satisfação sem denominador, período pré/pós e controle devem entrar no business case apenas como hipóteses.

A documentação da Oracle confirma que operações hoteleiras separam `Dirty`, `Clean`, `Inspected`, `Pickup`, `Out of Service` e `Out of Order`, e que `Out of Order` remove a unidade do inventário e afeta métricas como ocupação e RevPAR ([Oracle room-status mobile](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_room_status_mobile_app.htm); [Oracle housekeeping board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_housekeeping_using_the_housekeeping_board.htm)). Booking.com e Expedia documentam disponibilidade, tarifas, restrições e reservas como objetos de conectividade distintos ([Booking.com Connectivity](https://developers.booking.com/connectivity/docs); [Expedia Rapid Lodging API](https://developers.expediagroup.com/rapid/lodging)). STR define ocupação, ADR e RevPAR com fórmulas operacionais padronizadas ([STR Glossary](https://str.com/data-insights/resources/glossary)). ISO 10002 orienta recebimento, rastreamento, avaliação, resposta, encerramento e melhoria de reclamações ([ISO 10002](https://www.iso.org/standard/71580.html)); ISO 22301 estrutura continuidade, resposta, recuperação e exercícios ([ISO 22301](https://www.iso.org/standard/75106.html)); e o NIST AI RMF organiza governança, mapeamento, medição e gestão de risco em IA ([NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)).

No Brasil, a LGPD define finalidade, necessidade, transparência, segurança, prevenção, não discriminação e responsabilização, além de direitos de titulares, regras para dados sensíveis, incidentes e transferências internacionais ([LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm); [ANPD — direitos](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares); [ANPD — segurança para pequeno porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte)). Pagamentos devem permanecer tokenizados e fora de chat, planilha e log, conforme o escopo do PCI DSS ([PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/)). WhatsApp exige templates aprovados fora da janela de atendimento e strings por idioma fornecidas pelo hotel ([Meta templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/)).

**Limites:** as notas não confirmam publicamente o PMS, channel manager, gateway, fechadura, equipe, horários, licenças, inventário ou políticas atuais da Theotókos. Números abaixo marcados como “meta proposta” precisam de baseline local, revisão jurídica e aprovação do proprietário. Uma integração anunciada como “tempo real” ou “API REST” não prova webhook, idempotência, latência, sandbox, cobertura de cancelamento, pagamento, FNRH ou manutenção; exigir documentação e teste contratual ([Simpleshotel integrações](https://simpleshotel.com.br/integracoes.html); [Mews API](https://www.mews.com/en/products/api); [Cloudbeds webhooks](https://developers.cloudbeds.com/docs/webhooks-1)).

## A torre de controle transforma reservas em trabalho verificável

### Arquitetura e ownership

**Proposta — confiança alta como desenho:** não criar um segundo PMS. O PMS/channel manager é a fonte de verdade de `Reservation`, `Inventory`, `RatePlan`, `Stay`, `Folio` e `Unit` vendável; o gateway é autoridade de autorização, captura, estorno e chargeback; a fila operacional é autoridade de tarefas, evidências, SLA e passagem de turno; o hub de integração mantém eventos, correlação, retries, reconciliação e projeções de leitura. O diagrama lógico é:

```text
WhatsApp | telefone | balcão | site | OTA
                  │
       inbox omnicanal + autenticação
                  │
         hub de integração e políticas
   eventos | outbox/inbox | idempotência | auditoria
       │             │              │
   PMS/CM        PSP/fiscal      fila operacional
  reserva/ARI     token/status    limpeza/manutenção
       │             │              │
  booking engine  link seguro     app móvel + gestor
```

A integração deve obedecer a três invariantes propostos: **(1)** repetição de um evento externo não cria segunda reserva ou segunda tarefa; **(2)** timeout depois de uma mutação marca o estado como `UNKNOWN` até reconciliação, nunca como “falhou” ou “sucesso” por suposição; **(3)** toda mutação destrutiva — cancelar, reembolsar, bloquear unidade, alterar tarifa, emitir acesso ou mover hóspede — registra ator, regra, aprovação, antes/depois, timestamp, versão e correlação. O modelo canônico mínimo inclui `Property`, `UnitType`, `Unit`, `RatePlan`, `InventorySnapshot`, `GuestProfile`, `Reservation`, `Stay`, `Folio`, `Conversation`, `Message`, `Task`, `Incident`, `Inspection`, `Asset`, `StockItem`, `LostItem`, `IntegrationEvent` e `AuditEntry`.

### Estados que não podem ser confundidos

| Dimensão | Estados mínimos propostos | Regra operacional |
|---|---|---|
| Ocupação | `vacant`, `expected_arrival`, `checked_in`, `checked_out` | Vem do PMS; não é inferida por mensagem. |
| Limpeza | `dirty`, `cleaning`, `clean`, `pickup`, `inspected` | “Clean” não equivale a “vendável” quando inspeção é exigida. |
| Disponibilidade | `sellable`, `out_of_service`, `out_of_order`, `blocked` | `OO` remove inventário; `OS` bloqueia uso conforme regra e motivo. |
| Serviço | `DND`, `make_up_room`, `turndown`, `request_open` | Sinal de preferência/pedido; não altera ocupação. |
| Prioridade | `P0`, `P1`, `P2`, `P3` | Segurança e chegada iminente vencem conveniência. |
| Tarefa | `new`, `triaged`, `assigned`, `acknowledged`, `in_progress`, `blocked`, `needs_inspection`, `done`, `reopened`, `cancelled` | `done` exige evidência; cancelamento exige motivo. |

**Regra de prontidão proposta:** só liberar acesso ou atribuir chegada quando `occupancy_state=expected_arrival`, `cleaning_state=inspected` (ou política explícita de sem inspeção), `availability_state=sellable`, pagamento/autorização conforme regra e identidade/check-in válidos. A documentação Oracle sustenta a separação de estados; os nomes e a regra composta são proposta de implementação.

### Papéis, escalada e autoridade

| Papel | Responsabilidade primária | Pode decidir | Não pode decidir sozinho |
|---|---|---|---|
| Atendente/recepção | Reserva, check-in/out, comunicação e triagem | FAQ, cotação real, pedido P2, correção simples documentada | Exceção de tarifa, reembolso, fraude, acessibilidade incerta, emergência |
| Coordenador de operações/duty manager | Dono da fila e do turno | Prioridade, room move, bloqueio operacional, compensação dentro de limite | Alteração estrutural sem evidência; decisão jurídica |
| Supervisão de governança | Inspeção, qualidade e produtividade segura | Liberar unidade após checklist, reabrir tarefa | Desbloquear risco de segurança sem manutenção |
| Camareira | Execução de limpeza, achado, defeito e evidência | Iniciar, pausar por risco, registrar estado | Entrar em ambiente perigoso; fechar incidente crítico |
| Manutenção/fornecedor | Diagnóstico, reparo, preventiva e asset history | Reparar e testar dentro da competência | Improvisar em gás, elétrica, incêndio ou elevador sem procedimento |
| Financeiro/gestor | Pagamentos, estornos, chargeback e políticas | Reembolso/depósito dentro da matriz | Compartilhar PAN/CVV; alterar chave de pagamento por chat |
| DPO/encarregado/gestor | Privacidade, direitos, incidentes e fornecedores | Acesso, retenção, resposta a titulares | Apagar evidência sob legal hold |
| Agente automatizado | Classificar, responder com base aprovada, criar/atualizar tarefa permitida | Ações allowlisted e reversíveis | Segurança, identidade, dinheiro, acesso físico e exceção contratual |

**Matriz humana proposta:** `P0` interrompe o fluxo normal e notifica duty manager, equipe local e emergência aplicável; `P1` exige humano em minutos; `P2` entra na fila do turno; `P3` pode ser automatizado com supervisão. A automação deve ser “fail closed” para transações e “fail open” para alertas: se PMS, internet, IA ou lock cair, bloquear mutações perigosas, mas ainda disparar alerta por telefone/rádio e acionar procedimento manual.

## Workflows ponta a ponta cobrem a jornada inteira

### 1. Pré-reserva, reserva e distribuição

**Gatilhos:** mensagem recebida; busca no site; abandono de cotação; alteração/cancelamento/no-show no PMS/OTA; divergência de inventário; pickup acima do limite. **Estados:** `lead → quoted → awaiting_confirmation → reserved → modified/cancelled/no_show`. **Dados obrigatórios:** `channel`, `external_reservation_id`, `reservation_version`, datas com timezone, ocupação e idades quando relevantes, unidade/tipo, tarifa, impostos/taxas, política, moeda, pagamento/status, consentimentos, origem e timestamp.

**Automação permitida:** detectar intenção; pedir datas/ocupação; consultar disponibilidade e tarifa no PMS; mostrar composição do preço, política, moeda e validade; gerar deep link; registrar lead e consentimento; enviar confirmação utility; abrir follow-up de abandono. A Meta documenta que utility, marketing e authentication são categorias distintas e que o hotel precisa fornecer cada idioma ([Meta templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/)). O bot nunca confirma “tem vaga” por memória, nem trata uma cotação como reserva.

**Decisão humana obrigatória:** grupo, overbooking, pedido fora da política, acessibilidade não verificável, suspeita de fraude, menor em condição excepcional, tarifa manual, parceiro não autorizado ou alteração que aumente risco/penalidade. Antes de cancelar, exibir política, valor a reter, valor a reembolsar e efeito no inventário; no-show depende de regra do PMS/horário, não do silêncio no WhatsApp.

**Exceções:** duas sessões tentam reservar a última unidade — revalidar no commit, usar chave de idempotência e oferecer alternativa à segunda; webhook duplicado — descartar por `source_event_id`/versão; webhook atrasado — ordenar por versão/event time e reconciliar janela recente; alteração de canal sem ID — fila manual. Booking.com e Expedia separam reservas, disponibilidade, tarifas e restrições, portanto o hub deve preservar essas dimensões, não “somar” atualizações ([Booking.com Connectivity](https://developers.booking.com/connectivity/docs); [Expedia Rapid Lodging API](https://developers.expediagroup.com/rapid/lodging)).

**Checklist de fechamento da reserva:**

- [ ] Datas, timezone, ocupação e unidade/tipo confirmados.
- [ ] Total, impostos, taxas, política de cancelamento/no-show e validade exibidos antes do commit.
- [ ] ID interno e externo correlacionados; versão registrada.
- [ ] Pagamento é somente status/token do gateway; PAN/CVV não aparece em chat, log ou planilha ([PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/)).
- [ ] Mensagem utility e consentimento de marketing separados.
- [ ] Evento `ReservationConfirmed` publicado; tarefa de pré-chegada agendada.

### 2. Pré-chegada e preparação do flat

**Gatilho proposto:** `3–7 dias antes`, ajustado à antecedência da reserva, com segundo lembrete `24 h antes`; reserva curta recebe fluxo imediato. **Estados:** `prearrival_pending → link_sent → partially_complete → verified → exception`. **Dados:** horário/modo estimado de chegada, idioma, necessidades de acessibilidade, berço/cama extra, estacionamento, instruções, documento apenas no mínimo necessário, assinatura/pagamento por link seguro, consentimento e status de entrega.

**Automação:** enviar template utility com confirmação, endereço, estacionamento, regras essenciais, contato, link web, coleta de horário e modo de chegada; consultar capacidade para oferecer early check-in, late checkout, upgrade, kit, transporte ou experiência; gerar tarefas de berço, enxoval, manutenção e limpeza especial. Soluções como Duve documentam check-in web, documento, assinatura, pagamento, perguntas customizadas e upsell ([Duve contactless check-in](https://duve.com/contactless-online-check-in/)); isso prova capacidade de produto, não que o fluxo esteja juridicamente validado para Theotókos.

**Humano:** pedido de acessibilidade não confirmado por medidas/fotos; divergência de identidade; pagamento falho; chegada de madrugada sem acesso comprovado; acompanhante fora da reserva; pessoa vulnerável; suspeita de fraude. Nunca vender um serviço sem revalidar inventário/capacidade.

**Preparação de chegada:** `expected_arrival` dispara housekeeping board; a supervisão prioriza VIP/chegada iminente, room move, ocupado com defeito, turno normal e deep clean. A tarefa contém checklist de cozinha, banheiro, enxoval, eletros, Wi-Fi, climatização, fechadura, resíduos e danos. Achado durante limpeza abre manutenção vinculada ao `room_id` e `asset_id`; defeito crítico coloca `OS/OO` segundo a matriz, com motivo, owner, data e status de retorno.

### 3. Chegada, check-in, acesso e exceções

**Gatilhos:** hóspede chega; pré-check-in concluído; unidade muda para `inspected`; falha de lock; fila de chegada iminente. **Estados:** `pending → verified → ready → checked_in`; exceção `blocked/assisted/room_move`. **Dados:** reservation ID, identidade mínima, ocupantes, autorização de pagamento, unidade, readiness, credencial emitida/revogada, horário, dispositivo e fallback.

**Automação permitida:** validar condições no PMS/PSP; enviar instruções e credencial única por reserva e janela; registrar emissão, entrega, abertura e revogação; orientar caminho humano. Uma mensagem recebida não prova identidade nem autorização de entrada. Código deve ser revogado em cancelamento/checkout e ter fallback físico. WCAG 2.2 exige conteúdo perceptível, operável, compreensível e robusto ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)); oferecer caminho web e balcão/telefone equivalentes.

**Exceções críticas:** `cheguei e não entra`, lock sem energia/internet, unidade não inspecionada, documento divergente, acompanhante não cadastrado, flat inacessível, overbooking. Escalar em até 2 minutos (meta proposta); não enviar código de outra unidade; room move somente com aprovação e atualização atômica no PMS. Em emergência, orientar contato imediato com serviço local, sem diagnóstico ou troubleshooting perigoso.

**Checklist de check-in:**

- [ ] Reserva encontrada e autenticada por fator apropriado.
- [ ] Pagamento/autorização conferidos no gateway/PMS.
- [ ] `inspected + sellable` confirmado ou exceção humana documentada.
- [ ] Código válido apenas no intervalo e unidade corretos.
- [ ] Fallback físico, telefone e endereço disponíveis offline.
- [ ] Hóspedes e necessidades operacionais registrados com minimização.

### 4. Estada, concierge e solicitações de serviço

**Gatilhos:** mensagem, chamada, QR code, balcão, sensor ou observação de equipe. **Catálogo curto:** toalha/enxoval, limpeza, amenidade, Wi-Fi, ar-condicionado, água, estacionamento, ruído, manutenção, item esquecido, recomendação, extensão, acessibilidade e emergência. O hóspede não deve escolher entre dezenas de códigos; a equipe enxerga códigos ricos depois.

**Estados:** `received → authenticated → classified → assigned → acknowledged → in_progress → blocked → completed → confirmed/reopened`. **Campos:** `task_id`, reserva/unidade, categoria, texto original, intenção, idioma, prioridade, impacto, SLA de acknowledgment/restauração, owner, dependência, evidência, custo, confirmação e motivo de reabertura.

**Roteamento proposto:**

| Pedido | Prioridade | Dono inicial | SLA proposto | Fechamento |
|---|---:|---|---:|---|
| Fogo, gás, inundação grave, violência, lesão, pessoa presa, risco elétrico | P0 | Duty manager + emergência | alerta ≤30 s | registro de ação e segurança; nunca “bot resolved” |
| Lockout, overbooking, unidade insegura, água/energia, cobrança contestada, acessibilidade falha | P1 | Duty manager + área | reconhecimento ≤5 min; plano ≤15 min | confirmação humana e auditoria |
| HVAC, chuveiro, ruído relevante, limpeza urgente, item essencial | P2 | Manutenção/governança | reconhecimento ≤10 min; solução/ETA ≤60 min | teste, foto ou hóspede confirma |
| FAQ, localização, horário, amenidade não urgente | P3 | Bot/recepção | resposta ≤2 min; tarefa no turno | resposta grounded ou tarefa com prazo |

Metas são propostas, não padrão universal. O relógio de resposta começa na criação; pausa apenas por bloqueio codificado (`guest_unavailable`, `access_denied`, `part_waiting`, `approval_waiting`) e o relógio de restauração permanece visível. Não marcar `done` por mensagem automática; exigir evidência adequada.

**Recomendações locais:** catálogo de Piumhi/Serra da Canastra deve ser curado, datado e revalidado; a Prefeitura posiciona Piumhi no mapa turístico e a Rota Essência da Canastra publica atrativos/roteiros ([Prefeitura de Piumhi](https://prefeiturapiumhi.mg.gov.br/piumhi-alcanca-marco-historico-e-passa-a-integrar-a-categoria-municipio-turistico-do-mapa-do-turismo-brasileiro/); [Rota Essência da Canastra](https://nascentesecanastra.com.br/rota-essencia-da-canastra/)). Não prometer horário, estrada, ingresso, clima ou parceiro sem fonte vigente.

### 5. Checkout e pós-estada

**Gatilhos:** `checkout_date - 24h`; pedido de saída antecipada; late checkout; saída detectada; folio pendente. **Estados:** `checkout_pending → departure_confirmed → folio_review → cleaning_released → poststay_sent`. **Dados:** horário, devolução de chave, consumo, saldo, caução, dano alegado, recibo, tarefa de turnover, pesquisa e consentimento de marketing.

**Automação:** lembrar horário e instruções; oferecer late checkout apenas com disponibilidade real; enviar recibo/link seguro; registrar saída; abrir limpeza e inspeção; separar feedback de reclamação; pedir avaliação sem fabricar, ocultar ou incentivar review enganoso — a FTC proíbe práticas enganosas em endorsements/reviews ([FTC reviews rule](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-465)).

**Humano:** dano, item faltante, caução, disputa de cobrança, saída sem chave, ameaça de review, pedido de reembolso, incidente de segurança ou reclamação de acessibilidade. Não bloquear a saída por disputa não verificada; abrir caso separado e preservar evidência.

### 6. Governança/housekeeping e camareiras

**Gatilhos:** check-out confirmado; extensão/room move; pedido de limpeza; `OO/OS`; chegada próxima; DND; preventiva. **Plano diário:** gerar workload por unidade/zoneamento, tipo de serviço (`turnover`, `stayover`, `pickup`, `deep_clean`), prioridade, tempo-alvo e sequência. A camareira recebe apenas tarefas do turno, com botão `start`, `blocked`, `hazard`, `needs_inspection`, `done` e motivo.

**Checklist de turnover proposto:** retirar resíduos; verificar danos/itens; cozinha e louça; banheiro e água quente; cama/enxoval; ar/climatização; Wi-Fi/TV; lâmpadas/tomadas; fechadura; amenities; odor/mofo; acessibilidade prometida; fotos somente quando exigidas por dano/risco/QA. `done` muda limpeza para `clean` ou `needs_inspection`; supervisão faz inspeção curta baseada em risco e muda para `inspected` ou reabre com motivo.

**Segurança:** a camareira não entra em ambiente com gás, fumaça, faísca, inundação grave, arma, sangue, ameaça ou ocupante hostil. Seleciona `do_not_enter`, afasta-se, registra localização mínima e aciona duty manager. OSHA identifica riscos ergonômicos de levantar, empurrar, puxar, curvar e alcançar; o desenho deve medir carga e incidentes, não apenas quartos por pessoa ([OSHA housekeeping ergonomics](https://www.osha.gov/etools/hospitals/housekeeping/work-related-musculoskeletal-disorders)).

### 7. Manutenção reativa e preventiva

**Gatilhos:** pedido de hóspede; defeito encontrado na limpeza/inspeção; leitura fora do limite; preventiva vencendo; repetição em 30 dias; fornecedor externo. **Estados:** `reported → triaged → made_safe → assigned → diagnosed → parts_reserved → repaired → tested → verified → closed/reopened`. **Campos:** `asset_id`, marca/modelo/garantia, room/zone, sintoma original, severidade, impacto, foto/leitura, segurança, peças, fornecedor, custo, causa, ação, ETA, evidência e retorno a inventário.

O loop recomendado é **reportar → classificar → tornar seguro → atribuir → diagnosticar → reservar peça → reparar → testar → verificar → encerrar → decidir preventiva/causa raiz**. HelloShift e eWorkOrders descrevem work orders, ativos, preventivas, checklists, fotos, leituras e inventário como primitives úteis ([HelloShift preventive maintenance](https://www.helloshift.com/preventive-maintenance); [eWorkOrders hospitality CMMS](https://eworkorders.com/hospitality-gaming-maintenance-management-software-cmms/)). São padrões de produto, não norma de intervalo.

**Bloqueio de unidade:** defeito de segurança, água, elétrica, gás, lock, incêndio ou condição que impeça ocupação exige `OS/OO` conforme impacto; o PMS recebe motivo, início/fim previsto, return status e owner. Não fechar P1/P0 sem `made_safe=true`; não liberar venda antes de `verified=true` e inspeção. Preventivas são baseadas em criticidade: vida/segurança, água/HVAC/elevador/piscina/boiler, ativos de alto impacto, depois cosméticos. Intervalo legal deve vir da autoridade/contrato do ativo, não de um número global inventado.

### 8. Inventário, peças, enxoval e consumo

**Gatilhos:** issue/return de item; contagem cíclica; abaixo do mínimo; compra recebida; dano/perda; tarefa usa peça. **Estados do estoque:** `available`, `reserved`, `issued`, `returned`, `quarantined`, `expired`, `lost`; transações são append-only e ligadas a tarefa, compra ou contagem.

**Campos:** SKU, descrição, categoria (`guest_supply`, `linen`, `cleaning`, `spare_part`, `asset`), unidade de medida, localização/bin, on-hand, reservado, disponível, min/max ou reorder point, fornecedor, lead time, substituto, lote/serial/validade, custo, última contagem e responsável. `available = on_hand - reserved`; `reorder_qty = max(0, target_stock - available - on_order)` — fórmula de design, não benchmark.

**Rotina proposta:** contar itens críticos semanalmente e demais itens mensalmente; investigar variação acima de 2% ou valor aprovado; registrar enxoval enviado para lavanderia, dano e descarte; reservar peça ao abrir work order; devolver sobra ao fechar. A frequência é recomendação, calibrada pelo valor, risco e giro; as notas não encontraram padrão hoteleiro universal para shrinkage, estoque ou produtividade.

### 9. Achados e perdidos

Fluxo separado de manutenção: `found → bagged/sealed → logged → stored → claimant_verified → returned/shipped → disposed_after_retention`. **Campos obrigatórios:** `item_id`, data/hora, local exato, finder, descrição neutra, condição, foto somente se necessária, embalagem/local de guarda, cada handoff com ator/horário, verificação do reclamante, decisão de envio/retirada, prazo de retenção e disposição.

A camareira deve registrar o achado sem fotografar rostos, documentos, cartão, dados irrelevantes ou pessoas. A recepção não confirma uma descrição detalhada a qualquer solicitante; exige prova proporcional e registra a decisão. Retenção não é universal: definir com jurídico, seguro e política local; preservar `legal_hold` quando houver disputa/incidente. A separação reduz risco de misturar cadeia de custódia com SLA de serviço.

### 10. Inspeções e qualidade

**Gatilhos:** unidade pronta; falha repetida; reclamação; manutenção concluída; inspeção diária; auditoria semanal; mudança de SOP. **Estados:** `scheduled → in_progress → pass/fail → corrective_task → verified`. O checklist tem itens críticos (segurança, água, lock, higiene, danos, acessibilidade prometida), severidade, foto quando necessário, inspector, versão, nota e ação corretiva.

Use inspeção 100% de chegadas na fase inicial e amostragem baseada em risco depois de estabilidade; falha crítica rebaixa a unidade e abre tarefa. **Proposta de amostragem:** 100% em duas primeiras semanas de cada nova unidade/processo; depois 100% para P0/P1 e pelo menos 20% das unidades liberadas por semana, aumentando para 50% quando a taxa de falha exceder 5%. Não há evidência oficial para esses percentuais; são gates locais ajustáveis.

### 11. Incidentes, continuidade e solicitações sensíveis

**Incidente** não é apenas tarefa. Abrir `Incident` para fogo/fumaça, gás, inundação, energia/água, elevador, lesão, violência, ameaça, desaparecimento, acessibilidade grave, fraude, vazamento de dados ou falha sistêmica. **Estados:** `detected → acknowledged → contained → recovered → reviewed → closed`; preservar timeline, evidência, decisões, comunicações e lições.

P0 mostra imediatamente “ligue para emergência” e o número aplicável; não dizer que o hotel chamou ajuda sem integração auditável. Para emergências no Brasil, confirmar o número local e o procedimento da propriedade; referências europeias a 112 não substituem o plano brasileiro. OSHA recomenda plano de ação de emergência com comunicação, evacuação, responsabilidades e contabilização ([OSHA EAP](https://www.osha.gov/etools/evacuation-plans-procedures/emergency-action-plans)); NFPA 101 é referência de segurança da vida cuja adoção depende da autoridade competente ([NFPA 101](https://www.nfpa.org/codes-and-standards/nfpa-101-standard-development/101)).

**Modo offline proposto:** lista mínima protegida de hóspedes necessários, telefones essenciais, mapas/saídas, instruções de acesso, chaves físicas, lanternas/power banks, formulário de incidente e reconciliação posterior. Testar falha de PMS, internet, energia, lock e gateway trimestralmente; ISO 22301 apoia continuidade e recuperação, mas não prescreve essa frequência.

### 12. Passagem de turno e fila única

**Gatilho:** 30 minutos antes do fim do turno; troca emergencial; outage; P0/P1 aberto. **Handover obrigatório:** ocupação/chegadas próximas; unidades `OO/OS`; P0/P1 abertos; hóspedes impactados; pagamentos pendentes; tarefas atrasadas; peças/fornecedores; achados sob custódia; incidentes; compromissos prometidos; riscos e próxima ação.

**Formato:** `item | impacto | owner atual | estado | próximo passo | prazo | bloqueio | evidência | owner do próximo turno`. O turno que entrega não apenas “informa”: o receptor deve reconhecer e assumir. Dashboard do gestor mostra somente exceções: P0/P1, SLA em risco, tarefas sem owner, unidade não pronta para chegada em 2h, divergência PMS–gateway, webhook morto, estoque crítico e reclamação reaberta.

## Dados, IA, privacidade e automações permitidas

### Guardrails de integração e pagamentos

A camada conversacional deve registrar texto original, interpretação estruturada, confiança, política/KB usada, versão do modelo, resposta, tool call, resultado, handoff e correlação. IDs, nomes, endereços, CEP, telefone, reserva, PIX e últimos quatro dígitos ficam em campos separados; a normalização nunca substitui o original. O RAG deve recuperar somente documentos aprovados, versionados, com escopo de propriedade e validade; conteúdo de hóspede, review ou fornecedor não pode virar instrução do sistema. Ferramentas recebem payload estruturado, autorização server-side, allowlist, idempotency key e confirmação quando irreversíveis. Structured Outputs e function calling validam formato, mas não substituem regra de negócio ([OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)); OWASP destaca risco de excessive agency ([OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)).

**Não automatizar sem humano:** tarifa fora da regra; cancelamento ambíguo; reembolso/chargeback; alteração de titular; emissão de acesso após divergência; room move; acessibilidade não verificada; cobrança de dano; fraude; saúde, ameaça, violência, discriminação; publicação de resposta sensível; eliminação de evidência; mudança de retenção. **Automatizar:** FAQ grounded, busca de disponibilidade, deep link, lembrete, classificação, abertura/atribuição de tarefa, alertas, reconciliação, relatórios, mensagens utility aprovadas e respostas P3 com fatos vigentes.

### LGPD e minimização por fluxo

| Fluxo | Dados mínimos | Controle e evidência |
|---|---|---|
| Reserva | nome, contato, datas, ocupação, tarifa/política, origem | ROPA, aviso, consentimento de marketing separado, logs de API |
| Check-in | identidade necessária, ocupantes e status | mascaramento, RBAC, retenção aprovada, não copiar documento sem necessidade |
| Pagamento | token, status, valor, referência | gateway hospedado/tokenização, varredura de logs, MFA |
| Acesso | código, unidade, validade, eventos | credencial única, revogação, logs, fallback |
| Manutenção/CCTV | asset, local, foto necessária, incidente | sem pessoas/documentos nas fotos; acesso nominal, retenção curta |
| Chat | mensagem, reserva, idioma, consentimento | aviso no primeiro contato, redaction, DPA e localização de dados |
| Escalada | somente dados necessários à decisão | fila restrita, motivo codificado, decisão humana auditável |

A LGPD prevê bases como execução de contrato, obrigação legal, exercício regular de direitos, proteção da vida e legítimo interesse conforme os fatos; consentimento não deve ser padrão para tudo ([LGPD arts. 7, 10, 11, 18 e 20](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)). A ANPD orienta registros, segurança, contratos, controle de acesso e gestão de vulnerabilidades ([Guia ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte)). Direitos de titulares precisam de fila, prazo e prova de resposta; incidentes precisam de contenção, avaliação de risco e comunicação quando aplicável.

## Painel de KPIs mede serviço, risco e economia real

### Fórmulas e faixas de benchmark

Os valores abaixo dividem **benchmark sourced** de **meta proposta**. Onde não há benchmark universal para pequenos apart-hotéis, a faixa é deliberadamente uma faixa de lançamento, não uma promessa de mercado.

| KPI | Fórmula | Meta/faixa proposta para 12→31 | Confiança/uso |
|---|---|---:|---|
| Ocupação | noites/unidades ocupadas ÷ noites/unidades disponíveis ×100 | medir por unidade, tipo e canal; não fixar alvo sem histórico | Alta para fórmula ([STR](https://str.com/data-insights/resources/glossary)); alvo local |
| ADR | receita de acomodação ÷ unidades/noites vendidas | baseline semanal; comparar por canal e mix | Alta para fórmula; alvo local |
| RevPAR | receita de acomodação ÷ unidades/noites disponíveis | baseline e tendência; `ADR × ocupação` | Alta para fórmula; alvo local |
| Taxa de conversão direta | reservas confirmadas ÷ leads qualificados ×100 | medir por canal; promover após 2 semanas de baseline | Proposta |
| Tempo de primeira resposta | mediana de `first_response_at - received_at` | P3 ≤2 min automatizado; humano P1 ≤5 min | Proposta; publicar p50/p90 |
| Handoff no prazo | casos humanos atribuídos no SLA ÷ casos que exigem humano ×100 | ≥98% P0/P1; ≥95% P2 | Proposta |
| Falso aceite de OOS | casos OOS respondidos como suportados sem escalada ÷ OOS ×100 | 0% em cobrança, acesso, emergência e fraude | Proposta apoiada por CLINC/OOS ([CLINC](https://aclanthology.org/D19-1131/)) |
| Intenção macro-F1 | média harmônica por classe | ≥0,99 nas classes críticas do gold; calibrar demais | Proposta; MASSIVE orienta métrica ([MASSIVE](https://aclanthology.org/2023.acl-long.235/)) |
| Slot exact match | slots corretos ÷ slots avaliados ×100 | ≥99%; identificadores com CER=0 | Proposta |
| Room-ready no horário | chegadas com unidade `inspected/sellable` no horário ÷ chegadas ×100 | ≥98%; P0/P1 =100% em canário | Proposta |
| Retrabalho 24h | turnos reabertos em 24h ÷ turnos concluídos ×100 | ≤5%; investigar por equipe/unidade | Proposta |
| Inspeção falha | inspeções reprovadas ÷ inspeções realizadas ×100 | ≤5% após estabilização; crítico =0 | Proposta |
| Reconhecimento de tarefa | tarefas com `ack_at` no SLA ÷ tarefas criadas ×100 | P1 ≥99%; P2 ≥95% | Proposta |
| Restauração no SLA | tarefas resolvidas/verificadas no SLA ÷ tarefas elegíveis ×100 | P1 ≥95%; P2 ≥90% | Proposta |
| MTTA | média/mediana `ack_at - created_at` | P0 alerta ≤30 s; P1 ≤5 min | Proposta; separar p50/p90 |
| MTTR | `verified_at - created_at` | medir por categoria; publicar p50/p90, não impor 2h universal | Proposta; notas não acharam padrão universal |
| Reabertura | tarefas reabertas ÷ tarefas encerradas ×100 | ≤5%; P0/P1 =0 sem revisão | Proposta |
| Reincidência 30 dias | ativos/unidades com mesmo defeito em 30d ÷ defeitos resolvidos ×100 | ≤10%; PM para recorrentes | Proposta |
| PM no prazo | preventivas concluídas no vencimento ÷ preventivas vencidas ×100 | ≥95%; críticas ≥99% | Proposta |
| Disponibilidade guest-facing | minutos disponíveis ÷ minutos previstos ×100 | ≥99,9% mensal, excluindo manutenção anunciada | Proposta de aceitação |
| Self-check-in válido | check-ins válidos concluídos ≤3 min ÷ válidos ×100 | ≥95%; falha sempre mostra fallback ≤60 s | Proposta |
| Erro de acesso | tentativas com código errado/unidade errada ÷ tentativas ×100 | 0 vazamento cross-unit; medir falhas legítimas | Proposta |
| Divergência PMS–gateway | transações não reconciliadas no ciclo ÷ transações ×100 | 0 duplicidade; ≥99,5% conciliadas em D+1 | Proposta |
| PAN/CVV exposto | ocorrências em logs/chat/tickets | 0 | Alta como controle PCI; meta proposta |
| Turnover por unidade | minutos `start→done` por tipo de limpeza | baseline por tipo; não usar quota sem ergonomia | Proposta |
| Carga de coordenação | horas de rádio/planilha/manual ÷ reservas/turnovers | reduzir após baseline sem aumentar incidentes | Proposta |
| Lost-and-found com cadeia completa | itens com todos handoffs registrados ÷ itens achados ×100 | 100% | Proposta |
| Reclamação reaberta | reabertas ÷ fechadas ×100 | ≤5%; segurança/acessibilidade 0 sem revisão | Proposta |
| CSAT pós-resolução | respostas 4–5 ÷ respostas válidas ×100 | baseline por categoria; não usar isolado | Prática de qualidade; causa por aspecto |
| Custo de recuperação | compensação + custo direto ÷ reservas | acompanhar por causa raiz; limite de aprovação local | Proposta |
| Precisão de forecast | `1 - abs(previsto-real)/real` | medir WAPE/MAPE por horizonte; escolher após baseline | Proposta baseada em revenue management |
| Acurácia de inventário | itens contados corretos ÷ itens contados ×100 | ≥98%; críticos ≥99% | Proposta |
| Ruptura | eventos de falta de item essencial ÷ estadias | 0 críticos; medir P2 | Proposta |
| Incidentes P0 roteados | P0 com alerta humano no prazo ÷ P0 ×100 | 100%; drill trimestral sem falha | Proposta apoiada por NIST/ISO |

**Regra de interpretação:** publicar p50, p90 e p95 por canal, turno, unidade, idioma e tipo de tarefa; médias ocultam filas e eventos raros. Containment/deflexão nunca é KPI primário isolado: reportar resolução real, repeat contact, handoff, esforço e satisfação ([TSIA](https://www.tsia.com/blog/top-support-services-questions-answered); [ICMI FCR](https://www.icmi.com/resources/2018/the-link-between-customer-satisfaction-and-first-contact-resolution/); [NICE quality management](https://www.nice.com/info/7-principles-of-quality-management-in-the-contact-center)).

### Painel diário, semanal e mensal

**Diário, 15 minutos:** chegadas em 24h sem `inspected`; P0/P1 abertos; tarefas sem owner; SLA em risco; `OO/OS`; pagamentos `UNKNOWN`; falhas de acesso; reclamações reabertas; estoque crítico; webhooks parados; handover não reconhecido. **Semanal:** room-ready, retrabalho, falha de inspeção, PM, MTTA/MTTR por categoria, workload por turno, ocupação/ADR/RevPAR, conversão, cancelamento/no-show, receita líquida por canal, tempo de coordenação e causas raiz. **Mensal:** incidentes, privacy/security, acessibilidade, auditoria de permissões, retenção/expurgo, custo de software/PSP, horas liberadas realmente observadas, margem de upsell e evolução do baseline.

## Implantar em quatro ondas e provar antes de escalar

### Onda 0 — fundação (2–4 semanas)

Confirmar inventário físico de 12/15/31 unidades, tipos e atributos; PMS/channel manager/PSP/locks; políticas; equipe/horários; ROPA; matriz de papéis; catálogo de tarefas; mapa de assets; SOPs; contatos de emergência; offline pack; baseline de duas semanas. Exigir OpenAPI/webhooks, eventos, autenticação, rate limits, retries, idempotência, sandbox, exportação, retenção, DPA, suboperadores e suporte. Para Simpleshotel/HSystem, capacidades anunciadas — PMS, governança, manutenção, API, WhatsApp, Asaas, HSystem/HUNIT/HBOOK — devem ser comprovadas no contrato e homologação, não assumidas por marketing ([Simpleshotel funcionalidades](https://simpleshotel.com.br/funcionalidades.html); [Simpleshotel preços](https://simpleshotel.com.br/precos.html); [HUNIT](https://hsystem.com.br/produtos/hunit-gestor-de-canais/); [HBOOK](https://hsystem.com.br/produtos/hbook-motor-de-reservas/)).

### Onda 1 — 12 unidades, execução assistida (4–6 semanas)

Ativar fila operacional, housekeeping, inspeção, manutenção, inventário básico, lost-and-found, handover e reconciliação. Manter a recepção no circuito; automatizar apenas FAQ, alertas, tarefas e mensagens aprovadas. Medir baseline versus piloto em unidades selecionadas; não trocar PMS nem liberar acesso autônomo apenas para “testar IA”.

### Onda 2 — 15 unidades, jornada digital (4–8 semanas)

Adicionar WhatsApp oficial, pré-chegada, web check-in opcional, pagamento por link/token, horário de chegada, menu de solicitações e upsell condicionado. Testar pt-BR com conjunto dourado próprio; MASSIVE separa pt-BR/pt-PT, mas não é hotelaria, e CLINC/OOS mostra por que rejeição fora de escopo é necessária ([MASSIVE](https://huggingface.co/datasets/qanastek/MASSIVE); [CLINC/OOS](https://aclanthology.org/D19-1131/)). Manter humano para acessibilidade, identidade, pagamento, cancelamento e acesso.

### Onda 3 — 31 unidades, governança e melhoria contínua (8–12 semanas)

Expandir somente após quatro semanas de estabilidade: room-ready ≥98%, PAN/CVV =0, duplicidade =0, P0 roteado =100%, handoff no prazo ≥98%, retrabalho ≤5%, divergência PMS–gateway dentro do gate e nenhuma regressão crítica no teste temporal/canal. Introduzir revenue review diário em alta demanda, inspeção baseada em risco, PM por criticidade, scorecards de fornecedor, voice/lock/agentic features apenas se o volume justificar. Ferramentas como HiJiffy, Asksuite, Duve, Akia, Canary, hotelkit, Flexkeeping, Optii, Mews, Cloudbeds e Stayntouch demonstram capacidades de mercado, mas preço, integração e desempenho em pt-BR/pequena operação exigem prova local ([HiJiffy](https://www.hijiffy.com/booking-assistant); [Asksuite](https://asksuite.com/); [Duve](https://duve.com/contactless-online-check-in/); [Akia](https://www.akia.com/pricing); [Mews Marketplace](https://www.mews.com/en/products/marketplace); [hotelkit](https://hotelkit.net/)).

### Testes de aceitação e melhoria contínua

Antes de cada release, executar conjunto dourado de pelo menos 200 conversas sintéticas/reais anonimizadas, estratificadas por jornada, canal, turno, idioma, texto informal, ASR, concorrência, indisponibilidade, OOS, acessibilidade, pagamento, emergência e multi-intent. Medir macro-F1, slot exact match, OOS false accept, calibração/ECE, selective risk-coverage, handoff, tempo de resposta e invariantes transacionais. A matriz de cenários deve incluir reserva duplicada, tarifa local, número “1.234,56”, cancelamento ambíguo, nome com acento, “qto/obg”, código trocado, vazamento, cheiro de gás, criança, cadeira de rodas, reclamação sarcástica e falha de PMS. MASSIVE, Banking77, TweetEval, XNLI e reviews hoteleiras pt-BR são auxiliares; não substituem um gold set interno ([Banking77](https://arxiv.org/abs/2003.04807); [TweetEval](https://aclanthology.org/2020.findings-emnlp.148/); [XNLI](https://aclanthology.org/D18-1269/); [Brazilian Portuguese Hotel Reviews Corpus](https://data.mendeley.com/datasets/2w3kvrg97m/1); [PROPOR 2026](https://aclanthology.org/2026.propor-1.92/)).

Rodar **offline → shadow mode → canário → expansão**. Em shadow, a IA classifica e propõe sem enviar/mutacionar; comparar com recepção. No canário, ativar uma categoria/canal/unidades e manter kill switch. A/B só para mensagens ou upsell de baixo risco, com mesma política, margem e consentimento; não experimentar em emergência, acesso, cobrança, identidade ou acessibilidade. Toda semana revisar falsos positivos/negativos por causa (conhecimento, integração, ferramenta, prompt, idioma, treinamento ou política), atualizar SOP/KB e registrar versão. NIST AI RMF recomenda governança, medição e gestão contínuas; NIST SP 1800-27 recomenda segmentação, autenticação, monitoramento e logging para PMS ([NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework); [NIST PMS security](https://www.nccoe.nist.gov/publication/1800-27/VolA/index.html)).

## Conclusão

A escala de 12 para 31 unidades não exige uma grande central nem um agente autônomo; exige uma disciplina pequena, explícita e mensurável. A unidade deve ter estado separado de tarefa; a reserva deve ter autoridade separada do chat; o chamado deve ter resposta separada de restauração; o incidente deve ter cadeia própria; e a decisão de alto impacto deve continuar humana. O ganho real aparece quando o próximo turno sabe exatamente o que está aberto, quem é o dono, qual é o prazo, qual hóspede é afetado e qual evidência falta.

A recomendação final é **comprar o encanamento e construir o controle**: PMS/channel manager e PSP como autoridades, uma camada operacional móvel com estados e SLAs, WhatsApp/web como canais governados, RAG com fonte versionada, tarefas idempotentes, fallback offline, privacidade por finalidade e KPIs próprios. Só promova automação quando ela demonstrar, em dados da Theotókos, que reduz atraso, retrabalho, perda de solicitação e custo de coordenação sem aumentar overbooking, cobrança duplicada, erro de acesso, falha de acessibilidade, incidente de privacidade ou resposta insegura.
