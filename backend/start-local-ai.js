// Starts the already-downloaded local runtime. No install, pull or cloud login.
const fs = require("node:fs"), path = require("node:path"), { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..", "storage", "local-ai");
const executable = path.join(root, "runtime", "ollama.exe");
if (process.platform !== "win32" || !fs.existsSync(executable)) {
  console.error("The portable Windows Ollama runtime is missing. See docs/JD-LOCAL-PROVIDER.md; this command never downloads software automatically.");
  process.exit(1);
}
console.log("Local highlight runtime: http://127.0.0.1:11435 · cloud disabled · Ctrl+C to stop");
const child = spawnSync(executable, ["serve"], { stdio: "inherit", windowsHide: true,
  env: { ...process.env, OLLAMA_NO_CLOUD: "1", OLLAMA_HOST: "127.0.0.1:11435", OLLAMA_MODELS: path.join(root, "models"),
    OLLAMA_NOPRUNE: "1", OLLAMA_NUM_PARALLEL: "1", OLLAMA_MAX_LOADED_MODELS: "1", OLLAMA_MAX_QUEUE: "2", OLLAMA_CONTEXT_LENGTH: "4096", OLLAMA_KEEP_ALIVE: "2m" } });
if (child.error) console.error("Local runtime could not start:", child.error.message);
process.exitCode = child.status ?? 1;
