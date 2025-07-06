/**
 * Configuration system for unified lazy edit optimizations
 */

export interface LazyEditConfig {
  // Master controls
  enableAllOptimizations: boolean;
  fallbackToOriginal: boolean;
  maxProcessingTime: number;
  
  // Optimization-specific controls
  enableSimilarFunctionOptimization: boolean;
  enableReorderOptimization: boolean;
  enableTestOptimization: boolean;
  enableMarkdownOptimization: boolean;
  
  // Strategy selection thresholds
  complexityThreshold: number;
  confidenceThreshold: number;
  
  // Performance settings
  enableCaching: boolean;
  maxCacheSize: number;
  cacheTimeout: number;
  
  // Debugging and monitoring
  enableDebugLogging: boolean;
  enableMetrics: boolean;
  metricsCallback?: (metrics: ProcessingMetrics) => void;
}

export interface ProcessingMetrics {
  filename: string;
  fileType: string;
  strategy: string;
  processingTime: number;
  success: boolean;
  fallbacksUsed: string[];
  confidence: number;
  complexity: {
    functionCount: number;
    fileSize: number;
    changeRatio: number;
  };
}

// Default configuration optimized for general use
export const DEFAULT_LAZY_EDIT_CONFIG: LazyEditConfig = {
  // Master controls
  enableAllOptimizations: true,
  fallbackToOriginal: true,
  maxProcessingTime: 10000, // 10 seconds
  
  // Optimization-specific controls
  enableSimilarFunctionOptimization: true,
  enableReorderOptimization: true,
  enableTestOptimization: true,
  enableMarkdownOptimization: true,
  
  // Strategy selection thresholds
  complexityThreshold: 0.7,
  confidenceThreshold: 0.5,
  
  // Performance settings
  enableCaching: true,
  maxCacheSize: 100, // 100 cached results
  cacheTimeout: 300000, // 5 minutes
  
  // Debugging and monitoring
  enableDebugLogging: false,
  enableMetrics: false,
};

// Conservative configuration for production environments
export const CONSERVATIVE_LAZY_EDIT_CONFIG: LazyEditConfig = {
  ...DEFAULT_LAZY_EDIT_CONFIG,
  enableAllOptimizations: true,
  maxProcessingTime: 5000, // 5 seconds
  complexityThreshold: 0.8, // Higher threshold
  confidenceThreshold: 0.7, // Require higher confidence
  enableDebugLogging: false,
  enableMetrics: true,
};

// Aggressive configuration for development environments
export const AGGRESSIVE_LAZY_EDIT_CONFIG: LazyEditConfig = {
  ...DEFAULT_LAZY_EDIT_CONFIG,
  enableAllOptimizations: true,
  maxProcessingTime: 15000, // 15 seconds
  complexityThreshold: 0.5, // Lower threshold
  confidenceThreshold: 0.3, // Accept lower confidence
  enableCaching: true,
  maxCacheSize: 200,
  enableDebugLogging: true,
  enableMetrics: true,
};

// Minimal configuration that only uses basic optimizations
export const MINIMAL_LAZY_EDIT_CONFIG: LazyEditConfig = {
  ...DEFAULT_LAZY_EDIT_CONFIG,
  enableAllOptimizations: true,
  enableSimilarFunctionOptimization: false,
  enableReorderOptimization: false,
  enableTestOptimization: false,
  enableMarkdownOptimization: false,
  maxProcessingTime: 3000, // 3 seconds
  enableCaching: false,
  enableDebugLogging: false,
  enableMetrics: false,
};

// File-type specific configurations
export const FILE_TYPE_CONFIGS: Record<string, Partial<LazyEditConfig>> = {
  markdown: {
    enableMarkdownOptimization: true,
    enableSimilarFunctionOptimization: false,
    enableReorderOptimization: true,
    maxProcessingTime: 8000,
  },
  
  test: {
    enableTestOptimization: true,
    enableSimilarFunctionOptimization: true,
    enableReorderOptimization: false,
    maxProcessingTime: 12000,
  },
  
  javascript: {
    enableSimilarFunctionOptimization: true,
    enableReorderOptimization: true,
    enableTestOptimization: false,
    maxProcessingTime: 10000,
  },
  
  typescript: {
    enableSimilarFunctionOptimization: true,
    enableReorderOptimization: true,
    enableTestOptimization: false,
    maxProcessingTime: 12000, // TS parsing can be slower
  },
  
  python: {
    enableSimilarFunctionOptimization: true,
    enableReorderOptimization: true,
    enableTestOptimization: false,
    maxProcessingTime: 8000,
  },
};

/**
 * Create a configuration by merging base config with file-type specific and custom overrides
 */
export function createLazyEditConfig(
  baseConfig: LazyEditConfig = DEFAULT_LAZY_EDIT_CONFIG,
  fileType?: string,
  customOverrides?: Partial<LazyEditConfig>
): LazyEditConfig {
  let config = { ...baseConfig };
  
  // Apply file-type specific config
  if (fileType && FILE_TYPE_CONFIGS[fileType]) {
    config = { ...config, ...FILE_TYPE_CONFIGS[fileType] };
  }
  
  // Apply custom overrides
  if (customOverrides) {
    config = { ...config, ...customOverrides };
  }
  
  return config;
}

