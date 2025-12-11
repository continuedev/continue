/**
 * Configuration for a specialized agent
 */
export interface AgentConfig {
  /** Unique identifier for the agent */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of when to use this agent */
  description: string;
  /** Tool configuration - which tools are available to this agent */
  tools: Record<string, boolean>;
  /** Optional custom system prompt for the agent */
  systemPrompt?: string;
}
