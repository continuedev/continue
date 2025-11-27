/**
 * Validates and sanitizes regex patterns for use with ripgrep
 */

export interface RegexValidationResult {
  isValid: boolean;
  sanitizedQuery?: string;
  error?: string;
  warning?: string;
}

/**
 * Validates a regex pattern and attempts to sanitize common issues
 * @param query The regex pattern to validate
 * @returns Validation result with sanitized query if possible
 */
export function validateAndSanitizeRegex(query: string): RegexValidationResult {
  // Check for common problematic patterns that often fail with ripgrep
  const problematicPatterns = [
    {
      // Triple-escaped quotes
      pattern: /\\\\\\/g,
      issue: "Triple backslash sequences may cause parsing errors",
      fix: (s: string) => s.replace(/\\\\\\/g, "\\\\"),
    },
    {
      // Unescaped brackets/parentheses that are NOT part of valid regex constructs
      pattern: /(?<!\\)[\[\]()]/g, // Removed {} from here since they're valid quantifiers
      issue: "Unescaped brackets or parentheses",
      fix: null, // Just warn, don't auto-fix as it might be intentional
    },
    {
      // Unescaped braces that are NOT quantifiers (quantifiers are handled separately)
      pattern: /(?<!\\)\{(?![0-9,}]*\})/g,
      issue: "Unescaped braces that don't appear to be quantifiers",
      fix: null,
    },
    {
      // Raw tab/newline characters (not escaped)
      pattern: /[\t\n\r]/g,
      issue: "Raw whitespace characters should be escaped",
      fix: (s: string) =>
        s.replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r"),
    },
  ];

  let sanitizedQuery = query;
  let warnings: string[] = [];

  // Apply fixes for known issues
  for (const check of problematicPatterns) {
    if (check.pattern.test(query)) {
      if (check.fix) {
        sanitizedQuery = check.fix(sanitizedQuery);
        warnings.push(`Fixed: ${check.issue}`);
      } else {
        warnings.push(`Warning: ${check.issue}`);
      }
    }
  }

  // Try to compile as a JavaScript regex to catch basic syntax errors
  try {
    new RegExp(sanitizedQuery);
  } catch (e) {
    let errorMessage = e instanceof Error ? e.message : "Unknown error";
    // If it fails as a JS regex, it might still be valid for ripgrep
    // (ripgrep supports some patterns JS doesn't), but warn the user
    warnings.push(`Pattern may have syntax issues: ${errorMessage}`);
  }

  // Check for patterns that are valid regex but might not work as expected with ripgrep
  const ripgrepSpecificIssues = [
    {
      pattern: /\\[0-7]{3}/g,
      warning: "Octal escape sequences may not work as expected in ripgrep",
    },
    {
      pattern: /\(\?[<!=]/,
      warning:
        "Lookahead/lookbehind assertions require ripgrep to be compiled with PCRE2",
    },
  ];

  for (const issue of ripgrepSpecificIssues) {
    if (issue.pattern.test(sanitizedQuery)) {
      warnings.push(issue.warning);
    }
  }

  return {
    isValid: true,
    sanitizedQuery,
    warning: warnings.length > 0 ? warnings.join("; ") : undefined,
  };
}

/**
 * Escapes a literal string to be used as a regex pattern
 * @param literal The literal string to escape
 * @returns Escaped string safe for regex use
 */
export function escapeLiteralForRegex(literal: string): string {
  // Escape all regex metacharacters
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detects if a query looks like it's meant to be a literal search
 * rather than a regex pattern
 * @param query The search query
 * @returns true if it appears to be a literal search
 */
export function looksLikeLiteralSearch(query: string): boolean {
  // If it contains regex metacharacters but they're not escaped,
  // and it doesn't look like an intentional regex pattern
  const hasUnescapedMetachars = /[.*+?^${}()|[\]]/g.test(query);
  const hasEscapedMetachars = /\\[.*+?^${}()|[\]\\]/g.test(query);

  // Check for regex constructs, but be more specific about what we consider regex
  const hasEscapeSequences = /\\[dws]/g.test(query); // \d, \w, \s
  const hasQuantifiers = /\{[0-9,]+\}/g.test(query); // {2,4}, {3}

  // Check for bracket patterns and distinguish between character classes and array access
  const bracketPattern = /\[[^\]]*\]/g;
  const brackets = query.match(bracketPattern);
  let hasCharacterClasses = false;

  if (brackets) {
    hasCharacterClasses = brackets.some((bracket) => {
      const inside = bracket.slice(1, -1); // Remove [ ]
      // Character class indicators: ranges (a-z), multiple chars, negation (^)
      return /-/.test(inside) || inside.length > 1 || inside.startsWith("^");
    });
  }

  const hasRegexConstructs =
    hasEscapeSequences || hasQuantifiers || hasCharacterClasses;

  // Likely a literal search if it has unescaped metachars but no regex constructs
  return hasUnescapedMetachars && !hasEscapedMetachars && !hasRegexConstructs;
}

/**
 * Prepares a query for ripgrep by sanitizing problematic patterns
 * @param query The search query
 * @returns Object with sanitized query and any warnings
 */
export function prepareQueryForRipgrep(query: string): {
  query: string;
  warning?: string;
} {
  const validation = validateAndSanitizeRegex(query);

  return {
    query: validation.sanitizedQuery || query,
    warning: validation.warning,
  };
}
