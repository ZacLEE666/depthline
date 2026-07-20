import { spawn } from "node:child_process";

const children = [
  spawn("npx", ["tsx", "watch", "src/server/index.ts"], {
    stdio: "inherit",
    env: { ...process.env, DEPTHLINE_DEV_ORIGIN: "http://127.0.0.1:5173" },
  }),
  spawn("npx", ["vite"], { stdio: "inherit" }),
];

const stop = () => {
  for (const child of children) child.kill("SIGTERM");
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
      stop();
    }
  });
}
