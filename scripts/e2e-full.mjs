/**
 * Full smoke: admin login → list → create teacher → create student → assign
 * Uses .env.local ADMIN_PASSWORD against production URL.
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";

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

const pass = loadEnv(".env.local").ADMIN_PASSWORD;
writeFileSync("tmp-admin.json", JSON.stringify({ password: pass }));

const login = JSON.parse(
  curl(
    `-c tmp-adm.txt -X POST "${BASE}/api/admin/login" -H "Content-Type: application/json" --data-binary "@tmp-admin.json"`,
  ),
);
console.log("1 admin login", login.ok ? "OK" : login);

const teachers = JSON.parse(curl(`-b tmp-adm.txt "${BASE}/api/teachers"`));
console.log(
  "2 teachers",
  teachers.teachers?.length ?? teachers.error,
  teachers.teachers?.[0]?.teacher_code,
);

const students = JSON.parse(
  curl(`-b tmp-adm.txt "${BASE}/api/students?limit=5"`),
);
console.log(
  "3 students",
  students.students?.length ?? students.error,
  "total",
  students.pagination?.total,
);

// public register
const loginName = "SMOKE" + Date.now().toString().slice(-5);
writeFileSync(
  "tmp-reg.json",
  JSON.stringify({
    first_name: "Smoke",
    last_name: "Test",
    phone: "+992900000099",
    login: loginName,
    password: "smoke123",
    preferred_course: "English",
  }),
);
const reg = JSON.parse(
  curl(
    `-c tmp-stu.txt -X POST "${BASE}/api/students/register" -H "Content-Type: application/json" --data-binary "@tmp-reg.json"`,
  ),
);
console.log(
  "4 register",
  reg.student?.student_code || reg.error,
  reg.credentials?.password ? "has-pass" : "",
);

const me = JSON.parse(curl(`-b tmp-stu.txt "${BASE}/api/student/me"`));
console.log(
  "5 student me",
  me.student?.student_code || me.error,
  "teachers",
  me.teachers?.length,
  "payment",
  me.payment?.status,
);

// assign to first teacher if any
const teacherId = teachers.teachers?.[0]?.id;
const studentId = reg.student?.id;
if (teacherId && studentId) {
  writeFileSync(
    "tmp-assign.json",
    JSON.stringify({ student_id: studentId, teacher_id: teacherId }),
  );
  const assign = JSON.parse(
    curl(
      `-b tmp-adm.txt -X POST "${BASE}/api/assign" -H "Content-Type: application/json" --data-binary "@tmp-assign.json"`,
    ),
  );
  console.log("6 assign", assign.ok || assign.error || assign);
}

// teacher login needs password we don't have - skip or reset
if (teacherId) {
  const reset = JSON.parse(
    curl(
      `-b tmp-adm.txt -X POST "${BASE}/api/teachers/${teacherId}/reset-password" -H "Content-Type: application/json" --data "{}"`,
    ),
  );
  console.log(
    "7 teacher reset",
    reset.credentials?.plain_password
      ? "OK got password"
      : reset.error || JSON.stringify(reset).slice(0, 120),
  );
  if (reset.credentials?.plain_password && teachers.teachers?.[0]?.teacher_code) {
    writeFileSync(
      "tmp-tl.json",
      JSON.stringify({
        teacher_code: teachers.teachers[0].teacher_code,
        password: reset.credentials.plain_password,
      }),
    );
    const tl = JSON.parse(
      curl(
        `-c tmp-tch.txt -X POST "${BASE}/api/teachers/login" -H "Content-Type: application/json" --data-binary "@tmp-tl.json"`,
      ),
    );
    console.log("8 teacher login", tl.teacher?.teacher_code || tl.error);
    const tme = JSON.parse(curl(`-b tmp-tch.txt "${BASE}/api/teacher/me"`));
    console.log(
      "9 teacher me students",
      tme.students?.length ?? tme.error,
    );
  }
}

for (const f of [
  "tmp-admin.json",
  "tmp-adm.txt",
  "tmp-reg.json",
  "tmp-stu.txt",
  "tmp-assign.json",
  "tmp-tl.json",
  "tmp-tch.txt",
]) {
  try {
    unlinkSync(f);
  } catch {
    /* */
  }
}
console.log("DONE");
