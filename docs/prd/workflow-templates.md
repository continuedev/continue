# Product Requirements Document: Workflow Templates

**Feature:** Workflow Templates
**Version:** 1.0
**Status:** Draft
**Author:** Code Mode Team
**Created:** 2025-11-17
**Last Updated:** 2025-11-17

---

## Executive Summary

Workflow Templates is a curated library of pre-built, production-ready TypeScript workflows that enable users to automate common development tasks with minimal setup. By providing battle-tested templates for tasks like GitHub issue triage, file processing pipelines, security scanning, and code quality automation, we dramatically reduce the time from idea to execution—from hours of custom development to minutes of configuration.

This feature leverages Code Mode's core value proposition: **98% token reduction through TypeScript execution** in secure E2B sandboxes. Templates showcase this capability while providing immediate, practical value to developers.

---

## Problem Statement

### Current Pain Points

1. **High Barrier to Entry**
   - New users face a blank canvas when creating workflows
   - Requires understanding of MCP APIs, TypeScript patterns, and Code Mode architecture
   - Time to first successful workflow: 2-4 hours

2. **Repeated Implementation**
   - Common workflows (stale issue management, PR triage, changelog generation) are reimplemented across teams
   - No centralized repository of best practices
   - Inconsistent error handling, retry logic, and logging patterns

3. **Limited Discoverability**
   - Users don't know what's possible with Code Mode
   - Advanced features (parallel execution, multi-service orchestration, error handling) are underutilized
   - Examples exist but are buried in documentation

4. **Configuration Over Code**
   - Traditional automation tools force configuration-heavy approaches
   - Code Mode's strength (TypeScript composability) is hidden from casual users

### Impact

- **Developer Productivity:** Teams spend 5-10 hours/week on manual tasks that could be automated
- **Adoption Rate:** 60% of new users abandon workflow creation after initial attempts
- **Time to Value:** Average 4-6 days from sign-up to first production workflow

---

## Goals & Success Metrics

### Primary Goals

1. **Reduce Time to First Workflow**
   - From 2-4 hours to <10 minutes
   - Target: 80% of users create successful workflow within first session

2. **Increase Workflow Adoption**
   - 5x increase in active workflows per user
   - Target: Average 3-5 workflows per team within 30 days

3. **Showcase Code Mode Capabilities**
   - Demonstrate 98% token reduction through real-world examples
   - Highlight parallel execution, error handling, multi-service orchestration

4. **Build Community Library**
   - Enable users to share custom templates
   - Create feedback loop for template improvements

### Success Metrics

| Metric | Baseline | Target (3 months) | Measurement |
|--------|----------|-------------------|-------------|
| Time to first workflow | 2-4 hours | <10 minutes | User analytics |
| Workflow creation success rate | 40% | 85% | Session tracking |
| Active workflows per user | 0.8 | 4.0 | Usage analytics |
| Template usage rate | 0% | 70% | Feature adoption |
| User satisfaction (NPS) | TBD | 50+ | Quarterly survey |
| Community contributions | 0 | 20+ templates | GitHub submissions |

### Non-Goals (Out of Scope for v1)

- Visual workflow builder (code-based only)
- Template marketplace with paid templates
- Automatic template recommendations based on repository analysis
- Template versioning and update notifications
- Multi-repository template execution (single repo per workflow)

---

## User Personas

### Primary: Mid-Level Backend Engineer ("Alex")

**Profile:**
- 3-5 years experience
- Works on microservices architecture
- Familiar with TypeScript/Node.js
- Uses GitHub daily, occasionally writes GitHub Actions

**Goals:**
- Automate repetitive PR review tasks
- Set up automated security scanning
- Generate weekly reports for team standup

**Pain Points:**
- Limited time to learn new automation tools
- Needs templates that "just work"
- Wants customization without starting from scratch

**Template Needs:**
- GitHub PR triage
- Stale issue management
- Dependency vulnerability scanning
- Weekly team activity reports

---

### Secondary: Engineering Manager ("Jordan")

**Profile:**
- 7+ years experience
- Manages team of 5-10 engineers
- Focuses on process improvement and team productivity
- Limited time for hands-on coding

**Goals:**
- Standardize team workflows
- Improve code review velocity
- Track and report team metrics

**Pain Points:**
- Needs low-maintenance automation
- Must justify time investment to leadership
- Requires visibility into workflow execution

