import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { readServiceTraffic } from "../routeros-client.js";

test("reports the two directions of the requested simple queue, including idle traffic", async () => {
  const server = createServer((socket) => {
    socket.on("data", (frame) => {
      const command = frame.toString();
      const words = command.includes("/login")
        ? ["!done", ""]
        : ["!re", "=target=192.0.2.2/32", "=rate=0/2400000", "", "!done", ""];
      socket.write(
        Buffer.concat(
          words.map((word) =>
            Buffer.concat([Buffer.from([word.length]), Buffer.from(word)]),
          ),
        ),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const router = {
      host: "127.0.0.1",
      port: addr.port,
      tls: false,
      username: "test",
      password: "dummy",
    };
    const reading = await readServiceTraffic(router, "192.0.2.2");
    assert.equal(reading.uploadBps, 0);
    assert.equal(reading.downloadBps, 2400000);
    await assert.rejects(
      readServiceTraffic(router, "192.0.2.3"),
      /cola individual/,
    );
  } finally {
    server.close();
  }
});
