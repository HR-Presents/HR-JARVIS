import type { Message } from "../types/api";
export const defaultBase =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? window.location.origin : "http://127.0.0.1:8100");
export function getBase() {
  return (localStorage.getItem("jarvis-api-base") || defaultBase).replace(
    /\/$/,
    "",
  );
}
export async function request<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
  signal?: AbortSignal,
): Promise<T> {
  const form = body instanceof FormData;
  const res = await fetch(getBase() + path, {
    method,
    headers:
      body === undefined || form
        ? undefined
        : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    signal: signal || AbortSignal.timeout(240000),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : `Request failed (${res.status})`,
    );
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json() as Promise<T>;
  if (contentType.startsWith("audio/")) return res.blob() as Promise<T>;
  throw new Error(
    "Unexpected backend response. Check the API URL and server configuration.",
  );
}
export async function stream(
  message: string,
  history: Message[],
  update: (token: string) => void,
  signal: AbortSignal,
) {
  const res = await fetch(getBase() + "/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Chat unavailable (${res.status})`);
  const reader = res.body.getReader(),
    decoder = new TextDecoder();
  let pending = "";
  const parse = (line: string) => {
    if (!line.trim()) return;
    const item = JSON.parse(line);
    if (item.type === "error") throw new Error(item.message);
    if (item.type === "token") update(item.content);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      lines.forEach(parse);
    }
    pending += decoder.decode();
    parse(pending);
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
export function safeUrl(url: string) {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
