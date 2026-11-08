# Automação hoteleira Theotókos

## O que o catálogo de referência já propõe

### Takeaway
O arquivo local é um inventário amplo, não uma especificação aprovada: declara 1.437 registros brutos, 368 funcionalidades deduplicadas e 43 plataformas, organizadas em 11 domínios. O recorte preliminar é para um apart-hotel que cresce de 12 para 15 e depois 31 flats, com solução própria de IA, supervisão humana e integração ao Simpleshotel, HSystem e Asaas. [Evidência: `D:\PROJETOS EM ANDAMENTO\Pesquisa Automação Hotelaria\Perplexity\Catálogo de funcionalidades — Theotókos Flats.md`, lido em 08/11/2026.]

### Cited Findings
- O catálogo cobre: IA/supervisão (33), recepção/inbox (28), vendas (26), pré-chegada/check-in/check-out (32), estadia/concierge (37), governança/manutenção (43), CRM/reputação (42), gestão/analytics (32), integrações/canais (31), segurança/LGPD (29) e plataforma (35). [Evidência: arquivo local, índice.]
- O desenho operacional recomendado é coerente para uma equipe enxuta: escalonamento humano com contexto (IA-01/02/03/12), níveis de autonomia (IA-06/07/08), modo sombra (IA-09), pausa quando humano assume (IA-10/11), feedback e testes (IA-16/18), base de conhecimento aprovada (IA-19/20/22) e contexto vivo do PMS (IA-23).
- O núcleo de jornada é bem coberto: mensagens por eventos e modelos dinâmicos (JOR-01/02/04/05), confirmação/depósito (JOR-06), portal de check-in sem aplicativo (JOR-09/10), FNRH Digital já oferecida pelo Simples Hotel (JOR-11), guia web (JOR-16), instruções e códigos de acesso (JOR-17), integração de fechaduras (JOR-18), atualização do PMS (JOR-19), check-in assistido (JOR-20) e checkout digital (JOR-24).
- Para operação, há boa ênfase em governança: tarefas por unidade, calendário de limpeza, checklists, inspeções, manutenção preventiva/corretiva, fotos e trilha de auditoria (OPS-01 a OPS-43; PLT-16/18/19/27).
- Para crescimento comercial, o catálogo propõe perfil unificado, deduplicação, consentimento, segmentação, jornadas, campanhas, reputação e métricas (CRM-01 a CRM-18 e GES). Isso deve ser subordinado à qualidade cadastral e à LGPD, não tratado como “marketing automático” desde o primeiro dia.
- Segurança aparece como requisito de produto, e não como apêndice: menor privilégio, consentimento, retenção, bloqueios determinísticos, proteção de cartão, red teaming e escalonamento de casos sensíveis (SEG-01 a SEG-18; PLT-28/29/35).

### Inferences
- O melhor “produto mínimo” não é um chatbot genérico. É uma camada operacional orientada a eventos, com PMS como fonte de verdade, WhatsApp/e-mail como canais, portal web de chegada, fila humana e tarefas de unidade.
- O catálogo acerta ao marcar autonomia por ação. Respostas informativas podem começar em modo automático; acesso, cobrança, alteração de reserva, desconto, cancelamento e dados pessoais devem exigir regras determinísticas e/ou aprovação.
- A arquitetura futura deve ser multiunidade desde o modelo de dados, mas a experiência inicial deve permanecer simples: uma propriedade, poucos fluxos, poucas integrações e observabilidade desde o primeiro disparo.

### Gaps
- O arquivo não comprova os números agregados (43 plataformas, 1.437 registros, 368 funcionalidades) com uma planilha de auditoria ou critérios de deduplicação; tratá-los como **declaração do catálogo**, não como estudo independente.
- Muitas referências são páginas comerciais de fornecedores, e algumas URLs parecem genéricas, repetidas ou incompatíveis com a funcionalidade descrita; “Como os líderes fazem bem” é hipótese de design, não evidência comparativa.
- “MVP” é uma marcação preliminar; o próprio arquivo diz que o recorte efetivo está em outro relatório. Falta uma matriz de dependências, custo, risco, dono operacional, SLA, critérios de aceite e dados necessários.
- Faltam decisões locais: método real de acesso (cofre, fechadura, portaria), horários e cobertura humana, política de late check-in, internet, estacionamento, pets, café/cozinha/lavanderia, regras de cobrança/cancelamento, equipamentos instalados, limites da API do Simpleshotel/HSystem/Asaas e plano de contingência offline.
- Faltam métricas-baseline do Theotókos: volume de mensagens por reserva, taxa de conversão direta, no-show/cancelamento, tempo de resposta, incidentes de acesso, retrabalho de limpeza, avaliações por canal e custo de OTA.

## Evidência local, concorrência e canais públicos