**Template Needs:**
- Code quality dashboards
- PR review time tracking
- Automated changelog generation
- On-call rotation management

---

### Tertiary: DevOps Engineer ("Sam")

**Profile:**
- 5+ years experience
- Manages CI/CD pipelines
- Expert in automation and infrastructure
- Uses multiple cloud providers

**Goals:**
- Build complex multi-service workflows
- Integrate with existing tooling (Sentry, Datadog, PagerDuty)
- Create custom templates for team use

**Pain Points:**
- Existing tools lack composability
- Token limits in LLM-based automation
- Needs robust error handling and retry logic

**Template Needs:**
- Log aggregation and analysis
- Incident response automation
- Cross-repository code analysis
- Infrastructure health checks

---

## User Stories

### Epic 1: Template Discovery

**US-1.1:** As a new user, I want to browse a gallery of workflow templates so I can find a starting point for my automation needs.

**Acceptance Criteria:**
- Template gallery displays 10+ curated templates
- Each template shows: name, description, use case, trigger type, and MCP servers used
- Templates are categorized (GitHub Automation, Security, Code Quality, Reporting)
- Search and filter functionality

**US-1.2:** As a user, I want to preview a template's code before using it so I can understand what it does.

**Acceptance Criteria:**
- Template detail view shows full TypeScript code
- Syntax highlighting and code navigation
- Inline comments explain key logic
- Example output/results shown

**US-1.3:** As a user, I want to see real-world results from template execution so I can evaluate if it meets my needs.

**Acceptance Criteria:**
- Template examples include sample execution logs
- Before/after screenshots where applicable
- Token usage comparison (traditional vs Code Mode)
- Estimated execution time

---

### Epic 2: Template Usage

**US-2.1:** As a user, I want to create a workflow from a template with one click so I can start automating quickly.

**Acceptance Criteria:**
- "Use Template" button creates pre-configured workflow
- Repository and agent selection auto-filled where possible
- Template code copied to workflow editor
- User guided to configure only required fields

**US-2.2:** As a user, I want to customize template configuration variables so I can adapt it to my repository without editing code.

**Acceptance Criteria:**
- Templates expose configuration as environment variables
- UI form for editing variables (org name, repo, thresholds, etc.)
- Default values pre-filled
- Validation for required fields

**US-2.3:** As a user, I want to test a template against my repository before scheduling it so I can verify it works correctly.

**Acceptance Criteria:**
- "Test Run" executes workflow once
- Results displayed in UI within 30 seconds
- Error messages actionable and clear
- Option to edit and re-test

---

### Epic 3: Template Customization

**US-3.1:** As an advanced user, I want to fork a template and modify the code so I can create custom variations.

**Acceptance Criteria:**
- "Customize" button creates editable copy
- Full TypeScript editor with syntax highlighting
- Access to all MCP server imports
- Preserves template structure and comments

**US-3.2:** As a user, I want to add custom logic to templates using helper functions so I can extend functionality without breaking the original workflow.

**Acceptance Criteria:**
- Templates designed with extension points
- Helper function library available
- Examples of common customizations in docs

**US-3.3:** As a user, I want to save my customized template for reuse so I can apply it to multiple repositories.

**Acceptance Criteria:**
- "Save as Template" creates user template
- User templates appear in "My Templates" section
- Can share templates with team members
- Templates include custom metadata

---

### Epic 4: Template Management

**US-4.1:** As a team admin, I want to create organization-wide templates so my team can use standardized workflows.

**Acceptance Criteria:**
- Organization template library
- Permission controls (create, edit, use)
- Templates inherit org-level secrets and configs

**US-4.2:** As a user, I want to receive notifications when my scheduled template workflows complete so I can review results.

**Acceptance Criteria:**
- Notification preferences (email, Slack, webhook)
- Configurable notification triggers (success, failure, all)
- Rich notification content (summary, logs, diff links)

**US-4.3:** As a power user, I want to contribute templates to the public gallery so I can share solutions with the community.

**Acceptance Criteria:**
- Template submission via GitHub PR
- Review process and quality guidelines
- Attribution to contributor
- Community voting/rating system (v2)

---

## Template Categories & Initial Templates

### Category 1: GitHub Automation (8 templates)

