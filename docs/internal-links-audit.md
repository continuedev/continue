# Internal Links Audit Report

## Summary

- **Total internal links found**: 181
- **Total markdown files**: 57
- **Links using `../` (parent directory)**: 74
- **Links using `./` (current directory)**: 35
- **Absolute links starting with `/`**: 48
- **Links to .mdx files**: 44
- **Links with anchors (#)**: 66

## Files with Most Internal Links

1. **reference.md** - 20 links
2. **hub/secrets/secret-resolution.md** - 9 links
3. **blocks/models.md** - 9 links
4. **customize/overview.md** - 8 links
5. **yaml-migration.md** - 7 links
6. **json-reference.md** - 7 links
7. **hub/blocks/block-types.md** - 7 links
8. **customize/deep-dives/configuration.md** - 7 links
9. **chat/context-selection.md** - 7 links
10. **agent/how-to-use-it.md** - 7 links

## Common Link Patterns

### 1. Cross-Directory References (Most Problematic)
- Files in `hub/blocks/` frequently link to `../../reference.md` and `../../customize/`
- Files in `chat/` link to `../customize/` and `../hub/`
- Files in subdirectories often need to traverse multiple levels (e.g., `../../`)

### 2. Frequently Linked Targets
- `./customize/deep-dives/settings.md` (4 times)
- `../customize/tutorials/build-your-own-context-provider.mdx` (3 times)
- `../customize/deep-dives/docs.mdx` (3 times)
- `../customize/deep-dives/codebase.mdx` (3 times)
- `../reference.md` and its anchors (multiple times)

### 3. Image References
- All images use absolute paths starting with `/img/`
- Examples: `/img/mcp-blocks-overview.png`, `/img/chat.gif`

## Potential Issues When Reorganizing

### 1. Deep Nesting Dependencies
Files in subdirectories like `hub/blocks/` have links going up two levels (`../../`) to reach:
- `reference.md`
- `customize/` directory content

### 2. Circular or Complex Dependencies
- `chat/` files link to `customize/`
- `customize/` files link back to feature directories
- `hub/` content links to both `customize/` and root-level files

### 3. Mixed Link Styles
- Some files use relative paths (`../`, `./`)
- Some use absolute paths (`/`)
- Some reference both `.md` and `.mdx` files
- 44 links point to `.mdx` files (need to ensure these remain valid)

### 4. Anchor Links
Many links include anchors (e.g., `../reference.md#models`), which means:
- Moving files requires updating both the path and ensuring anchors remain valid
- Need to track section headers in target files

## Recommendations for Reorganization

1. **Create a link mapping document** before moving files to track all internal references
2. **Consider using absolute paths** from documentation root to reduce complexity
3. **Group related content** to minimize cross-directory references
4. **Update tooling** to validate links after reorganization
5. **Pay special attention to**:
   - Files in `hub/blocks/` subdirectory (heavy use of `../../`)
   - Cross-references between feature directories (`chat/`, `edit/`, `agent/`)
   - References to `reference.md` and its anchors

## Most Critical Files to Handle Carefully

1. `reference.md` - Most linked-to file
2. `customize/deep-dives/` - Frequently referenced from multiple areas
3. `hub/blocks/block-types.md` - Central to block documentation
4. Feature directories (`chat/`, `edit/`, `agent/`) - Cross-reference each other