/**
 * After schema is applied: register student, check password_plain via admin,
 * assign teacher, mark attendance + grade, student sees them.
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://langcenter-tillojon.onrender.com";

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

function curl(args) {
  return execSync(`curl.exe -s ${args}`, { encoding: "utf8" });
}

function j(args) {
  return JSON.parse(curl(args));
}

const env = loadEnv(".env.local");
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

// 0) schema
const probe = await sb
  .from("students")
  .select("id, password_plain, phone_digits, notes")
  .limit(1);
console.log(
  "0 schema select password_plain:",
  probe.error?.message || "OK",
  probe.data?.[0] ? Object.keys(probe.data[0]) : "",
);

// 1) admin login
writeFileSync(
  "tmp-admin.json",
  JSON.stringify({ password: env.ADMIN_PASSWORD }),
);
const login = j(
  `-c tmp-adm.txt -X POST "${BASE}/api/admin/login" -H "Content-Type: application/json" --data-binary "@tmp-admin.json"`,
);
console.log("1 admin", login.ok ? "OK" : login);

// 2) register
const loginName = "OK" + Date.now().toString().slice(-6);
const password = "mypass99";
writeFileSync(
  "tmp-reg.json",
  JSON.stringify({
    first_name: "Али",
    last_name: "Проверка",
    phone: "+992901234567",
    login: loginName,
    password,
    preferred_course: "English",
    preferred_schedule: "Вечер",
  }),
);
const reg = j(
  `-c tmp-stu.txt -X POST "${BASE}/api/students/register" -H "Content-Type: application/json" --data-binary "@tmp-reg.json"`,
);
console.log(
  "2 register",
  reg.student?.student_code || reg.error,
  reg.credentials?.password,
);

// 3) DB password_plain
if (reg.student?.id) {
  const { data: row, error } = await sb
    .from("students")
    .select("student_code, password_plain, notes, phone_digits")
    .eq("id", reg.student.id)
    .single();
  console.log(
    "3 db password_plain",
    error?.message || row?.password_plain,
    "notes",
    row?.notes?.slice?.(0, 40),
  );
}

// 4) admin list shows plain
const list = j(`-b tmp-adm.txt "${BASE}/api/students?search=${loginName}&limit=5"`);
const found = list.students?.find((s) => s.student_code === loginName);
console.log(
  "4 admin sees password",
  found?.password_plain || found?.student_code || list.error,
);

// 5) teachers + assign
const teachers = j(`-b tmp-adm.txt "${BASE}/api/teachers"`);
const teacher = teachers.teachers?.[0];
if (teacher && reg.student?.id) {
  writeFileSync(
    "tmp-assign.json",
    JSON.stringify({
      student_id: reg.student.id,
      teacher_id: teacher.id,
    }),
  );
  const assign = j(
    `-b tmp-adm.txt -X POST "${BASE}/api/assign" -H "Content-Type: application/json" --data-binary "@tmp-assign.json"`,
  );
  console.log("5 assign", assign.ok ?? assign.error ?? assign);

  // 6) reset teacher password + login
  const reset = j(
    `-b tmp-adm.txt -X POST "${BASE}/api/teachers/${teacher.id}/reset-password" -H "Content-Type: application/json" --data "{}"`,
  );
  const tPass = reset.credentials?.plain_password || reset.teacher?.plain_password;
  console.log("6 teacher reset", tPass ? "OK" : reset.error || reset);

  if (tPass) {
    writeFileSync(
      "tmp-tl.json",
      JSON.stringify({
        teacher_code: teacher.teacher_code,
        password: tPass,
      }),
    );
    const tl = j(
      `-c tmp-tch.txt -X POST "${BASE}/api/teachers/login" -H "Content-Type: application/json" --data-binary "@tmp-tl.json"`,
    );
    console.log("7 teacher login", tl.teacher?.teacher_code || tl.error);

    // 8 attendance
    writeFileSync(
      "tmp-att.json",
      JSON.stringify({
        student_id: reg.student.id,
        status: "present",
      }),
    );
    const att = j(
      `-b tmp-tch.txt -X POST "${BASE}/api/attendance" -H "Content-Type: application/json" --data-binary "@tmp-att.json"`,
    );
    console.log("8 attendance", att.ok || att.error || att.status || "ok-ish", JSON.stringify(att).slice(0, 120));

    // 9 grade
    writeFileSync(
      "tmp-grade.json",
      JSON.stringify({
        student_id: reg.student.id,
        title: "Урок 1",
        score: 95,
        comment: "Отлично",
      }),
    );
    const gr = j(
      `-b tmp-tch.txt -X POST "${BASE}/api/grades" -H "Content-Type: application/json" --data-binary "@tmp-grade.json"`,
    );
    console.log("9 grade", gr.ok || gr.error || gr.grade?.score || JSON.stringify(gr).slice(0, 120));
  }
}

// 10 student me again
const me = j(`-b tmp-stu.txt "${BASE}/api/student/me"`);
console.log(
  "10 student sees",
  "grades",
  me.grades?.length,
  "attendance",
  me.attendance?.length,
  "teachers",
  me.teachers?.length,
  me.error || "",
);

for (const f of [
  "tmp-admin.json",
  "tmp-adm.txt",
  "tmp-reg.json",
  "tmp-stu.txt",
  "tmp-assign.json",
  "tmp-tl.json",
  "tmp-tch.txt",
  "tmp-att.json",
  "tmp-grade.json",
]) {
  try {
    unlinkSync(f);
  } catch {
    /* */
  }
}
console.log("DONE");
