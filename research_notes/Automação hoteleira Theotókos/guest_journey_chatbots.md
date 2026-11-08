# Automação hoteleira e jornada do hóspede para Theotókos

## Qual inventário de capacidades é comprovado nas plataformas líderes?

### Takeaway
Em 2025–2026, as plataformas líderes convergiram para uma arquitetura de “guest journey” que combina IA conversacional, caixa de entrada omnicanal, automação baseada em eventos do PMS/booking engine, check-in web, upsell contextual e handoff humano. Para um apart-hotel boutique de 12–31 unidades, o núcleo de maior retorno tende a ser: WhatsApp oficial + site, respostas de pré-venda 24/7, motor de reservas integrado, mensagens transacionais pré-chegada, coleta de horário de chegada, check-in digital opcional, solicitações durante a estada, checkout e pesquisa/reputação. Recursos avançados de voz, IoT e agentes autônomos são reais, mas devem ser tratados como fases posteriores e não como requisitos iniciais.

### Cited Findings
- A Meta define templates como o único tipo de mensagem que pode ser enviado fora da janela de atendimento ao cliente do WhatsApp; templates devem ser classificados como authentication, marketing ou utility e aprovados antes do envio. As mensagens podem conter texto, mídia, parâmetros e componentes interativos. [Meta, documentação consultada em 2026-11-08](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/) — **confiança alta; fonte primária**.
- A documentação da Meta informa que o hotel precisa fornecer strings e exemplos em cada idioma; a Meta não traduz os templates. Isso exige governança explícita de português brasileiro e, se necessário, inglês/espanhol. [Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/) — **alta**.
- Asksuite declara IA de reservas 24/7 em WhatsApp, site, Instagram e outros canais, respostas em 50+ idiomas, cotações em tempo real, compreensão de múltiplas perguntas na mesma mensagem, integração com 400+ booking engines e agentes AskFlow para abandono de reserva, promoções, pesquisas e mensagens de check-in/out. A página atual também informa 5.500+ hotéis em 80+ países e 98% de recomendação; são números declarados pelo próprio fornecedor e não devem ser tratados como auditoria independente. [Asksuite, página de produto/FAQ consultada em 2026-11-08](https://asksuite.com/) — **confiança média-alta para capacidades; média para métricas comerciais**.
- A Asksuite descreve handoff para agentes humanos, dashboards de desempenho e ROI, além de agentes especializados para tarefas ao longo da jornada. [Asksuite](https://asksuite.com/) — **média-alta; afirmação do fornecedor**.
- HiJiffy descreve um booking assistant 24/7 em site, redes sociais, WhatsApp e Facebook Messenger; responde FAQs, orienta a reserva no site, oferece campanhas personalizadas, integra booking engine/CRS/PMS, transfere para equipe quando solicitado ou quando não resolve, permite cotação personalizada e centraliza site, Messenger, Instagram, Telegram, Expedia, Booking.com, WhatsApp, SMS e e-mail. [HiJiffy, página oficial consultada em 2026-11-08](https://www.hijiffy.com/booking-assistant) — **confiança alta para capacidades declaradas; média para desempenho**.
- HiJiffy informa mais de 200 tópicos de FAQ hoteleira prontos, FAQs customizáveis e coleta de feedback para avaliar chatbot e agentes humanos. [HiJiffy](https://www.hijiffy.com/booking-assistant) — **alta/média**.
- Duve documenta check-in web sem download, com convite por e-mail, SMS ou WhatsApp, digitalização de documento, assinatura, coleta de pagamento, perguntas customizadas, horário/forma de chegada e upsell. O produto conecta dados ao PMS e permite configurar etapas por origem da reserva. [Duve, página oficial consultada em 2026-11-08](https://duve.com/contactless-online-check-in/) — **alta para capacidades; média para resultados**.
- Duve afirma integração direta com Mews, Opera Cloud, Cloudbeds, Guesty e Protel, além de dezenas via middleware; declara 150+ integrações, 3.450+ propriedades e presença em 96+ países. Esses números são vendor-reported. [Duve](https://duve.com/contactless-online-check-in/) — **média-alta para integrações listadas; média para escala**.
- Duve descreve uma experiência de “um link” que combina check-in, informações do quarto, upsells, mensagens, checkout e diretório digital, sem app store. Também declara que DuveAI responde em menos de um minuto e na língua do hóspede; tratar como alegação de produto a validar em demonstração. [Duve](https://duve.com/contactless-online-check-in/) — **média-alta**.
- Canary declara automação de mais de 80% da comunicação de hóspedes por sua AI Guest Messaging, com respostas a FAQs e upsell. A página lista marcas globais e posiciona a solução como integrada à operação hoteleira. [Canary Technologies, consultada em 2026-11-08](https://www.canarytechnologies.com/products/ai-guest-messaging) — **confiança alta para existência do recurso; média para percentual**.
- A Canary anunciou em fevereiro de 2025 uma plataforma de voz com virtual front desk, concierge, central de reservas e agente de booking. O anúncio é fonte corporativa republicada pela PR Newswire; é evidência de capacidade comercial anunciada, não prova de adequação a uma propriedade pequena. [PR Newswire, 2025](https://www.prnewswire.com/news-releases/canary-technologies-unveils-the-first-end-to-end-ai-voice-platform-built-for-hospitality-302368154.html) — **média-alta**.
- A pesquisa/relatório da Oracle Hospitality para 2025 é referência de mercado para a direção da indústria: automação, experiências sem atrito e personalização baseada em dados. O PDF deve ser usado como contexto setorial, não como benchmark específico de Piumhi. [Oracle Hospitality, relatório 2025](https://www.oracle.com/a/ocom/docs/industries/hospitality/hospitality-industry-trends-for-2025.pdf) — **confiança alta quanto à autoria; detalhes quantitativos devem ser extraídos do PDF original**.
- A EHL e a HospitalityNet descrevem a tendência de combinar IA com atendimento humano, personalização, mensageria omnicanal e automação operacional. [EHL Insights](https://insights.ehl.edu/technology-trends-hospitality-industry); [HospitalityNet, 2025](https://www.hospitalitynet.org/news/4125209/key-hospitality-technology-trends-to-watch-in-2025) — **média-alta; fontes setoriais**.

### Inferences
- O “mínimo moderno” não é apenas um chatbot FAQ: é um orquestrador ligado a disponibilidade/preço/reserva e a eventos da estadia. Para Theotókos, qualquer fornecedor que não mostre API ou integração comprovada com o PMS/booking engine atual deve ser considerado apenas canal de atendimento, não automação completa.
- Como o hotel tem 12–31 unidades, a melhor relação custo/complexidade provavelmente virá de uma solução de implantação rápida e configuração por regras, não de uma central de voz ou plataforma enterprise com grande custo fixo.
- A experiência deve ser web-first e WhatsApp-first; exigir download de aplicativo reduz adoção em estadias curtas e em hóspedes que chegam por OTA. Um link web persistente pode concentrar check-in, orientações, serviços e checkout.
- As ofertas devem ser contextuais e limitadas: early check-in, late checkout, upgrade, café/kit, estacionamento, traslado, experiências locais e serviços para famílias/casais. A regra deve consultar disponibilidade e capacidade operacional antes de vender.

### Gaps
- Não encontrei, em fontes públicas confiáveis, preços comparáveis para uma propriedade brasileira de 12–31 unidades. Solicitar proposta com custos de implantação, mensagens WhatsApp, usuários, integrações, volume, suporte e cancelamento.
- As páginas de fornecedores não comprovam por si só desempenho em português brasileiro, latência no interior de Minas Gerais, cobertura de um PMS específico ou qualidade do handoff. Exigir piloto e referências brasileiras.
- Não há base pública suficiente para afirmar qual plataforma é “melhor” sem conhecer PMS, booking engine, política de pagamento, escala de equipe e canais atuais.

## Como mapear capacidades por etapa da jornada?

### Takeaway
A automação deve ser desenhada como uma máquina de estados orientada por reserva: visitante anônimo → lead → reserva confirmada → pré-chegada → chegada/check-in → hóspede em casa → checkout → pós-estada. Cada etapa precisa de gatilhos, dados permitidos, mensagem principal, ação operacional, SLA e critério de escalada. A IA deve responder somente a partir de uma base de conhecimento versionada e de dados transacionais autorizados.

### Cited Findings
- A Meta diferencia templates utility, marketing e authentication e limita mensagens fora da janela de atendimento. Isso é diretamente aplicável a confirmação de reserva, lembrete de chegada, link de check-in, cobrança/recibo e pesquisa pós-estada. [Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/) — **alta**.
- HiJiffy documenta cotações, FAQ, booking engine, canais múltiplos, handoff, feedback e workflows acionados ao longo do booking. [HiJiffy](https://www.hijiffy.com/booking-assistant) — **alta**.
- Asksuite documenta agentes para carrinho/booking abandonment, promoções personalizadas, pesquisas, check-in/out e follow-ups. [Asksuite](https://asksuite.com/) — **alta para capacidade declarada**.
- Duve documenta coleta de horário e modo de chegada, perfil pré-check-in, perguntas customizadas, upsell, pagamentos e sincronização bidirecional com PMS. [Duve](https://duve.com/contactless-online-check-in/) — **alta**.

### Inferences
**Inventário funcional recomendado para Theotókos:**

1. **Pré-reserva**
   - Responder instantaneamente: disponibilidade, tarifa, número de hóspedes, regras para crianças/pets, estacionamento, acessibilidade, cozinha, internet, horários, localização e política de cancelamento.
   - Capturar datas, número de hóspedes, propósito da viagem, idioma, canal de origem e consentimento de contato.
   - Gerar cotação ou deep link para o booking engine; nunca confirmar disponibilidade por memória.
   - Detectar intenção de alta probabilidade: “quero reservar”, “tem vaga”, “quanto fica”, “é perto da Serra da Canastra?”.

2. **Booking**
   - Confirmar reserva, categoria, datas, hóspedes, tarifa, política, pagamento e contato de suporte.
   - Enviar template utility aprovado; registrar ID da mensagem e status de entrega.
   - Perguntar preferências não sensíveis: horário estimado, berço, cama, motivo da viagem, restrições alimentares apenas se necessário e com cuidado.

3. **Pré-chegada (idealmente 3–7 dias antes, ajustado ao ciclo de reserva)**
   - Enviar mapa/link, estacionamento, instruções de acesso, previsão de chegada, regras essenciais, previsão do tempo somente se houver fonte confiável e recomendações locais.
   - Oferecer early check-in, transporte, upgrade, café/kit e experiências; ocultar oferta sem inventário.
   - Abrir check-in digital quando o processo legal/operacional estiver validado; captar horário e modo de chegada.
   - Se a chegada for fora do horário da recepção, acionar fluxo específico com instruções e plantão humano.

4. **Chegada/check-in**
   - Confirmar que documentação, pagamento e cadastro estão completos; fornecer instruções de acesso somente após condições de segurança e pagamento.
   - Nunca expor código/chave em canal errado ou antes de validação. Para unidades sem fechadura inteligente, usar mensagens operacionais e confirmação humana.
   - Detectar “não consigo entrar”, “a porta não abre”, “cheguei e ninguém atende” como prioridade alta, com escalada imediata.

5. **Estada**
   - Menu de ações estruturadas: toalhas, limpeza, manutenção, Wi-Fi, ar-condicionado, ruído, estacionamento, itens esquecidos, recomendação de restaurante/atrativo, extensão da estadia.
   - Cada pedido vira tarefa com unidade, hóspede, prioridade, responsável, horário prometido, estado e confirmação de conclusão.
   - Responder em português brasileiro por padrão; preservar idioma preferido do hóspede. Oferecer inglês/espanhol quando detectado, mas não confundir tradução com conhecimento local.
   - Usar personalização simples: casal/família, duração, horário de chegada, unidade, histórico de preferências e serviços já comprados.

6. **Checkout**
   - Lembrar horário, instruções, devolução de chave, consumo/pagamento e possibilidade de late checkout se houver disponibilidade.
   - Enviar recibo ou link seguro; nunca solicitar cartão completo no chat.
   - Confirmar saída e abrir tarefa de limpeza/manutenção para a unidade.

7. **Pós-estada**
   - Agradecer, pedir avaliação em janela adequada, solicitar feedback privado antes de review público quando isso fizer sentido e oferecer rebooking/benefício futuro somente com base legal para marketing.
   - Separar reclamação urgente de feedback comum; tickets negativos devem entrar em fila de recuperação de serviço.
   - Atualizar perfil com consentimento e retenção limitada; não construir “perfil sensível” desnecessário.

8. **Idioma e acessibilidade**
   - Idiomas prioritários: pt-BR obrigatório; inglês e espanhol como segunda camada, a validar por demanda. A complexidade deve ser centralizada em templates e glossário de nomes locais.
   - Oferecer mensagens curtas, botões e links; evitar depender de áudio ou texto longo. Disponibilizar humano para baixa confiança linguística.

9. **Métricas**
   - Funil: tempo de primeira resposta, leads atendidos fora do horário, cotação→reserva, abandono recuperado, reserva direta, custo por reserva, OTA displacement, taxa de leitura e entrega WhatsApp.
   - Operação: resolução automática, escalada, tempo até primeira ação humana, SLA de manutenção, tarefas reabertas, no-show, check-in digital concluído.
   - Experiência: CSAT por etapa, sentimento antes/depois, reclamações repetidas, reviews, nota média, menções a check-in/limpeza/ruído.
   - Finanças: receita incremental de upsell, margem após custo de canal, comissão OTA evitada, custo de mensagens e horas economizadas.

### Gaps
- Não há evidência pública de que toda plataforma ofereça detecção de sentimento em tempo real com explicabilidade e português brasileiro. Tratar “sentiment analysis” como item de validação, não como pressuposto.
- As fontes de fornecedor não especificam, de forma consistente, limites de retenção, exportação/exclusão, localização dos dados, suboperadores ou uso para treinamento de modelos. Isso precisa entrar no due diligence contratual.

## Qual comparação de plataformas é mais útil para uma pequena propriedade no Brasil?

### Takeaway
A escolha deve ser feita por “fit de operação”, não por número de idiomas ou marketing. Asksuite aparece mais orientada à venda direta e reservas omnicanal; HiJiffy à automação de booking/FAQ e jornada; Duve a check-in, guest app, dados de chegada e upsell; Canary à automação ampla de mensagens, check-in e, em escala maior, voz. Bookboost/CRM e Quicktext/Quinta podem ser considerados quando CRM/estrutura de dados forem prioridade, mas as informações públicas comparáveis são menos uniformes.

### Cited Findings
- Asksuite: 50+ idiomas, booking assistant, 400+ integrações de booking engine, WhatsApp/site/Instagram, agentes de carrinho abandonado, pesquisas e check-in/out. [Asksuite](https://asksuite.com/) — **alta para features declaradas**.
- HiJiffy: web/social/messaging/OTA, cotação, booking engine/CRS/PMS, handoff, FAQ customizável, feedback e workflows. [HiJiffy](https://www.hijiffy.com/booking-assistant) — **alta**.
- Duve: check-in web, ID, e-signature, pagamentos, chegada, perfis, guest app, WhatsApp/SMS/e-mail/OTA, PMS e upsell. [Duve](https://duve.com/contactless-online-check-in/) — **alta**.
- Canary: mais de 80% de automação declarada em comunicação, AI Guest Messaging, digital check-in e plataforma de voz lançada em 2025. [Canary](https://www.canarytechnologies.com/products/ai-guest-messaging); [PR Newswire, 2025](https://www.prnewswire.com/news-releases/canary-technologies-unveils-the-first-end-to-end-ai-voice-platform-built-for-hospitality-302368154.html) — **média-alta**.
- Comparativos de mercado de 2025–2026 frequentemente posicionam Asksuite como reservation-sales, HiJiffy como guest-journey, Bookboost como CRM/mensageria e Quicktext/Quinta como camada estruturada de dados; esses comparativos são úteis para hipótese inicial, mas devem ser confirmados com demonstrações e contratos. [Hotel Tech Report – comparação](https://hoteltechreport.com/compare/asksuite-hotel-chatbot-vs-bookboost-crm-vs-hijiffy-hotel-chatbot) — **média; fonte secundária**.

### Inferences
**Matriz preliminar de adequação:**

| Critério | Asksuite | HiJiffy | Duve | Canary |
|---|---|---|---|---|
| Venda direta e cotação | Muito forte | Forte | Dependente da integração/fluxo | Forte, mas validar fit local |
| WhatsApp e omnicanal | Forte | Forte e amplo | Forte | Forte |
| FAQ/jornada | Forte | Muito forte | Forte quando ligado ao guest app | Forte |
| Check-in digital e dados de chegada | Validar profundidade do parceiro | Validar | Muito forte | Forte |
| Upsell contextual | Forte | Forte | Muito forte | Forte |
| Pequeno apart-hotel | Potencialmente bom se custo mínimo for baixo | Potencialmente bom | Bom se check-in/upsell forem prioridade | Validar custo e escala |
| Voz/central de reservas | Não é o primeiro diferencial | Não é o primeiro diferencial | Não é o primeiro diferencial | Diferencial, mas provavelmente fase posterior |

**Shortlist prática:**
- Se o problema primário for perder leads e reservas no WhatsApp/site: iniciar avaliação de Asksuite e HiJiffy.
- Se o problema primário for chegada sem recepção, cadastro, pagamentos, acesso e upsell: avaliar Duve primeiro, junto do PMS.
- Se houver volume relevante de ligações e operação 24/7 no futuro: avaliar Canary, mas não assumir que sua escala/preço é adequada.
- Se a prioridade for CRM e campanhas de relacionamento pós-estada, incluir Bookboost ou módulo CRM do fornecedor escolhido, sem duplicar base de hóspedes.

**Roteiro de prova de conceito (2–4 semanas):**
1. Conectar somente uma unidade/categoria ou ambiente de teste; não migrar todo o histórico.
2. Carregar 100–150 FAQs em pt-BR, 20–30 intents transacionais e políticas reais.
3. Testar 50 conversas anônimas de pré-venda, 20 reservas, 20 pré-chegadas, 20 solicitações de estada e 10 reclamações.
4. Medir respostas corretas, alucinações, escaladas, tempo de handoff, preço/disponibilidade, entrega de templates e esforço da equipe.
5. Exigir exportação de logs, contatos, consentimentos e tarefas; testar exclusão de um hóspede.
6. Só depois ativar mensagens proativas e upsell para hóspedes reais.

### Gaps
- Preços, SLAs, taxas Meta, disponibilidade de suporte em português, cobertura do PMS e termos LGPD não aparecem de forma pública e comparável.
- Dados de “98% recomendado”, “23x ROI”, “80% automatizado” e similares são declarações de fornecedores; não devem compor o business case sem dados da própria Theotókos.

## Quais controles de LGPD, WhatsApp, segurança e escalada são necessários?

### Takeaway
O hotel deve separar mensagens necessárias à execução da reserva/estada de marketing e reativação. WhatsApp exige templates e governança próprios; o consentimento para marketing não deve ser presumido a partir de uma reserva. A IA deve ter limites operacionais, registro de decisões, baixa confiança → humano, e escalada imediata para segurança, cobrança, acesso, saúde, discriminação, ameaça, perda de objeto e reclamação grave.

### Cited Findings
- A Meta estabelece templates aprovados para mensagens fora da janela de atendimento, categorias utility/marketing/authentication, parâmetros por idioma e status de aprovação/qualidade. [Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/) — **alta; primária**.
- A LGPD aplica-se ao tratamento de dados pessoais por hotéis; a base legal deve ser definida por finalidade. Para reserva e suporte, execução de contrato pode ser relevante; para promoções e reengajamento, consentimento ou outra base adequada deve ser analisada pelo jurídico/DPO. Referência legal primária: [Lei 13.709/2018 – Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) — **alta**.
- A ANPD publicou regulamentações e agenda sobre temas de proteção de dados e segurança; a equipe deve consultar a versão vigente diretamente no portal oficial, pois regras e calendários podem mudar. [ANPD – documentos e publicações](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes) — **alta para fonte; não inferir requisitos específicos sem norma aplicável**.
- A Resolução CD/ANPD nº 15/2024 trata de comunicação de incidente de segurança e deve ser revisada com jurídico/DPO para prazos e requisitos aplicáveis. [ANPD, Resolução CD/ANPD nº 15/2024](https://www.gov.br/anpd/pt-br/assuntos/legislacao/resolucoes) — **alta para fonte oficial; validar versão consolidada**.

### Inferences
**Mínimo de governança:**
- Inventário de dados: nome, telefone, reserva, datas, unidade, documento, pagamento, preferências e mensagens.
- Finalidade e base legal por campo; minimizar coleta no chat.
- Opt-in separado para WhatsApp marketing, e-mail marketing e mensagens transacionais quando aplicável; registrar timestamp, origem, versão do texto e revogação.
- Link para aviso de privacidade em pt-BR, contato do controlador/encarregado e mecanismo de direitos do titular.
- Não pedir cartão completo, senha, documento por chat aberto ou dados sensíveis sem fluxo seguro e necessidade demonstrada.
- Retenção limitada; exportação, correção, exclusão/anonymização e trilha de auditoria.
- Contrato com fornecedor: controlador/operador, suboperadores, transferência internacional, hospedagem, segurança, incidentes, exclusão ao término, uso para treinamento e propriedade dos logs.
- Handoff com contexto, não com exposição excessiva: resumo, reserva, unidade, última mensagem, emoção/urgência e ação sugerida.
- Sentimento é sinal de roteamento, não diagnóstico. “Irritado” pode ser falso positivo; regras determinísticas devem prevalecer para segurança e acesso.

**Escalada em níveis:**
- P0 imediato: risco físico, incêndio, invasão, pessoa presa, vazamento grave, ameaça, discriminação, emergência médica.
- P1 em minutos: hóspede sem acesso, cobrança indevida, overbooking, unidade sem condições, falha de água/energia, segurança.
- P2 no SLA do turno: manutenção, limpeza, amenidades, informação incompleta.
- P3 automatizável: FAQ, localização, horários, regras públicas, recomendações curadas.

### Gaps
- A busca não encontrou uma orientação ANPD específica para chatbots hoteleiros/WhatsApp que substitua análise jurídica. Não usar blogs de fornecedores como autoridade legal.
- A precisão “92–96%” de sentimento encontrada em resultados secundários não tem validação robusta específica para português brasileiro e hotelaria; não foi incluída como fato.
- Prazos de incidentes devem ser confirmados na resolução vigente e no plano de resposta da organização; não assumir prazos de artigos não oficiais.

## Qual é a recomendação de implementação para Theotókos em Piumhi MG?

### Takeaway
Piumhi tem contexto turístico favorável, com reconhecimento oficial como Município Turístico e conexão com a região Nascentes das Gerais e Canastra. A recomendação é uma implantação em camadas: primeiro pré-venda e WhatsApp transacional, depois pré-chegada/check-in e tarefas operacionais, e só então personalização/upsell/sentimento/voz. O sistema deve conhecer a realidade local (Serra da Canastra, Lago de Furnas, gastronomia, deslocamentos, condições de estrada e horários), mas recomendar apenas parceiros e informações mantidos pelo hotel.

### Cited Findings
- A Prefeitura de Piumhi informa que o município foi habilitado pela primeira vez na categoria Município Turístico, com validade da certificação até 18 de junho de 2027, e o posiciona como referência da região turística Nascentes das Gerais e Canastra, composta por 17 municípios. [Prefeitura de Piumhi, publicação consultada em 2026-11-08](https://prefeiturapiumhi.mg.gov.br/piumhi-alcanca-marco-historico-e-passa-a-integrar-a-categoria-municipio-turistico-do-mapa-do-turismo-brasileiro/) — **confiança alta; fonte municipal**.
- O portal municipal mantém arquivo de turismo e divulga monitoramento de movimentação turística/hoteleira; números de visitantes e ocupação devem ser usados apenas quando acompanhados da publicação original e período. [Prefeitura de Piumhi – Turismo](https://prefeiturapiumhi.mg.gov.br/setores/turismo/) — **alta para existência do arquivo; média para cada métrica individual**.
- O IBGE oferece panorama demográfico/econômico de Piumhi, útil para contextualização, mas não substitui dados internos de hóspedes, origem, duração e sazonalidade. [IBGE Cidades – Piumhi](https://cidades.ibge.gov.br/brasil/mg/piumhi/panorama) — **alta**.

### Inferences
**Fase 0 — fundação (1–2 semanas)**
- Escolher PMS, booking engine, provedor WhatsApp Business Platform e inbox.
- Consolidar FAQ versionada: unidades, fotos, metragem, cozinha, camas, estacionamento, pet, acessibilidade, horários, silêncio, política, pagamento, cancelamento e endereço.
- Criar matriz de verdade: dado, fonte, responsável, validade, canal e data de revisão.
- Definir voz Theotókos: acolhedora, objetiva, mineira sem caricatura; sempre declarar “sou assistente virtual” e oferecer equipe.

**Fase 1 — receita (2–4 semanas)**
- Ativar widget no site e WhatsApp para pré-reserva, cotação e link de reserva.
- Templates utility de confirmação, alteração, lembrete e check-in; marketing separado.
- Medir baseline por 30 dias: mensagens, tempo de resposta, reservas diretas, abandono, OTA, horários de pico.

**Fase 2 — chegada e operação (3–6 semanas)**
- Pré-chegada com horário de chegada, estacionamento, localização, acesso e opções de early check-in.
- Check-in digital somente se houver processo jurídico/operacional seguro; para unidades sem fechadura inteligente, usar confirmação humana.
- Pedidos estruturados ligados a tarefas e SLA; painel de plantão fora do horário.

**Fase 3 — receita incremental e lealdade (após 60–90 dias)**
- Upsell de late checkout, upgrade, kits, experiências e parcerias locais, condicionado a estoque/capacidade.
- Pesquisa pós-estada, recuperação de serviço e rebooking com consentimento.
- Segmentação simples e explicável, sem criar dados sensíveis.

**Fase 4 — IA avançada (somente após baseline)**
- Sentimento para priorização, classificação de intenção, resumo de conversa, recomendações e voz.
- Testes de precisão pt-BR, falsos negativos, viés contra sotaques/erros de digitação e impacto no SLA.
- Nunca permitir que o modelo conceda desconto, altere reserva, libere acesso ou responda incidente sem política e autorização.

**Base de conhecimento local para Piumhi/Canastra:**
- Atrativos e como chegar: somente links/horários verificados pelo hotel.
- Recomendações por perfil: família, casal, aventura, gastronomia, trabalho e estadias longas.
- Mensagens de segurança: chuva, estrada, estacionamento, horário de chegada e telefones oficiais.
- Parceiros com disponibilidade e comissão claramente documentadas; revelar quando uma recomendação é patrocinada.

**KPIs de decisão após 90 dias:**
- + conversão de lead para reserva direta; - tempo de resposta fora do horário; % de consultas resolvidas sem humano; % de handoff correto; conclusão do pré-check-in; tarefas dentro do SLA; receita de upsell por estadia; CSAT/NPS por etapa; reclamações e reviews; custo total por reserva.
- Critério de sucesso prudente: melhoria contra baseline da própria Theotókos, não copiar números de vendors ou redes globais.

### Gaps
- Não há dados públicos suficientes para segmentar hóspedes de Piumhi por nacionalidade, idioma, duração ou intenção. Capturar esses dados de forma voluntária e minimizada nos primeiros 90 dias.
- Não foi informado qual PMS, channel manager, booking engine, fechadura, gateway de pagamento ou equipe de plantão a Theotókos usa. Essas variáveis podem alterar completamente a escolha do fornecedor.
- A certificação turística municipal indica oportunidade, mas não prova demanda para qualquer upsell ou idioma; validar com dados reais de reservas.

## Fontes prioritárias e data de corte

### Takeaway
As fontes primárias dos fornecedores e da Meta sustentam capacidades técnicas; estudos de caso e fontes setoriais sustentam plausibilidade de impacto, mas frequentemente são autorrelatos. Para decisões de compra, separar claramente “capacidade documentada”, “resultado relatado” e “resultado esperado/inferido”. Pesquisa executada em 2026-11-08, com ênfase em material publicado/atualizado entre 2024 e 2026.

### Cited Findings
- Meta WhatsApp Templates — documentação técnica primária, consultada em 2026-11-08: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md/
- Asksuite — produto/FAQ e métricas declaradas, consultado em 2026-11-08: https://asksuite.com/
- HiJiffy Booking Assistant — produto e integrações, consultado em 2026-11-08: https://www.hijiffy.com/booking-assistant
- Duve Online Check-in — produto, integrações e claims de resultado, consultado em 2026-11-08: https://duve.com/contactless-online-check-in/
- Canary AI Guest Messaging — produto, consultado em 2026-11-08: https://www.canarytechnologies.com/products/ai-guest-messaging
- Canary AI Voice announcement, fevereiro de 2025: https://www.prnewswire.com/news-releases/canary-technologies-unveils-the-first-end-to-end-ai-voice-platform-built-for-hospitality-302368154.html
- Oracle Hospitality industry trends 2025: https://www.oracle.com/a/ocom/docs/industries/hospitality/hospitality-industry-trends-for-2025.pdf
- EHL hospitality technology trends: https://insights.ehl.edu/technology-trends-hospitality-industry
- HospitalityNet 2025 trends: https://www.hospitalitynet.org/news/4125209/key-hospitality-technology-trends-to-watch-in-2025
- Hotel Tech Report comparative pages: https://hoteltechreport.com/compare/asksuite-hotel-chatbot-vs-bookboost-crm-vs-hijiffy-hotel-chatbot
- Lei Geral de Proteção de Dados, Planalto: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- ANPD legislation/publications: https://www.gov.br/anpd/pt-br/assuntos/legislacao/resolucoes ; https://www.gov.br/anpd/pt-br/documentos-e-publicacoes
- Prefeitura de Piumhi, Município Turístico: https://prefeiturapiumhi.mg.gov.br/piumhi-alcanca-marco-historico-e-passa-a-integrar-a-categoria-municipio-turistico-do-mapa-do-turismo-brasileiro/
- Prefeitura de Piumhi, arquivo de turismo: https://prefeiturapiumhi.mg.gov.br/setores/turismo/
- IBGE Piumhi: https://cidades.ibge.gov.br/brasil/mg/piumhi/panorama

### Inferences
- Para uma compra segura, solicitar demos gravadas ou ao vivo usando exatamente os 50 cenários de teste da Theotókos, contrato/DPA, lista de integrações brasileiras e exportação de logs.
- A fonte primária deve prevalecer para requisitos técnicos e legais; case studies devem ser tratados como evidência direcional; números de ROI e automação precisam de replicação local.

### Gaps
- O material público não permitiu verificar preços, termos contratuais, residência de dados, suporte pt-BR, cobertura exata do PMS ou referências de propriedades de 12–31 unidades em Minas Gerais. Esses pontos permanecem como due diligence obrigatória.
