# Multilingual Portuguese failure modes and localization for hotel automation

## Evidence base and interpretation

### Facts

- The strongest directly relevant public NLU benchmark located is MASSIVE, which contains 1M parallel virtual-assistant utterances across 51 languages, 18 domains, 60 intents, and 55 slots; it reports intent accuracy, slot-filling F1, and exact match, and its non-English data were localized from English by professional translators. [ACL Anthology: MASSIVE](https://aclanthology.org/2023.acl-long.235/)
- MASSIVE is therefore useful for testing transfer, intent, and slot extraction, but its parallel/localized design should not be treated as a substitute for organically collected Brazilian hotel conversations; that limitation is an inference from the dataset construction described by the authors. [ACL Anthology: MASSIVE](https://aclanthology.org/2023.acl-long.235/)
- P3B3 is an ACL 2026 workshop benchmark for multi-turn conversations that measures preference and controllability across European Portuguese (pt-PT) and Brazilian Portuguese (pt-BR). Its abstract reports that most tested LLMs showed a strong pt-BR bias and that controllability varied by model. [arXiv: P3B3](https://arxiv.org/abs/2606.16753)
- The existence of a measurable pt-BR/pt-PT bias means that “Portuguese” is not a sufficiently precise product requirement when locale, vocabulary, pronouns, or service register matter. This is a recommendation derived from P3B3, not a claim that every deployed model has the same bias. [arXiv: P3B3](https://arxiv.org/abs/2606.16753)
- A 2025 VarDial study provides an information-theoretic analysis of lexical, grammatical, and syntactic variation between Brazilian and European Portuguese, supporting the use of explicit variety labels in evaluation rather than treating Portuguese as homogeneous. [VarDial 2025](https://aclanthology.org/2025.vardial-1.2/)
- Research on polite customer-care generation has built multilingual conversational data and baselines that explicitly model courteousness and empathy; its experiments used English and Hindi, not Portuguese, so transfer to pt-BR is a hypothesis requiring testing. [LREC 2020](https://aclanthology.org/2020.lrec-1.514/)
- A Brazilian-Portuguese service-encounter study examines requests in settings such as shops and banks and treats indirectness, mitigation, and forms of address as politeness resources. [RCAAP record](https://www.rcaap.pt/detail.jsp?id=oai:repositorio.ufsc.br:123456789/75418)
- A Brazilian-Portuguese user-generated-content normalizer has been published for tokenization, segmentation, and phonetic spelling correction, demonstrating that informal/noisy text is a distinct engineering problem rather than only a language-model prompt issue. [UGC normalizer paper](https://www.aclweb.org/anthology/W15-4305.pdf)
- CorSpell is a 2026 semiautomatic spelling-normalization tool for Brazilian Portuguese, developed with the CorCel corpus of handwritten Celpe-Bras responses and human validation; it is evidence for human-in-the-loop normalization, not evidence that automatic correction is safe for names, addresses, or payment identifiers. [LREC 2026: CorSpell](https://aclanthology.org/2026.lrec-1.130/)
- Major speech providers document pt-BR as a locale, but their feature matrices differ. Google Cloud lists `pt-BR` and `pt-PT` separately and documents feature availability by model and locale, including punctuation, diarization, adaptation, and confidence features. [Google Cloud Speech languages](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages)
- Azure Speech documents `pt-BR` and `pt-PT` separately and states that support varies by feature, including real-time, batch, multilingual post-processing, custom speech, translation, and voices. [Microsoft Azure language support](https://learn.microsoft.com/pt-br/azure/ai-services/speech-service/language-support)
- Amazon Transcribe’s supported-language table distinguishes batch and streaming support and separately lists language-specific features such as numbers, custom language models, redaction, and Call Analytics; the relevant row must be checked before assuming a pt-BR capability is available in every mode. [Amazon Transcribe supported languages](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html)
- OpenAI’s multilingual-text guidance says models can accept and generate multiple languages and recommends keeping prompts consistent in one language when consistency matters; this is a provider recommendation, not a quality guarantee for pt-BR hotel terminology. [OpenAI multilingual text](https://help.openai.com/en/articles/6742369-how-can-i-use-the-openai-api-with-text-in-different-languages)
- Rasa documents entity extractors and supports custom NLU components, but typo correction, fuzzy matching, and language-specific normalization generally require pipeline design rather than assuming a universal built-in spell checker. [Rasa entity extractors](https://rasa.com/docs/rasa/components/#entity-extractors)
- Brazil’s Disability Inclusion Law establishes rights and accessibility duties, while Decree 9.296/2018 regulates accessibility requirements for hotels, inns, and similar lodging facilities; these are primary legal sources for accessibility-sensitive automation. [Law 13.146/2015](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm); [Decree 9.296/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9296.htm)

### Recommendations

- Keep `pt-BR` and `pt-PT` as separate locale configurations, with separate lexicons, examples, voices, date/number tests, and generation evaluations.
- Treat benchmark scores as component evidence. Require an organically collected, consented, de-identified hotel test set containing Brazilian regional variation, conversational repair, code-switching, typos, voice transcripts, and real names/addresses represented by synthetic or protected test fixtures.
- Use a two-stage design for risky entities: preserve the user’s original string, normalize only for search/display, and confirm before committing a reservation, cancellation, payment, or guest identity change.

## Failure modes to test

### Ambiguity and intent boundaries

- **Fact:** MASSIVE evaluates intent classification and slot filling separately, which makes it possible to measure whether a system chose the right workflow while also measuring whether it extracted dates, locations, and names correctly. [MASSIVE](https://aclanthology.org/2023.acl-long.235/)
- **Recommendation:** Test minimal pairs where one expression changes the business action: “quero cancelar” versus “quero alterar”, “chego tarde” versus “vou chegar depois do horário”, “pode segurar a reserva?” versus “não vou mais”. Require abstention or clarification when policy-critical fields are missing.
- **Proposed tests:** multi-intent utterances (“vou chegar tarde e preciso de berço”), elliptical answers (“à noite”, “a mesma do mês passado”), scope ambiguity (“cancelar a diária de sábado”), and negation (“não quero cancelar”). Score intent, slot spans, policy decision, and clarification quality separately.

### Dialect, variety, and register

- **Fact:** P3B3 reports measurable model bias between pt-BR and pt-PT and evaluates controllability across varieties. [P3B3](https://arxiv.org/abs/2606.16753)
- **Recommendation:** Build locale-specific tests using Brazilian vocabulary and pronoun/register choices, and include speakers from multiple Brazilian regions; do not score a pt-PT paraphrase as equivalent if it is operationally confusing or violates brand voice.
- **Proposed tests:** “ônibus”/“autocarro”, “celular”/“telemóvel”, “quarto”/“câmara” where relevant, “você”/“tu”, formal and informal greetings, and guest messages mixing regional colloquialisms with standard Portuguese. Test both understanding and generated wording.

### Names, addresses, dates, and identifiers

- **Fact:** MASSIVE includes slots such as names, dates, and locations in a multilingual virtual-assistant setting. [MASSIVE](https://aclanthology.org/2023.acl-long.235/)
- **Recommendation:** Names and addresses should be losslessly captured before any normalization. Never run generic spelling correction over a guest name, street, apartment number, postal code, reservation code, PIX key, card last four digits, or phone number.
- **Proposed tests:** diacritics (João, Érica), compound surnames, repeated surnames, apostrophes/hyphens, all-caps forms, homophones, “nº”/“numero”, block/apartment complements, CEP with and without punctuation, spoken digit groups, and a guest correcting the agent (“não é Silva, é Sylva”). Measure character error rate and exact-field preservation, not only semantic similarity.
- **Operational safeguard:** Display the captured value and request explicit confirmation before mutation; maintain the original transcript and the normalized lookup value as separate fields.

### Code-switching and foreign hotel vocabulary

- **Fact:** The public multilingual politeness benchmark found in this review used English and Hindi, while P3B3 focuses on Portuguese variety, so neither directly establishes performance on pt-BR/English hotel code-switching. [LREC 2020](https://aclanthology.org/2020.lrec-1.514/); [P3B3](https://arxiv.org/abs/2606.16753)
- **Recommendation:** Treat code-switching as an explicit test dimension rather than assuming multilingual support implies robust mixed-language handling.
- **Proposed tests:** “late check-in”, “early check-out”, “king size”, “upgrade”, “no-show”, “walk-in”, “pet friendly”, “room service”, and brand/PMS names embedded in Portuguese. Test intent and entity extraction before and after ASR, plus generated replies that preserve the hotel’s preferred terminology.

### Spelling, accents, chat abbreviations, and ASR noise

- **Fact:** Brazilian-Portuguese normalization research includes phonetic spelling correction and human validation, showing that UGC noise and correction quality are established research targets. [UGC normalizer](https://www.aclweb.org/anthology/W15-4305.pdf); [CorSpell](https://aclanthology.org/2026.lrec-1.130/)
- **Recommendation:** Normalize for retrieval/classification only after retaining the raw input; make corrections reversible and confidence-aware. Do not silently “fix” a token that could be a proper name or identifier.
- **Proposed tests:** missing accents (“hospede”, “voce”), keyboard substitutions, repeated letters, omitted spaces, WhatsApp shorthand (“qto”, “pq”, “obg”), punctuation-free messages, emoji, voice transcription errors, background noise, and numbers spoken in Brazilian grouping. Report intent accuracy, slot exact match, correction precision, and dangerous false corrections.

### Politeness, empathy, and complaint handling

- **Fact:** Research on customer-care generation explicitly evaluates courteousness and empathy, and Brazilian-Portuguese service-encounter research identifies mitigation and indirectness as relevant request strategies. [LREC 2020](https://aclanthology.org/2020.lrec-1.514/); [Brazilian-Portuguese service requests](https://www.rcaap.pt/detail.jsp?id=oai:repositorio.ufsc.br:123456789/75418)
- **Recommendation:** Evaluate pragmatic appropriateness separately from grammaticality. A response can be linguistically correct yet too blunt, patronizing, evasive, or falsely reassuring for a Brazilian guest.
- **Proposed tests:** direct versus mitigated requests, anger without profanity, repeated complaints, apology plus remediation, refusal of an unavailable request, accessibility requests, and urgency markers. Use trained Brazilian reviewers with a rubric for respect, clarity, accountability, and escalation—not only BLEU/ROUGE or generic preference.

### Localization, numbers, currency, and policy language

- **Fact:** Provider documentation lists locale-specific support and feature differences for `pt-BR`, so locale selection is a configuration decision rather than a cosmetic label. [Google Cloud](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages); [Azure](https://learn.microsoft.com/pt-br/azure/ai-services/speech-service/language-support); [Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html)
- **Recommendation:** Test Brazilian date order, 24-hour times, decimal comma, thousands separator, R$, installments, PIX/card vocabulary, phone numbers, CEP, and local address components end to end. Store canonical machine values separately from localized display text.
- **Proposed tests:** “10/11” with missing year, “meia-noite”, “às 00:30”, “R$ 1.234,56”, “1.234,56” versus “1,234.56”, “12 parcelas”, cancellation deadlines crossing midnight, and time-zone transitions. Require the system to restate interpreted values before taking irreversible action.

## Hotel scenario matrix

| Scenario | High-risk pt-BR ambiguity/noise | Required behavior | Minimum tests |
|---|---|---|---|
| Reservation | dates without year, room-type synonyms, “duas pessoas” versus “dois quartos”, names/CEP, code-switching (“upgrade”) | collect dates, occupancy, room, contact, and policy fields; clarify missing or conflicting values | 50+ paraphrases per intent; exact date/occupancy/name preservation; locale and noisy-chat slices |
| Cancellation | “cancelar” versus “alterar”, partial-stay cancellation, “não vou conseguir ir”, policy deadline | do not promise refund/cancellation until reservation and policy are identified; confirm scope and consequence | negation, partial dates, third-party booking, angry phrasing, deadline boundary |
| Late check-in | “chego tarde”, “depois da meia-noite”, “madrugada”, transport delay, after-hours access | distinguish late arrival notification from date change/no-show; route access instructions and human escalation when required | 23:30/00:30/03:00, date rollover, ASR numbers, emergency fallback |
| Accessibility | indirect requests, disability terminology, room-feature specificity, urgency | preserve requested accommodation, avoid inventing availability, escalate if safe fulfillment is uncertain | wheelchair route, visual/hearing needs, accessible bathroom, service animal, companion; legal-policy review |
| Complaint | politeness mismatch, sarcasm, threats, repeated unresolved issue, mixed intents | acknowledge impact, summarize facts, create/route case, avoid blame and unsupported compensation promises | rude/indirect complaints, code-switching, emoji, escalation and sentiment disagreement |
| Maintenance | colloquialisms (“chuveiro não esquenta”), room number errors, safety implications | identify location and hazard, create ticket, prioritize urgent risks, confirm access constraints | plumbing/electricity/lock/air-conditioning; number correction; after-hours routing |
| Emergency | ambiguous urgency (“estou passando mal”), panic/noise, location ambiguity | prioritize immediate safety and local emergency/human escalation; do not make diagnosis or delay dispatch | fire, gas, medical distress, assault, trapped elevator, inaccessible evacuation; evaluate time-to-escalation |
| Payment | R$ formatting, PIX/card terms, installment language, fraud/social engineering, last-four digits | never expose or infer full payment credentials; confirm amount/currency/booking and hand off to approved payment flow | decimal comma, refunds, duplicate charge, declined card, PIX mismatch, requests for card data |

### Facts relevant to the matrix

- Brazilian accessibility obligations for lodging facilities are grounded in the Disability Inclusion Law and Decree 9.296/2018, so accessibility intents should be treated as service and safety requirements rather than ordinary preference classification. [Law 13.146/2015](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm); [Decree 9.296/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9296.htm)
- Provider speech documentation distinguishes locale and feature support, so a hotel voice channel should validate the exact model/locale/features used in production rather than rely on a generic “Portuguese supported” statement. [Google Cloud](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages); [Azure](https://learn.microsoft.com/pt-br/azure/ai-services/speech-service/language-support); [Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html)

## Evaluation plan and unresolved gaps

### Recommendations

- Maintain separate slices for: clean text, informal text, ASR transcripts, regional/register variation, code-switching, names/addresses, numbers/currency, complaints, accessibility, and emergencies.
- Gate automation by risk: reservation search can tolerate clarification; cancellation/payment/emergency actions require deterministic field validation, confirmation, audit logging, and human fallback.
- Use macro-F1 and per-intent recall for classification; slot exact match and character error rate for identifiers; calibration/error-rejection curves for abstention; and Brazilian human review for politeness, localization, and factuality.
- Evaluate generation with adversarial prompts that ask the system to invent availability, refund eligibility, accessibility features, emergency instructions, or payment outcomes. The expected result should be a safe clarification or escalation, not a plausible fabrication.

### Gaps

- The public sources located do not provide a hotel-specific, pt-BR benchmark covering all eight scenarios above; a local, consented benchmark must be created.
- The reviewed multilingual politeness dataset is English/Hindi rather than Portuguese, so Portuguese-specific politeness and empathy scores remain an empirical question. [LREC 2020](https://aclanthology.org/2020.lrec-1.514/)
- Public provider language tables document feature availability, not hotel-domain word-error rates, regional fairness, or performance on Brazilian names, addresses, and payment identifiers. Those must be measured on the production channel and model versions selected.
- P3B3 is a 2026 benchmark for Portuguese variety bias, but its abstract does not establish that its prompts or metrics cover hotel policies, emergency escalation, or transactional correctness. [P3B3](https://arxiv.org/abs/2606.16753)
