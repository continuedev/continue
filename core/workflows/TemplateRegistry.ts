/**
 * Template Registry Service
 *
 * Manages template catalog, metadata, and lifecycle.
 * Provides methods for listing, searching, and managing templates.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Template,
  TemplateMetadata,
  TemplateFilters,
  PaginatedResponse,
  ValidationResult,
} from './types';
import { TemplateValidator } from './TemplateValidator';

export class TemplateRegistry {
  private templates: Map<string, Template> = new Map();
  private templateDir: string;
  private validator: TemplateValidator;
  private cacheInitialized: boolean = false;

  constructor(templateDir: string) {
    this.templateDir = templateDir;
    this.validator = new TemplateValidator();
  }

  /**
   * Initialize the registry by loading all templates from disk
   */
  async initialize(): Promise<void> {
    if (this.cacheInitialized) {
      return;
    }

    console.log('[TemplateRegistry] Initializing template registry...');
    await this.loadTemplatesFromDisk();
    this.cacheInitialized = true;
    console.log(`[TemplateRegistry] Loaded ${this.templates.size} templates`);
  }

  /**
   * Load all templates from the template directory
   */
  private async loadTemplatesFromDisk(): Promise<void> {
    try {
      const categories = await fs.readdir(this.templateDir);

      for (const category of categories) {
        const categoryPath = path.join(this.templateDir, category);
        const stat = await fs.stat(categoryPath);

        if (!stat.isDirectory()) continue;

        const templateDirs = await fs.readdir(categoryPath);

        for (const templateDir of templateDirs) {
          const templatePath = path.join(categoryPath, templateDir);
          const templateStat = await fs.stat(templatePath);

          if (!templateStat.isDirectory()) continue;

          try {
            const template = await this.loadTemplateFromDirectory(templatePath, category);
            this.templates.set(template.id, template);
          } catch (error) {
            console.error(`[TemplateRegistry] Failed to load template from ${templatePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[TemplateRegistry] Failed to load templates from disk:', error);
      throw error;
    }
  }

  /**
   * Load a single template from a directory
   */
  private async loadTemplateFromDirectory(
    templatePath: string,
    category: string
  ): Promise<Template> {
    const metadataPath = path.join(templatePath, 'metadata.json');
    const codePath = path.join(templatePath, 'template.ts');

    // Load metadata
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    // Load code
    const code = await fs.readFile(codePath, 'utf-8');

    // Load README if exists
    let longDescription: string | undefined;
    try {
      const readmePath = path.join(templatePath, 'README.md');
      longDescription = await fs.readFile(readmePath, 'utf-8');
    } catch {
      // README is optional
    }

    // Construct template object
    const template: Template = {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      longDescription,
      version: metadata.version || '1.0.0',
      author: metadata.author || 'Code Mode Team',
      createdAt: new Date(metadata.createdAt || Date.now()),
      updatedAt: new Date(metadata.updatedAt || Date.now()),
      category: metadata.category || category,
      tags: metadata.tags || [],
      difficulty: metadata.difficulty || 'intermediate',
      code,
      mcpServers: metadata.mcpServers || [],
      triggerTypes: metadata.triggerTypes || ['cron'],
      configSchema: metadata.configSchema || { type: 'object', properties: {}, required: [] },
      defaultConfig: metadata.defaultConfig || {},
      estimatedTokens: metadata.estimatedTokens || 0,
      estimatedDuration: metadata.estimatedDuration || 0,
      tokenReduction: metadata.tokenReduction || 0,
      useCases: metadata.useCases || [],
      exampleOutputUrl: metadata.exampleOutputUrl,
      documentationUrl: metadata.documentationUrl,
      requiredPermissions: metadata.requiredPermissions || [],
      visibility: metadata.visibility || 'public',
      organizationId: metadata.organizationId,
    };

    return template;
  }

  /**
   * List all templates with optional filters
   */
  async listTemplates(
    filters?: TemplateFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<TemplateMetadata>> {
    await this.initialize();

    let templates = Array.from(this.templates.values());

    // Apply filters
    if (filters) {
      if (filters.category) {
        templates = templates.filter(t => t.category === filters.category);
      }

      if (filters.triggerType) {
        templates = templates.filter(t => t.triggerTypes.includes(filters.triggerType!));
      }

      if (filters.mcpServer) {
        templates = templates.filter(t => t.mcpServers.includes(filters.mcpServer!));
      }

      if (filters.difficulty) {
        templates = templates.filter(t => t.difficulty === filters.difficulty);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
    }

    // Sort by usage count (if available) and rating
    templates.sort((a, b) => {
      const aScore = (a.usageCount || 0) * 0.7 + (a.rating || 0) * 0.3;
      const bScore = (b.usageCount || 0) * 0.7 + (b.rating || 0) * 0.3;
      return bScore - aScore;
    });

    const total = templates.length;
    const paginatedTemplates = templates.slice(offset, offset + limit);

    // Convert to metadata
    const metadata = paginatedTemplates.map(this.toMetadata);

    return {
      items: metadata,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get detailed template by ID
   */
  async getTemplate(templateId: string): Promise<Template | null> {
    await this.initialize();
    return this.templates.get(templateId) || null;
  }

  /**
   * Register new template (validation included)
   */
  async registerTemplate(template: Template): Promise<string> {
    // Validate template
    const validationResult = await this.validator.validateTemplate(template);

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map(e => e.message).join(', ');
      throw new Error(`Template validation failed: ${errorMessages}`);
    }

    // Check for duplicate ID
    if (this.templates.has(template.id)) {
      throw new Error(`Template with ID '${template.id}' already exists`);
    }

    // Add timestamps if not present
    if (!template.createdAt) {
      template.createdAt = new Date();
    }
    template.updatedAt = new Date();

    // Store in memory
    this.templates.set(template.id, template);

    // Optionally: persist to disk or database
    // await this.persistTemplate(template);

    console.log(`[TemplateRegistry] Registered template: ${template.id}`);

    return template.id;
  }

  /**
   * Update existing template
   */
  async updateTemplate(templateId: string, updates: Partial<Template>): Promise<void> {
    const existing = await this.getTemplate(templateId);

    if (!existing) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Merge updates
    const updated: Template = {
      ...existing,
      ...updates,
      id: existing.id, // ID cannot be changed
      updatedAt: new Date(),
    };

    // Validate updated template
    const validationResult = await this.validator.validateTemplate(updated);

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map(e => e.message).join(', ');
      throw new Error(`Template validation failed: ${errorMessages}`);
    }

    // Update in memory
    this.templates.set(templateId, updated);

    console.log(`[TemplateRegistry] Updated template: ${templateId}`);
  }

  /**
   * Delete template (soft delete)
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const template = await this.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Remove from memory
    this.templates.delete(templateId);

    console.log(`[TemplateRegistry] Deleted template: ${templateId}`);
  }

  /**
   * Search templates by keyword
   */
  async searchTemplates(query: string, limit: number = 50): Promise<TemplateMetadata[]> {
    const result = await this.listTemplates({ search: query }, limit, 0);
    return result.items;
  }

  /**
   * Reload templates from disk
   */
  async reload(): Promise<void> {
    this.templates.clear();
    this.cacheInitialized = false;
    await this.initialize();
  }

  /**
   * Get template count by category
   */
  async getTemplateCountByCategory(): Promise<Map<string, number>> {
    await this.initialize();

    const counts = new Map<string, number>();

    for (const template of this.templates.values()) {
      const current = counts.get(template.category) || 0;
      counts.set(template.category, current + 1);
    }

    return counts;
  }

  /**
   * Convert Template to TemplateMetadata
   */
  private toMetadata(template: Template): TemplateMetadata {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      difficulty: template.difficulty,
      mcpServers: template.mcpServers,
      triggerTypes: template.triggerTypes,
      tokenReduction: template.tokenReduction,
      usageCount: template.usageCount,
      rating: template.rating,
      author: template.author,
      version: template.version,
      tags: template.tags,
    };
  }
}

// Singleton instance
let registryInstance: TemplateRegistry | null = null;

/**
 * Get the global template registry instance
 */
export function getTemplateRegistry(templateDir?: string): TemplateRegistry {
  if (!registryInstance) {
    if (!templateDir) {
      throw new Error('Template directory must be provided for first initialization');
    }
    registryInstance = new TemplateRegistry(templateDir);
  }
  return registryInstance;
}
