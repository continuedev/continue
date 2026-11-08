# Platform landscape: automação hoteleira Theotókos

**Research date:** 2026-11-08  
**Scope:** hotel operations for a boutique apart-hotel scaling from 12 to 31 units.  
**Evidence policy:** official product/documentation pages are primary. Vendor case studies and customer stories are useful but marketing evidence; independent sources should be used to validate quantified outcomes. Pricing is recorded only where publicly stated by the vendor. Confidence is per claim: **High** = explicit current official documentation; **Medium** = official marketing/case study or corroborated secondary source; **Low** = inference or page unavailable during research.

## Executive view

For 12→31 units, the lowest-risk architecture is usually **one PMS/channel manager plus one focused operations layer**, rather than a broad enterprise suite. The PMS should be the source of truth for reservations, room status, arrivals/departures, payments and distribution; the operations layer should turn those events into housekeeping, maintenance, inspection, service-request and incident workflows.

Shortlist for a structured demo:

1. **Cloudbeds + an operations partner** — strongest documented distribution/integration posture for a small independent property; Cloudbeds states 300+ channel connections, 350+ integration partners and an open API. It is not, by itself, a deep hotel-operations/maintenance system. **Confidence: High.**
2. **Mews + operations partner** — strong modern PMS, automation and marketplace story; Mews states 1,000+ hospitality-app integrations. Validate local fiscal/payment/channel requirements and the exact housekeeping/maintenance integration. **Confidence: High for platform claims; Medium for local fit.**
3. **hotelkit** — broadest documented all-department collaboration, housekeeping, facility management, inventory/repairs, checklists and inspections. Potentially more platform than 31 units need, but attractive if standardization and auditability are priorities. **Confidence: High.**
4. **Flexkeeping** — focused on housekeeping, front office requests and maintenance, with task progress, staffing patterns and preventive maintenance. Good operational fit; validate PMS list, inventory/lost-and-found depth and commercial minimums. **Confidence: High for core positioning; Medium for edge workflows.**
5. **RoomChecking/HOPR** — compelling real-time housekeeping, maintenance, prioritization, inspections and PMS synchronization, with French-language product evidence and a stated base of 1,000+ hotels. Validate language, support and integrations for the operating country. **Confidence: High for vendor claims; Medium for local deployment.**
6. **ALICE/Actabl** — mature cross-department service coordination, guest messaging, response-time visibility and multi-property governance. Likely strongest where service volume, brand standards or a management company justify enterprise processes; test whether the 31-unit property can buy and configure it economically. **Confidence: High for features; Medium for right-sizing.**
7. **HelloShift** — unusually broad “one platform” proposition: guest messaging, AI phone answering, mobile check-in, housekeeping and maintenance. Attractive for lean/front-deskless operations; validate PMS/channel integrations, data export and whether AI/service workflows meet local requirements. **Confidence: High for published scope; Medium for fit.**
8. **Optii** — credible category leader to evaluate for housekeeping/service optimization, but official pages were not retrievable in this research run; treat all unverified feature assumptions as open questions. **Confidence: Low until documentation/demo evidence is obtained.**

## Capability matrix

