/**
 * Full usage simulation + audit against a live Lang Center URL.
 * Uses .env.local ADMIN_PASSWORD. Override host with BASE_URL.
 */
import { readFileSync, existsSync, writeFileSync } from "fs";

const env = loadEnv(".env.local");
const BASE = (
  process.env.BASE_URL ||
  env.APP_URL ||
  "https://langcenter-tillojon.onrender.com"
).replace(/\/$/, "");
const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
const stamp = Date.now().toString().slice(-6);

const report = {
  base: BASE,
  started_at: new Date().toISOString(),
  checks: [],
  created: {},
};

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

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const h of setCookieHeaders) {
    const part = h.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeJar(jar, headers) {
  const list =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie")]
        : [];
  Object.assign(jar, parseCookies(list.filter(Boolean)));
  return jar;
}

async function req(path, opts = {}) {
  const { method = "GET", body, jar, headers = {} } = opts;
  const h = { ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (jar && Object.keys(jar).length) h.cookie = cookieHeader(jar);
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  if (jar) mergeJar(jar, res.headers);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text: text.slice(0, 500), location: res.headers.get("location") };
}

function check(name, ok, detail) {
  const row = { name, ok: Boolean(ok), detail: detail ?? "" };
  report.checks.push(row);
  const mark = row.ok ? "OK " : "FAIL";
  console.log(`${mark}  ${name}${row.detail ? " — " + String(row.detail).slice(0, 180) : ""}`);
  return row.ok;
}

async function page(name, path, expect = 200) {
  const r = await req(path);
  return check(name, r.status === expect, `HTTP ${r.status}`);
}

const adminJar = {};
const teacherJar = {};
const studentJar = {};

console.log(`\n=== LANG CENTER AUDIT ===\n${BASE}\n`);

// ---------- pages ----------
await page("landing /", "/");
await page("admin login page", "/admin/login");
await page("student login page", "/student/login");
await page("teacher login page", "/teacher/login");
await page("register page", "/register");
await page("download page", "/download");

const adminGuard = await req("/admin");
check(
  "admin page redirects when logged out",
  adminGuard.status === 307 || adminGuard.status === 302,
  `HTTP ${adminGuard.status} → ${adminGuard.location || ""}`,
);

// ---------- telegram health ----------
for (const bot of ["admin", "student", "teacher"]) {
  const r = await req(`/api/telegram/${bot}/webhook`);
  check(
    `telegram ${bot} webhook GET`,
    r.status === 200 && r.json?.ok === true && r.json?.configured === true,
    JSON.stringify(r.json || { status: r.status }),
  );
}

// ---------- admin auth ----------
const badAdmin = await req("/api/admin/login", {
  method: "POST",
  body: { password: "wrong-password" },
});
check("admin login rejects bad password", badAdmin.status === 401, `HTTP ${badAdmin.status}`);

const adminLogin = await req("/api/admin/login", {
  method: "POST",
  body: { password: ADMIN_PASSWORD },
  jar: adminJar,
});
check(
  "admin login",
  adminLogin.status === 200 && adminLogin.json?.ok === true && Boolean(adminJar.lc_admin),
  JSON.stringify(adminLogin.json) + " cookie=" + Boolean(adminJar.lc_admin),
);

const orgs = await req("/api/org", { jar: adminJar });
check(
  "list organizations",
  orgs.status === 200 && Array.isArray(orgs.json?.organizations) && orgs.json.organizations.length >= 1,
  JSON.stringify(orgs.json?.organizations?.map((o) => o.slug) || orgs.json),
);

const teachers0 = await req("/api/teachers", { jar: adminJar });
check(
  "list teachers",
  teachers0.status === 200 && Array.isArray(teachers0.json?.teachers),
  `count=${teachers0.json?.teachers?.length ?? "err"} ${teachers0.json?.error || ""}`,
);

const students0 = await req("/api/students?limit=5", { jar: adminJar });
check(
  "list students",
  students0.status === 200 && Array.isArray(students0.json?.students),
  `count=${students0.json?.students?.length ?? "err"} total=${students0.json?.pagination?.total ?? "?"} ${students0.json?.error || ""}`,
);

const dash0 = await req("/api/owner/dashboard", { jar: adminJar });
check(
  "owner dashboard",
  dash0.status === 200 && typeof dash0.json?.students_active === "number",
  JSON.stringify({
    teachers: dash0.json?.teachers_active,
    students: dash0.json?.students_active,
    month_expected: dash0.json?.month_expected,
    error: dash0.json?.error,
  }),
);

// ---------- create teacher ----------
const teacherCreate = await req("/api/teachers", {
  method: "POST",
  jar: adminJar,
  body: {
    first_name: "Азиз",
    last_name: "Тестов",
    phone: "+99290011" + stamp.slice(-4),
    group_name: "English A1 Audit",
  },
});
const teacher = teacherCreate.json?.teacher;
check(
  "create teacher",
  teacherCreate.status === 201 && teacher?.id && teacher?.teacher_code && teacher?.plain_password,
  teacher
    ? `${teacher.teacher_code} / ${teacher.full_name}`
    : JSON.stringify(teacherCreate.json) + ` HTTP ${teacherCreate.status}`,
);
report.created.teacher = teacher
  ? { id: teacher.id, code: teacher.teacher_code, password: teacher.plain_password }
  : null;

// ---------- public register 3 students ----------
const students = [];
for (let i = 1; i <= 3; i++) {
  const login = `AUD${stamp}${i}`;
  const password = `Pass${stamp}${i}`;
  const r = await req("/api/students/register", {
    method: "POST",
    body: {
      first_name: ["Али", "Зарина", "Дилшод"][i - 1],
      last_name: ["Рахимов", "Каримова", "Саидов"][i - 1],
      phone: `+99290${stamp}${i}`,
      login,
      password,
      preferred_course: "English (общий)",
      preferred_schedule: "18:30",
      monthly_fee: 500000,
    },
  });
  const st = r.json?.student;
  const ok = r.status === 201 && st?.id && (st.student_code || r.json?.credentials?.code);
  check(
    `register student ${i}`,
    ok,
    ok ? (st.student_code || login) : JSON.stringify(r.json) + ` HTTP ${r.status}`,
  );
  if (ok) {
    students.push({
      id: st.id,
      code: st.student_code || r.json.credentials?.code || login,
      password: r.json.credentials?.password || password,
      name: `${st.last_name || ""} ${st.first_name || ""}`.trim(),
    });
  }
}
report.created.students = students;

// ---------- assign all to teacher ----------
if (teacher?.id) {
  for (const st of students) {
    const r = await req("/api/assign", {
      method: "POST",
      jar: adminJar,
      body: { student_id: st.id, teacher_id: teacher.id },
    });
    check(
      `assign ${st.code} → teacher`,
      r.status === 200 && r.json?.ok === true,
      JSON.stringify(r.json),
    );
  }
}

// ---------- teacher login + journal ----------
if (teacher?.teacher_code && teacher?.plain_password) {
  const tLogin = await req("/api/teachers/login", {
    method: "POST",
    jar: teacherJar,
    body: { teacher_code: teacher.teacher_code, password: teacher.plain_password },
  });
  check(
    "teacher login",
    tLogin.status === 200 && tLogin.json?.teacher?.id,
    JSON.stringify(tLogin.json?.teacher || tLogin.json),
  );

  const meT = await req("/api/teacher/me", { jar: teacherJar });
  check(
    "teacher /me",
    meT.status === 200 && meT.json?.teacher?.id === teacher.id,
    JSON.stringify(meT.json?.teacher || meT.json),
  );

  if (students[0]) {
    const att = await req("/api/attendance", {
      method: "POST",
      jar: teacherJar,
      body: { student_id: students[0].id, status: "present" },
    });
    check(
      "mark attendance present",
      att.status === 201 && att.json?.record?.id,
      JSON.stringify(att.json),
    );

    const bulk = await req("/api/attendance", {
      method: "POST",
      jar: teacherJar,
      body: { student_ids: students.map((s) => s.id), status: "present" },
    });
    check(
      "bulk attendance",
      bulk.status === 201 && bulk.json?.bulk === true && Number(bulk.json?.marked) > 0,
      JSON.stringify(bulk.json),
    );

    const grade = await req("/api/grades", {
      method: "POST",
      jar: teacherJar,
      body: {
        student_id: students[0].id,
        title: "Тест: Present Simple",
        score: 88,
        max_score: 100,
      },
    });
    check(
      "add grade",
      grade.status === 201 && grade.json?.grade?.id,
      JSON.stringify(grade.json),
    );
  }
}

// ---------- payments ----------
const gen = await req("/api/payments/generate", {
  method: "POST",
  jar: adminJar,
  body: {},
});
check(
  "generate monthly payments",
  gen.status === 200 && (gen.json?.created != null || gen.json?.total != null || Array.isArray(gen.json?.payments)),
  JSON.stringify(gen.json),
);

if (students[0]) {
  const cash = await req("/api/payments/student", {
    method: "POST",
    jar: adminJar,
    body: { student_id: students[0].id, action: "paid" },
  });
  check(
    "mark student paid (cash)",
    cash.status === 200 && (cash.json?.ok === true || cash.json?.payment || cash.json?.status === "paid" || cash.json?.current),
    JSON.stringify(cash.json),
  );
}

const reports = await req("/api/owner/reports", { jar: adminJar });
check(
  "owner reports",
  reports.status === 200 && (reports.json?.summary || reports.json?.period_month || reports.json?.teachers),
  JSON.stringify({
    keys: reports.json ? Object.keys(reports.json) : [],
    error: reports.json?.error,
    status: reports.status,
  }),
);

const dash1 = await req("/api/owner/dashboard", { jar: adminJar });
check(
  "owner dashboard after activity",
  dash1.status === 200 && Number(dash1.json?.students_active) >= students.length,
  JSON.stringify({
    students: dash1.json?.students_active,
    teachers: dash1.json?.teachers_active,
    month_income: dash1.json?.month_income,
    month_debt: dash1.json?.month_debt,
    error: dash1.json?.error,
  }),
);

// ---------- student cabinet ----------
if (students[0]) {
  const sLogin = await req("/api/students/login", {
    method: "POST",
    jar: studentJar,
    body: { student_code: students[0].code, password: students[0].password },
  });
  check(
    "student login",
    sLogin.status === 200 && sLogin.json?.student?.id,
    JSON.stringify(sLogin.json?.student || sLogin.json),
  );

  const meS = await req("/api/student/me", { jar: studentJar });
  check(
    "student /me",
    meS.status === 200 && meS.json?.student?.id === students[0].id,
    JSON.stringify({
      id: meS.json?.student?.id,
      grades: meS.json?.grades?.length ?? meS.json?.student?.grades?.length,
      attendance: meS.json?.attendance?.length,
      error: meS.json?.error,
      keys: meS.json ? Object.keys(meS.json) : [],
    }),
  );

  const dashPage = await req("/student/dashboard", { jar: studentJar });
  check(
    "student dashboard page",
    dashPage.status === 200,
    `HTTP ${dashPage.status}`,
  );
}

const teacherDash = await req("/teacher/dashboard", { jar: teacherJar });
check(
  "teacher dashboard page",
  teacherDash.status === 200,
  `HTTP ${teacherDash.status}`,
);

const adminHome = await req("/admin", { jar: adminJar });
check(
  "admin home page",
  adminHome.status === 200,
  `HTTP ${adminHome.status}`,
);

// ---------- 5-day journal for first student ----------
if (teacher?.id && students[0]) {
  let attDays = 0;
  let gradeDays = 0;
  for (let d = 1; d <= 5; d++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - d);
    const lesson_date = day.toISOString().slice(0, 10);
    const att = await req("/api/attendance", {
      method: "POST",
      jar: teacherJar,
      body: {
        student_id: students[0].id,
        status: d % 5 === 0 ? "absent" : "present",
        lesson_date,
      },
    });
    if (att.status === 201) attDays += 1;
    const gr = await req("/api/grades", {
      method: "POST",
      jar: teacherJar,
      body: {
        student_id: students[0].id,
        title: `Урок ${d}`,
        score: 70 + d * 3,
      },
    });
    if (gr.status === 201) gradeDays += 1;
  }
  check("5-day attendance history", attDays === 5, `${attDays}/5`);
  check("5-day grades history", gradeDays === 5, `${gradeDays}/5`);
}

const passed = report.checks.filter((c) => c.ok).length;
const failed = report.checks.filter((c) => !c.ok);
report.finished_at = new Date().toISOString();
report.passed = passed;
report.failed = failed.length;

writeFileSync(
  "scripts/full-audit-report.json",
  JSON.stringify(report, null, 2),
  "utf8",
);

console.log(`\n=== RESULT ${passed}/${report.checks.length} passed, ${failed.length} failed ===`);
if (failed.length) {
  console.log("Failures:");
  for (const f of failed) console.log(" -", f.name, f.detail);
}
process.exit(failed.length ? 1 : 0);
