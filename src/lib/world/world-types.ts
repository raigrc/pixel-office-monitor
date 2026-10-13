export type WorldAgentStatus = "working" | "waiting" | "success" | "error" | "idle";

export interface WorldSession {
  id: string;
  projectId: string;
  rootSessionId: string;
  title: string;
  createdAt: number;
}

export interface WorldAgent {
  id: string;
  worldId: string;
  sessionId: string;
  agentKey: string;
  displayName: string;
  role: string;
  isOrchestrator: boolean;
  status: WorldAgentStatus;
  seatIndex: number;
}

export interface WorldState {
  sessions: WorldSession[];
  agents: WorldAgent[];
}
