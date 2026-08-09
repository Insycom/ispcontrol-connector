import type {
  ConnectorApiClient,
  ConnectorCommand,
  LegacyConnectorJob,
} from "./api-client.js";
import { RouterOsClient } from "./routeros-client.js";
import { ping } from "./monitoring/ping.js";
import { traceroute } from "./monitoring/traceroute.js";
import { RouterOsApiAdapter } from "./mikrotik/routeros-api-adapter.js";
import {
  provisionService,
  type ServiceProvisionPayload,
} from "./mikrotik/service-provisioner.js";

export class CommandWorker {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly api: ConnectorApiClient,
    private readonly intervalMs = 2_000,
  ) {}

  start(): void {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const command = await this.api.nextCommand();
      if (command) {
        try {
          await execute(command);
          await this.api.reportCommand(command.id, { success: true });
        } catch (cause: unknown) {
          const error = cause instanceof Error ? cause.message : "Unknown error";
          await this.api.reportCommand(command.id, { success: false, error });
        }
      }

      for (const job of await this.api.claimJobs(5)) {
        if (new Date(job.expiresAt) <= new Date()) continue;
        await this.api.startJob(job.id);
        try {
          const result = await executeJob(job);
          await this.api.completeJob(job.id, result);
        } catch (cause: unknown) {
          const error = cause instanceof Error ? cause.message : "Unknown error";
          await this.api.failJob(job.id, error);
        }
      }
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "Unknown error";
      console.error(`Command polling failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}

async function executeJob(job: LegacyConnectorJob): Promise<Record<string, unknown>> {
  const payload = job.payload as {
    target?: { address?: string };
    count?: number;
    timeoutMs?: number;
    packetSize?: number;
    maxHops?: number;
    router?: {
      host: string;
      port: number;
      tls: boolean;
      username: string;
      password: string;
    };
  };
  if (
    ["monitoring.ping", "network.ping_server", "network.diagnostic_ping"].includes(job.type) &&
    payload.target?.address
  ) {
    return ping(
      payload.target.address,
      payload.count ?? 5,
      payload.timeoutMs ?? 1_000,
      payload.packetSize ?? 56,
    );
  }
  if (job.type === "network.traceroute" && payload.target?.address) {
    return traceroute(
      payload.target.address,
      payload.maxHops ?? 20,
      payload.packetSize ?? 56,
    );
  }
  if (job.type === "mikrotik.test_connection" && payload.router) {
    return testMikrotik(payload.router);
  }
  if (job.type === "mikrotik.apply_service") {
    return provisionService(job.payload as unknown as ServiceProvisionPayload);
  }
  throw new Error("Unsupported job type");
}

async function execute(command: ConnectorCommand): Promise<void> {
  const router = new RouterOsClient(command.router);
  await router.connect();
  try {
    if (command.type === "SUSPEND") {
      await ensureAddress(
        router,
        command.service.suspendedAddressListName,
        command.service.ipAddress,
        command.service.name,
      );
      await removeAddress(
        router,
        command.service.addressListName,
        command.service.ipAddress,
      );
      if (command.service.managementMode === "SIMPLE_QUEUE") {
        await setQueue(router, command, true);
      }
      return;
    }
    await removeAddress(
      router,
      command.service.suspendedAddressListName,
      command.service.ipAddress,
    );
    await ensureAddress(
      router,
      command.service.addressListName,
      command.service.ipAddress,
      command.service.name,
    );
    if (command.service.managementMode === "SIMPLE_QUEUE") {
      await setQueue(router, command, false);
    }
  } finally {
    await router.close();
  }
}

async function ensureAddress(
  router: RouterOsClient,
  list: string,
  address: string,
  comment: string,
): Promise<void> {
  const found = await router.print(
    "/ip/firewall/address-list",
    { list, address },
    ".id,list,address",
  );
  if (!found.length) {
    await router.add("/ip/firewall/address-list", { list, address, comment });
  }
}

async function removeAddress(
  router: RouterOsClient,
  list: string,
  address: string,
): Promise<void> {
  const found = await router.print(
    "/ip/firewall/address-list",
    { list, address },
    ".id",
  );
  for (const item of found) {
    if (item[".id"]) {
      await router.remove("/ip/firewall/address-list", item[".id"]);
    }
  }
}

async function setQueue(
  router: RouterOsClient,
  command: ConnectorCommand,
  disabled: boolean,
): Promise<void> {
  const found = await router.print(
    "/queue/simple",
    { name: command.service.name },
    ".id,name",
  );
  const attributes: Record<string, string> = {
    target: `${command.service.ipAddress}/32`,
    "max-limit": `${command.service.uploadKbps}k/${command.service.downloadKbps}k`,
    disabled: disabled ? "yes" : "no",
    comment: `Managed by IspControl (${command.service.id})`,
  };
  if (
    command.service.burstUploadKbps &&
    command.service.burstDownloadKbps
  ) {
    attributes["burst-limit"] =
      `${command.service.burstUploadKbps}k/${command.service.burstDownloadKbps}k`;
  }
  const id = found[0]?.[".id"];
  if (id) await router.set("/queue/simple", id, attributes);
  else await router.add("/queue/simple", { name: command.service.name, ...attributes });
}

async function testMikrotik(credentials: {
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
}): Promise<Record<string, unknown>> {
  const adapter = new RouterOsApiAdapter(credentials);
  try {
    await adapter.connect();
    const info = await adapter.getSystemInfo();
    return {
      reachable: true,
      identity: info.identity,
      version: info.version,
      boardName: info.boardName,
      architecture: info.architecture,
      serialNumber: info.serialNumber,
      uptime: info.uptime,
      testedAt: new Date().toISOString(),
    };
  } finally {
    await adapter.disconnect();
  }
}
