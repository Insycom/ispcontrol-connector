import assert from "node:assert/strict";
import test from "node:test";
import { validateBundle } from "../trust-bundle.js";

test("rejects a trust bundle digest mismatch", () => {
  assert.throws(
    () => validateBundle({ schemaVersion: 1, digest: "bad", anchors: [] }),
    /digest mismatch/,
  );
});

test("accepts a correctly digested empty trust bundle", () => {
  validateBundle({
    schemaVersion: 1,
    digest: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    anchors: [],
  });
});
