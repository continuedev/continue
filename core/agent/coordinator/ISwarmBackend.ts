/**
 * Runtime-agnostic interface for spawning and managing swarm agents.
 * The CLI implements this with process/tmux backends; other runtimes (e.g. VS Code)
 * can provide their own implementations.
 */

export interface SwarmAgentConfig {
  /** Unique agent identifier (e.g. "alice@my-team") */
  agentId: string;
  /** Human-readable agent name (e.g. "alice") */
  agentName: string;
  /** Team the agent belongs to */
  teamName: string;
  /** Initial prompt sent to the agent */
  prompt: string;
  /** Working directory for the agent process */
  cwd?: string;
  /**
   * Execution backend hint — interpreted by each ISwarmBackend implementation.
   * Known values for the CLI: "in-process" | "process" | "tmux"
   */
  backend?: string;
  /** Optional model identifier to use for this agent */
  model?: string;
  /** Optional subagent type/name for runtime metadata. */
  agentType?: string;
  /** Optional short description associated with this delegated run. */
  description?: string;
  /** Optional per-agent system prompt */
  agentSystemPrompt?: string;
  /** Optional execution profile for the worker. */
  profile?: "explore" | "verify" | "coordinator-worker";
  /** Optional parent session id used for coordinator scratchpad continuity. */
  parentSessionId?: string;
}

export interface SwarmSpawnResult {
  /** Whether a new agent was started or an existing one received a queued prompt */
  status: "spawned" | "queued";
  /** Opaque handle for the spawned unit (job id, pane id, etc.) — backend-specific */
  handle?: string;
  /** Human-readable summary of what happened */
  summary: string;
}

export type SwarmAgentStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ISwarmBackend {
  /**
   * Spawn a new agent or queue a prompt for an already-running agent.
   */
  spawnAgent(config: SwarmAgentConfig): Promise<SwarmSpawnResult>;

  /**
   * Signal an agent to stop. Best-effort; implementations may not be able to
   * interrupt already-running work immediately.
   */
  stopAgent(agentId: string, teamName: string): Promise<void>;

  /**
   * Query the current execution status of a named agent.
   * Returns null when the agent is not found in the team roster.
   */
  getAgentStatus(
    agentId: string,
    teamName: string,
  ): Promise<SwarmAgentStatus | null>;
}
