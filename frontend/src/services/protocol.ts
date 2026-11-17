export function safeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
export async function consumeNdjson(
  body: ReadableStream<Uint8Array>,
  update: (token: string) => void,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let pending = "";
  const parse = (line: string) => {
    if (!line.trim()) return;
    const item = JSON.parse(line) as {
      type: string;
      content?: unknown;
      message?: string;
    };
    if (item.type === "error")
      throw new Error(item.message || "The model stream failed.");
    if (item.type === "token") {
      if (typeof item.content !== "string")
        throw new Error("Invalid token from backend.");
      update(item.content);
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) parse(line);
    }
    pending += decoder.decode();
    parse(pending);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
