---
name: Anti-slop
description: Fix AI Slop
---

I want to follow the **Anti AI-slop rule**: clean up any AI-generated code patterns that harm readability and maintainability. Please look around at the files that were changed. If there are any with "AI slop" patterns, make targeted changes to clean them up. Stick to a single file maximum. If no changes are necessary, then do nothing.

**What qualifies as AI slop in code:**

1. **Overly verbose comments** - Comments that restate exactly what the code does (e.g., `// increment counter by 1` above `counter++`)
2. **Excessive defensive programming** - Unnecessary null checks, try-catches, or validations that clutter the logic without providing real safety
3. **Redundant type annotations** - Type declarations that are already inferred by the language/compiler
4. **Boilerplate explosion** - Creating separate classes/functions/files for trivial operations that could be a simple expression
5. **Over-abstraction** - Interfaces with single implementations, factories that create one thing, strategy patterns for two options
6. **Verbose variable names that obscure intent** - e.g., `currentUserAuthenticationStatusBoolean` instead of `isAuthenticated`
7. **Unnecessary intermediate variables** - Variables used exactly once on the next line purely to "document" a step
8. **Repetitive error handling** - Copy-pasted try-catch blocks that could be consolidated
9. **Filler documentation** - JSDoc/docstrings that add no information beyond the function signature
10. **"Just in case" code** - Unused parameters, dead code paths, or features built for hypothetical future needs

**The goal:** Code should be concise, readable, and no more complex than necessary. Remove ceremony, not functionality.
