import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineClient } from "../machine-client.js";

test("concurrent polls recover from a refresh timeout with a single rotation", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "session-refresh-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    if (url.pathname.endsWith("/refresh")) {
      attempts++;
      if (attempts === 1) throw new DOMException("timeout", "TimeoutError");
      return Response.json({ accessToken: "new-access", refreshToken: "new-refresh" });
    }
    return new Headers(init.headers).get("authorization") === "Bearer new-access"
      ? Response.json([]) : new Response(null, { status: 401 });
  });
  const client = new MachineClient(new URL("https://example.invalid"), dir, {
    connectorId: "same-id", accessToken: "expired", refreshToken: "old-refresh",
  });
  await assert.rejects(client.configuration(), { name: "TimeoutError" });
  await assert.rejects(client.configuration(), /will retry/);
  now += 1001;
  await Promise.all([client.configuration(), client.configuration(), client.claimJobs()]);
  assert.equal(attempts, 2);
  const stored = JSON.parse(await readFile(join(dir, "identity.json"), "utf8"));
  assert.equal(stored.connectorId, "same-id");
  assert.equal(stored.refreshToken, "new-refresh");
});
