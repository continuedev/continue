---
name: OpenSpec: Research
description: Research external dependencies and generate implementation guides.
category: OpenSpec
tags: [openspec, research]
---

<!-- OPENSPEC:START -->

**Guardrails**

- Favor straightforward, minimal implementations first and add complexity only when it is requested or clearly required.
- Keep changes tightly scoped to the requested outcome.
- Refer to `openspec/AGENTS.md` (located inside the `openspec/` directory—run `ls openspec` or `openspec update` if you don't see it) if you need additional OpenSpec conventions or clarifications.

**Steps**

1. Identify the current change ID from context or by running `openspec list`.
2. Parse resource arguments provided by the user (URLs, GitHub repos, package names, local files).
3. Classify each resource:
   - URLs: Start with http:// or https://
   - GitHub repos: Match owner/repo pattern
   - Local files: End with .md or contain path separators
   - Package names: Attempt Context7 lookup for everything else
4. Fetch all resources in parallel with progress updates.
5. Analyze documentation for:
   - Integration patterns and architecture
   - Authentication and configuration requirements
   - Best practices from official sources with citations
   - Code examples with version annotations
   - Testing approaches and recommendations
   - Deprecated methods and migration paths
6. Identify blast radius:
   - Integration points in codebase
   - Affected modules and dependencies
   - Data model impacts
   - API surface changes
   - Configuration requirements
7. Extract footguns and gotchas:
   - Common mistakes from documentation warnings
   - Version-specific issues
   - Performance pitfalls
   - Security concerns
8. Generate three research artifacts in `changes/<change-id>/research/`:
   - `research.md` - Implementation guide with patterns, best practices, and code examples
   - `blastradius.md` - Codebase impact analysis with affected modules
   - `footguns.md` - Common mistakes, gotchas, and how to avoid them
9. Report completion with summary of findings and next steps.

**Reference**

- See `openspec/AGENTS.md` for research artifact templates and citation requirements.
- Use WebFetch for URLs, file reading for local files, and Context7 integration for packages.
- Include source citations and fetch timestamps in all research artifacts.
- Run `/audit` after research completes to validate specs against findings.
<!-- OPENSPEC:END -->
