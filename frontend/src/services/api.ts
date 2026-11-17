import type { Message } from "../types/api";
import { consumeNdjson } from "./protocol";
import { fetchApi } from "./transport";
export { safeUrl } from "./protocol";
export const defaultBase =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? window.location.origin : "http://127.0.0.1:8100");
export function getBase() {
  return (localStorage.getItem("jarvis-api-base") || defaultBase).replace(
    /\/$/,
    "",
  );
}
export function request<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
  signal?: AbortSignal,
): Promise<T> {
  return fetchApi<T>(getBase(), path, body, method, signal);
}
export async function stream(
  message: string,
  history: Message[],
  update: (token: string) => void,
  signal: AbortSignal,
) {
  const response = await fetch(getBase() + "/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });
  if (!response.ok || !response.body)
    throw new Error(`Chat unavailable (${response.status})`);
  if (!response.headers.get("content-type")?.includes("application/x-ndjson"))
    throw new Error("The backend did not return a supported chat stream.");
  await consumeNdjson(response.body, update);
}
