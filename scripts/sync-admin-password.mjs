import { readFileSync } from "fs";
import { spawnSync } from "child_process";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, i)] = v;
  }
  return out;
}

const local = loadEnv(".env.local").ADMIN_PASSWORD;
if (!local) {
  console.error("ADMIN_PASSWORD missing in .env.local");
  process.exit(1);
}

for (const envName of ["production", "development", "preview"]) {
  spawnSync("vercel", ["env", "rm", "ADMIN_PASSWORD", envName, "--yes"], {
    shell: true,
    stdio: "pipe",
  });
}

for (const envName of ["production", "development"]) {
  const r = spawnSync("vercel", ["env", "add", "ADMIN_PASSWORD", envName], {
    input: `${local}\n`,
    encoding: "utf8",
    shell: true,
  });
  console.log(
    "set",
    envName,
    "status",
    r.status,
    (r.stderr || r.stdout || "").slice(0, 180).replace(local, "[redacted]"),
  );
}

console.log("Synced ADMIN_PASSWORD from .env.local (length", local.length + ")");
