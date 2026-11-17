export async function fetchApi<T>(
  base: string,
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
  signal?: AbortSignal,
): Promise<T> {
  const form = body instanceof FormData;
  const combined = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(240000)])
    : AbortSignal.timeout(240000);
  const response = await fetch(base + path, {
    method,
    headers:
      body === undefined || form
        ? undefined
        : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    signal: combined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail
              .map((v: { msg?: string }) => v.msg || "Invalid input")
              .join("; ")
          : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) return response.json() as Promise<T>;
  if (type.startsWith("audio/")) return response.blob() as Promise<T>;
  throw new Error(
    "Unexpected backend response. Check the API URL and server configuration.",
  );
}
