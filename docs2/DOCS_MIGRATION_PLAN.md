# Docusaurus to Mintlify Migration Plan

## Overview

This document tracks the migration of Continue's documentation from Docusaurus (/docs) to Mintlify (/docs2). Both documentation sites will run in parallel until the migration is complete and validated.

## Current State Analysis

### Docusaurus Setup (v3.7.0)

- **Content**: ~200+ documentation pages
- **Navigation**: Multi-level sidebar with categories
- **Features**:
  - Algolia search integration
  - PostHog analytics
  - 100+ redirects
  - Internationalization (zh-CN)
  - Custom plugins (llms-txt)
  - Extensive use of Tabs component

### Mintlify Target Structure

- **Format**: MDX with YAML frontmatter
- **Navigation**: mint.json configuration with 4 main tabs:
  - User Guide (getting started, features)
  - Customize (models, prompts, rules)
  - Hub (assistants, blocks, governance)
  - Reference (API, troubleshooting)
- **Components**: Frame, Card, Steps, Note
- **Assets**: Organized /images directory

## Migration Phases

### Phase 1: Foundation Setup (Hour 1)

- [ ] Install Mintlify CLI and dependencies
- [ ] Create mint.json with 4-tab structure (User Guide, Customize, Hub, Reference)
- [ ] Map current content to new tab organization:
  - Getting Started + Features → User Guide
  - Customization + Advanced/Model sections → Customize
  - Hub content → Hub
  - Reference + Troubleshooting → Reference
- [ ] Set up basic theme and branding
- [ ] Configure development environment (parallel to /docs)

### Phase 2: Automated Content Migration (Hour 2)

- [ ] Run Mintlify scraping tool: `mintlify-scrape section https://docs.continue.dev`
- [ ] Review and organize scraped content
- [ ] Fix file naming and directory structure
- [ ] Initial content validation

### Phase 3: Component & Feature Migration (Hour 3-4)

- [ ] Convert Docusaurus Tabs to Mintlify tabs/cards
- [ ] Convert Admonitions to Mintlify Note components
- [ ] Update all image paths from `/img/` to `/images/`
- [ ] Migrate code block syntax and highlighting
- [ ] Convert custom components to Mintlify equivalents

### Phase 4: Advanced Features (Hour 5)

- [ ] Migrate 100+ redirects to Mintlify format
- [ ] Handle internationalization (if supported)
- [ ] Replace custom plugins functionality
- [ ] _Defer: Search functionality (Algolia) - implement after go-live_
- [ ] _Defer: Analytics (PostHog) - implement after go-live_

### Phase 5: Quality Assurance (Hour 6)

- [ ] Content review for formatting issues
- [ ] Link validation
- [ ] Image optimization
- [ ] Performance testing
- [ ] Cross-browser testing

### Phase 6: Launch Preparation (Hour 7)

- [ ] Final content sync between /docs and /docs2
- [ ] DNS/hosting configuration for cutover
- [ ] Redirect testing from old URLs
- [ ] Rollback plan (keep /docs available)
- [ ] Documentation team training
- [ ] Plan deprecation timeline for /docs

### Phase 7: Post-Launch (Hour 8)

- [ ] Configure Algolia search for Mintlify
- [ ] Set up PostHog analytics
- [ ] Monitor traffic and user feedback
- [ ] Address any critical issues
- [ ] Deprecate /docs after validation period

## Technical Considerations

### Component Mapping

| Docusaurus        | Mintlify       | Notes                                     |
| ----------------- | -------------- | ----------------------------------------- |
| @theme/Tabs       | CardGroup/Tabs | Extensive usage, needs careful conversion |
| @theme/Admonition | Note           | Less common, straightforward conversion   |
| Images            | Frame          | May need wrapping for consistency         |
| Code blocks       | Code blocks    | Check syntax highlighting support         |

### Redirect Strategy

- Export redirects from docusaurus.config.js
- Convert to Mintlify redirect format
- Test critical redirects first
- Monitor 404s post-migration

### Search Migration (Post-Launch)

- Document current Algolia configuration
- Evaluate Mintlify search capabilities
- Plan for search index rebuild after go-live
- Maintain search on /docs until cutover

## Risk Mitigation

1. **Content Loss**: Keep full backup of original docs
2. **Broken Links**: Use link checker tools
3. **SEO Impact**: Maintain URL structure where possible
4. **Feature Gaps**: Document any lost functionality

## Success Metrics

- [ ] All content migrated successfully
- [ ] No broken links or images
- [ ] Content properly organized in 4-tab structure
- [ ] Page load performance ≤ current
- [ ] Smooth cutover with minimal downtime
- [ ] Search functionality restored post-launch
- [ ] Analytics continuity maintained

## Progress Tracking

### Week 1 Status - Phase 1: Foundation Setup

- Started: 2025-01-07
- Completed: 2025-01-07
- Blockers: None
- Notes: 
  - ✅ Created mint.json with 4-tab structure (User Guide, Customize, Hub, Reference)
  - ✅ Mapped all content categories to preserve existing URLs
  - ✅ Set up branding matching Docusaurus theme with Mintlify colors
  - ✅ Verified parallel development environment (runs on port 3001)
  - ✅ Created CONTENT_MAPPING.md for tracking organization

### Week 2 Status

- Started: [DATE]
- Completed:
- Blockers:
- Notes:

[Continue for each week...]

## Issues & Resolutions

Document any issues encountered and their resolutions here.

## Post-Migration Tasks

- [ ] Archive old Docusaurus setup
- [ ] Update CI/CD pipelines
- [ ] Update documentation contribution guides
- [ ] Monitor analytics for traffic patterns
- [ ] Gather team feedback

## Resources

- [Mintlify Migration Guide](https://mintlify.com/docs/guides/migration)
- [Mintlify Documentation](https://mintlify.com/docs)
- [Current Docs](https://docs.continue.dev) - Will remain live during migration
- [New Docs (Staging)](http://localhost:3000) - Local development
- [New Docs (Production)](TBD) - Will run in parallel until cutover

## Parallel Running Strategy

1. Both /docs (Docusaurus) and /docs2 (Mintlify) will run simultaneously
2. No changes to production /docs during migration
3. All new content goes to /docs2
4. Gradual transition of users through:
   - Internal testing
   - Beta user feedback
   - Soft launch with select users
   - Full cutover with redirects
5. Keep /docs available for rollback for 30 days post-cutover
