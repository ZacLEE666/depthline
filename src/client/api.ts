import type { DepthlineSnapshot } from "../shared/types";

async function request(path: string, init?: RequestInit): Promise<DepthlineSnapshot> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as DepthlineSnapshot & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export const api = {
  snapshot: () => request("/api/snapshot"),
  startFocus: (minutes: number, threadId?: string) =>
    request("/api/focus", {
      method: "POST",
      body: JSON.stringify({ minutes, threadId }),
    }),
  stopFocus: () => request("/api/focus", { method: "DELETE" }),
  snooze: (threadId: string, minutes = 30) =>
    request(`/api/items/${encodeURIComponent(threadId)}/snooze`, {
      method: "POST",
      body: JSON.stringify({ minutes }),
    }),
  handled: (threadId: string) =>
    request(`/api/items/${encodeURIComponent(threadId)}/handled`, {
      method: "POST",
      body: "{}",
    }),
  open: (threadId: string) =>
    request(`/api/items/${encodeURIComponent(threadId)}/open`, {
      method: "POST",
      body: "{}",
    }),
};
