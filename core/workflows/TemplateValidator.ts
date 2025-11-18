/**
 * Template Validator Service
 *
 * Validates template code, metadata, and configuration.
 * Performs syntax validation, security scanning, and best practice checks.
 */

import * as ts from 'typescript';
import {
  Template,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SecurityIssue,
  ConfigSchema,
  ConfigProperty,
} from './types';

export class TemplateValidator {
  private readonly AVAILABLE_MCP_SERVERS = [
    'github',
    'slack',
    'filesystem',
    'sentry',
    'snyk',
    'supabase',
    'netlify',
    'notion',
    'chrome-devtools',
    'atlassian',
    'dlt',
    'posthog',
    'sanity',
  ];

  private readonly MAX_COMPLEXITY = 50;

  private readonly FORBIDDEN_PATTERNS = [
    { pattern: /eval\s*\(/gi, message: 'Use of eval() is forbidden' },
    { pattern: /Function\s*\(/gi, message: 'Use of Function() constructor is forbidden' },
    { pattern: /process\.exit\s*\(/gi, message: 'Use of process.exit() is forbidden' },
    { pattern: /process\.kill\s*\(/gi, message: 'Use of process.kill() is forbidden' },
    { pattern: /child_process/gi, message: 'Use of child_process is forbidden' },
    { pattern: /fs\.unlink/gi, message: 'File deletion outside /tmp is forbidden' },
    { pattern: /fs\.rm/gi, message: 'File removal outside /tmp is forbidden' },
    { pattern: /require\s*\(/gi, message: 'Use of require() for unauthorized modules is forbidden' },
  ];

  /**
   * Validate template syntax and structure
   */
  async validateTemplate(template: Template): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Validate metadata
    const metadataErrors = this.validateMetadata(template);
    errors.push(...metadataErrors);

    // 2. Validate TypeScript syntax
    const syntaxErrors = this.validateSyntax(template.code);
    errors.push(...syntaxErrors);

    // 3. Validate imports
    const importErrors = this.validateImports(template.code, template.mcpServers);
    errors.push(...importErrors);

    // 4. Security scan
    const securityIssues = await this.securityScan(template.code);
    errors.push(...securityIssues);

    // 5. Complexity check
    const complexity = this.calculateComplexity(template.code);
    if (complexity > this.MAX_COMPLEXITY) {
      warnings.push({
        type: 'complexity',
        message: `High complexity: ${complexity} (max recommended: ${this.MAX_COMPLEXITY})`,
      });
    }

    // 6. Best practices check
    const bestPracticeWarnings = this.checkBestPractices(template.code);
    warnings.push(...bestPracticeWarnings);

    // 7. Validate config schema
    const configErrors = this.validateConfigSchema(template.configSchema);
    errors.push(...configErrors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate template metadata
   */
  private validateMetadata(template: Template): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required fields
    if (!template.id || template.id.trim() === '') {
      errors.push({
        type: 'syntax',
        message: 'Template ID is required',
      });
    }

    if (!template.name || template.name.trim() === '') {
      errors.push({
        type: 'syntax',
        message: 'Template name is required',
      });
    }

    if (!template.description || template.description.trim() === '') {
      errors.push({
        type: 'syntax',
        message: 'Template description is required',
      });
    }

    if (!template.code || template.code.trim() === '') {
      errors.push({
        type: 'syntax',
        message: 'Template code is required',
      });
    }

    // Version validation
    if (template.version && !this.isValidSemver(template.version)) {
      errors.push({
        type: 'syntax',
        message: `Invalid version format: ${template.version}. Use semantic versioning (e.g., 1.0.0)`,
      });
    }

    // Category validation
    const validCategories = [
      'github-automation',
      'code-quality',
      'security',
      'data-processing',
      'devops',
      'reporting',
      'notifications',
      'other',
    ];
    if (!validCategories.includes(template.category)) {
      errors.push({
        type: 'syntax',
        message: `Invalid category: ${template.category}`,
      });
    }

    return errors;
  }

  /**
   * Validate TypeScript syntax
   */
  private validateSyntax(code: string): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      const sourceFile = ts.createSourceFile(
        'template.ts',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      // Check for syntax errors
      const diagnostics = [
        ...sourceFile.parseDiagnostics,
      ];

      for (const diagnostic of diagnostics) {
        if (diagnostic.file && diagnostic.start !== undefined) {
          const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          errors.push({
            type: 'syntax',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            line: line + 1,
            column: character + 1,
          });
        } else {
          errors.push({
            type: 'syntax',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          });
        }
      }
    } catch (error: any) {
      errors.push({
        type: 'syntax',
        message: `TypeScript parsing error: ${error.message}`,
      });
    }

    return errors;
  }

  /**
   * Validate imports and MCP server dependencies
   */
  private validateImports(code: string, declaredMcpServers: string[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Extract import statements
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
    const matches = Array.from(code.matchAll(importRegex));

    for (const match of matches) {
      const moduleName = match[2];

      // Check if it's an MCP import
      if (moduleName.startsWith('/mcp')) {
        // Extract MCP server name from import
        const importedServers = match[1].split(',').map(s => s.trim());

        for (const server of importedServers) {
          // Check if server is available
          if (!this.AVAILABLE_MCP_SERVERS.includes(server)) {
            errors.push({
              type: 'import',
              message: `Unknown MCP server: ${server}`,
            });
          }

          // Check if server is declared in template metadata
          if (!declaredMcpServers.includes(server)) {
            errors.push({
              type: 'import',
              message: `MCP server '${server}' is imported but not declared in mcpServers metadata`,
            });
          }
        }
      }
    }

    // Check if all declared servers are used
    for (const server of declaredMcpServers) {
      if (!code.includes(server)) {
        errors.push({
          type: 'import',
          message: `MCP server '${server}' is declared but not used in code`,
        });
      }
    }

    return errors;
  }

  /**
   * Security scan for common vulnerabilities
   */
  async securityScan(code: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check forbidden patterns
    for (const { pattern, message } of this.FORBIDDEN_PATTERNS) {
      const match = code.match(pattern);
      if (match) {
        issues.push({
          type: 'security',
          message,
          severity: 'high',
          recommendation: 'Remove this code or use a safe alternative',
        });
      }
    }

    // Check for hardcoded secrets (basic patterns)
    const secretPatterns = [
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, name: 'API key' },
      { pattern: /password\s*=\s*['"][^'"]+['"]/gi, name: 'password' },
      { pattern: /token\s*=\s*['"][^'"]+['"]/gi, name: 'token' },
      { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, name: 'secret' },
    ];

    for (const { pattern, name } of secretPatterns) {
      const match = code.match(pattern);
      if (match) {
        issues.push({
          type: 'security',
          message: `Potential hardcoded ${name} detected`,
          severity: 'critical',
          recommendation: `Use environment variables or secrets manager instead`,
        });
      }
    }

    // Check for SQL injection risks
    if (code.includes('SELECT') || code.includes('INSERT') || code.includes('UPDATE')) {
      if (!code.includes('?') && !code.includes('$1')) {
        issues.push({
          type: 'security',
          message: 'Potential SQL injection risk: use parameterized queries',
          severity: 'high',
          recommendation: 'Use parameterized queries with placeholders',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate code complexity (cyclomatic complexity approximation)
   */
  calculateComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const decisionPatterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*:/g, // Ternary operator
      /&&/g,
      /\|\|/g,
    ];

    for (const pattern of decisionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Check for best practices
   */
  private checkBestPractices(code: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for error handling
    if (!code.includes('try') && !code.includes('catch')) {
      warnings.push({
        type: 'best-practice',
        message: 'Template should include try-catch blocks for error handling',
      });
    }

    // Check for logging
    if (!code.includes('console.log') && !code.includes('console.error')) {
      warnings.push({
        type: 'best-practice',
        message: 'Template should include logging statements for debugging',
      });
    }

    // Check for return statement
    if (!code.includes('return')) {
      warnings.push({
        type: 'best-practice',
        message: 'Template should return a result object',
      });
    }

    // Check for async/await
    const hasAsync = code.includes('async');
    const hasAwait = code.includes('await');

    if (hasAwait && !hasAsync) {
      warnings.push({
        type: 'best-practice',
        message: 'Using await without async function declaration',
      });
    }

    return warnings;
  }

  /**
   * Validate configuration schema
   */
  private validateConfigSchema(schema: ConfigSchema): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!schema || typeof schema !== 'object') {
      errors.push({
        type: 'syntax',
        message: 'Config schema must be an object',
      });
      return errors;
    }

    if (schema.type !== 'object') {
      errors.push({
        type: 'syntax',
        message: 'Config schema type must be "object"',
      });
    }

    if (!schema.properties || typeof schema.properties !== 'object') {
      errors.push({
        type: 'syntax',
        message: 'Config schema must have properties object',
      });
      return errors;
    }

    // Validate each property
    for (const [key, prop] of Object.entries(schema.properties)) {
      const propErrors = this.validateConfigProperty(key, prop);
      errors.push(...propErrors);
    }

    // Validate required fields
    if (schema.required && !Array.isArray(schema.required)) {
      errors.push({
        type: 'syntax',
        message: 'Config schema required must be an array',
      });
    }

    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!schema.properties[requiredField]) {
          errors.push({
            type: 'syntax',
            message: `Required field '${requiredField}' not defined in properties`,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate a single config property
   */
  private validateConfigProperty(key: string, prop: ConfigProperty): ValidationError[] {
    const errors: ValidationError[] = [];

    const validTypes = ['string', 'number', 'boolean', 'array'];
    if (!validTypes.includes(prop.type)) {
      errors.push({
        type: 'syntax',
        message: `Invalid property type for '${key}': ${prop.type}`,
      });
    }

    if (!prop.description) {
      errors.push({
        type: 'syntax',
        message: `Property '${key}' must have a description`,
      });
    }

    if (prop.pattern && prop.type !== 'string') {
      errors.push({
        type: 'syntax',
        message: `Property '${key}' has pattern but is not a string type`,
      });
    }

    if ((prop.minimum !== undefined || prop.maximum !== undefined) && prop.type !== 'number') {
      errors.push({
        type: 'syntax',
        message: `Property '${key}' has min/max but is not a number type`,
      });
    }

    return errors;
  }

  /**
   * Extract configuration schema from code
   */
  extractConfigSchema(code: string): ConfigSchema {
    const schema: ConfigSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Extract environment variable usage
    const envRegex = /process\.env\.(\w+)/g;
    const matches = Array.from(code.matchAll(envRegex));

    for (const match of matches) {
      const varName = match[1];

      if (!schema.properties[varName]) {
        // Try to infer type from usage
        const fullMatch = code.substring(match.index!, match.index! + 100);

        let type: 'string' | 'number' | 'boolean' | 'array' = 'string';
        let defaultValue: any = undefined;

        if (fullMatch.includes('parseInt(')) {
          type = 'number';
        } else if (fullMatch.includes('parseFloat(')) {
          type = 'number';
        } else if (fullMatch.includes('=== \'true\'') || fullMatch.includes('=== \'false\'')) {
          type = 'boolean';
        }

        // Try to extract default value
        const defaultRegex = new RegExp(`process\\.env\\.${varName}\\s*\\|\\|\\s*['"]([^'"]+)['"]`);
        const defaultMatch = fullMatch.match(defaultRegex);
        if (defaultMatch) {
          defaultValue = defaultMatch[1];
          if (type === 'number') {
            defaultValue = parseFloat(defaultValue);
          } else if (type === 'boolean') {
            defaultValue = defaultValue === 'true';
          }
        }

        schema.properties[varName] = {
          type,
          description: `Configuration for ${varName}`,
          ...(defaultValue !== undefined && { default: defaultValue }),
        };

        // If no default value, mark as required
        if (defaultValue === undefined && !fullMatch.includes('||')) {
          schema.required.push(varName);
        }
      }
    }

    return schema;
  }

  /**
   * Verify that all MCP server dependencies are available
   */
  verifyDependencies(mcpServers: string[]): boolean {
    return mcpServers.every(server => this.AVAILABLE_MCP_SERVERS.includes(server));
  }

  /**
   * Check if a string is valid semver
   */
  private isValidSemver(version: string): boolean {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }
}
