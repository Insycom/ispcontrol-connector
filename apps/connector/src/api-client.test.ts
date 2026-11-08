import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ConnectorApiClient } from "./api-client.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function client() {
  return new ConnectorApiClient(new URL("https://api.example.test"), {
    connectorId: "connector-1",
    apiKey: "test-key",
  });
}

test("progress renews the lease using the legacy connector route", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    return new Response(JSON.stringify({ count: 1 }), { status: 200 });
  }) as typeof fetch;
  await client().progressJob("job-1");
  assert.deepEqual(requests, [{
    url: "https://api.example.test/api/v1/connector/v1/jobs/job-1/progress",
    method: "POST",
  }]);
});

test("transient job failures request a retry", async () => {
  let body: { retryable?: boolean } | undefined;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  await client().failJob("job-1", "connection reset");
  assert.equal(body?.retryable, true);
});

test("permanent job failures do not request a retry", async () => {
  let body: { retryable?: boolean } | undefined;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  await client().failJob("job-1", "Unsupported job type", false);
  assert.equal(body?.retryable, false);
});

test("failed progress response is not treated as a renewed lease", async () => {
  globalThis.fetch = (async () => new Response("", { status: 409 })) as typeof fetch;
  await assert.rejects(client().progressJob("job-1"), /409/);
});
