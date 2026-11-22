import assert from "node:assert/strict";
import test from "node:test";
import { tlsOptionsFor } from "../routeros-client.js";

test("enforces TLS validation and destination-scoped CA trust", () => {
  const options = tlsOptionsFor({
    host: "router.example.test",
    port: 8729,
    tls: true,
    username: "connector",
    password: "secret",
    caPem: "public-ca-pem",
  });

  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.servername, "router.example.test");
  assert.deepEqual(options.ca, ["public-ca-pem"]);
  assert.equal(typeof options.checkServerIdentity, "function");
});

test("does not send an IP address as TLS SNI", () => {
  const options = tlsOptionsFor({
    host: "192.0.2.10",
    port: 8729,
    tls: true,
    username: "connector",
    password: "secret",
  });
  assert.equal(options.servername, undefined);
  assert.equal(options.rejectUnauthorized, true);
});
