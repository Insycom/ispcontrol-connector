import assert from "node:assert/strict";
import test from "node:test";
import { reconcileQueueGraphs } from "./queue-graphs.js";

test("enables, resynchronizes and disables the managed graph rule", async () => {
  const rows: Record<string, string>[] = [
    { ".id": "*0", comment: "external", disabled: "no" },
  ];
  const router = {
    async print(_path: string, filter: Record<string, string>) {
      return rows.filter((row) => row.comment === filter.comment);
    },
    async add(_path: string, attrs: Record<string, string>) {
      rows.push({ ".id": "*1", ...attrs });
    },
    async set(_path: string, id: string, attrs: Record<string, string>) {
      Object.assign(
        rows.find((row) => row[".id"] === id)!,
        attrs,
      );
    },
  };
  await reconcileQueueGraphs(router, "server", false);
  assert.equal(rows.length, 1);
  await reconcileQueueGraphs(router, "server", true);
  await reconcileQueueGraphs(router, "server", true);
  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.["simple-queue"], "all");
  assert.equal(rows[1]?.["allow-target"], "no");
  await reconcileQueueGraphs(router, "server", false);
  assert.equal(rows[1]?.disabled, "yes");
  assert.equal(rows[0]?.disabled, "no");
});