| Platform | Housekeeping / room status | Maintenance / incidents | Tasks, SLA, inspections | Inventory / lost & found | PMS/channel integration | 12→31-unit fit |
|---|---|---|---|---|---|---|
| hotelkit | Automated cleaning plans, checklists, room inspections; PMS interface for real-time status updates | Facility management, repairs and preventive/recurring workflows; inventory and consumption centrally recorded | Cross-department workflows, recurring walkthroughs/repairs, real-time request/complaint tracking; confirm formal SLA/escalation fields | Inventory and consumption explicitly mentioned; lost & found not clearly documented on public page | PMS interface stated; exact supported PMS list should be confirmed | Strong operational coverage; may be broad/enterprise-oriented |
| Flexkeeping | Cleaning patterns, task progress, team performance; housekeeping-manager workflows | Real-time repair delegation/tracking and preventive maintenance | Prioritize/delegate/track; confirm formal SLA timers, inspection templates and escalation rules | Inventory/lost & found not prominent in public material | Confirm PMS/channel list and room-status sync | Strong if housekeeping and maintenance are the main pain points |
| ALICE/Actabl | Real-time room assignments/status; supervisors reassign mid-shift; maintenance flags | Maintenance visibility and cross-department handoff; service coordination | Task assignment, completion, response-time/service workload visibility; guest requests logged and tracked | Not prominent in public ALICE material; verify add-on/product boundary | Vendor states PMS integrations during onboarding; obtain exact connector list | Strong for service-heavy or multi-property operations; potentially overbuilt |
| HelloShift | Housekeeping management is a core module; mobile-first staff collaboration | Maintenance is a core module; verify asset/PM and incident audit depth | Tasks and collaboration; verify inspection forms, SLA/escalation and reporting | Not clearly documented publicly | Verify PMS, channel and messaging integrations; ask about export/API | Good for lean teams/front-deskless model if integrations pass |
| RoomChecking/HOPR | Automatic cleaning tasks from arrivals/departures; real-time prioritization and room status | Fast incident reporting, prioritization, resolution tracking and escalation | Automatic assignment, changing priorities, integrated quality control/inspections | Stock-low recommendations are shown; full inventory/lost-and-found scope needs validation | Vendor says major PMS integrations and real-time reservation/arrival/departure sync | Very promising operational fit; validate country/language/support |
| Optii | Category fit expected for housekeeping optimization, but not verified here | Not verified | Not verified | Not verified | Not verified | Keep as comparison candidate only after current documentation/demo |
| Mews | PMS reservation/room lifecycle; automations, guest management, check-in/out and digital keys | Usually partner/app layer for deep maintenance | Automations and 1,000+ hospitality-app ecosystem; confirm exact operational partner | PMS/back-office capabilities vary by module/partner | 1,000+ hospitality apps stated | Strong PMS core; pair with focused ops tool |
| Cloudbeds | PMS supports housekeeping/staff-management integration use cases; not a full maintenance suite | Usually partner/API layer | Open API and partner ecosystem; operational SLA/inspection depth depends on connected app | Depends on connected app | 300+ channel connections, 350+ integration partners and open API | Strong independent-property foundation; partner selection is decisive |
| HotelIQ | Not an operations execution system | Not an operations execution system | Analytics/business intelligence and data standards, not frontline routing | Analytics/data-management role | Integrates data across hotel systems; not a PMS/channel manager | Use for analytics only, not as the operations system |
| Hapi | Integration/middleware category; do not treat as PMS or frontline ops | Depends on connected systems | Depends on connected systems | Depends on connected systems | Validate current product scope, APIs and supported PMS ecosystems | Relevant only if Theotókos needs integration plumbing or data normalization |

## Platform notes and source evidence

### hotelkit

The current official homepage describes an “Hotel Operations Platform” covering team collaboration, housekeeping and facility management. It explicitly claims automated cleaning processes, PMS-backed real-time status updates, maintenance cycles, consumption data, inventory and repairs. The same page describes checklists, room inspections, recurring walkthroughs, guest requests/complaints and dashboards for resource planning. The homepage reports 4,000+ hotels and 180,000+ users; these are vendor-reported scale signals, not independently audited figures.

**Case-study signal:** official stories cover InterContinental Vienna (collaboration, guest requests and complaints), Estrel Berlin (repairs and guest requests across 550 employees), and Radisson regional collaboration. These demonstrate enterprise use; they do not prove that the same configuration is economical for 31 units.

**Open questions:** exact PMS connectors, offline mode, Portuguese/Spanish support, lost-and-found object workflow, incident severity/escalation, SLA dashboards, minimum contract and whether facility/inventory modules are bundled.

