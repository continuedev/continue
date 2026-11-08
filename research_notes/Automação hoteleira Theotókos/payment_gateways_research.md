# Payment gateways for a boutique apart-hotel

## Capability matrix

### Takeaway
For a Brazil-first property, Mercado Pago and Pagar.me expose the most directly Brazil-oriented payment primitives in their public materials; Stripe and Adyen have strong global APIs and documented Brazil support, but some local-method and installment details are account-, country-, or acquiring-configuration dependent. Stone is relevant as a domestic acquiring ecosystem, yet its publicly indexable developer documentation was insufficient to verify all requested API behaviors.

### Cited Findings
- Mercado Pago’s Checkout API documentation covers online checkout and lists payment methods available through its platform, including Pix and cards; the exact set is account/country dependent. [Mercado Pago Checkout API overview](https://www.mercadopago.com.br/developers/en/docs/checkout-api/overview) · [Payment methods](https://www.mercadopago.com.br/developers/en/docs/checkout-api/payment-methods)
- Mercado Pago documents Pix payments for Brazil and provides API references for creating and managing payments. [Pix overview](https://www.mercadopago.com.br/developers/en/docs/checkout-api/payment-methods/pix) · [Payments API](https://www.mercadopago.com.br/developers/en/reference/payments/_payments/post)
- Mercado Pago documents payment refunds through the Payments API. [Refund a payment](https://www.mercadopago.com.br/developers/en/reference/chargebacks/_payments_id_refunds/post)
- Mercado Pago’s API guidance includes request idempotency using an idempotency key for payment operations. [Idempotency](https://www.mercadopago.com.br/developers/en/docs/checkout-api/additional-content/notifications/idempotency)
- Pagar.me’s public documentation describes a Brazilian payments API with orders, charges, Pix, cards, installments, refunds, webhooks, and antifraud-related concepts; availability and exact endpoints should be checked against the account’s current API version. [Pagar.me documentation](https://docs.pagar.me/)
- Pagar.me’s API reference documents charge creation and payment methods, including credit-card and Pix flows. [Pagar.me API reference](https://docs.pagar.me/reference)
- Stripe’s PaymentIntents API is designed to manage a payment through its lifecycle, including authentication and later capture where supported by the payment method. [PaymentIntents](https://docs.stripe.com/api/payment_intents)
- Stripe supports Pix in Brazil through a dedicated payment-method integration; the merchant must use a Brazil-capable Stripe account and satisfy Stripe’s eligibility requirements. [Stripe Pix payments](https://docs.stripe.com/payments/pix)
- Stripe supports 3D Secure through Stripe.js/PaymentIntents and can request or require authentication using `request_three_d_secure`. [3D Secure authentication](https://docs.stripe.com/payments/3d-secure) · [PaymentIntent confirmation](https://docs.stripe.com/api/payment_intents/confirm)
- Stripe supports idempotent API requests through the `Idempotency-Key` header. [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- Stripe exposes refund creation and dispute-management APIs. [Refunds](https://docs.stripe.com/api/refunds) · [Disputes](https://docs.stripe.com/api/disputes)
- Stripe’s hosted Elements/Checkout approach reduces the merchant’s direct handling of raw card data, but PCI obligations are not automatically zero; the applicable SAQ and integration scope depend on the implementation. [Stripe PCI compliance](https://docs.stripe.com/security/guide) · [PCI compliance guide](https://stripe.com/docs/security/guide)
- Adyen documents Pix as a Brazil payment method and provides a payment-method-specific integration guide. [Adyen Pix](https://docs.adyen.com/payment-methods/pix)
- Adyen documents cards, 3D Secure 2, webhooks, refunds, disputes, and API idempotency as core online-payments capabilities. [Cards](https://docs.adyen.com/payment-methods/cards) · [3D Secure 2](https://docs.adyen.com/online-payments/3d-secure) · [Webhooks](https://docs.adyen.com/development-resources/webhooks) · [Refunds](https://docs.adyen.com/online-payments/refund) · [Disputes](https://docs.adyen.com/risk-management/disputes) · [API idempotency](https://docs.adyen.com/development-resources/api-idempotency)
- Adyen documents card installments for Brazil as a market-specific capability whose availability depends on the payment method, shopper country, merchant account, and acquiring setup. [Adyen card installments](https://docs.adyen.com/online-payments/other-payment-methods/installments)
- Stone presents itself as a Brazilian payments/acquiring provider, but I could not verify a stable, public, complete API reference for Pix, tokenization, 3DS2, idempotency, refunds, webhooks, and chargebacks from an official developer portal during this research. [Stone official site](https://www.stone.com.br/)

### Inferences
- A small property should shortlist Mercado Pago or Pagar.me when Brazil-local Pix and installment operations are the primary requirement, then validate commercial terms and API limits during onboarding. This is an inference from the Brazil-focused documentation above, not a claim about pricing or approval.
- Stripe or Adyen is more attractive when the property needs a mature global object model, multi-country expansion, or sophisticated authentication/risk orchestration; Brazil-local payment-method eligibility still needs written confirmation from the provider.
- “Installments” must not be treated as a generic card feature: the merchant should confirm issuer/acquirer support, maximum parcels, interest-bearing versus merchant-funded installments, settlement timing, and whether the API returns installment-specific webhooks.

### Gaps
- Public materials did not establish current 2026 pricing, settlement schedule, reserve policy, or approval criteria for any provider.
- Public materials did not establish a uniform Brazil-specific installment contract for all five providers.
- Stone’s public documentation was not sufficient to make reliable feature claims for tokenization, 3DS2, idempotency, or hotel-specific authorization flows.

## Hotel deposits, no-show and dispute operations

### Takeaway
Hotel deposits and no-show fees require separating authorization, capture, cancellation, refund, and dispute evidence. Card authorization/capture is structurally better suited than Pix for a future, conditional charge; Pix is generally an immediate push payment and should be treated as a deposit/refund workflow rather than a card-style hold unless the provider explicitly documents a different product.

### Cited Findings
- Stripe documents separate authorization and capture behavior for PaymentIntents and supports manual capture for eligible card payments; this is the relevant primitive for a deposit hold or delayed room-charge capture. [Capture a PaymentIntent](https://docs.stripe.com/api/payment_intents/capture) · [Capture later](https://docs.stripe.com/payments/capture-later)
- Stripe documents saving payment methods for later use through SetupIntents and off-session payments, subject to authentication, mandate, and network rules. [SetupIntents](https://docs.stripe.com/api/setup_intents) · [Save payment details](https://docs.stripe.com/payments/save-and-reuse)
- Adyen documents separate authorisation and capture flows and supports delayed capture for card payments, subject to payment-method and account configuration. [Capture](https://docs.adyen.com/online-payments/capture) · [Authorisation](https://docs.adyen.com/online-payments/authorisation)
- Adyen documents recurring/merchant-initiated transactions and stored payment details with required shopper-consent and transaction-indicator rules. [Recurring payments](https://docs.adyen.com/online-payments/recurring-payments) · [Tokenization](https://docs.adyen.com/online-payments/tokenization)
- Mercado Pago’s payment object and refund APIs support creating a payment and later refunding it, but the public Checkout API pages reviewed did not document a general-purpose hotel no-show authorization-hold product comparable to card preauthorization. [Payments API](https://www.mercadopago.com.br/developers/en/reference/payments/_payments/post) · [Refunds](https://www.mercadopago.com.br/developers/en/reference/chargebacks/_payments_id_refunds/post)
- Pagar.me exposes card charge lifecycle and refund concepts in its API reference; public documentation reviewed did not establish a hotel-specific no-show product or guarantee that every integration supports delayed capture. [Pagar.me reference](https://docs.pagar.me/reference)
- 3DS2 authenticates cardholders and can reduce certain fraud/chargeback exposures, but it does not guarantee liability shift for every transaction or eliminate disputes. [Stripe 3D Secure](https://docs.stripe.com/payments/3d-secure) · [Adyen 3D Secure 2](https://docs.adyen.com/online-payments/3d-secure)
- Stripe and Adyen both provide dispute objects/workflows and webhooks so the property can react to disputes and submit evidence. [Stripe disputes](https://docs.stripe.com/api/disputes) · [Adyen disputes](https://docs.adyen.com/risk-management/disputes) · [Adyen dispute webhooks](https://docs.adyen.com/risk-management/disputes/api)
- Stripe and Adyen provide webhook-signature or webhook-security guidance; webhook processing should be asynchronous, authenticated, idempotent, and replay-safe. [Stripe webhook security](https://docs.stripe.com/webhooks) · [Adyen webhooks](https://docs.adyen.com/development-resources/webhooks)
- PCI scope depends on the integration pattern. Hosted checkout/hosted fields can reduce exposure to raw PAN, while direct server-side card-data handling materially increases PCI obligations; the merchant must complete the applicable PCI self-assessment and follow the provider’s exact integration guidance. [Stripe PCI guide](https://docs.stripe.com/security/guide) · [Adyen PCI DSS](https://docs.adyen.com/development-resources/pci-dss-compliance)

### Inferences
- Recommended hotel workflow: take a Pix or card deposit at booking; for cards, use a documented authorization/manual-capture or saved-card flow where the provider and acquirer explicitly support it; capture only the agreed amount; refund deposits through the provider API; retain booking, cancellation-policy, guest-consent, check-in/out, and service-delivery evidence for disputes.
- Do not promise a “no-show charge” solely because a card was tokenized. The booking terms, consent, transaction indicators, authorization validity, local card-network rules, and the provider’s merchant-initiated-transaction support all matter.
- For Pix bookings, use an explicit deposit/refund policy and a reconciliation job keyed by provider payment ID plus webhook event ID. Pix confirmation should not be inferred from a browser redirect.

### Gaps
- No public source reviewed guaranteed that a provider’s Brazil product supports hotel-specific authorization validity windows, incremental authorizations, or no-show rules for every merchant category.
- No public source reviewed established whether a Brazilian apart-hotel can apply a stored card token to a no-show without a fresh 3DS challenge in every scenario.
- Chargeback representment deadlines and evidence requirements vary by provider, scheme, issuer, and reason code; they must be obtained during underwriting.

## Implementation decision checklist and evidence gaps

### Takeaway
The decisive evaluation should be a provider-led sandbox/underwriting test, not a feature checkbox. Require each candidate to demonstrate the exact Brazil transaction paths the property will operate and to provide written confirmation for any capability not clearly documented.

### Cited Findings
- Webhooks are necessary for asynchronous payment state changes such as Pix confirmation, delayed capture, refunds, and disputes; Stripe and Adyen document webhook event delivery and signature/security handling. [Stripe webhooks](https://docs.stripe.com/webhooks) · [Adyen webhooks](https://docs.adyen.com/development-resources/webhooks)
- Idempotency is a standard protection against duplicate payment creation after retries or network failures; Stripe and Adyen document idempotency keys, and Mercado Pago documents idempotency guidance. [Stripe](https://docs.stripe.com/api/idempotent_requests) · [Adyen](https://docs.adyen.com/development-resources/api-idempotency) · [Mercado Pago](https://www.mercadopago.com.br/developers/en/docs/checkout-api/additional-content/notifications/idempotency)
- Refund APIs are provider operations and should be reconciled against webhook/event state rather than treated as synchronous UI success. [Stripe refunds](https://docs.stripe.com/api/refunds) · [Adyen refunds](https://docs.adyen.com/online-payments/refund) · [Mercado Pago refunds](https://www.mercadopago.com.br/developers/en/reference/chargebacks/_payments_id_refunds/post)
- Tokenization is provider-specific: Stripe documents PaymentMethods/SetupIntents, while Adyen documents stored payment details and recurring contracts; do not assume tokens are portable between gateways. [Stripe PaymentMethods](https://docs.stripe.com/api/payment_methods) · [Stripe SetupIntents](https://docs.stripe.com/api/setup_intents) · [Adyen tokenization](https://docs.adyen.com/online-payments/tokenization)
- Fraud tooling differs by provider and plan. Stripe documents Radar rules and risk evaluation; Adyen documents RevenueProtect/risk management; Brazil-local providers should be evaluated using their current antifraud product and liability terms. [Stripe Radar](https://docs.stripe.com/radar) · [Adyen risk management](https://docs.adyen.com/risk-management)

### Inferences
- Minimum acceptance test per provider: create Pix payment; create card payment in one installment and multiple installments; test failed and pending states; verify signed webhook delivery and replay handling; retry with the same idempotency key; refund full and partial amounts; test 3DS challenge/frictionless paths; test authorization then capture/void; open a simulated dispute; and export reconciliation data.
- For the smallest engineering team, hosted checkout or provider-hosted card fields plus a thin payment orchestration layer usually minimizes raw-card handling and gateway lock-in. Keep an internal payment record with provider, payment ID, order/booking ID, amount, currency, status, idempotency key, webhook IDs, refund IDs, and dispute IDs.
- Selection should weight Brazil operational fit (Pix reconciliation, installment settlement, support, local underwriting, antifraud tuning) more heavily than the existence of a globally elegant API.

### Gaps
- This research did not verify current commercial pricing, MDR, installment fees, Pix fees, reserve/rolling-reserve terms, settlement cadence, or support SLAs.
- This research did not verify whether Mercado Pago, Pagar.me, or Stone currently exposes a public, merchant-available API for hotel preauthorization, incremental authorization, or network-token/card-on-file no-show charging in Brazil.
- A production decision still requires legal/accounting review of cancellation/no-show wording, LGPD data retention, PCI self-assessment, card-network rules, and the provider contract.
