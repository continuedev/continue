/**
 * Tokenization and context management constants
 */

// Tool result analysis thresholds
export const TOOL_RESULT_TOKEN_THRESHOLD = 15000; // Trigger compaction check at 15K tokens
export const LARGE_TOOL_RESULT_TOKEN_THRESHOLD = 5000; // Individual result considered large
export const MAX_TOOL_RESULTS_WITHOUT_CHECK = 1; // Always check when > 1 tool result

// File attachment thresholds  
export const ATTACHMENT_TOKEN_THRESHOLD = 25000; // Warn when attachments exceed 25K tokens
export const MAX_FILE_SIZE_KB = 200; // ~50K tokens roughly

// Context usage warnings
export const HIGH_CONTEXT_USAGE_THRESHOLD = 0.7; // Warn at 70% usage
export const CRITICAL_CONTEXT_USAGE_THRESHOLD = 0.9; // Critical warning at 90%