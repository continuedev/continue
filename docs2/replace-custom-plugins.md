# Custom Plugin Replacement Plan

## Overview

This document outlines how to replace custom Docusaurus plugins and functionality with Mintlify Pro equivalents.

## Custom Plugins Analysis

### 1. Custom LLMs.txt Plugin ✅ BUILT-IN (Mintlify Pro)

**Current functionality:**

- Scans HTML files post-build
- Extracts titles, descriptions, URLs from all pages
- Organizes content by sections (Getting Started, Features, Guides, etc.)
- Generates structured `/llms.txt` file for AI model consumption

**Mintlify Pro replacement:**

- **Automatic `/llms.txt`** - Lists all available pages automatically
- **Automatic `/llms-full.txt`** - Combines entire documentation into single file
- **AI-optimized** - Specifically designed for LLM consumption
- **No custom code required** - Built-in feature

**Status:** ✅ Complete - No migration needed

### 2. Analytics Configuration ✅ BUILT-IN

**Current:**

- Google Analytics: `G-M3JWW8N2XQ`
- Custom Reo.dev script

**Mintlify replacement:**

- Native Google Analytics support in mint.json
- Custom scripts can be added via mint.json

### 3. Search Configuration ✅ BUILT-IN

**Current:**

- Algolia search (App ID: `0OMUMCQZVV`, Index: `continue`)

**Mintlify replacement:**

- Native search functionality built-in
- Can configure Algolia if needed

### 4. URL Redirects ✅ COMPLETE

**Status:** Already migrated (145 redirects) in mint.json

## Implementation Plan

### Phase 4A: Replace LLMs.txt Plugin

1. Create `generate-llms-txt.js` script
2. Adapt to work with Mintlify's build structure
3. Test with current docs2 content
4. Add to build process

### Phase 4B: Add Analytics

1. Add Google Analytics to mint.json
2. Migrate custom Reo.dev script if needed

### Phase 4C: Configure Search

1. Verify Mintlify search works
2. Configure Algolia if required

## Custom LLMs.txt Script for Mintlify

```javascript
// generate-llms-txt.js - Adapted for Mintlify
const fs = require("fs");
const path = require("path");

function generateLLMsTxt(buildDir) {
  const sections = {
    "Getting Started": [],
    Features: [],
    Guides: [],
    Customization: [],
    Customize: [],
    Hub: [],
    Reference: [],
  };

  // Read mint.json to get page structure
  const mintJson = JSON.parse(fs.readFileSync("mint.json", "utf8"));

  // Extract page info from navigation
  function extractPages(navItems, sectionName = "") {
    navItems.forEach((item) => {
      if (typeof item === "string") {
        // Direct page reference
        const pageInfo = getPageInfo(item);
        if (pageInfo) {
          categorizeContent(pageInfo, sections);
        }
      } else if (item.group && item.pages) {
        // Group with pages
        extractPages(item.pages, item.group);
      }
    });
  }

  extractPages(mintJson.navigation);

  // Generate llms.txt content
  generateContent(sections);
}
```

## Files to Create

1. **`/docs2/scripts/generate-llms-txt.js`** - LLMs.txt generator
2. **`/docs2/scripts/build-hooks.js`** - Post-build automation
3. **Update mint.json** - Add analytics and search config

## Success Criteria

- [ ] LLMs.txt generated correctly from Mintlify build
- [ ] Analytics tracking matches current setup
- [ ] Search functionality works as expected
- [ ] All redirects function properly
- [ ] No loss of functionality compared to Docusaurus

## Risk Assessment

**Low Risk:**

- Analytics migration (built-in support)
- Search configuration (native functionality)

**Medium Risk:**

- LLMs.txt generation (requires custom script)
- Custom JavaScript integration

**Mitigation:**

- Test scripts thoroughly before deployment
- Keep Docusaurus version running during transition
- Monitor analytics and search metrics post-migration
