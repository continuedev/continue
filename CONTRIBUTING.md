# Contributing to Please Continue

Thank you for helping make Please Continue clearer, safer, and more
dependable.

> **Contribution status**
>
> External pull-request intake is not yet open. Fork-owned contributor terms,
> security contacts, and review rules are being finalized. Please do not open
> a pull request or begin a substantial code change until the relevant
> contribution path is announced.
>
> The rest of this guide describes the quality bar that will apply when intake
> opens and that maintainers use for project-authored changes today.

Please Continue is an early-stage, community-maintained fork of Continue. A
contribution should deliver one coherent, independently useful outcome. A
focused fix, test improvement, documentation correction, refactor, release
gate, or tested foundation can be a complete contribution. Orphan scaffolding,
unused abstractions, knowingly broken intermediate states, and changes whose
available contract tests are deferred do not meet the contribution bar.

## Ways to contribute

When the relevant contribution path is open, useful contributions may include:

- reproducing a bug with the smallest deterministic example;
- improving tests, documentation, or compatibility guidance;
- validating inherited behavior on a supported platform;
- fixing a scoped issue with its tests and user-facing documentation; or
- completing one agreed roadmap outcome end to end.

Do not report vulnerabilities, credentials, private source, or sensitive logs
through a public issue, discussion, or pull request. A fork-owned security
contact will be published before external security-report intake opens.

## Before you start

Once contribution intake is announced:

1. Read the project status and roadmap in [`README.md`](./README.md).
2. Search existing issues and pull requests for the same problem.
3. For a substantial change, agree on the problem, scope, and verification
   approach before implementation.
4. Identify every affected surface, required test, compatibility concern, and
   documentation update.
5. Keep the proposed outcome small enough to review and merge independently.

Do not assume that an inherited Continue issue, pull request, roadmap item, or
contributor agreement automatically applies to Please Continue.

## Development setup

Use the Node.js version declared by [`.nvmrc`](./.nvmrc) and
[`.node-version`](./.node-version). These repository files are authoritative;
do not substitute an untested newer version merely because it is installed on
your machine.

After cloning the repository, install and build the development dependencies
from the repository root:

### Windows

```powershell
.\scripts\install-dependencies.ps1
```

### macOS or Linux

```bash
./scripts/install-dependencies.sh
```

The installation scripts build several shared packages and may take time. You
do not need to install Vite globally.

Use the component guide nearest to the code you are changing:

- [VS Code extension](./extensions/vscode/CONTRIBUTING.md)
- [JetBrains extension](./extensions/intellij/CONTRIBUTING.md)
- [CLI](./extensions/cli/README.md)
- [GUI](./gui/README.md)
- [Packaged core](./binary/README.md)
- [Documentation](./docs/README.md)

## Make a reviewable change

- Start from the current `main` branch and use a focused topic branch.
- Solve one coherent problem; do not combine unrelated fixes or formatting.
- Add or update every available automated test that establishes the changed
  behavior.
- When no suitable automated test surface exists, explain why and provide the
  strongest practical alternative verification in the same change.
- Update documentation needed to understand, verify, or operate the outcome.
- Preserve existing behavior and compatibility unless the agreed scope
  explicitly changes them.
- Include a screenshot or short recording when visible UI behavior changes.
- Retain applicable licences, notices, attribution, and provenance for reused
  work.
- Never commit secrets, private code, personal data, machine-specific paths,
  local traces, generated evidence, package caches, or unrelated build output.

AI-assisted contributions remain the contributor's responsibility. Read every
change, confirm its provenance, run the applicable checks, and be able to
explain the resulting behavior.

## Verify your change

Run the checks for every affected component. Package-level `package.json`
scripts and the current pull-request workflows are the source of truth for
available lint, type-check, unit, integration, packaging, and end-to-end
commands.

For supported source and documentation formats, check repository formatting
from the root:

```bash
npm run format:check
```

Report the exact commands run, their results, and any warnings or skips. A
pre-existing skip must remain explicit; it is not a passing test for changed
behavior. Pull-request CI is authoritative for merge readiness, while local
checks provide faster feedback.

## Pull-request expectations

When pull-request intake opens, each pull request should include:

- the user-visible or maintainer-visible problem and outcome;
- the exact review scope and affected paths;
- tests and documentation delivered with the behavior;
- commands run and their results;
- screenshots or recordings for visible UI changes;
- compatibility, security, migration, or rollback considerations; and
- known limitations and residual risk.

Review feedback may require a change to be split, combined, or reordered so
that each review unit remains understandable and independently mergeable. A
branch push, review approval, merge, and product release are separate events.

## Contributor terms and community policies

Please Continue has not yet published fork-owned contributor terms. The
inherited Continue CLA and its automation do not establish external
contribution intake for this fork. Do not sign or rely on that inherited CLA
as an agreement with Please Continue.

The contribution-status notice at the top of this file will be updated when
fork-owned contributor terms, security reporting, conduct contacts, and review
rules are approved and published.
