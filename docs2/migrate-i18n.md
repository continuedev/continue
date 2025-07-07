# Internationalization (i18n) Migration Plan

## Current State

- Docusaurus has complete Chinese (zh-CN) translations but they're **commented out** in config
- 79 translated markdown files exist in `/docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/`
- Theme translations exist in `/docs/i18n/zh-CN/code.json`

## Mintlify Pro i18n Approach

- Uses `versions` array in `mint.json` with `locale` values
- Supports Chinese as `cn` locale
- Auto-translates fixed UI text ("Was this page helpful?", etc.)
- Built-in internationalization feature in Mintlify Pro
- Requires manual content translation (which we already have)

## Migration Steps

### 1. Add Chinese Version to mint.json

```json
"versions": [
  {
    "name": "English",
    "locale": "en"
  },
  {
    "name": "中文",
    "locale": "cn"
  }
]
```

### 2. Create Chinese Content Structure

- Create `/docs2/cn/` directory
- Copy translated content from `/docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/`
- Update paths and frontmatter for Mintlify format

### 3. Update Navigation for Chinese

- Add version specification to navigation groups
- Ensure proper routing for Chinese pages

### 4. Content Format Migration

- Convert Docusaurus-specific syntax to Mintlify format
- Update image paths from `/img/` to `/images/`
- Convert components (Info, Warning, Tabs, etc.)

## Implementation Decision

For Phase 4, we have two options:

1. **Enable Chinese translations** - Full migration of existing Chinese content
2. **Document for future** - Create migration plan but defer implementation

Given that Chinese translations are currently disabled in production, **Option 2** is recommended for Phase 4 to avoid scope creep. The Chinese content is ready and can be migrated when needed.

## Files to Migrate (if enabled)

- `/docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/` → `/docs2/cn/`
- 79 translated markdown files
- Navigation structure adaptation
- Theme translations (handled automatically by Mintlify)

## Next Steps

1. Document the migration approach
2. Create helper scripts for content conversion
3. Test with a small subset of Chinese pages
4. Full migration when Chinese localization is prioritized