### Takeaway
O melhor sinal público local é um inventário turístico regional que lista 12 meios de hospedagem em Piumhi, com capacidades e serviços. A oferta combina hotéis de 24–48 unidades e pousadas de 6–16 unidades; os atributos recorrentes são café da manhã, Wi-Fi e estacionamento. Há um concorrente com recepção 24 horas e outros com elevador/sauna, mas a fonte não mostra adoção de jornada digital, automação ou fechaduras inteligentes. [Circuito Turístico Nascentes das Gerais e Canastra, página “Hospedagem em Piumhi”, acesso em 08/11/2026: https://nascentesecanastra.com.br/hospedagem-piumhi/]

### Cited Findings
- A página regional lista: Serravita (34 unidades/70 leitos), Stalo (48/150), Belas Artes (31/61), Petaluma (38/50), Rib’s Comfort (36/70), Candidez (24/200), Villa da Serra (8/8), Bella Canastra (16/32), São Francisco (16/35), Luar da Canastra (6/12), Pérola Mineira (8/25) e Hostel Mundo Consciente (7/25). [Fonte: https://nascentesecanastra.com.br/hospedagem-piumhi/; acesso 08/11/2026.]
- Serviços recorrentes publicados: café da manhã, Wi-Fi e/ou estacionamento. Stalo publica sauna, elevador e estacionamento; Rib’s Comfort publica recepção 24 horas, elevador, refeitório e estacionamento; Villa da Serra destaca jardins para atividades ao ar livre. [Fonte: mesma fonte; acesso 08/11/2026.]
- A lista é um sinal de concorrência, não um censo atual: não informa data individual de atualização, ocupação, tarifas, avaliações, disponibilidade ou participação de OTAs. Alguns campos parecem inconsistentes — por exemplo, a capacidade de leitos do Hotel Candidez é muito superior à de outras propriedades — e devem ser confirmados diretamente.
- O circuito regional também lista 21 atrativos em Piumhi, incluindo Cachoeira da Belinha, Cachoeira do Nenzico, Mirantes da Onça e Belinha, fazendas/queijarias, trilhas, igrejas, Casa da Cultura, Pérola Negra Center e turismo de pesca no Rio Samburá. Vários funcionam “sob consulta” ou têm horários específicos. [Fonte: https://nascentesecanastra.com.br/atrativos-piumhi/; acesso 08/11/2026.]
- O portal local “Visite Piumhi” promove roteiros de queijo, cachoeiras e trilhas e exibe curadoria de Fazenda Bela Vista e Restaurante Rural Caminhos; a página mostra avaliações editoriais (por exemplo, 4,8 e 4,5), mas não informa metodologia ou volume de avaliações. Portanto, usar como inspiração de conteúdo/concierge, não como ranking de qualidade. [Fonte: https://visitepiumhi.com.br; acesso 08/11/2026.]
- A busca do Google Maps está disponível para hotéis e pousadas de Piumhi, mas a página é dinâmica e não expôs de forma estável nomes, notas e contagens no acesso automatizado. [Fontes de descoberta: https://www.google.com/maps/search/hot%C3%A9is+Piumhi+MG e https://www.google.com/maps/search/pousadas+Piumhi+MG; acesso 08/11/2026.]
- Booking.com apresentou desafio/redirect e não entregou uma lista confiável de Piumhi no acesso automatizado; Airbnb retornou “Over 1,000 stays”, claramente um resultado genérico que não deve ser interpretado como inventário local. [Fontes: https://www.booking.com/searchresults.pt-br.html?ss=Piumhi%2C%20Minas%20Gerais%2C%20Brasil e https://www.airbnb.com.br/s/Piumhi--MG/homes; acesso 08/11/2026.]
- A evidência pública de OTA é, portanto, principalmente de **descoberta e fricção de pesquisa**, não de preço/nota. Para decisões de paridade, tarifas, comissão e ranking, é necessário um levantamento manual datado com datas de hospedagem, ocupação, número de hóspedes e captura das páginas.

### Inferences
- O Theotókos entra num mercado em que o básico é relativamente padronizado (café, Wi-Fi, estacionamento). A diferenciação defensável pode ser apartamento funcional, autonomia de chegada, instruções claras, resposta rápida, confiabilidade do acesso e concierge local verificável.
- O conteúdo local deve ser operacionalizado como catálogo versionado: atração, distância/rota, horário, contato, necessidade de reserva, acessibilidade, clima e data da última confirmação. Não prometer disponibilidade de atrações “sob consulta”.
- Concorrentes maiores têm escala e amenidades; pousadas menores têm intimidade e simplicidade. O Theotókos pode combinar autonomia digital com hospitalidade humana sob demanda, sem tentar imitar recepção 24 horas de hotel maior.

### Gaps
- Não foi possível confirmar notas e temas de avaliações de hóspedes de Google/Booking/Tripadvisor por bloqueios, páginas dinâmicas ou ausência de resultados estáveis. Não atribuir aos concorrentes reclamações ou elogios sem coleta manual verificável.
- Não há fonte pública confiável, nesta rodada, para tarifas, ocupação, comissões de OTA, share de canal ou adoção tecnológica de cada concorrente.
- A página regional pode estar desatualizada; validar telefone, endereço, leitos, serviços e existência antes de usar em benchmarking ou no concierge.

## Princípios, prioridades e evidência de mercado

### Takeaway
A prioridade deve ser confiabilidade operacional mensurável, não amplitude de funcionalidades. A sequência recomendada é: (1) dados e segurança; (2) comunicação e chegada; (3) limpeza/manutenção; (4) vendas diretas e reputação; (5) inteligência avançada. Adoção de IA deve ser gradual, com modo sombra, aprovação, logs e fallback humano.

### Cited Findings
- O catálogo já define fases MVP (0–3 meses), F2 (3–9) e F3 (9–24), além de complexidade B/M/A; essa estrutura é útil, mas precisa ser convertida em backlog com dependências. [Evidência: arquivo local, legenda.]
- O próprio catálogo recomenda API-first, adaptadores para PMS/channel manager/pagamentos, menor privilégio, idempotência, trilha de auditoria, fonte oficial de conhecimento e bloqueios determinísticos. [Evidência: PLT-27/29/35, SEG-06/07/11, IA-19/23/24.]
- O Ministério do Turismo mantém página de notícias com conteúdo modificado em 06/11/2026, mas a página geral não fornece uma estatística específica de adoção tecnológica por hotéis brasileiros nesta coleta. [Fonte: https://www.gov.br/turismo/pt-br/assuntos/noticias; acesso 08/11/2026.]
- Não foi localizada, com evidência suficientemente específica e acessível nesta rodada, uma pesquisa nacional recente que quantifique a adoção de PMS, channel manager ou IA por pequenos meios de hospedagem brasileiros. Isso é uma lacuna de pesquisa, não evidência de baixa adoção.

### Inferences
- **Fase 0 — fundação (0–3 meses):** inventário de unidades e regras; modelo de reserva/hóspede; integração somente leitura com Simpleshotel; inbox WhatsApp/e-mail; respostas com base aprovada; escalonamento; logs; consentimento; painel de mensagens; mensagens de confirmação/pré-chegada; portal web básico; checklists de limpeza e vistoria.
- **Fase 1 — operação confiável (3–9 meses):** sincronização bidirecional controlada; FNRH/check-in digital conforme integração existente; pagamentos por link/Asaas sem armazenar cartão; códigos de acesso com validade; tarefas de manutenção; pesquisa pós-estadia; deduplicação; métricas de resposta, acesso, conversão e falhas.
- **Fase 2 — crescimento (9–24 meses):** channel manager e paridade de inventário; campanhas consentidas; motor de reserva/upsell; reputação; segmentação; múltiplas propriedades; supervisores de IA, roteamento de modelos e failover somente após volume e baseline.
- Princípio de segurança: “informar automaticamente, agir com aprovação, nunca improvisar” para dinheiro, acesso, identidade, cancelamento, descontos e dados pessoais.
- Indicadores de aceite sugeridos: tempo mediano de primeira resposta; porcentagem de mensagens resolvidas sem humano; taxa de escalonamento e reabertura; mensagens duplicadas; sucesso de check-in; falhas de acesso; tempo entre checkout e unidade liberada; tarefas reabertas; conversão direta; custo por reserva por canal; avaliação e reclamações; incidentes LGPD.

### Gaps
- A pesquisa pública não sustenta uma afirmação quantitativa sobre “adoção de tecnologia no Brasil”; qualquer justificativa de investimento deve usar baseline do Theotókos e fontes setoriais primárias obtidas em etapa específica.
- Ainda falta decidir se o produto será apenas ferramenta interna ou também portal/concierge visível ao hóspede, quem responde fora do horário, quais ações a IA pode executar e qual é o SLA de emergência.
- Antes do desenvolvimento, confirmar contratos/API, limites de rate, webhooks, autenticação e responsabilidades de Simpleshotel, HSystem, Asaas, WhatsApp e fornecedores de acesso.
- Suposições que devem permanecer explicitamente marcadas: **[Assunção]** equipe pequena e recepção não contínua; **[Assunção]** expansão 12→15→31; **[Assunção]** WhatsApp/e-mail são canais centrais; **[Evidência local]** oferta publicada de 12 hospedagens e serviços; **[Evidência não confirmada]** notas, preços, ocupação, comissões e adoção tecnológica dos concorrentes.
