import { constants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type ExecutableCheck = (candidate: string) => Promise<boolean>;

async function isExecutable(candidate: string): Promise<boolean> {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathCandidates(command: string, pathValue: string | undefined, platform: NodeJS.Platform): string[] {
  const extensions = platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  return (pathValue || "")
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((directory) => extensions.map((extension) => path.join(directory, `${command}${extension}`)));
}

function macAppCandidates(homeDirectory: string): string[] {
  return [
    "/Applications/ChatGPT.app/Contents/Resources/codex",
    "/Applications/Codex.app/Contents/Resources/codex",
    path.join(homeDirectory, "Applications/ChatGPT.app/Contents/Resources/codex"),
    path.join(homeDirectory, "Applications/Codex.app/Contents/Resources/codex"),
  ];
}

export async function resolveCodexBinary(options: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  canExecute?: ExecutableCheck;
} = {}): Promise<string> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? os.homedir();
  const canExecute = options.canExecute ?? isExecutable;
  const configured = env.DEPTHLINE_CODEX_BIN?.trim();

  const candidates = configured
    ? path.isAbsolute(configured) || configured.includes(path.sep)
      ? [configured]
      : pathCandidates(configured, env.PATH, platform)
    : [
        ...pathCandidates("codex", env.PATH, platform),
        ...(platform === "darwin" ? macAppCandidates(homeDirectory) : []),
      ];

  for (const candidate of [...new Set(candidates)]) {
    if (await canExecute(candidate)) return candidate;
  }

  const configuredHint = configured ? ` Configured value: ${configured}.` : "";
  throw new Error(
    `Codex executable was not found.${configuredHint} Set DEPTHLINE_CODEX_BIN to the full executable path.`,
  );
}
