/**
 * Sets Telegram env vars on Vercel (production + development).
 * Usage: node scripts/set-telegram-env.mjs
 * Reads secrets from env or from args file tmp-tg-secrets.json (deleted after).
 */
import { readFileSync, unlinkSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { randomBytes } from "crypto";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadEnvLocal() {
  const out = {};
  if (!existsSync(".env.local")) return out;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
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

function vercelEnvRm(name, envName) {
  spawnSync("vercel", ["env", "rm", name, envName, "--yes"], {
    shell: true,
    stdio: "pipe",
  });
}

function vercelEnvAdd(name, envName, value) {
  const r = spawnSync("vercel", ["env", "add", name, envName], {
    input: `${value}\n`,
    encoding: "utf8",
    shell: true,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.status !== 0) {
    console.error("FAIL", name, envName, out.slice(0, 200));
    return false;
  }
  console.log("OK", name, envName);
  return true;
}

const secretsPath = "tmp-tg-secrets.json";
if (!existsSync(secretsPath)) {
  console.error("missing tmp-tg-secrets.json");
  process.exit(1);
}

const secrets = loadJson(secretsPath);
const adminToken = String(secrets.admin || "").trim();
const studentToken = String(secrets.student || "").trim();
const webhookSecret =
  String(secrets.webhook_secret || "").trim() ||
  randomBytes(24).toString("hex");
const appUrl =
  String(secrets.app_url || "").trim() ||
  "https://langcenter-tillojon.vercel.app";

if (!adminToken || !studentToken) {
  console.error("tokens required");
  process.exit(1);
}

const pairs = [
  ["TELEGRAM_ADMIN_BOT_TOKEN", adminToken],
  ["TELEGRAM_STUDENT_BOT_TOKEN", studentToken],
  ["TELEGRAM_WEBHOOK_SECRET", webhookSecret],
  ["APP_URL", appUrl],
];

for (const envName of ["production", "development"]) {
  for (const [name, value] of pairs) {
    vercelEnvRm(name, envName);
    vercelEnvAdd(name, envName, value);
  }
}

// write webhook secret for setup step (not full tokens)
const setup = {
  webhook_secret: webhookSecret,
  app_url: appUrl,
  admin_token_len: adminToken.length,
  student_token_len: studentToken.length,
};
import { writeFileSync } from "fs";
writeFileSync("tmp-tg-setup.json", JSON.stringify(setup, null, 2));

// merge into .env.local without printing secrets
const local = loadEnvLocal();
local.TELEGRAM_ADMIN_BOT_TOKEN = adminToken;
local.TELEGRAM_STUDENT_BOT_TOKEN = studentToken;
local.TELEGRAM_WEBHOOK_SECRET = webhookSecret;
local.APP_URL = appUrl;
const lines = Object.entries(local).map(([k, v]) => `${k}=${v}`);
writeFileSync(".env.local", lines.join("\n") + "\n");

try {
  unlinkSync(secretsPath);
} catch {
  /* */
}

console.log("ENV set. webhook_secret length", webhookSecret.length);
console.log("APP_URL", appUrl);