1. **Stale Issue Manager**
   - Auto-label and comment on inactive issues
   - Configurable staleness threshold
   - Batch operations (100+ issues)

2. **PR Triage Assistant**
   - Analyze PRs: size, approvals, CI status
   - Auto-label based on criteria
   - Generate weekly PR digest

3. **Changelog Generator**
   - Parse commits and PRs
   - Format as markdown
   - Create/update CHANGELOG.md via PR

4. **First-Time Contributor Greeter**
   - Detect first-time contributors
   - Post welcoming comment with contribution guidelines
   - Add "first-time-contributor" label

5. **Code Review Reminder**
   - Find PRs awaiting review
   - Notify reviewers via GitHub/Slack
   - Escalate after threshold

6. **Release Notes Automation**
   - Generate release notes from closed PRs
   - Categorize by labels (feature, bug, breaking)
   - Create GitHub release draft

7. **Security Advisory Responder**
   - Monitor Dependabot alerts
   - Create issues for critical vulnerabilities
   - Notify security team

8. **Repository Health Check**
   - Verify README, LICENSE, CONTRIBUTING.md exist
   - Check for required CI/CD workflows
   - Generate health report issue

---

### Category 2: Code Quality & Security (6 templates)

9. **Snyk Vulnerability Scanner**
   - Run Snyk scan on cron
   - Create issues for new vulnerabilities
   - Priority-based labeling

10. **Test Coverage Reporter**
    - Extract coverage from CI artifacts
    - Comment on PRs with coverage delta
    - Track coverage trends

11. **Linting Report Generator**
    - Run ESLint/Prettier across codebase
    - Generate summary report
    - Create issues for violations

12. **License Compliance Checker**
    - Scan dependencies for license conflicts
    - Generate compliance report
    - Alert on non-approved licenses

13. **Dependency Update Tracker**
    - Monitor package.json for outdated deps
    - Create batched update PRs
    - Test updates before committing

14. **Code Complexity Analyzer**
    - Identify high-complexity functions
    - Generate refactoring candidates list
    - Track complexity trends

---

### Category 3: Data Processing & Reporting (4 templates)

15. **Log Aggregator & Analyzer**
    - Fetch logs from multiple sources
    - Parse and categorize errors
    - Generate incident summary

16. **API Performance Monitor**
    - Call endpoints, measure latency
    - Detect performance regressions
    - Alert on SLA violations

17. **Team Activity Dashboard**
    - Aggregate commits, PRs, reviews
    - Generate weekly team report
    - Post to Slack with charts

18. **Cross-Repository Code Search**
    - Search multiple repos for patterns
    - Generate usage report
    - Identify deprecation candidates

---

### Category 4: DevOps & Infrastructure (4 templates)

19. **Deployment Verification**
    - Verify deployment health checks
    - Run smoke tests post-deploy
    - Rollback on failure

20. **Infrastructure Drift Detector**
    - Compare actual vs expected config
    - Identify manual changes
    - Generate drift report

21. **Incident Response Automation**
    - Parse Sentry/PagerDuty events
    - Create incident issue
    - Notify on-call engineer

22. **Backup & Archive Manager**
    - Archive old branches/tags
    - Export repository data
    - Verify backup integrity

---

## Functional Requirements

### FR-1: Template Gallery

**FR-1.1:** The system SHALL display a searchable gallery of workflow templates in Mission Control UI.

**FR-1.2:** Each template card SHALL display:
- Template name and icon
- One-sentence description
- Category badge
- Trigger type (cron/webhook)
- Required MCP servers
- Estimated token savings

**FR-1.3:** Users SHALL be able to filter templates by:
- Category (GitHub, Security, Code Quality, etc.)
- Trigger type (cron, webhook, both)
- MCP server requirements
- Difficulty level (beginner, intermediate, advanced)

**FR-1.4:** Template detail view SHALL include:
- Full description and use case
- Code preview with syntax highlighting
- Configuration variables and defaults
- Required permissions and secrets
- Example execution logs
- Related templates

---

### FR-2: Template Instantiation

**FR-2.1:** "Use Template" action SHALL create a new workflow with:
- Template code pre-loaded
- Default configuration values
- Recommended schedule (for cron workflows)
- Required agent configuration

**FR-2.2:** Template configuration form SHALL:
- Extract variables from template code (e.g., `const ORG = process.env.GITHUB_ORG || 'myorg'`)
- Display as editable form fields
- Validate required fields
- Preview rendered code with values

