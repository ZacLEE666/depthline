import type { DepthlineSnapshot } from "../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export const api = {
  snapshot: () => request<DepthlineSnapshot>("/api/snapshot"),
  startFocus: (minutes: number, threadId?: string) =>
    request<DepthlineSnapshot>("/api/focus", {
      method: "POST",
      body: JSON.stringify({ minutes, threadId }),
    }),
  stopFocus: () => request<DepthlineSnapshot>("/api/focus", { method: "DELETE" }),
  snooze: (threadId: string, minutes = 30) =>
    request<DepthlineSnapshot>(`/api/items/${encodeURIComponent(threadId)}/snooze`, {
      method: "POST",
      body: JSON.stringify({ minutes }),
    }),
  handled: (threadId: string) =>
    request<DepthlineSnapshot>(`/api/items/${encodeURIComponent(threadId)}/handled`, {
      method: "POST",
      body: "{}",
    }),
  open: (threadId: string) =>
    request<{ ok: true; opened: "thread" }>(`/api/items/${encodeURIComponent(threadId)}/open`, {
      method: "POST",
      body: "{}",
    }),
};
