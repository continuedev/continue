import { RequestOptions } from "@continuedev/config-types";
import * as followRedirects from "follow-redirects";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  getAgentOptions,
  getUniqueAgentRequestOptionsKey,
} from "./getAgentOptions.js";
const { http, https } = (followRedirects as any).default;

type Agent =
  | typeof http.Agent
  | typeof https.Agent
  | HttpProxyAgent<string>
  | HttpsProxyAgent<string>;

interface AgentEntry {
  agent: Agent;
  timeoutId: NodeJS.Timeout;
}

interface PendingRequest {
  resolve: (agent: Agent) => void;
  reject: (error: Error) => void;
}

const DEFAULT_AGENT_TTL = 1000 * 60 * 5; // 5 minutes

export class AgentPool {
  private static instance: AgentPool;
  private cache: Map<string, AgentEntry> = new Map();
  private pendingRequests: Map<string, PendingRequest[]> = new Map();
  private isCreating: Set<string> = new Set();
  private ttl: number;

  constructor(ttl = DEFAULT_AGENT_TTL) {
    this.ttl = ttl;
  }

  public static getInstance(): AgentPool {
    if (!AgentPool.instance) {
      AgentPool.instance = new AgentPool();
    }
    return AgentPool.instance;
  }

  private async createAgent(
    protocol: string,
    proxy: string | undefined,
    requestOptions: RequestOptions | undefined,
  ): Promise<Agent> {
    const agentOptions = await getAgentOptions(requestOptions);

    if (protocol === "https:") {
      return proxy
        ? new HttpsProxyAgent(proxy, agentOptions)
        : new https.Agent(agentOptions);
    } else {
      return proxy
        ? new HttpProxyAgent(proxy, agentOptions)
        : new http.Agent(agentOptions);
    }
  }

  private getCacheKey(
    protocol: string,
    proxy: string | undefined,
    optionsKey: string,
  ): string {
    return `${protocol}:::::${proxy || "no_proxy"}:::::${optionsKey}`;
  }

  private scheduleCleanup(cacheKey: string): NodeJS.Timeout {
    const entry = this.cache.get(cacheKey);
    if (entry?.timeoutId) {
      clearTimeout(entry.timeoutId);
    }

    return setTimeout(() => {
      const entry = this.cache.get(cacheKey);
      if (entry) {
        entry.agent.destroy();
        this.cache.delete(cacheKey);
      }
    }, this.ttl);
  }

  async getOrCreateAgent(
    url: URL,
    proxy: string | undefined,
    requestOptions: RequestOptions | undefined,
  ): Promise<Agent> {
    try {
      const protocol = url.protocol;
      const optionsKey = getUniqueAgentRequestOptionsKey(requestOptions);
      const cacheKey = this.getCacheKey(protocol, proxy, optionsKey);

      // Check cache first
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry) {
        cachedEntry.timeoutId = this.scheduleCleanup(cacheKey);
        return cachedEntry.agent;
      }

      // Return a promise that will be resolved when the agent is created
      return new Promise<Agent>((resolve, reject) => {
        // Add this request to the pending queue
        if (!this.pendingRequests.has(cacheKey)) {
          this.pendingRequests.set(cacheKey, []);
        }
        this.pendingRequests.get(cacheKey)!.push({ resolve, reject });

        // If we're already creating this agent, just wait
        if (this.isCreating.has(cacheKey)) {
          return;
        }

        // Mark that we're creating this agent
        this.isCreating.add(cacheKey);

        // Start the agent creation process
        this.createAgent(protocol, proxy, requestOptions)
          .then((agent) => {
            // Store in cache with cleanup timeout
            const entry: AgentEntry = {
              agent,
              timeoutId: null as any,
            };
            entry.timeoutId = this.scheduleCleanup(cacheKey);
            this.cache.set(cacheKey, entry);

            // Resolve all pending requests for this agent
            const pending = this.pendingRequests.get(cacheKey) || [];
            for (const request of pending) {
              request.resolve(agent);
            }
            this.pendingRequests.delete(cacheKey);
            this.isCreating.delete(cacheKey);
          })
          .catch((error) => {
            console.error("Error creating agent:", error);

            // Reject all pending requests for this agent
            const pending = this.pendingRequests.get(cacheKey) || [];
            for (const request of pending) {
              request.reject(error);
            }
            this.pendingRequests.delete(cacheKey);
            this.isCreating.delete(cacheKey);
          });
      });
    } catch (error) {
      console.error("Error in agent creation setup:", error);
      // Fallback to a one-time agent if we couldn't even start the normal process
      return this.createAgent(url.protocol, proxy, requestOptions);
    }
  }

  clear(): void {
    // Destroy all agents and clear timeouts
    for (const [_, entry] of this.cache) {
      clearTimeout(entry.timeoutId);
      entry.agent.destroy();
    }

    // Reject any pending requests
    for (const [cacheKey, requests] of this.pendingRequests) {
      for (const request of requests) {
        request.reject(new Error("Agent pool cleared"));
      }
    }

    this.cache.clear();
    this.pendingRequests.clear();
    this.isCreating.clear();
  }
}
