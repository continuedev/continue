# Product Requirements Document: Documentation Restructuring

## Executive Summary
This PRD outlines the plan to restructure Continue's documentation from 10+ navigation sections to 5 main sections, improving discoverability and user experience.

## Goals
1. **Improve Discoverability** - Make features easier to find without prior knowledge
2. **Simplify Navigation** - Reduce from 10+ to 5 main sections
3. **Standardize Content** - Consistent structure across all feature pages
4. **Maintain SEO** - Preserve existing URLs with proper redirects

## Timeline: 4-Day Implementation Plan

### Day 1: Planning & Documentation
**Tasks:**
- [x] Create comprehensive URL mapping document (old → new paths)
- [x] Document all internal link dependencies
- [x] Create redirect strategy for netlify.toml
- [x] Set up staging environment for testing

**Deliverables:**
- URL_MAPPING.md with all path changes
- Internal links audit document
- Draft netlify.toml with redirects

### Day 2: Structure Implementation
**Tasks:**
- [x] Restructure sidebars.js with 5 main sections
- [x] Update top navigation in docusaurus.config.js
- [x] Create new directory structure
- [x] Move files to new locations
- [x] Create section overview pages
- [x] Set up Guides section structure

**Deliverables:**
- Updated sidebars.js
- Updated top navigation bar
- Reorganized file structure
- 5 new section overview pages
- Guides section scaffold

### Day 3: Content Updates
**Tasks:**
- [x] Standardize feature pages (How it works, Quick start)
- [x] Implement VS Code/JetBrains tabbed install guides
  - [x] Fix broken image
- [x] Update all internal links
- [ ] Add installation reminders in feature intros

**Deliverables:**
- Standardized feature documentation
- Updated install guides with tabs
- Fixed internal links

### Day 4: Testing & Deployment
**Tasks:**
- [ ] Test all redirects on staging
- [ ] Verify no broken links
- [ ] Performance testing
- [ ] Deploy to production
- [ ] Monitor 404 errors

**Deliverables:**
- Testing report
- Deployment checklist
- Post-deployment monitoring plan

## New Information Architecture (5 Main Sections)

### Top Navigation Bar Updates
The top navigation will be updated to include:
1. **Documentation** (renamed from "User Guide") - Links to the main docs
2. **Guides** (NEW) - Tutorials and how-to articles converted from blog posts
   - Example: "Using Ollama with Continue: A Developer's Guide"
   - Will migrate relevant blog content to structured guides
3. **Explore** - Direct link to the Continue Hub

## Documentation Structure

### 1. Getting Started
```
getting-started/
├── install.mdx (with VS Code/JetBrains tabs)
├── overview.mdx
└── quick-start.mdx
```

### 2. Core Features
```
features/
├── overview.mdx
├── chat/
│   ├── how-it-works.mdx
│   └── quick-start.mdx
├── autocomplete/
│   ├── how-it-works.mdx
│   └── quick-start.mdx
├── edit/
│   ├── how-it-works.mdx
│   └── quick-start.mdx
└── agent/
    ├── how-it-works.mdx
    └── quick-start.mdx
```

### 3. Customization
```
customization/
├── overview.mdx
├── models.mdx
├── rules.mdx
└── blocks/
    ├── overview.mdx
    ├── mcp-tools.mdx
    └── prompts.mdx
```

### 4. Hub & Sharing
```
hub/
├── overview.mdx
├── community.mdx
├── publishing.mdx
├── featured-assistants.mdx
└── using-assistants.mdx
```

### 5. Advanced
```
advanced/
├── overview.mdx
├── context-integration/
│   ├── codebase.mdx
│   ├── documentation.mdx
│   ├── custom-providers.mdx
│   └── slash-commands.mdx
├── deep-dives/
├── model-providers/
├── model-roles/
├── telemetry.mdx
├── troubleshooting.mdx
├── reference.mdx
└── yaml-migration.mdx
```

## Redirect Strategy

### Implementation
1. Track all URL changes in URL_MAPPING.md
2. Generate netlify.toml redirects with 301 status codes
3. Test redirects on staging before production

### Example Redirects
```toml
[[redirects]]
  from = "/chat/how-to-use-it"
  to = "/features/chat/quick-start"
  status = 301

[[redirects]]
  from = "/autocomplete/how-to-use-it"
  to = "/features/autocomplete/quick-start"
  status = 301
```

## Success Metrics
1. **User Navigation Time** - Reduced time to find features
2. **404 Error Rate** - <0.1% after redirect implementation
3. **Documentation Feedback** - Improved user satisfaction scores
4. **Search Performance** - Better SEO rankings maintained

## Risk Mitigation
1. **Broken Links** - Comprehensive redirect testing on staging
2. **SEO Impact** - 301 redirects preserve link equity
3. **User Confusion** - Clear migration notices if needed
4. **Rollback Plan** - Git history allows quick reversion

## Testing Checklist
- [x] All old URLs redirect to new locations
- [x] Internal links work correctly
- [ ] Search functionality updated
- [ ] Mobile navigation works
- [ ] No console errors
- [ ] Page load performance acceptable

## Post-Launch Tasks
1. Monitor 404 errors for first week
2. Update external documentation links
3. Notify community of changes
4. Gather user feedback
5. Iterate based on analytics

## Approval & Sign-off
- [ ] Engineering Lead
- [ ] Product Manager
- [ ] Documentation Team
- [ ] Community Manager