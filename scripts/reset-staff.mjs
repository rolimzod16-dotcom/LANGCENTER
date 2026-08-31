/**
 * Delete ALL students + teachers (+ related journal data),
 * then create exactly one teacher.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";

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

const env = loadEnv(".env.local");
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

async function count(table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return `err:${error.message}`;
  return count;
}

async function deleteAll(table) {
  // Fetch all ids in pages
  const allIds = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select("id")
      .range(from, from + page - 1);
    if (error) {
      console.log(`fetch ${table}:`, error.message);
      return { deleted: 0, error: error.message };
    }
    if (!data?.length) break;
    allIds.push(...data.map((r) => r.id));
    if (data.length < page) break;
    from += page;
  }
  if (!allIds.length) return { deleted: 0 };

  // delete in chunks
  let deleted = 0;
  for (let i = 0; i < allIds.length; i += 200) {
    const chunk = allIds.slice(i, i + 200);
    const { error } = await sb.from(table).delete().in("id", chunk);
    if (error) {
      console.log(`delete ${table}:`, error.message);
      return { deleted, error: error.message };
    }
    deleted += chunk.length;
  }
  return { deleted };
}

console.log("BEFORE");
for (const t of [
  "students",
  "teachers",
  "grades",
  "attendance",
  "student_payments",
  "group_students",
  "groups",
]) {
  console.log(`  ${t}:`, await count(t));
}

// order matters for FKs
for (const t of [
  "grades",
  "attendance",
  "student_payments",
  "group_students",
  "groups",
  "students",
  "teachers",
]) {
  const r = await deleteAll(t);
  console.log(`deleted ${t}:`, r.deleted, r.error || "ok");
}

// optional: clear telegram admin chats? keep them - user may be linked
// Create ONE teacher
const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const genPass = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789",
  10,
);
const year = new Date().getFullYear();
const teacher_code = `TCH-${year}-${genCode()}`;
const plain_password = genPass();
const password_hash = bcrypt.hashSync(plain_password, 10);
const full_name = "Учитель Основной";

const row = {
  full_name,
  teacher_code,
  password_hash,
  password_plain: plain_password,
  status: "active",
};

let ins = await sb
  .from("teachers")
  .insert(row)
  .select("id, full_name, teacher_code, status")
  .single();

if (ins.error?.message?.toLowerCase().includes("password_plain")) {
  delete row.password_plain;
  ins = await sb
    .from("teachers")
    .insert(row)
    .select("id, full_name, teacher_code, status")
    .single();
}

if (ins.error) {
  console.error("CREATE FAIL", ins.error.message);
  process.exit(1);
}

// best-effort store plain password for admin
await sb
  .from("teachers")
  .update({ password_plain: plain_password })
  .eq("id", ins.data.id);

console.log("\n=== CREATED TEACHER ===");
console.log(
  JSON.stringify(
    {
      full_name,
      teacher_code,
      password: plain_password,
      login_url: "https://langcenter-tillojon.onrender.com/teacher/login",
    },
    null,
    2,
  ),
);

console.log("\nAFTER");
for (const t of ["students", "teachers", "grades", "attendance", "student_payments", "group_students", "groups"]) {
  console.log(`  ${t}:`, await count(t));
}
