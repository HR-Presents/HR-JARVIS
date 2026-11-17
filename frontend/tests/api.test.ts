import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { consumeNdjson, safeUrl } from "../src/services/protocol.ts";
import { fetchApi } from "../src/services/transport.ts";
test("NDJSON survives fragmented records and multi-byte Unicode", async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ type: "token", content: "Hello 🌊" }) +
      "\n" +
      JSON.stringify({ type: "token", content: " world" }) +
      "\n" +
      JSON.stringify({ type: "done" }),
  );
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 3)
        c.enqueue(bytes.slice(i, i + 3));
      c.close();
    },
  });
  let output = "";
  await consumeNdjson(stream, (token) => (output += token));
  assert.equal(output, "Hello 🌊 world");
});
test("Stream errors preserve partial output and release the reader", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(
        new TextEncoder().encode(
          '{"type":"token","content":"Partial"}\n{"type":"error","message":"Model unavailable"}\n',
        ),
      );
      c.close();
    },
  });
  let output = "";
  await assert.rejects(
    consumeNdjson(stream, (t) => (output += t)),
    /Model unavailable/,
  );
  assert.equal(output, "Partial");
  assert.equal(stream.locked, false);
});
test("Source URLs reject script and data schemes", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("data:text/html,test"), undefined);
  assert.equal(safeUrl("https://example.org/a"), "https://example.org/a");
});
test("HTTP transport handles JSON, audio, validation, HTML fallback and cancellation", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/json") {
      res.setHeader("content-type", "application/json");
      res.end('{"ok":true}');
    } else if (req.url === "/audio") {
      res.setHeader("content-type", "audio/wav");
      res.end("RIFF");
    } else if (req.url === "/validation") {
      res.statusCode = 422;
      res.setHeader("content-type", "application/json");
      res.end('{"detail":[{"msg":"Path is required"}]}');
    } else if (req.url === "/html") {
      res.setHeader("content-type", "text/html");
      res.end("<html>SPA fallback</html>");
    } else {
      setTimeout(() => res.end("late"), 300);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port;
  try {
    assert.deepEqual(await fetchApi(base, "/json"), { ok: true });
    assert.equal(await (await fetchApi<Blob>(base, "/audio")).text(), "RIFF");
    await assert.rejects(fetchApi(base, "/validation"), /Path is required/);
    await assert.rejects(
      fetchApi(base, "/html"),
      /Unexpected backend response/,
    );
    const abort = new AbortController();
    const pending = fetchApi(base, "/slow", undefined, "GET", abort.signal);
    abort.abort();
    await assert.rejects(pending, { name: "AbortError" });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Long speech is chunked within backend limits without dropping words", async () => {
  const { speechChunks } = await import("../src/services/speech.ts");
  const text = "This is a complete spoken sentence. ".repeat(180).trim();
  const chunks = speechChunks(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((v) => v.length <= 1800));
  assert.equal(chunks.join(" "), text);
});
