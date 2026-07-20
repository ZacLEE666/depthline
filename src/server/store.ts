import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PersistedState } from "../shared/types.js";

const EMPTY_STATE: PersistedState = {
  version: 1,
  threadPreferences: {},
};

export class LocalStateStore {
  readonly directory: string;
  readonly filePath: string;

  constructor(directory = process.env.DEPTHLINE_DATA_DIR || path.join(os.homedir(), ".depthline")) {
    this.directory = directory;
    this.filePath = path.join(directory, "state.json");
  }

  async read(): Promise<PersistedState> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as PersistedState;
      if (parsed.version !== 1 || typeof parsed.threadPreferences !== "object") {
        return structuredClone(EMPTY_STATE);
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STATE);
      throw error;
    }
  }

  async write(state: PersistedState): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, this.filePath);
  }

  async update(mutator: (state: PersistedState) => void): Promise<PersistedState> {
    const state = await this.read();
    mutator(state);
    await this.write(state);
    return state;
  }
}
