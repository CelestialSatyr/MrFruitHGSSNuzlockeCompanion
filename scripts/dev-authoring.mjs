import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error(
    "Could not locate npm's CLI. Run this launcher through `npm run dev:authoring` rather than invoking scripts/dev-authoring.mjs directly.",
  );
}

function spawnNpm(args) {
  return spawn(process.execPath, [npmCli, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });
}

// Invoke each workspace script directly. Passing Vite flags through the root
// `dev:site` wrapper caused npm on Windows to consume `--port` and leave Vite
// with a positional `5173` argument (`vite 5173`), which changes Vite's root.
const children = [
  spawnNpm(["run", "dev", "--workspace", "@nuzlocke/site", "--", "--port", "5173", "--strictPort"]),
  spawnNpm(["run", "dev", "--workspace", "@nuzlocke/editor"]),
];

let stopping = false;

function stop() {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

for (const child of children) {
  child.on("error", (error) => {
    if (!stopping) {
      console.error("Failed to start an authoring process:", error);
      process.exitCode = 1;
      stop();
    }
  });

  child.on("exit", (code) => {
    if (!stopping && code !== null && code !== 0) {
      process.exitCode = code;
      stop();
    }
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
