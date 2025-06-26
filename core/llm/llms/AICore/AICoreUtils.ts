/**
 * Adheres to the AI Core tool name requirements:
 * https://github.com/SAP/ai-sdk-js/blob/main/packages/orchestration/src/client/api/schema/function-object.ts#L15-L20
 * @param name 
 * @returns 
 * @returns 
 */
export function sanitizeToolName(name: string): string {
    // Replace any character not in [a-zA-Z0-9-_] with "-"
    let sanitized = name.replace(/[^a-zA-Z0-9-_]/g, "-");
    // Remove duplicate dashes/underscores, and trim
    sanitized = sanitized.replace(/[-_]{2,}/g, "-");
    // Remove starting/trailing dashes/underscores
    sanitized = sanitized.replace(/^[-_]+|[-_]+$/g, "");
    // Ensure max length 64
    if (sanitized.length > 64) {
        sanitized = sanitized.substring(0, 64);
    }
    // Fallback if empty 
    if (sanitized.length === 0) sanitized = "tool";
    return sanitized;
}