**FR-2.3:** Users SHALL be able to test template execution before saving workflow.

---

### FR-3: Template Customization

**FR-3.1:** Users SHALL be able to edit template code in full TypeScript editor.

**FR-3.2:** Editor SHALL provide:
- Syntax highlighting
- Auto-completion for MCP server methods
- Error checking (TypeScript compilation)
- Inline documentation tooltips

**FR-3.3:** Customized templates SHALL be savable as user templates for reuse.

---

### FR-4: Template Metadata & Documentation

**FR-4.1:** Each template SHALL include metadata:
```typescript
{
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  author: string;
  version: string;
  mcpServers: string[];
  triggerTypes: ('cron' | 'webhook')[];
  configSchema: ConfigSchema;
  defaultConfig: object;
  estimatedTokens: number;
  exampleOutputUrl?: string;
}
```

**FR-4.2:** Templates SHALL include inline code comments explaining:
- Purpose of each major section
- Configuration options
- Error handling strategy
- Customization points

---

### FR-5: Template Execution & Monitoring

**FR-5.1:** Template-based workflows SHALL execute identically to custom workflows.

**FR-5.2:** Execution logs SHALL indicate template source and version.

**FR-5.3:** Users SHALL receive notifications when template workflows complete (configurable per workflow).

---

## Non-Functional Requirements

### NFR-1: Performance

- Template gallery SHALL load in <1 second
- Template instantiation SHALL complete in <500ms
- Test execution SHALL complete in <30 seconds
- Search/filter operations SHALL return results in <200ms

### NFR-2: Reliability

- Templates SHALL have 99.5% success rate on valid configurations
- Templates SHALL handle common error cases (network failures, rate limits, invalid data)
- All templates SHALL include retry logic for transient failures
- Failed workflows SHALL produce actionable error messages

### NFR-3: Usability

- Template setup SHALL require <5 minutes for beginner users
- Configuration forms SHALL validate in real-time
- Error messages SHALL be specific and actionable
- Templates SHALL work without modification for 80% of use cases

### NFR-4: Scalability

- System SHALL support 1000+ templates (community contributions)
- Template execution SHALL scale to 10,000+ workflows/day
- Batch operations SHALL handle 1000+ items without timeout

### NFR-5: Security

- Templates SHALL NOT expose secrets in logs
- User-customized templates SHALL be sandboxed (E2B)
- Template code SHALL be reviewed before public gallery inclusion
- MCP server permissions SHALL follow principle of least privilege

### NFR-6: Maintainability

- Templates SHALL follow consistent code structure
- Templates SHALL use shared utility functions (error handling, retries)
- Template code SHALL be tested with CI/CD
- Breaking changes to MCP APIs SHALL trigger template updates

---

## User Experience & Design

### Template Gallery UI

```
┌─────────────────────────────────────────────────────────────┐
│  Workflow Templates                           [+ New Template]│
├─────────────────────────────────────────────────────────────┤
│  Search: [                    ] 🔍                          │
│  Filters: [All Categories ▼] [All Triggers ▼] [All Levels ▼]│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ 🏷️ Stale    │ │ 📊 PR Triage│ │ 📝 Changelog│           │
│  │ Issues      │ │ Assistant   │ │ Generator   │           │
│  │             │ │             │ │             │           │
│  │ GitHub      │ │ GitHub      │ │ GitHub      │           │
│  │ ⏰ Cron     │ │ 🪝 Webhook  │ │ ⏰ Cron     │           │
│  │ 98% tokens ↓│ │ 97% tokens ↓│ │ 96% tokens ↓│           │
│  │ [Use]       │ │ [Use]       │ │ [Use]       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Template Detail View

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Templates                                         │
├─────────────────────────────────────────────────────────────┤
│  🏷️  Stale Issue Manager                      [Use Template]│
│  by Code Mode Team • v1.0 • GitHub Automation               │
├─────────────────────────────────────────────────────────────┤
│  📖 Description                                              │
│  Automatically labels and comments on issues that haven't   │
│  been updated in X days. Helps keep your issue tracker      │
│  clean and prioritized.                                      │
│                                                              │
│  💡 Use Cases:                                               │
│  • Identify abandoned feature requests                      │
│  • Prompt contributors to update status                     │
│  • Auto-close long-stale issues                             │
│                                                              │
│  ⚙️  Configuration:                                          │
│  • GITHUB_ORG: Your organization name                       │
│  • STALE_DAYS: Days before marking stale (default: 30)      │
│  • AUTO_CLOSE: Auto-close after X days (optional)           │
│                                                              │
│  🎯 Token Efficiency:                                        │
│  • Traditional: ~350K tokens (200+ LLM calls)               │
│  • Code Mode: ~6K tokens (single execution)                 │
│  • Reduction: 98.3%                                          │
│                                                              │
│  📦 Requirements:                                            │
│  • MCP Servers: github                                      │
│  • Trigger: Cron (recommended: daily)                       │
│  • Permissions: Issues (read/write)                         │
│                                                              │
│  💻 Code Preview:                    [Expand] [Customize]   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ import { github } from '/mcp';                      │   │
│  │                                                     │   │
│  │ const ORG = process.env.GITHUB_ORG || 'myorg';     │   │
│  │ const STALE_DAYS = parseInt(                       │   │
│  │   process.env.STALE_DAYS || '30'                   │   │
│  │ );                                                  │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  📊 Example Results:                           [View Full]  │
│  ✅ Analyzed 5 repositories                                 │
│  ✅ Found 23 stale issues                                   │
│  ✅ Added labels and comments                               │
└─────────────────────────────────────────────────────────────┘
```

