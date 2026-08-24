/**
 * E2E: trial application + accept + student register via bot webhooks
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://langcenter-tillojon.vercel.app";

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
    )
      v = v.slice(1, -1);
    out[line.slice(0, i)] = v;
  }
  return out;
}

function postWebhook(path, update, secret) {
  writeFileSync("tmp-wh.json", JSON.stringify(update));
  const out = execFileSync(
    "curl.exe",
    [
      "-s",
      "-X",
      "POST",
      `${BASE}${path}`,
      "-H",
      `x-telegram-bot-api-secret-token: ${secret}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@tmp-wh.json",
    ],
    { encoding: "utf8" },
  );
  return out;
}

const env = loadEnv(".env.local");
const secret = env.TELEGRAM_WEBHOOK_SECRET || env.ADMIN_PASSWORD;
const adminPass = env.ADMIN_PASSWORD;
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const ADMIN_CHAT = 910000001;
const STUDENT_CHAT = 910000002;
let uid = Date.now();

function msg(chatId, text, fromId = chatId, username = "tester") {
  return {
    update_id: ++uid,
    message: {
      message_id: uid % 10000,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: "private" },
      from: {
        id: fromId,
        first_name: "Test",
        username,
      },
      text,
    },
  };
}

function cb(chatId, data, fromId = chatId) {
  return {
    update_id: ++uid,
    callback_query: {
      id: String(uid),
      from: { id: fromId, first_name: "Admin" },
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: "private" },
        text: "app",
      },
      data,
    },
  };
}

console.log("=== E2E TRIAL + REGISTER ===\n");

// cleanup leftover test chats
await sb.from("telegram_admin_chats").delete().eq("chat_id", ADMIN_CHAT);
await sb.from("telegram_sessions").delete().eq("chat_id", STUDENT_CHAT);
await sb.from("telegram_sessions").delete().eq("chat_id", ADMIN_CHAT);

// 1) Admin auth
console.log("1) Admin /auth");
let r = postWebhook(
  "/api/telegram/admin/webhook",
  msg(ADMIN_CHAT, `/auth ${adminPass}`, ADMIN_CHAT, "admin_test"),
  secret,
);
console.log("   ", r);
const { data: adm } = await sb
  .from("telegram_admin_chats")
  .select("*")
  .eq("chat_id", ADMIN_CHAT)
  .maybeSingle();
console.log("   linked:", adm ? "YES" : "NO");

// 2) Student trial flow
console.log("2) Trial application dialog");
const steps = [
  "📝 Пробный урок",
  "Тестов Тест",
  "+992900555667",
];
for (const t of steps) {
  r = postWebhook(
    "/api/telegram/student/webhook",
    msg(STUDENT_CHAT, t, STUDENT_CHAT, "stu_test"),
    secret,
  );
}
// pick course via callback
r = postWebhook(
  "/api/telegram/student/webhook",
  cb(STUDENT_CHAT, "trial_course:0", STUDENT_CHAT),
  secret,
);
// date
r = postWebhook(
  "/api/telegram/student/webhook",
  msg(STUDENT_CHAT, "завтра", STUDENT_CHAT, "stu_test"),
  secret,
);
// time
r = postWebhook(
  "/api/telegram/student/webhook",
  cb(STUDENT_CHAT, "trial_time:5", STUDENT_CHAT),
  secret,
);
console.log("   finish trial webhook", r);

const { data: apps } = await sb
  .from("trial_applications")
  .select("*")
  .eq("telegram_chat_id", STUDENT_CHAT)
  .order("created_at", { ascending: false })
  .limit(1);
const app = apps?.[0];
console.log(
  "   app:",
  app
    ? `${app.status} ${app.full_name} ${app.preferred_date} ${app.preferred_time}`
    : "NONE",
);

if (!app) {
  console.error("FAIL: no application created");
  process.exit(1);
}

// 3) Accept
console.log("3) Admin accept");
r = postWebhook(
  "/api/telegram/admin/webhook",
  cb(ADMIN_CHAT, `lead:accept:${app.id}`, ADMIN_CHAT),
  secret,
);
console.log("   ", r);

const { data: app2 } = await sb
  .from("trial_applications")
  .select("*")
  .eq("id", app.id)
  .single();
console.log(
  "   status:",
  app2?.status,
  "login:",
  app2?.login_code,
  "pass:",
  app2?.plain_password,
  "student_id:",
  app2?.student_id ? "yes" : "no",
);

if (app2?.status !== "accepted" || !app2.student_id) {
  console.error("FAIL: accept");
  process.exit(1);
}

// student should be linked
const { data: st } = await sb
  .from("students")
  .select("student_code, password_plain, telegram_chat_id, full_name")
  .eq("id", app2.student_id)
  .single();
console.log("   student:", st);

// 4) Direct registration via bot
console.log("4) Direct registration in TG");
const chat3 = 910000003;
await sb.from("telegram_sessions").delete().eq("chat_id", chat3);
const login = "TGREG" + Date.now().toString().slice(-5);
const pass = "regpass1";
const regSteps = [
  "✍️ Регистрация",
  "Новиков Иван",
  "+992901112233",
  login,
  pass,
  pass,
];
for (const t of regSteps) {
  r = postWebhook(
    "/api/telegram/student/webhook",
    msg(chat3, t, chat3, "reg_test"),
    secret,
  );
}
const { data: regStu } = await sb
  .from("students")
  .select("student_code, password_plain, telegram_chat_id, full_name")
  .eq("telegram_chat_id", chat3)
  .maybeSingle();
console.log("   registered:", regStu);

// 5) Reject flow
console.log("5) Reject flow");
const chat4 = 910000004;
await sb.from("telegram_sessions").delete().eq("chat_id", chat4);
for (const t of ["📝 Пробный урок", "Отказ Тест", "-", "завтра"]) {
  postWebhook(
    "/api/telegram/student/webhook",
    msg(chat4, t, chat4, "rej"),
    secret,
  );
}
// course + time via cb - need course first after phone
// After name, phone "-" goes to course callback state - we sent "завтра" too early
// restart clean reject flow
await sb.from("telegram_sessions").delete().eq("chat_id", chat4);
postWebhook(
  "/api/telegram/student/webhook",
  msg(chat4, "📝 Пробный урок", chat4),
  secret,
);
postWebhook(
  "/api/telegram/student/webhook",
  msg(chat4, "Отказ Тест", chat4),
  secret,
);
postWebhook(
  "/api/telegram/student/webhook",
  msg(chat4, "-", chat4),
  secret,
);
postWebhook(
  "/api/telegram/student/webhook",
  cb(chat4, "trial_course:1", chat4),
  secret,
);
postWebhook(
  "/api/telegram/student/webhook",
  msg(chat4, "28.07.2026", chat4),
  secret,
);
postWebhook(
  "/api/telegram/student/webhook",
  cb(chat4, "trial_time:2", chat4),
  secret,
);

const { data: apps2 } = await sb
  .from("trial_applications")
  .select("*")
  .eq("telegram_chat_id", chat4)
  .eq("status", "pending")
  .order("created_at", { ascending: false })
  .limit(1);
const appR = apps2?.[0];
console.log("   pending reject app:", appR?.id ? "yes" : "no", appR?.full_name);

if (appR) {
  r = postWebhook(
    "/api/telegram/admin/webhook",
    cb(ADMIN_CHAT, `lead:reject:${appR.id}`, ADMIN_CHAT),
    secret,
  );
  const { data: appR2 } = await sb
    .from("trial_applications")
    .select("status")
    .eq("id", appR.id)
    .single();
  console.log("   reject status:", appR2?.status);
}

// cleanup test data
console.log("\n6) Cleanup test rows…");
await sb.from("telegram_admin_chats").delete().eq("chat_id", ADMIN_CHAT);
for (const c of [STUDENT_CHAT, chat3, chat4, ADMIN_CHAT]) {
  await sb.from("telegram_sessions").delete().eq("chat_id", c);
}
// keep students created - or delete test ones
if (app2?.student_id) {
  await sb.from("students").delete().eq("id", app2.student_id);
}
if (regStu) {
  const { data: rs } = await sb
    .from("students")
    .select("id")
    .eq("telegram_chat_id", chat3);
  if (rs?.[0]) await sb.from("students").delete().eq("id", rs[0].id);
}
// also by login
await sb.from("students").delete().eq("student_code", login.toUpperCase());
await sb.from("trial_applications").delete().eq("telegram_chat_id", STUDENT_CHAT);
await sb.from("trial_applications").delete().eq("telegram_chat_id", chat4);

try {
  unlinkSync("tmp-wh.json");
} catch {
  /* */
}

const ok =
  adm &&
  app2?.status === "accepted" &&
  st?.telegram_chat_id === STUDENT_CHAT &&
  regStu?.student_code &&
  appR;

console.log("\n=== RESULT ===", ok ? "ALL CRITICAL PATHS OK" : "CHECK FAILURES");
process.exit(ok ? 0 : 1);
