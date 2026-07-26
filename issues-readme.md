# Issue Catalogue Guide

## Why the catalogue is combined

Continue's issue tracker mixes bugs, requests, questions, promotional
submissions, stale records, and PR-backed proposals. Many records describe the
same failure from different providers or platforms. The easiest representation
for an agent is therefore:

- one ranked cluster catalogue;
- one dated evidence snapshot; and
- one dossier per selected candidate, created later.

The ranked catalogue is not an exhaustive transcription of 535 issue bodies.
It is a normalized action catalogue produced from complete pagination of the
535 open issues and 399 open PRs available at the snapshot. Low-information,
promotional, duplicate, provider-specific, and stale records remain
discoverable through the live GitHub queries in `../REFERENCES.md`.

## Criticality

| Class                    | Meaning                                                                                                                          | Required response                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| R0 — Critical/restricted | Plausible secret exposure, destructive execution, security-boundary failure, or similarly irreversible harm                      | Security owner classifies immediately; ordinary public triage pauses |
| R1 — High                | Code corruption, false verification, inaccessible product, or a core agent/edit/tool workflow that fails broadly                 | Reproduce next; prepare a bounded candidate dossier                  |
| R2 — Significant         | Material reliability, compatibility, context, session, platform, or usability failure with a workaround or narrower blast radius | Schedule after R0/R1 controls or in a safe parallel lane             |
| R3 — Planned             | Valuable enhancement, integration, or ecosystem request that does not repair an immediate integrity or access failure            | Evaluate after the reliability baseline, unless separately funded    |
| R4 — Watch/defer         | Stale, weakly evidenced, duplicate, promotional, support-only, or outside the fork's chosen scope                                | Monitor or close locally; do not implement from title alone          |

Within a class, order uses:

1. worst credible user harm;
2. blast radius and affected core workflow;
3. reproduction confidence and evidence quality;
4. whether a narrow complete repair is possible;
5. dependency value for later work; and
6. Please Continue strategic fit.

Comment count, age, upstream priority labels, and existence of a PR are
secondary signals. An open PR is not proof of correctness, provenance, CI
status, or permission to copy code.
