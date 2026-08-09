import type { ConnectorIdentity } from "./identity.js";

export type HeartbeatResult =
  | { accepted: true; heartbeatIntervalMs?: number; heartbeatFields?: string[] | null }
  | { accepted: false; status: number };

export type ConnectorCommand = {
  id: string;
  type: "SYNC" | "ACTIVATE" | "SUSPEND" | "CHANGE_SPEED";
  router: {
    host: string;
    port: number;
    tls: boolean;
    username: string;
    password: string;
  };
  service: {
    id: string;
    name: string;
    ipAddress: string;
    managementMode: "SIMPLE_QUEUE" | "ADDRESS_LIST";
    addressListName: string;
    suspendedAddressListName: string;
    uploadKbps: number;
    downloadKbps: number;
    burstUploadKbps: number | null;
    burstDownloadKbps: number | null;
  };
};

export type LegacyConnectorJob = {
  id: string;
  type: string;
  schemaVersion: number;
  payload: {
    target?: { deviceId?: string; address?: string };
    count?: number;
    timeoutMs?: number;
    packetSize?: number;
    intervalMs?: number;
    serverId?: string;
    router?: {
      host: string;
      port: number;
      tls: boolean;
      username: string;
      password: string;
    };
    periodStartedAt?: string;
    periodEndedAt?: string;
    deviceIds?: string[];
  };
  expiresAt: string;
};

export class ConnectorApiClient {
  constructor(
    private readonly apiUrl: URL,
    private readonly identity: ConnectorIdentity,
  ) {}

  async sendHeartbeat(): Promise<HeartbeatResult> {
    const response = await fetch(
      new URL("/api/v1/connector/v1/heartbeat", this.apiUrl),
      {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${this.identity.apiKey}`,
          "content-type": "application/json",
        },
body: JSON.stringify({
          connectorId: this.identity.connectorId,
          version: "0.2.1",
          capabilities: [],
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    return response.ok
      ? { accepted: true }
      : { accepted: false, status: response.status };
  }

  async nextCommand(): Promise<ConnectorCommand | null> {
    const response = await fetch(
      new URL("/api/v1/connector/v1/commands/next", this.apiUrl),
      {
        redirect: "error",
        headers: { authorization: `Bearer ${this.identity.apiKey}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error(`Command API returned ${response.status}`);
    return parseJsonOrNull<ConnectorCommand>(response);
  }

  async reportCommand(
    commandId: string,
    result: { success: boolean; error?: string },
  ): Promise<void> {
    const response = await fetch(
      new URL(
        `/api/v1/connector/v1/commands/${encodeURIComponent(commandId)}/result`,
        this.apiUrl,
      ),
      {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${this.identity.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(result),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(`Result API returned ${response.status}`);
  }

  async claimJobs(limit = 5): Promise<LegacyConnectorJob[]> {
    const response = await fetch(
      new URL("/api/v1/connector/v1/jobs/claim", this.apiUrl),
      {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${this.identity.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error(`Job API returned ${response.status}`);
    return (await parseJsonOrNull<LegacyConnectorJob[]>(response)) ?? [];
  }

  async startJob(jobId: string): Promise<void> {
    const response = await fetch(
      new URL(`/api/v1/connector/v1/jobs/${encodeURIComponent(jobId)}/start`, this.apiUrl),
      {
        method: "POST",
        redirect: "error",
        headers: { authorization: `Bearer ${this.identity.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(`Job start API returned ${response.status}`);
  }

  async completeJob(jobId: string, result: Record<string, unknown>): Promise<void> {
    const response = await fetch(
      new URL(`/api/v1/connector/v1/jobs/${encodeURIComponent(jobId)}/complete`, this.apiUrl),
      {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${this.identity.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ result }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(`Job complete API returned ${response.status}`);
  }

  async failJob(jobId: string, message: string): Promise<void> {
    const response = await fetch(
      new URL(`/api/v1/connector/v1/jobs/${encodeURIComponent(jobId)}/fail`, this.apiUrl),
      {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${this.identity.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "EXECUTION_FAILED", message, retryable: false }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(`Job fail API returned ${response.status}`);
  }
}

async function parseJsonOrNull<T>(response: Response): Promise<T | null> {
  const body = await response.text();
  const trimmed = body.trim();
  if (!trimmed || trimmed === "null") return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch (error: unknown) {
    throw new Error(
      `Invalid JSON from ${response.url || "connector API"}: ${trimmed.slice(0, 200)}`,
    );
  }
}