### Template Configuration Form

```
┌─────────────────────────────────────────────────────────────┐
│  Create Workflow from Template: Stale Issue Manager         │
├─────────────────────────────────────────────────────────────┤
│  Workflow Name:                                              │
│  [Daily Stale Issue Check                               ]   │
│                                                              │
│  Repository:                                                 │
│  [myorg/myrepo                                      ▼]       │
│                                                              │
│  Agent:                                                      │
│  [Default Agent (Claude Sonnet 4.5)                 ▼]       │
│                                                              │
│  Schedule:                                                   │
│  [Daily at 9:00 AM UTC                              ▼]       │
│                                                              │
│  ─────── Template Configuration ───────                      │
│                                                              │
│  GitHub Organization:                                        │
│  [myorg                                              ]       │
│                                                              │
│  Stale Threshold (days):                                     │
│  [30                                                 ] ℹ️     │
│  Issues inactive for this many days will be labeled          │
│                                                              │
│  Auto-close Threshold (optional):                            │
│  [90                                                 ] ℹ️     │
│  Leave empty to never auto-close                             │
│                                                              │
│  ────────────────────────────                                │
│                                                              │
│  [Test Run]                            [Cancel] [Create]     │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Considerations

### Template Storage

- Templates stored as TypeScript files in `/templates` directory
- Metadata in JSON sidecar files (`template-name.meta.json`)
- Version control via Git
- Community templates submitted via GitHub PR

### Template Loading

- Templates compiled and validated at build time
- Runtime: templates loaded from file system
- Template cache refreshed on deployment
- User templates stored in database

### Configuration Injection

Templates use environment variables for configuration:

```typescript
// Template code
const ORG = process.env.GITHUB_ORG || 'default-org';
const STALE_DAYS = parseInt(process.env.STALE_DAYS || '30');

