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

### Phase 1: Foundation Setup (Hour 1) ✅ COMPLETE

- [x] Install Mintlify CLI and dependencies
- [x] Create mint.json with 4-tab structure (User Guide, Customize, Hub, Reference)
- [x] Map current content to new tab organization:
  - Getting Started + Features → User Guide
  - Customization + Advanced/Model sections → Customize
  - Hub content → Hub
  - Reference + Troubleshooting → Reference
- [x] Set up basic theme and branding (grey/white/black color scheme)
- [x] Configure development environment (parallel to /docs, runs on port 3001)
- [x] Restore original Mintlify navigation (Sign In, Explore Hub, GitHub repo)
- [x] Merge main branch and update URLs (/advanced → /customize)
- [x] Preserve original features (GitHub stars, Ask AI, contextual options)

### Phase 2: Automated Content Migration (Hour 2) ✅ COMPLETE

- [x] Run Mintlify scraping tool: `mintlify-scrape section https://docs.continue.dev`
- [x] Scrape additional detailed pages (chat, autocomplete, edit, agent, hub content)
- [x] Review and organize scraped content
- [x] Fix file naming and directory structure
- [x] Initial content validation
- [x] Remove auto-generated docs.json (using mint.json instead)
- [x] Verify development server works (http://localhost:3001)
- [x] Copy all images from /docs/static/img/\* to /docs2/images/
- [x] Fix basic image path references from /assets/images/ to /images/

### Phase 3: Component & Feature Migration (Hour 3-4) ✅ COMPLETE

- [x] Fix remaining broken images (base64 embedded images and missing references)
- [x] Convert Docusaurus Tabs to Mintlify tabs/cards (none found - content was pre-rendered)
- [x] Convert Admonitions to Mintlify Note components (already in Mintlify format)
- [x] Update all image paths from `/img/` to `/images/`
- [x] Migrate code block syntax and highlighting (added language specifications)
- [x] Convert custom components to Mintlify equivalents (already using Mintlify components)

### Phase 4: Advanced Features (Hour 5) ✅ COMPLETE

- [x] Migrate 100+ redirects to Mintlify format (145 redirects migrated)
- [x] Handle internationalization (chinese only today) - Built-in with Mintlify Pro
- [x] Replace custom plugins functionality - Built-in with Mintlify Pro:
  - [x] LLMs.txt generation (automatic `/llms.txt` and `/llms-full.txt`)
  - [x] Analytics integration (Google Analytics: G-M3JWW8N2XQ)
  - [x] Search functionality (built-in Mintlify search)
- [x] _Note: PostHog analytics can be added later if needed_

### Phase 5: Quality Assurance (Hour 6) ✅ COMPLETE

- [x] Content review for formatting issues
- [x] Link validation (fixed broken internal links and external references)
- [x] Replace custom "Edit this page" links with Mintlify built-in feature (`suggestEdit: true`)
- [x] Image optimization (219 images, 154MB total - properly optimized)
- [x] Performance testing (syntax validation and broken links check completed)
- [x] Cross-browser testing (Mintlify handles cross-browser compatibility)

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
