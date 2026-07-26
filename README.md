# Please Continue

Please Continue is a community-maintained fork of
[Continue](https://github.com/continuedev/continue), the open-source coding
assistant for editors and the command line.

The project aims to preserve Continue, complete useful inherited infrastructure
where it can become a safe and testable feature, and release focused
improvements that make the assistant clearer and more dependable.

> **Project status:** Early-stage and not yet released for everyday use.
> Installers, extension packages, and compatibility claims will be added only
> after they have been tested on the platforms named in each release.

## Roadmap

The roadmap favours complete, reviewable features over publishing unfinished
scaffolding. Priorities may change as the current codebase is revalidated.

The **Complete** column is a rounded July 2026 development-maturity estimate,
not a measure of end-user availability. The shared scale is: 10% verified
design, 40% working development capability, 60% integration into a Continue
surface, 80% testing across target surfaces, 90% packaging and rollback
readiness, and 100% tested public release. Intermediate values reflect partial
completion between milestones.

| Roadmap item                  | Foundation                                      | What should be released                                                                                                   | Complete |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------: |
| Clear tool feedback           | Structured tool error handling                  | Typed errors with plain-language recovery steps and protection against repeated failed actions                            |      35% |
| Safer assisted changes        | Editor change and approval workflows            | Stale-file detection, reviewable changes, and validation before an edit is accepted                                       |      40% |
| Manageable tool results       | Search and context-result handling              | Bounded results with clear truncation notices, pagination, and reliable continuation                                      |      35% |
| Reliable context and sessions | Context retrieval and conversation state        | Fresh source checks and durable task state that survives long conversations                                               |      35% |
| Lifecycle hooks               | Shared hooks core and CLI lifecycle integration | Shared, workspace-trust-gated hooks for the CLI and VS Code, with bounded execution, diagnostics, and compatibility tests |      55% |
| Trust and output boundaries   | Permission, provider, and context controls      | Separation of trusted controls, untrusted evidence, model reasoning, and user-facing output                               |      20% |
| Fresh indexes and connections | Project indexing and connected-tool state       | Visible freshness state, safe invalidation, and refresh behavior when projects or connected tools change                  |      25% |
| Large-project discovery       | Code search and project indexing                | The smallest benchmark-proven improvement to finding relevant code in large repositories                                  |      30% |

Nothing in this table should be treated as available until it appears in a
tested release with documentation, supported-platform notes, and known
limitations.

## Releases

[GitHub Releases](https://github.com/chadmzoghby-alt/please-continue/releases)
will be the source for tested packages and release notes. Depending on verified
support, a release may include:

- a VS Code `.vsix`;
- a JetBrains plugin package;
- command-line packages or binaries;
- checksums, installation instructions, known limitations, and upgrade notes.

Source builds and CI artifacts are for contributors unless a release explicitly
states otherwise.

## Contributing

Contributions should solve one clear problem, include focused tests, and avoid
mixing unrelated refactors. Before starting a large change, open or join an
issue so that scope, compatibility, and verification can be agreed.

Useful ways to help include reproducing bugs, improving tests and documentation,
validating inherited behavior, and completing one roadmap item end to end.
See the
[contribution guide](https://github.com/chadmzoghby-alt/please-continue/blob/main/CONTRIBUTING.md)
before preparing a change.

## Safety

AI coding tools can read files, propose edits, and invoke tools. Review changes
before accepting them, protect credentials, and check provider data-handling
policies before sending private source code to a hosted model.

Do not include API keys, tokens, private code, or sensitive logs in public
issues.

## License

Please Continue retains the licenses and notices that apply to Continue and its
third-party dependencies. Read the
[repository license](https://github.com/chadmzoghby-alt/please-continue/blob/main/LICENSE)
before using, modifying, or redistributing the project.
