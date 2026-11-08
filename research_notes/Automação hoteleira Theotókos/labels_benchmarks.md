# Sentiment, intent, and multilingual regression research for Theotókos Flats

## Evidence on intent taxonomy, sentiment, and multilingual benchmarks

### Takeaway
Use a hierarchical, operational taxonomy: intent answers “what action or outcome does the guest seek?”, while sentiment and urgency are independent labels. Benchmark evidence supports explicit out-of-scope handling, per-class reporting, locale-aware evaluation, and behavioral regression tests rather than relying on aggregate accuracy alone.

### Cited Findings
- MASSIVE is a multilingual spoken-language-understanding benchmark with 1M realistic, parallel, labeled utterances across 51 languages, 18 domains, 60 intents, and 55 slots; it was created by professional localization of the English SLURP dataset and reports intent accuracy, slot F1, and exact match. [ACL Anthology](https://aclanthology.org/2023.acl-long.235/)
- MASSIVE is useful for transfer and slot-filling methodology, but its parallel/localized construction is not a substitute for naturally occurring Brazilian Portuguese hotel messages; the source paper explicitly describes localization from English SLURP. [ACL Anthology](https://aclanthology.org/2023.acl-long.235/)
- CLINC/OOS was designed because ordinary classification corpora assume every inference example belongs to a supported class. It contains 150 intents across 10 domains plus out-of-scope queries, and the authors report that models perform well in-scope but struggle with OOS identification. [Larson et al., EMNLP-IJCNLP 2019](https://aclanthology.org/D19-1131/)
- XTREME evaluates cross-lingual generalization across 40 languages and nine tasks, including classification, structured prediction, retrieval, and question answering; XNLI and PAWS-X provide aligned multilingual evaluation for inference and paraphrase phenomena. [XTREME](https://arxiv.org/abs/2003.11080), [XNLI](https://arxiv.org/abs/1809.05053), [PAWS-X](https://aclanthology.org/D19-1382/)
- A 2024 EACL Findings study found that uneven label distributions across languages can reduce multilingual classification performance, increase language separation in representations, and promote uninformative features; computing class weights separately by language mitigated these effects in their experiments. [Jung and van der Plas, 2024](https://aclanthology.org/2024.findings-eacl.157/)
- CheckList argues that held-out accuracy can overestimate NLP generalization. Its behavioral-testing matrix combines linguistic capabilities with Minimum Functionality, Invariance, and Directional Expectation tests; a user study found practitioners using CheckList wrote twice as many tests and found almost three times as many bugs as users without it. [Ribeiro et al., ACL 2020](https://aclanthology.org/2020.acl-main.442/)
- Portuguese hotel sentiment resources are emerging. A 2026 PROPOR exploratory study reports a manually annotated Brazilian-Portuguese hotel-review dataset of 762 TripAdvisor samples for structured sentiment analysis and discusses challenges including implicit subjects/pro-drop. [Campos, Corrêa, and de Freitas, 2026](https://aclanthology.org/2026.propor-1.92.pdf)
- ASQP-PT 2025 targets Portuguese hotel reviews with aspect-category, aspect-term, sentiment-term, and polarity quadruples; the shared-task paper reports a best/competitive system F1 of 45.66% for the described track, showing that fine-grained hotel sentiment remains difficult rather than solved. [ASQP-PT 2025 proceedings](https://ceur-ws.org/Vol-4098/ASQPPT2025_paper2.pdf)
- Google Dialogflow documents Portuguese-Brazil (`pt-BR`) as a locale-specific language distinct from Portuguese-Portugal, and states that intent training phrases, responses, and entity entries are language-specific. API calls must provide the relevant `languageCode`; unsupported locale behavior can fall back to a root language depending on configuration. [Google Dialogflow multilingual agents](https://docs.cloud.google.com/dialogflow/es/docs/agents-multilingual)

### Inferences
- The production label object should be multi-axis: `intent`, `sentiment`, `urgency/safety`, `locale`, and extracted slots. Do not encode “angry cancellation” or “urgent maintenance” as separate intent classes unless routing truly differs.
- The initial Theotókos intent family should include at least: `reservation_new`, `reservation_modify`, `reservation_confirm`, `reservation_policy`, `cancellation_request`, `cancellation_policy_or_refund`, `late_check_in`, `early_check_in`, `check_in_instructions`, `accessibility_request`, `payment_method_or_link`, `payment_failure`, `invoice_or_receipt`, `charge_dispute`, `maintenance_report`, `housekeeping_request`, `complaint`, `emergency_or_immediate_danger`, `lost_and_found`, `amenity_or_facility_question`, and `human_agent_request`.
- Add `oos_or_uncertain` and `multi_intent` labels. CLINC/OOS supports rejection as a first-class capability; hotel automation should not force an unsupported query into a nearby operational intent.
- Sentiment should be at least `positive`, `neutral`, `negative`, and `mixed/ambivalent`; add `distressed` or `fearful` only if it changes safety escalation. Keep sentiment independent from urgency: a calm “há fumaça no corredor” is urgent, while an angry but non-dangerous complaint is not an emergency.
- For complaints, use aspect labels such as `room_cleanliness`, `noise`, `temperature/AC`, `water/electricity`, `Wi-Fi`, `staff/service`, `billing`, `accessibility`, and `booking`. The Portuguese hotel sentiment literature supports aspect/polarity representation rather than a single document-level polarity.

### Gaps
- MASSIVE, XTREME, XNLI, and PAWS-X are general multilingual benchmarks, not hotel-specific Brazilian Portuguese operational datasets. They should be external sanity checks, not the acceptance benchmark for Theotókos.
- The cited hotel sentiment datasets concern reviews, not short live-chat messages, safety escalation, or reservation workflows. A production corpus must be collected and annotated from representative support traffic, with privacy controls.
- The cited sources do not establish a universal sentiment ontology or a universal threshold for emergency classification; those require operational policy and risk review.

## Brazilian Portuguese coverage and dataset-quality requirements

### Takeaway
Treat `pt-BR` as its own locale and test natural Brazilian Portuguese, not only translations. Include orthographic variation, accents/diacritics, informal chat, regional vocabulary, hospitality jargon, English/Spanish mixing, and code-switching as explicit slices. Keep source facts separate from locally chosen label policy.

### Cited Findings
- Dialogflow’s documentation explicitly distinguishes Portuguese-Brazil from Portuguese-Portugal and says locale-specific intent training phrases and entity entries are separate. [Google Dialogflow](https://docs.cloud.google.com/dialogflow/es/docs/agents-multilingual)
- P3B3 (ACL 2026) is a benchmark focused on European-versus-Brazilian Portuguese variety bias, covering lexical differences, address forms, syntax, regionalisms, and implicit/explicit switching between varieties. [P3B3 paper](https://aclanthology.org/2026.mellm-1.23/), [code](https://github.com/AMALIA-LLM/p3b3-benchmark)
- Research on Brazilian Portuguese hotel sentiment identifies pro-drop/implicit subjects as an error source in structured sentiment extraction. [PROPOR 2026 study](https://aclanthology.org/2026.propor-1.92.pdf)
- Multilingual benchmark construction can introduce translation artifacts: MASSIVE’s paper states that its non-English data were localized from English SLURP, so its parallelism is valuable for controlled transfer but does not guarantee natural local phrasing. [MASSIVE](https://aclanthology.org/2023.acl-long.235/)
- Benchmark contamination can invalidate “unseen” evaluation. A survey describes contamination as overlap between evaluation data and model training/fine-tuning data and notes that no universal decontamination method is foolproof. [Benchmark Data Contamination survey](https://arxiv.org/abs/2406.04244); see also [NAACL 2024 contamination study](https://aclanthology.org/2024.naacl-long.482/)

### Inferences
- Store raw text unchanged and maintain a normalized analysis view. Test both accented and unaccented inputs (`reserva`, `reservá` where applicable; `hóspede`, `hospede`), punctuation/no-punctuation, repeated letters, casing, emojis, abbreviations, and common chat typos. Do not silently erase accents before evaluation; normalization should be an explicit feature and test condition.
- Build a PT-BR lexicon from local operations: `reserva`, `booking`, `check-in`, `checkin`, `entrada`, `saída`, `diária`, `caução`, `sinal`, `pix`, `cartão`, `boleto`, `NF`, `nota fiscal`, `portaria`, `interfone`, ` fechadura`, `ar-condicionado`, `chuveiro`, `vazamento`, `Wi-Fi`, `vaga`, `acessível`, `cadeirante`, `PNE`, `pet`, `late check-in`, and property-specific names. Mark terms as examples, not exhaustive truth.
- Include regional and register variation without labeling a regionalism as an error. Recommended slices: formal Brazilian Portuguese, informal WhatsApp-style, Northeast/Southeast lexical variants when observed in real traffic, Portuguese-English mixing (`late check-in`, `booking`, `feedback`, `payment`), Portuguese-Spanish mixing, and Portuguese with hotel-system codes.
- Add contrastive pairs where only a decisive cue changes: “posso cancelar?” versus “não quero cancelar”; “vou chegar tarde” versus “cheguei e não consigo entrar”; “o ar-condicionado não funciona” versus “há fumaça”; “quero pagar via Pix” versus “já paguei e fui cobrado de novo”.
- Separate naturally authored local examples from machine-translated or paraphrased examples. Keep a provenance field (`native`, `translated`, `synthetic`, `redacted production`) and report results by provenance.
- Require double annotation for high-risk classes (`emergency_or_immediate_danger`, accessibility, payment dispute, cancellation/refund) and adjudication for disagreements. Maintain an annotation guide with positive examples, hard negatives, escalation rules, and “insufficient context” handling.
- Prevent leakage by splitting conversation threads and near-duplicate templates together, not individual messages independently. Keep a temporal holdout to test drift and a source/property holdout when multiple properties or channels exist.

### Gaps
- The cited literature does not provide a complete Theotókos-specific lexicon, local regional distribution, or validated frequency estimates for English/Spanish mixing. Those must be measured from consented/redacted traffic.
- No source establishes that a particular informal spelling or regional word is universal in Brazil; treat all such items as hypotheses until confirmed by local data.
- There is no cited benchmark that directly measures hotel emergency intent in PT-BR chat. Safety acceptance criteria therefore need domain-owner approval and conservative escalation policy.

## Proposed Theotókos benchmark and regression matrix

### Takeaway
Use a frozen, versioned test suite with stratified slices, temporal holdout, OOS/adversarial cases, and CheckList-style behavioral tests. Gate releases on safety and critical-intent floors, not only aggregate F1.

### Cited Findings
- CLINC/OOS establishes the need to test both supported intents and queries outside the supported label set; its authors report that OOS identification is substantially harder than in-scope classification. [Larson et al.](https://aclanthology.org/D19-1131/)
- CheckList provides the evidence-backed pattern for regression suites: minimum-functionality tests, invariance tests for meaning-preserving changes, and directional tests where a controlled wording change should change the output. [Ribeiro et al.](https://aclanthology.org/2020.acl-main.442/)
- The EACL 2024 findings support reporting language-specific and label-specific performance rather than only pooled multilingual scores when language/label distributions differ. [Jung and van der Plas](https://aclanthology.org/2024.findings-eacl.157/)
- MASSIVE demonstrates a useful multi-task evaluation pattern: intent classification plus slot filling and exact-match reporting. [MASSIVE](https://aclanthology.org/2023.acl-long.235/)

### Inferences

#### Test matrix

| Slice | Required examples | Expected assertion |
|---|---|---|
| Core intent | Reservation, modify, confirm, cancellation, late check-in, accessibility, complaint, maintenance, emergency, payment | Correct intent and required slot extraction |
| Hard negatives | Cancellation vs refund policy; late arrival vs failed entry; complaint vs maintenance; payment method vs disputed charge | No adjacent-class confusion above agreed limit |
| Multi-intent | “Vou chegar tarde e preciso de quarto acessível”; “o ar não funciona e quero cancelar” | Multi-intent flag or deterministic primary/secondary routing |
| OOS | Restaurant recommendations, tourism, legal advice, unrelated technical support, unsupported refund demand | `oos_or_uncertain`, human handoff, or safe clarification |
| Safety | Fire/smoke, gas smell, medical emergency, violence/threat, lockout at night, electrical hazard | Immediate emergency escalation; never routine maintenance workflow |
| PT-BR orthography | Accents omitted, typo, casing, punctuation omitted, elongated letters, emojis | Intent preserved under meaning-preserving perturbations |
| Locale | PT-BR versus PT-PT vocabulary; Spanish/English fragments; code-switching | Correct locale/routing or explicit clarification; no silent locale misclassification |
| Hospitality jargon | Pix, caução, diária, portaria, interfone, NF, quarto adaptado, ar-condicionado | Correct intent/entity mapping using local terms |
| Sentiment | Neutral request, frustrated complaint, angry complaint, praise, mixed sentiment, distress | Correct sentiment/aspect without changing intent |
| Temporal | “hoje”, “amanhã”, “depois da meia-noite”, “na sexta”, timezone/relative dates | Correct date/time normalization or clarification |
| Noise/channel | WhatsApp fragments, voice-transcript artifacts, spelling errors, duplicated messages | No critical-intent regression under realistic noise |
| Distribution shift | New month/week, new channel, new annotator batch, new property/source | Stable performance and documented degradation |

#### Recommended dataset splits

- **Train/dev/test:** stratify by intent, sentiment, locale, and risk tier; group by conversation/thread and near-duplicate template.
- **Temporal holdout:** newest period is test-only to detect operational drift.
- **Challenge set:** never used for tuning; curated hard negatives, OOS, code-switching, safety, and contrastive pairs.
- **Cross-locale holdout:** hold out some PT-BR phrasing patterns and evaluate transfer only as a secondary experiment; do not treat translated data as native PT-BR evidence.
- **Contamination control:** deduplicate exact and near-duplicate utterances across all splits; record provenance and model/data version.

#### Metrics and acceptance criteria (recommendations)

These thresholds are proposed starting gates, not sourced universal standards:

- Report micro-F1, macro-F1, per-intent F1, balanced accuracy, confusion matrix, calibration/reliability, and coverage at the chosen abstention threshold.
- Report every metric overall and by `pt-BR` register, language-mix slice, sentiment, channel, provenance, and risk tier. Include confidence intervals or bootstrap intervals for release comparisons.
- **Safety:** 100% recall on the curated emergency challenge set; zero routing of emergency examples to routine maintenance/payment/cancellation. Any failure blocks release and triggers human-review policy.
- **Critical operations:** ≥99% intent accuracy/recall on reservation, cancellation, late check-in, accessibility, maintenance, and payment challenge subsets; proposed threshold requires local validation because no cited source sets it.
- **OOS/abstention:** report OOS precision, recall, F1 and false-accept rate; set a conservative threshold so unsupported requests are clarified or handed off rather than confidently misrouted.
- **Fairness/locale:** no material regression for PT-BR or mixed-language slices relative to the prior approved model; define “material” before testing (for example, an absolute drop of 2 percentage points is a governance choice, not a literature fact).
- **Sentiment:** macro-F1 plus per-class recall, with separate aspect/polarity scoring for complaint domains. Do not accept a high pooled score if `negative`, `distressed`, or mixed sentiment collapses.
- **Regression:** every previously passing critical case must remain passing; new cases are added to the frozen suite when a production incident or annotation disagreement reveals a failure.

#### Concrete cases to seed first

- `“Quero reservar um flat para sexta e sábado, 2 adultos.”` → `reservation_new`; slots: dates, guests.
- `“Tem como cancelar minha reserva? Ainda recebo reembolso?”` → `cancellation_request` plus `cancellation_policy_or_refund` or multi-intent.
- `“Meu voo atrasou, vou chegar depois da meia-noite. A portaria atende?”` → `late_check_in`; slots: arrival window, access/entry.
- `“Sou cadeirante, tem quarto adaptado e banheiro acessível?”` → `accessibility_request`; slots: wheelchair-accessible room, bathroom.
- `“O ar-condicionado parou e está muito quente.”` → `maintenance_report`; aspect: AC; sentiment: negative.
- `“Sinto cheiro de gás no corredor.”` → `emergency_or_immediate_danger`; urgent escalation, not maintenance queue.
- `“Posso pagar no Pix? Vocês emitem nota fiscal?”` → `payment_method_or_link` plus `invoice_or_receipt`.
- `“Já paguei no Pix, mas cobraram de novo no cartão.”` → `charge_dispute`; sentiment: negative; human/payment escalation.
- `“O quarto estava impecável, mas o check-in foi confuso.”` → `complaint` or feedback; sentiment: mixed; aspect: service/check-in.
- `“I need a late check-in, mas meu voo chega 1h da manhã.”` → `late_check_in`; locale: `pt-BR-mixed`; preserve time slot.
- `“Necesito cancelar la reserva, por favor.”` → Spanish/OOS or supported multilingual cancellation according to declared scope; never silently treat as PT-BR.
- `“Quero reservar um quarto para um show”` → reservation if dates/availability request is clear; otherwise clarification, not automatic booking.

### Gaps
- Thresholds above are recommendations. They require a risk assessment, baseline measurements, sample sizes, and sign-off from Theotókos operations.
- No cited benchmark supplies statistically justified sample sizes for this exact hotel workflow; use power analysis or confidence-interval width to set the number of cases per slice.
- A benchmark cannot prove real-world safety. Emergency handling must have deterministic escalation, clear fallback messaging, and human/onsite procedures independent of model confidence.
