import { spawn } from "node:child_process";
import { resolveCodexBinary } from "./codex-binary.js";

const LAUNCH_TIMEOUT_MS = 10_000;
const SPAWN_CONFIRMATION_MS = 1_200;

export async function openCodexWorkspace(cwd: string): Promise<void> {
  const binary = await resolveCodexBinary();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, ["app", cwd], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    let settled = false;
    let confirmation: NodeJS.Timeout | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (confirmation) clearTimeout(confirmation);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error("Timed out while opening the Codex workspace."));
    }, LAUNCH_TIMEOUT_MS);

    child.once("error", (error) => finish(error));
    child.once("spawn", () => {
      confirmation = setTimeout(() => {
        child.unref();
        finish();
      }, SPAWN_CONFIRMATION_MS);
    });
    child.once("exit", (code, signal) => {
      if (code === 0) finish();
      else finish(new Error(`Codex launcher exited (${code ?? signal ?? "unknown"}).`));
    });
  });
}
