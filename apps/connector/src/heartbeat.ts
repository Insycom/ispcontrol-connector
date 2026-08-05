import type { ConnectorApiClient } from "./api-client.js";
import type { ConnectionState } from "./connection-state.js";

export class Heartbeat {
  private timer: NodeJS.Timeout | undefined;
  private currentIntervalMs: number;

  constructor(
    private readonly apiClient: ConnectorApiClient,
    private readonly connectionState: ConnectionState,
    intervalMs: number,
  ) {
    this.currentIntervalMs = intervalMs;
  }

  async start(): Promise<void> {
    await this.send();
    this.schedule();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private schedule(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.send(), this.currentIntervalMs);
  }

  private async send(): Promise<void> {
    try {
      const result = await this.apiClient.sendHeartbeat();
      if (result.accepted) {
        if (result.heartbeatIntervalMs && result.heartbeatIntervalMs !== this.currentIntervalMs) {
          this.currentIntervalMs = result.heartbeatIntervalMs;
          this.schedule();
        }
        this.connectionState.connected();
        return;
      }

      this.connectionState.disconnected();
      console.error(`Heartbeat rejected with status ${result.status}`);
    } catch (error: unknown) {
      this.connectionState.disconnected();
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`Heartbeat failed: ${message}`);
    }
  }
}