/**
 * Validate configuration and fix any issues
 */
export function validateLazyEditConfig(config: LazyEditConfig): LazyEditConfig {
  const validated = { ...config };
  
  // Ensure reasonable bounds
  validated.maxProcessingTime = Math.max(1000, Math.min(30000, validated.maxProcessingTime));
  validated.complexityThreshold = Math.max(0.1, Math.min(1.0, validated.complexityThreshold));
  validated.confidenceThreshold = Math.max(0.1, Math.min(1.0, validated.confidenceThreshold));
  validated.maxCacheSize = Math.max(10, Math.min(1000, validated.maxCacheSize));
  validated.cacheTimeout = Math.max(60000, Math.min(3600000, validated.cacheTimeout)); // 1 min to 1 hour
  
  // Logical dependencies
  if (!validated.enableAllOptimizations) {
    validated.enableSimilarFunctionOptimization = false;
    validated.enableReorderOptimization = false;
    validated.enableTestOptimization = false;
    validated.enableMarkdownOptimization = false;
  }
  
  if (!validated.enableCaching) {
    validated.maxCacheSize = 0;
  }
  
  return validated;
}

/**
 * Get configuration based on environment
 */
export function getEnvironmentConfig(): LazyEditConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return CONSERVATIVE_LAZY_EDIT_CONFIG;
    case 'test':
      return MINIMAL_LAZY_EDIT_CONFIG;
    case 'development':
    default:
      return AGGRESSIVE_LAZY_EDIT_CONFIG;
  }
}

/**
 * Configuration presets for common scenarios
 */
export const CONFIG_PRESETS = {
  default: DEFAULT_LAZY_EDIT_CONFIG,
  conservative: CONSERVATIVE_LAZY_EDIT_CONFIG,
  aggressive: AGGRESSIVE_LAZY_EDIT_CONFIG,
  minimal: MINIMAL_LAZY_EDIT_CONFIG,
  
  // Specific use case presets
  documentation: createLazyEditConfig(DEFAULT_LAZY_EDIT_CONFIG, 'markdown', {
    enableMarkdownOptimization: true,
    enableTestOptimization: false,
    enableSimilarFunctionOptimization: false,
  }),
  
  codebase: createLazyEditConfig(DEFAULT_LAZY_EDIT_CONFIG, 'javascript', {
    enableSimilarFunctionOptimization: true,
    enableReorderOptimization: true,
    enableTestOptimization: false,
  }),
  
  testing: createLazyEditConfig(DEFAULT_LAZY_EDIT_CONFIG, 'test', {
    enableTestOptimization: true,
    enableSimilarFunctionOptimization: false,
    enableMarkdownOptimization: false,
  }),
  
  mixed: createLazyEditConfig(AGGRESSIVE_LAZY_EDIT_CONFIG, undefined, {
    enableAllOptimizations: true,
    maxProcessingTime: 20000,
  }),
};

/**
 * Runtime configuration manager
 */
export class LazyEditConfigManager {
  private config: LazyEditConfig;
  private metrics: ProcessingMetrics[] = [];
  
  constructor(initialConfig: LazyEditConfig = DEFAULT_LAZY_EDIT_CONFIG) {
    this.config = validateLazyEditConfig(initialConfig);
  }
  
  getConfig(): LazyEditConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<LazyEditConfig>): void {
    this.config = validateLazyEditConfig({ ...this.config, ...updates });
  }
  
  getConfigForFile(filename: string): LazyEditConfig {
    const ext = filename.split('.').pop()?.toLowerCase();
    const fileType = this.detectFileType(ext || '');
    
    return createLazyEditConfig(this.config, fileType);
  }
  
  private detectFileType(extension: string): string | undefined {
    const typeMap: Record<string, string> = {
      'md': 'markdown',
      'markdown': 'markdown',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
    };
    
    return typeMap[extension];
  }
  
  recordMetrics(metrics: ProcessingMetrics): void {
    if (this.config.enableMetrics) {
      this.metrics.push(metrics);
      
      // Keep only recent metrics
      const maxMetrics = 1000;
      if (this.metrics.length > maxMetrics) {
        this.metrics = this.metrics.slice(-maxMetrics);
      }
      
      // Call metrics callback if provided
      if (this.config.metricsCallback) {
        this.config.metricsCallback(metrics);
      }
    }
  }
  
  getMetrics(): ProcessingMetrics[] {
    return [...this.metrics];
  }
  
  getSuccessRate(timeWindow?: number): number {
    let metricsToAnalyze = this.metrics;
    
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      metricsToAnalyze = this.metrics.filter(m => 
        // Assuming we add timestamp to metrics
        (m as any).timestamp > cutoff
      );
    }
    
    if (metricsToAnalyze.length === 0) return 0;
    
    const successCount = metricsToAnalyze.filter(m => m.success).length;
    return successCount / metricsToAnalyze.length;
  }
  
  getAverageProcessingTime(): number {
    if (this.metrics.length === 0) return 0;
    
    const totalTime = this.metrics.reduce((sum, m) => sum + m.processingTime, 0);
    return totalTime / this.metrics.length;
  }
  
  reset(): void {
    this.metrics = [];
  }
}

// Global configuration manager instance
export const globalConfigManager = new LazyEditConfigManager();