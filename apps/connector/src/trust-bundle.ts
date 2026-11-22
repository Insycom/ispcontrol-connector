import { createHash, X509Certificate } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TrustBundle } from "./machine-client.js";

export class TrustBundleStore {
  private bundle: TrustBundle = emptyBundle();
  private readonly path: string;

  constructor(private readonly directory: string) {
    this.path = join(directory, "trust-bundle.json");
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as TrustBundle;
      validateBundle(parsed);
      this.bundle = parsed;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Stored trust bundle is invalid; starting without additional trust");
      }
    }
  }

  async update(bundle: TrustBundle): Promise<boolean> {
    validateBundle(bundle);
    if (bundle.digest === this.bundle.digest) return false;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(bundle, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporary, 0o600);
    await rename(temporary, this.path);
    this.bundle = bundle;
    return true;
  }

  caFor(serverId: string | undefined, host: string, port: number): string | undefined {
    const anchor = this.bundle.anchors.find(
      (candidate) =>
        candidate.serverId === serverId &&
        candidate.port === port &&
        candidate.hosts.includes(host),
    );
    return anchor?.certificatePem;
  }

  digest(): string {
    return this.bundle.digest;
  }
}

export function validateBundle(bundle: TrustBundle): void {
  if (bundle.schemaVersion !== 1 || !Array.isArray(bundle.anchors)) {
    throw new Error("Unsupported trust bundle schema");
  }
  const digest = createHash("sha256")
    .update(JSON.stringify(bundle.anchors))
    .digest("hex");
  if (digest !== bundle.digest) throw new Error("Trust bundle digest mismatch");
  for (const anchor of bundle.anchors) {
    const certificate = new X509Certificate(anchor.certificatePem);
    if (!certificate.ca) throw new Error("Trust bundle contains a non-CA certificate");
    const fingerprint = certificate.fingerprint256.replaceAll(":", "").toLowerCase();
    if (fingerprint !== anchor.fingerprintSha256) {
      throw new Error("Trust bundle certificate fingerprint mismatch");
    }
    if (new Date(anchor.validTo) <= new Date()) {
      throw new Error("Trust bundle contains an expired certificate");
    }
    if (!anchor.hosts.length || !Number.isInteger(anchor.port)) {
      throw new Error("Trust bundle assignment is invalid");
    }
  }
}

function emptyBundle(): TrustBundle {
  return {
    schemaVersion: 1,
    anchors: [],
    digest: createHash("sha256").update("[]").digest("hex"),
  };
}