Sources: [hotelkit platform](https://hotelkit.net/), [InterContinental Vienna story](https://hotelkit.net/customer-stories/guest-requests-intercontinental-vienna/), [Estrel Berlin story](https://hotelkit.net/customer-stories/germanys-largest-hotel/), [Radisson story](https://hotelkit.net/customer-stories/radisson-optimizes-collaboration/). **Confidence: High for published capabilities; Medium for fit and outcomes.**

### Flexkeeping

Flexkeeping’s official homepage positions the product around one app for task progress, team performance and guest requests. It claims automated complex cleaning patterns, language-barrier support, staffing visibility, real-time front-office updates, and maintenance workflows that prioritize, delegate and track repairs. Preventive maintenance is explicitly mentioned.

**Fit:** this is a close match for a 12→31-unit property where the operational bottleneck is coordinating a small housekeeping/maintenance team, rather than enterprise reporting. The product’s public page is less explicit about inventory, lost & found, incident registers, inspection scoring and formal SLA timers; those should be demo acceptance criteria rather than assumptions.

Source: [Flexkeeping](https://flexkeeping.com/), [housekeeping manager solution](https://flexkeeping.com/solutions/housekeeping-managers?hsLang=en), [front-office manager solution](https://flexkeeping.com/solutions/front-office-managers?hsLang=en), [maintenance manager solution](https://flexkeeping.com/solutions/hotel-maintenance-managers?hsLang=en). **Confidence: High for core positioning; Medium for detailed workflow depth.**

### ALICE / Actabl

Actabl’s official ALICE page describes a shared real-time system for front desk, housekeeping, maintenance and guest services. Published capabilities include room assignments/status, mid-shift reassignment, maintenance flags, guest requests, SMS/WhatsApp guest messaging, logged communications, response-time and workload visibility, and property/portfolio oversight. Actabl says most properties are active within 90–120 days, including workflow configuration, PMS connection and training.

**Fit:** strong when the operating model needs clear ownership, service-request traceability and management visibility. For 31 units, the risk is not functional insufficiency but economic/configuration overhead. Ask for a small-property reference and a quote that separates ALICE modules from other Actabl products such as Hotel Effectiveness, ProfitSword and Transcendent.

Source: [Actabl ALICE](https://actabl.com/alice/). **Confidence: High for published capabilities; Medium for implementation-time and right-sizing.**

### HelloShift

HelloShift’s official homepage presents a single hotel operations platform combining 24/7 AI phone answering, guest texts, mobile check-in, housekeeping and maintenance. It also emphasizes staff collaboration and a mobile operating model, with logos of hotel and hospitality groups shown as social proof.

**Fit:** potentially high for a small apart-hotel that wants to reduce front-desk interruptions and coordinate distributed staff. The public page does not establish the depth of preventive maintenance, inspection scoring, inventory, lost & found, incident reporting, SLA escalation, API/export or specific PMS/channel connectors. These are decision-gate questions.

Source: [HelloShift](https://www.helloshift.com/). **Confidence: High for published product scope; Low-to-Medium for unlisted operational details.**

### RoomChecking / HOPR

The current official French-language site describes HOPR as a suite for housekeeping, maintenance, guest experience and real-time management. It states automatic task generation, arrival/departure-based cleaning schedules, live prioritization, incident reporting and resolution tracking, cross-team communication, real-time performance, integrated quality control/inspections, mobile use and PMS synchronization for reservation/arrival/departure data. It claims use by 1,000+ hotels and publishes vendor-reported outcomes of 90% of daily tasks generated automatically, +10% customer satisfaction after one year and 80% fewer errors in the first month.

**Fit:** among the closest functional matches for a 31-unit operation because it translates PMS events into prioritized field work. Treat outcome numbers as vendor marketing until a reference call or independent evidence confirms them. Validate integration availability in the target country, support language, offline/mobile behavior, inventory/lost & found, and contract minimums.

Source: [RoomChecking/HOPR](https://www.roomchecking.com/). **Confidence: High for feature claims; Medium for scale; Low-to-Medium for outcome claims.**

### Mews

Mews’ official product page positions it as a cloud hospitality platform/PMS with reservation management, guest intelligence, upsells, self-check-in, digital keys, automations, online check-out, POS and a back-office/integration layer. It states that properties can connect to 1,000+ hospitality apps. A published customer quote from Frame Hospitality Group says Mews supports a front-deskless model across two properties with a small team.

**Fit:** strong as the property system of record when the desired operating model is digital/self-service. Deep housekeeping, maintenance, inspections, inventory and incident workflows should be provided by a partner from the marketplace unless the current Mews product configuration proves otherwise. Validate local payment/fiscalization, channel distribution and the exact app connector’s event semantics (room status, stay changes, cancellations, out-of-order rooms).

Sources: [Mews products](https://www.mews.com/en/products), [Mews customer quote on front-deskless operations](https://www.mews.com/en/products), [Mews developer/R&D site](https://developers.mews.com/). **Confidence: High for platform/ecosystem claims; Medium for specific partner workflows.**

### Cloudbeds

Cloudbeds’ current official product page describes an integrated PMS, channel manager, booking engine, payments, revenue management, CRM and guest-experience stack. It states 300+ direct OTA/wholesaler/regional connections, 350+ integration partners, an open API, onboarding/data migration, training and 24/7/365 support. The developer documentation exposes integration guides and use cases for housekeeping/staff management, guest communication, door locks, BI, payments and other systems.

**Fit:** high for an independent 12→31-unit property needing distribution and a flexible ecosystem. The operations design should assume a second tool for detailed task routing, inspections, maintenance SLAs, stock and lost & found. API access, partner approval, rate limits, webhooks, data ownership and support boundaries should be confirmed before contracting.

Sources: [Cloudbeds hotel-management platform](https://www.cloudbeds.com/hotel-management-software/), [Cloudbeds Developer Documentation](https://developers.cloudbeds.com/llms.txt), [Housekeeping/staff-management blueprint](https://developers.cloudbeds.com/docs/housekeeping-staff-management.md), [integration guide](https://developers.cloudbeds.com/docs/integration-guide.md). **Confidence: High.**

### Hapi and HotelIQ

Hapi and HotelIQ should not be evaluated as interchangeable with hotel-operations execution platforms. Hapi is relevant as an integration/data layer in the Oracle Hospitality ecosystem and should be assessed for the exact APIs, objects, authentication, deployment and connector availability required by Theotókos. HotelIQ’s official site describes hospitality business intelligence, data standards and integration of tasks/requirements across systems; it is an analytics/governance layer, not a housekeeping dispatch board.

Source for HotelIQ: [HotelIQ](https://www.hoteliq.io/). **Confidence: High that HotelIQ is BI-oriented; Low for any Hapi-specific current claim until current product documentation is obtained.**

### Optii

Optii is a relevant comparison candidate in hotel service/housekeeping optimization, but official pages were not retrievable during this research run because of transport/DNS failures. Do not treat remembered feature lists or third-party summaries as verified. Request current documentation covering housekeeping boards, maintenance, service-request routing, guest messaging, inspections, SLA/escalation, inventory/lost & found, PMS connectors, pricing and minimum property size.

Source attempted: [Optii](https://www.optii.com/). **Confidence: Low until verified.**

## Integration architecture to validate

For either Mews or Cloudbeds, require a written integration map showing:

- reservation create/modify/cancel and dates/times;
- arrivals, departures, stayovers and early check-in/late check-out;
- room/unit status, out-of-order/out-of-service and room moves;
- maintenance/incident feedback into the PMS or a canonical export;
- staff identity/roles and audit trail;
- webhooks or polling frequency, retry behavior and outage handling;
- channel-manager impact on overbooking and room inventory;
- API limits, sandbox access, data retention and export rights;
- local payment, tax/fiscal and privacy requirements.

A 31-unit property should avoid a workflow where a receptionist manually rekeys every booking into the operations tool. At minimum, the operations layer should automatically create departure-clean, arrival-clean, stayover and inspection work from PMS events, then expose completion and exceptions in a daily control view.

## SLA, inspection and control requirements

Use the following acceptance tests in vendor demos:

1. **Arrival readiness:** a same-day departure automatically creates a clean task; an arriving unit marked inspected becomes sellable; a late task escalates before check-in time.
2. **Maintenance:** staff can report an issue with unit, category, photo, severity and timestamp; assignment, acknowledgement, resolution and verification are separately auditable.
3. **Guest request:** a request from WhatsApp/SMS/front desk is routed to a team, has a due time, records first response and completion, and remains visible when reassigned.
4. **Inspection:** supervisor checklist supports pass/fail, notes, photos, defect task creation and recurring standards by unit type.
5. **Inventory:** par levels, consumption, restock owner and low-stock alert are distinguishable from a generic task; ask specifically about linen, amenities and cleaning supplies.
6. **Lost & found:** item, unit, date/time, finder, storage location, chain of custody, guest contact, disposition and retention are searchable and exportable.
7. **Incident:** severity, safety/privacy flags, people involved, attachments, corrective action and restricted access are supported.
8. **Reporting:** daily exceptions, overdue tasks, room-turn time, maintenance aging, inspection defects and SLA attainment can be exported without vendor services.

## Commercial and implementation signals

No reliable public per-unit pricing was found in the reviewed official materials. Cloudbeds and Mews lead with demo/onboarding and ecosystem messaging rather than a public rate card. The operations vendors likewise appear quote-led. Do not compare “monthly price” until each vendor states: property minimum, per-room/per-user basis, modules, onboarding, PMS connector fees, messaging/AI usage, support tier, data export, annual uplift and cancellation terms.

For 12→31 units, implementation risk is often more material than license price. Prefer a 30-day pilot or staged rollout with one building/shift, named implementation owner, sample data import, PMS sandbox, mobile/offline test, staff training in the local language and a measurable baseline for room-turn time, overdue tasks, maintenance aging and guest-request response.

## Recommended decision path

- **If PMS replacement is also needed:** shortlist Cloudbeds and Mews, then select the operations partner only after testing event synchronization.
- **If the PMS is adequate:** shortlist hotelkit, Flexkeeping, RoomChecking/HOPR and HelloShift; add ALICE/Actabl if service complexity or multi-property governance justifies it.
- **If analytics is the main gap:** evaluate HotelIQ separately; do not buy it as a substitute for dispatch/inspection software.
- **If integration fragmentation is the main risk:** investigate Hapi or the PMS’s official integration layer, but document who owns operational truth and support.

The likely best-fit finalists for Theotókos are **Cloudbeds + Flexkeeping or RoomChecking/HOPR** for a lean, operationally focused stack, **Mews + a marketplace operations partner** for a digital/front-deskless model, and **hotelkit** when internal collaboration, facilities and standardized audits matter more than minimizing the number of systems.
