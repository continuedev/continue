export interface SwarmIdentity {
  agentId: string;
  agentName: string;
  teamName: string;
  color?: string;
  parentSessionId?: string;
  planModeRequired?: boolean;
}

let currentSwarmIdentity: SwarmIdentity | null = null;

export function setSwarmIdentity(identity: SwarmIdentity | null): void {
  currentSwarmIdentity = identity;
}

export function getSwarmIdentity(): SwarmIdentity | null {
  return currentSwarmIdentity;
}

export function isSwarmWorker(): boolean {
  return currentSwarmIdentity !== null;
}
