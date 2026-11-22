import assert from "node:assert/strict";
import test from "node:test";
import { runReservedJob } from "../reserved-job.js";

test("waits for an in-flight renewal and discards the result if it fails", async () => {
  const renewing = Promise.withResolvers<void>();
  const renewal = Promise.withResolvers<void>();
  const calls: string[] = [];
  const client = {
    async startJob() { calls.push("start"); },
    async progressJob() { calls.push("progress"); renewing.resolve(); await renewal.promise; },
    async completeJob() { calls.push("complete"); },
    async failJob() { calls.push("fail"); },
  };
  const work = runReservedJob(client, "id", async () => { await renewing.promise; return {}; }, 1);
  await renewing.promise;
  await new Promise(resolve => setImmediate(resolve));
  renewal.reject(new Error("stale lease"));
  await assert.rejects(work, /renewal failed/);
  assert.deepEqual(calls, ["start", "progress"]);
});

test("a failed completion request is never reported as a failed execution", async () => {
  let failed = false;
  await assert.rejects(runReservedJob({
    async startJob() {}, async progressJob() {},
    async completeJob() { throw new Error("response lost"); },
    async failJob() { failed = true; },
  }, "id", async () => ({})), /response lost/);
  assert.equal(failed, false);
});