// Injected at runtime
process.env.GITHUB_ORG = userConfig.githubOrg;
process.env.STALE_DAYS = userConfig.staleDays.toString();
```

### Error Handling Standards

All templates MUST include:
- Try-catch blocks for external API calls
- Retry logic with exponential backoff
- Graceful degradation (continue on non-critical failures)
- Structured error logging

Example:
```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await sleep(1000 * (4 - retries));
    return withRetry(fn, retries - 1);
  }
}
```

---

## Dependencies & Integrations

### Required MCP Servers

Templates leverage these MCP server integrations:

- **github:** Issues, PRs, commits, releases, workflows
- **filesystem:** Read/write files, directory operations
- **slack:** Post messages, upload files
- **sentry:** Fetch issues, create comments
- **database:** SQLite/PostgreSQL queries
- **http:** Generic HTTP requests

### External Services

- **GitHub API:** Core integration for most templates
- **Snyk API:** Vulnerability scanning
- **Sentry API:** Error tracking
- **Slack API:** Notifications

---

## Migration & Rollout Plan

### Phase 1: Foundation (Week 1-2)

- Implement template metadata schema
- Build template gallery UI
- Create 5 core templates (stale issues, PR triage, changelog, security, coverage)
- Internal testing with Code Mode team

### Phase 2: Expansion (Week 3-4)

- Add 10 more templates across all categories
- Implement template customization UI
- Add test execution feature
- Beta testing with 10 external users

### Phase 3: Launch (Week 5-6)

- Complete all 22 v1 templates
- Write documentation and tutorials
- Public launch announcement
- Monitor usage and gather feedback

### Phase 4: Community (Week 7+)

- Open template submissions
- Template review process
- Community voting/rating
- Monthly template showcases

---

## Risks & Mitigation

### Risk 1: Template Complexity Overwhelms Users

**Impact:** Medium
**Probability:** Medium

**Mitigation:**
- Difficulty levels (beginner/intermediate/advanced)
- Progressive disclosure (show simple config first, code on demand)
- Guided tutorials for each template
- Video walkthroughs

### Risk 2: Templates Break Due to API Changes

**Impact:** High
**Probability:** Low

**Mitigation:**
- Automated testing against MCP server APIs
- Version pinning for MCP servers
- Deprecation warnings
- Template update notifications

### Risk 3: Low Template Adoption

**Impact:** High
**Probability:** Low

**Mitigation:**
- Onboarding flow suggests relevant templates
- Email campaign highlighting template use cases
- Success stories and case studies
- Template of the month showcases

### Risk 4: Security Vulnerabilities in User Templates

**Impact:** High
**Probability:** Medium

**Mitigation:**
- All templates execute in sandboxed E2B environment
- Code review for public templates
- Static analysis for common vulnerabilities
- Rate limiting per workflow

### Risk 5: Poor Template Quality from Community

**Impact:** Medium
**Probability:** Medium

**Mitigation:**
- Submission guidelines and template
- Required test coverage
- Manual review before public gallery
- Community feedback/rating system

---

## Open Questions

1. **Template Versioning:** How do we handle template updates for existing workflows?
   - Option A: Auto-update (risky)
   - Option B: Notify user of updates (recommended)
   - Option C: Pin to template version

2. **Pricing Model:** Should premium/community templates be part of paid plans?
   - All templates free in v1
   - Consider marketplace in v2

3. **Template Sharing:** Private templates within organization vs public?
   - v1: Public gallery + private user templates
   - v2: Organization template libraries

4. **Template Analytics:** Track which templates are most used/successful?
   - Yes—helps prioritize template improvements
   - Privacy considerations for execution data

5. **Template Composition:** Allow combining multiple templates?
   - Defer to v2
   - Focus on single-purpose templates in v1

---

## Appendix

### A. Template Submission Guidelines

Templates submitted to the public gallery must:

1. Include comprehensive inline documentation
2. Follow Code Mode style guide
3. Include test cases demonstrating functionality
4. Handle errors gracefully
5. Use environment variables for configuration
6. Include example execution logs
7. Specify all required permissions
8. Be under 500 lines of code (focused, single-purpose)

### B. Template Structure Template

```typescript
/**
 * Template: [Template Name]
 * Category: [Category]
 * Description: [One-sentence description]
 *
 * Use Case:
 * [2-3 sentences describing when to use this template]
 *
 * Configuration:
 * - ENV_VAR_1: [Description] (default: [value])
 * - ENV_VAR_2: [Description] (required)
 *
 * MCP Servers: [server1, server2]
 * Trigger: [cron/webhook/both]
 *
 * Token Efficiency:
 * - Traditional: ~[X]K tokens
 * - Code Mode: ~[Y]K tokens
 * - Reduction: [Z]%
 */

import { /* MCP servers */ } from '/mcp';

// Configuration
const CONFIG_VAR = process.env.CONFIG_VAR || 'default';

// Main workflow logic
async function main() {
  // 1. [Step description]
  // 2. [Step description]
  // 3. [Step description]
}

// Execute
const result = await main();

// Return summary
return {
  success: true,
  // ... summary data
};
```

### C. Related Documents

- Technical Specifications: `docs/technical-specs/workflow-templates.md`
- API Documentation: `docs/api/templates.md`
- User Guide: `docs/user-guide/workflow-templates.md`

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-17 | Code Mode Team | Initial draft |

---

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| Security Lead | | | |
