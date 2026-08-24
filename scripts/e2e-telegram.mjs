/**
 * E2E Telegram after SQL: schema, admin /auth, notify, student /login link, cabinet.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const BASE = "https://langcenter-tillojon.vercel.app";

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
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

function curlJson(args) {
  const out = execFileSync("curl.exe", ["-s", ...args], { encoding: "utf8" });
  try {
    return JSON.parse(out);
  } catch {
    return { raw: out };
  }
}

const env = loadEnv(".env.local");
const secret = env.TELEGRAM_WEBHOOK_SECRET || env.ADMIN_PASSWORD;
const adminPass = env.ADMIN_PASSWORD;
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const testAdminChat = 900000001;
const testStudentChat = 900000002;

console.log("=== 1 schema ===");
{
  const t = await sb.from("telegram_admin_chats").select("chat_id").limit(1);
  console.log("admin_chats table", t.error?.message || "OK");
  const s = await sb
    .from("students")
    .select("id, telegram_chat_id")
    .limit(1);
  console.log("students.telegram_chat_id", s.error?.message || "OK");
}

console.log("=== 2 admin /auth via webhook ===");
{
  const update = {
    update_id: Date.now(),
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: testAdminChat, type: "private" },
      from: { id: testAdminChat, first_name: "TestAdmin", username: "testadmin" },
      text: `/auth ${adminPass}`,
    },
  };
  writeFileSync("tmp-tg-upd.json", JSON.stringify(update));
  const res = execFileSync(
    "curl.exe",
    [
      "-s",
      "-X",
      "POST",
      `${BASE}/api/telegram/admin/webhook`,
      "-H",
      `x-telegram-bot-api-secret-token: ${secret}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@tmp-tg-upd.json",
    ],
    { encoding: "utf8" },
  );
  console.log("webhook", res);
  const { data } = await sb
    .from("telegram_admin_chats")
    .select("*")
    .eq("chat_id", testAdminChat)
    .maybeSingle();
  console.log("admin linked in DB", data ? "YES" : "NO", data);
}

console.log("=== 3 register + notify (needs real admin or test chat) ===");
{
  const login = "TG" + Date.now().toString().slice(-6);
  const password = "tgpass12";
  writeFileSync(
    "tmp-reg.json",
    JSON.stringify({
      first_name: "Тест",
      last_name: "ТГ",
      phone: "+992900111222",
      login,
      password,
      preferred_course: "English",
      preferred_schedule: "Вечер",
    }),
  );
  const reg = curlJson([
    "-X",
    "POST",
    `${BASE}/api/students/register`,
    "-H",
    "Content-Type: application/json",
    "--data-binary",
    "@tmp-reg.json",
  ]);
  console.log(
    "register",
    reg.student?.student_code || reg.error,
    reg.credentials?.password,
  );

  // student /login via webhook
  const upd = {
    update_id: Date.now() + 1,
    message: {
      message_id: 2,
      date: Math.floor(Date.now() / 1000),
      chat: { id: testStudentChat, type: "private" },
      from: { id: testStudentChat, first_name: "Student" },
      text: `/login ${login} ${password}`,
    },
  };
  writeFileSync("tmp-tg-upd2.json", JSON.stringify(upd));
  const res2 = execFileSync(
    "curl.exe",
    [
      "-s",
      "-X",
      "POST",
      `${BASE}/api/telegram/student/webhook`,
      "-H",
      `x-telegram-bot-api-secret-token: ${secret}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@tmp-tg-upd2.json",
    ],
    { encoding: "utf8" },
  );
  console.log("student login webhook", res2);

  if (reg.student?.id) {
    const { data: row } = await sb
      .from("students")
      .select("student_code, password_plain, telegram_chat_id, notes")
      .eq("id", reg.student.id)
      .single();
    console.log("student row after link", row);
  }
}

console.log("=== 4 student grades request (linked) ===");
{
  const upd = {
    update_id: Date.now() + 2,
    message: {
      message_id: 3,
      date: Math.floor(Date.now() / 1000),
      chat: { id: testStudentChat, type: "private" },
      from: { id: testStudentChat, first_name: "Student" },
      text: "📊 Оценки",
    },
  };
  writeFileSync("tmp-tg-upd3.json", JSON.stringify(upd));
  const res = execFileSync(
    "curl.exe",
    [
      "-s",
      "-X",
      "POST",
      `${BASE}/api/telegram/student/webhook`,
      "-H",
      `x-telegram-bot-api-secret-token: ${secret}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@tmp-tg-upd3.json",
    ],
    { encoding: "utf8" },
  );
  console.log("grades webhook", res);
}

// cleanup test admin chat from DB (fake id)
await sb.from("telegram_admin_chats").delete().eq("chat_id", testAdminChat);
console.log("cleaned test admin chat");

for (const f of [
  "tmp-tg-upd.json",
  "tmp-tg-upd2.json",
  "tmp-tg-upd3.json",
  "tmp-reg.json",
]) {
  try {
    unlinkSync(f);
  } catch {
    /* */
  }
}
console.log("DONE");
