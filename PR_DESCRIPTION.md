# Fix Code Editing Safety Issues: Prevent IndentationError and NameError

## Summary

This PR addresses 5 critical code editing issues that cause **IndentationError** and **NameError** when AI agents apply code changes. The fixes provide comprehensive safety through validation, detection, prevention, and education.

## Problem Statement

Continue's code editing system had systematic issues causing file corruption and runtime errors:

1. **IndentationError** from empty function bodies (lazy block reconstruction)
2. **IndentationError** from destroyed Python indentation (whitespace stripping)
3. **NameError** from editing wrong functions (AST false positives)
4. **NameError** from sequential edit conflicts (invalidated references)
5. Poor LLM guidance (vague tool instructions)

### Real-World Example

```python
# Before: Working code
def _path_matches_patterns(self, path: str, patterns: List[str]) -> bool:
    """Check if path matches any of the glob patterns."""
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)

# After AI edit: File corruption
def _path_matches_patterns(self, path: str, patterns: List[str]) -> bool:
# IndentationError: expected an indented block after function definition
```

This real crash (documented in screenshots) prevented the entire Python module from importing.

## Changes

### Issue 1: Lazy Block Reconstruction (Commit `0b95a87`)

**Fix**: Added syntax validation after code reconstruction

- Parse reconstructed code with tree-sitter
- Detect empty function/class bodies
- Return `null` on validation failure → fallback to safer method
- **Impact**: Prevents file corruption from reconstruction failures

**Files**: `core/edit/lazy/deterministic.ts`, `core/edit/lazy/deterministic.test.ts`

### Issue 2: Whitespace-Insensitive Matching (Commit `5d7405b`)

**Fix**: Language-aware matching strategies

- Detect indentation-sensitive languages (Python, YAML, Pug, etc.)
- Disable whitespace-insensitive matching for these languages
- Preserve exact indentation to prevent IndentationError
- **Impact**: Python block structure remains intact during edits

**Files**: `core/edit/searchAndReplace/findSearchMatch.ts`, `core/edit/searchAndReplace/findSearchMatch.vitest.ts`, `core/edit/searchAndReplace/performReplace.ts`, `core/tools/definitions/multiEdit.ts`, `core/tools/definitions/singleFindAndReplace.ts`

### Issue 3: AST Similarity False Positives (Commit `556c1f8`)

**Fix**: Stricter node similarity matching

- Check name fields explicitly (reject if different)
- Compare first 3 lines instead of 1 line
- Reduce Levenshtein threshold from 20% to 10%
- **Impact**: Functions like `calculate_tax()` and `calculate_total()` no longer confused

**Files**: `core/edit/lazy/deterministic.ts`, `core/edit/lazy/deterministic.test.ts`

### Issue 4: Sequential Edit Chain Failures (Commit `970282e`)

**Fix**: Pre-execution edit chain validation

- Simulate all edits before applying any
- Detect when edit N+1 targets strings modified by edit N
- All-or-nothing approach prevents partial corruption
- Helpful error messages with fix suggestions
- **Impact**: Prevents NameError from invalidated variable references

**Files**: `core/edit/searchAndReplace/performReplace.ts`, `core/edit/searchAndReplace/multiEdit.vitest.ts`, `core/util/errors.ts`

### Issue 5: Tool Instructions (Commit `5946f6b`)

**Fix**: Concrete examples and best practices in tool descriptions

- "SEQUENTIAL EDIT PLANNING" section with WRONG/RIGHT examples
- Three strategies: reorder edits, update old_string, use replace_all strategically
- "BEST PRACTICES" section for proper edit planning
- Python-specific requirements documented
- **Impact**: LLMs learn correct patterns upfront, reducing trial-and-error

**Files**: `core/tools/definitions/multiEdit.ts`, `core/tools/definitions/singleFindAndReplace.ts`

## Test Coverage

- **Issue 1**: 3 tests (empty body detection, syntax validation, real-world case)
- **Issue 2**: 5 tests (Python indentation, YAML, JavaScript compatibility)
- **Issue 3**: 1 test (similar function names correctly distinguished)
- **Issue 4**: 5 tests (conflict detection, helpful errors, valid sequences)
- **Total**: 14 new tests, all passing

## Impact

### Before This PR

- File corruption from empty function bodies ❌
- IndentationError in Python from whitespace stripping ❌
- NameError from editing wrong functions ❌
- NameError from sequential edit conflicts ❌
- Vague guidance leading to trial-and-error ❌

### After This PR

- File corruption prevented by validation ✅
- Python indentation preserved ✅
- Functions correctly distinguished ✅
- Edit conflicts detected before changes ✅
- Clear guidance with concrete examples ✅

### Safety Improvements

- **Validation**: Syntax checking prevents invalid code
- **Detection**: Conflict detection catches issues early
- **Prevention**: Language-aware matching preserves semantics
- **Education**: Tool descriptions teach correct patterns

## Breaking Changes

None. All changes are backward compatible:

- Validation only rejects invalid edits (which would have failed anyway)
- Language detection is additive (doesn't break existing behavior)
- Enhanced error messages are more helpful, not breaking
- Tool description updates are guidance only

## Migration Guide

No migration needed. The fixes are transparent to users:

1. Invalid edits now fail with helpful error messages instead of corrupting files
2. Python edits require exact indentation (as they should)
3. LLMs receive better guidance automatically

## Related Issues

This PR addresses systematic issues related to:

- IndentationError in Python code editing
- NameError from variable reference issues
- File corruption from lazy block reconstruction
- Sequential edit failures

## Checklist

- [x] All 5 issues documented and analyzed
- [x] Fixes implemented for all issues
- [x] Tests added and passing
- [x] TypeScript compilation clean
- [x] No breaking changes
- [x] Documentation updated (tool descriptions)
- [x] Real-world case study validated

## Additional Notes

The comprehensive issue analysis is available in `CODE_EDITING_ISSUES.md` (not included in PR, for documentation purposes).

All commits follow conventional commit format with detailed descriptions and co-authorship attribution to Claude.
