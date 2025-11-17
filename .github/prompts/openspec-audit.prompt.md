---
description: Validate and augment specs against research findings.
---

$ARGUMENTS

<!-- OPENSPEC:START -->

**Guardrails**

- Favor straightforward, minimal implementations first and add complexity only when it is requested or clearly required.
- Keep changes tightly scoped to the requested outcome.
- Refer to `openspec/AGENTS.md` (located inside the `openspec/` directory—run `ls openspec` or `openspec update` if you don't see it) if you need additional OpenSpec conventions or clarifications.

**Steps**

1. Identify the current change ID from context or by running `openspec list`.
2. Verify research artifacts exist in `changes/<change-id>/research/` (research.md, blastradius.md, footguns.md).
3. Load and parse all research artifacts.
4. Validate spec deltas in `changes/<change-id>/specs/` against research findings:
   - Compare requirements to documented best practices
   - Identify missing requirements from research
   - Flag deprecated methods or patterns in specs
   - Check version compatibility
   - Validate security implementation patterns
5. Identify gaps and missing requirements:
   - Authentication requirements not in specs
   - Configuration requirements not documented
   - Error handling patterns missing
   - Testing requirements not specified
   - Security considerations not addressed
6. Augment `changes/<change-id>/design.md` with beyond-LLM-training information:
   - Add "API Integration Patterns" section with current version patterns
   - Add "Security Implementation" section with official recommendations
   - Add "Configuration" section with environment variable examples
   - Document deprecated methods to avoid with replacements
   - Include code snippets from official documentation with version markers
7. Add missing requirements to spec deltas:
   - Create new requirements under `## ADDED Requirements`
   - Update existing requirements under `## MODIFIED Requirements`
   - Include version-specific information and research citations
8. Re-run validation: `openspec validate <change-id> --strict`.
9. Report audit results with summary of changes, missing requirements added, deprecated patterns fixed, and validation status.

**Reference**

- See `openspec/AGENTS.md` for design.md augmentation templates and conflict resolution guidance.
- Focus on information beyond LLM training data: recent API changes, deprecations, evolved best practices.
- Preserve existing design.md content, only add new sections or augment existing ones.
- Flag conflicts between research and existing design for manual resolution.
<!-- OPENSPEC:END -->
