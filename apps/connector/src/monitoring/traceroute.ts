import { spawn } from "node:child_process";

export async function traceroute(
  address: string,
  maxHops: number,
  packetSize: number,
) {
  const startedAt = new Date().toISOString();
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const process = spawn(
      "traceroute",
      ["-n", "-m", String(maxHops), "-q", "1", "-w", "1", "-s", String(packetSize), address],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    process.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    process.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    process.once("error", reject);
    process.once("close", (code) => {
      resolve({
        reachable: code === 0,
        target: address,
        maxHops,
        packetSize,
        startedAt,
        completedAt: new Date().toISOString(),
        rawOutput: output,
      });
    });
  });
}
