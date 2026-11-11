import { ConnectorApiClient } from "./api-client.js";
import { loadConfig } from "./config.js";
import { ConnectionState } from "./connection-state.js";
import { HealthServer } from "./health-server.js";
import { Heartbeat } from "./heartbeat.js";
import { loadOrCreateIdentity, showApiKeyOnce } from "./identity.js";
import { CommandWorker } from "./command-worker.js";
import { ConnectorDatabase } from "./persistence/database.js";
import { MachineClient } from "./machine-client.js";
import { MonitoringService } from "./monitoring/monitoring-service.js";
import { totalmem, freemem, uptime, loadavg, cpus } from "node:os";
import { TrustBundleStore } from "./trust-bundle.js";

const CONNECTOR_VERSION = "0.2.1";

const config = loadConfig();
const identityResult = await loadOrCreateIdentity(config.dataDirectory);
let identity = identityResult.identity;

if (config.enrollmentToken && !identity.accessToken) {
  identity = await MachineClient.enroll(
    config.apiUrl,
    config.dataDirectory,
    config.enrollmentToken,
    config.connectorName,
  );
} else if (identity.apiKey) {
  showApiKeyOnce(identity);
}

const connectionState = new ConnectionState();
const healthServer = new HealthServer(config.healthPort, connectionState);
let heartbeat: Heartbeat | undefined;
let commandWorker: CommandWorker | undefined;
let monitoring: MonitoringService | undefined;
let database: ConnectorDatabase | undefined;
let machineHeartbeat: NodeJS.Timeout | undefined;
let trustBundleRefresh: NodeJS.Timeout | undefined;
const trustBundle = new TrustBundleStore(config.dataDirectory);
await trustBundle.load();

if (identity.apiKey) {
  const apiClient = new ConnectorApiClient(config.apiUrl, identity);
  const refreshTrust = async () => {
    try {
      await trustBundle.update(await apiClient.trustBundle());
    } catch (error: unknown) {
      console.error(`Trust bundle refresh failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };
  await refreshTrust();
  trustBundleRefresh = setInterval(() => void refreshTrust(), 300_000);
  heartbeat = new Heartbeat(
    apiClient,
    connectionState,
    config.heartbeatIntervalMs,
  );
  commandWorker = new CommandWorker(apiClient, trustBundle);
  commandWorker.start();
  await heartbeat.start();
} else {
  const machineClient = new MachineClient(
    config.apiUrl,
    config.dataDirectory,
    identity,
  );
  const refreshTrust = async () => {
    try {
      await trustBundle.update(await machineClient.trustBundle());
    } catch (error: unknown) {
      console.error(`Trust bundle refresh failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };
  await refreshTrust();
  trustBundleRefresh = setInterval(() => void refreshTrust(), 300_000);
  database = new ConnectorDatabase(config.dataDirectory);
  monitoring = new MonitoringService(machineClient, database);
  await monitoring.start();
  const sendHeartbeat = async () => {
    try {
      await machineClient.heartbeat({
        connectorVersion: CONNECTOR_VERSION,
        protocolVersion: 1,
        uptimeSeconds: Math.floor(uptime()),
        cpuUsagePercent: Math.min(100, (loadavg()[0] ?? 0) / cpus().length * 100),
        memoryUsagePercent: (1 - freemem() / totalmem()) * 100,
        diskUsagePercent: 0,
        pendingJobs: 0,
        pendingEvents: database?.pendingCount() ?? 0,
        monitoredDevices: database?.devices().length ?? 0,
        connectedRouters: 0,
        timestamp: new Date().toISOString(),
      });
      connectionState.connected();
    } catch {
      connectionState.disconnected();
    }
  };
  await sendHeartbeat();
  machineHeartbeat = setInterval(
    () => void sendHeartbeat(),
    config.heartbeatIntervalMs,
  );
}

healthServer.start();

async function shutdown(): Promise<void> {
  heartbeat?.stop();
  commandWorker?.stop();
  monitoring?.stop();
  if (machineHeartbeat) clearInterval(machineHeartbeat);
  if (trustBundleRefresh) clearInterval(trustBundleRefresh);
  database?.close();
  await healthServer.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
