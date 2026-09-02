import { readFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";

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

const env = loadEnvLocal();
let secret = env.TELEGRAM_WEBHOOK_SECRET || env.ADMIN_PASSWORD;
if (existsSync("tmp-tg-setup.json")) {
  const s = JSON.parse(readFileSync("tmp-tg-setup.json", "utf8"));
  secret = s.webhook_secret || secret;
}

if (!secret) {
  console.error("No webhook secret");
  process.exit(1);
}

const out = execFileSync(
  "curl.exe",
  [
    "-s",
    "-X",
    "POST",
    "https://langcenter-tillojon.vercel.app/api/telegram/setup",
    "-H",
    `x-setup-secret: ${secret}`,
    "-H",
    "Content-Type: application/json",
  ],
  { encoding: "utf8" },
);
console.log(out);

const admin = execFileSync(
  "curl.exe",
  ["-s", "https://langcenter-tillojon.vercel.app/api/telegram/admin/webhook"],
  { encoding: "utf8" },
);
const student = execFileSync(
  "curl.exe",
  ["-s", "https://langcenter-tillojon.vercel.app/api/telegram/student/webhook"],
  { encoding: "utf8" },
);
console.log("admin endpoint", admin);
console.log("student endpoint", student);

// verify webhook info via Telegram API using tokens from .env.local
async function webhookInfo(token, label) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const j = await res.json();
  if (!j.ok) {
    console.log(label, "getWebhookInfo fail", j.description);
    return;
  }
  console.log(
    label,
    "url=",
    j.result.url || "(empty)",
    "pending=",
    j.result.pending_update_count,
    j.result.last_error_message || "",
  );
}

if (env.TELEGRAM_ADMIN_BOT_TOKEN) {
  await webhookInfo(env.TELEGRAM_ADMIN_BOT_TOKEN, "admin");
}
if (env.TELEGRAM_STUDENT_BOT_TOKEN) {
  await webhookInfo(env.TELEGRAM_STUDENT_BOT_TOKEN, "student");
}
