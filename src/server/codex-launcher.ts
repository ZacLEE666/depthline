import { spawn } from "node:child_process";

const LAUNCH_TIMEOUT_MS = 10_000;

export function codexThreadUrl(threadId: string): string {
  return `codex://threads/${encodeURIComponent(threadId)}`;
}

function launcherFor(url: string): { command: string; args: string[] } {
  if (process.platform === "darwin") return { command: "/usr/bin/open", args: [url] };
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }
  return { command: "xdg-open", args: [url] };
}

export async function openCodexThread(threadId: string): Promise<void> {
  const { command, args } = launcherFor(codexThreadUrl(threadId));

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      env: process.env,
    });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error("Timed out while opening the Codex workspace."));
    }, LAUNCH_TIMEOUT_MS);

    child.once("error", (error) => finish(error));
    child.once("exit", (code, signal) => {
      if (code === 0) finish();
      else finish(new Error(`Codex deep-link launcher exited (${code ?? signal ?? "unknown"}).`));
    });
  });
}
