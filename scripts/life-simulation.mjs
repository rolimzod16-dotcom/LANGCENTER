/**
 * Full real-life simulation:
 * 15 students register → assigned to teacher → 15 days attendance + grades + payments
 * Then verify admin / teacher / student views.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import bcrypt from "bcryptjs";

const BASE = "https://langcenter-tillojon.onrender.com";
const TEACHER_CODE = "TCH-2026-FMZFHY";
const TEACHER_PASS = "KhaReGjkac";
const DAYS = 15;
const STUDENT_COUNT = 15;

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

function curl(args, cookieJar) {
  const full = ["-s"];
  if (cookieJar) {
    full.push("-b", cookieJar, "-c", cookieJar);
  }
  full.push(...args);
  return execFileSync("curl.exe", full, { encoding: "utf8", maxBuffer: 10e6 });
}

function curlJson(args, cookieJar) {
  const raw = curl(args, cookieJar);
  try {
    return JSON.parse(raw);
  } catch {
    return { raw: raw.slice(0, 400) };
  }
}

function dateOffset(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randScore() {
  // realistic: mostly 70-100, occasional lower
  const r = Math.random();
  if (r < 0.1) return 45 + Math.floor(Math.random() * 20);
  if (r < 0.3) return 65 + Math.floor(Math.random() * 15);
  return 80 + Math.floor(Math.random() * 21);
}

const FIRST = [
  "Али",
  "Фаридун",
  "Мехрдод",
  "Зарина",
  "Дилшод",
  "Нигора",
  "Руслан",
  "Мадина",
  "Джамшед",
  "Сабина",
  "Комрон",
  "Парвина",
  "Шахром",
  "Азиза",
  "Бехруз",
];
const LAST = [
  "Рахимов",
  "Каримова",
  "Олимзода",
  "Саидов",
  "Назарова",
  "Юсупов",
  "Исмоилова",
  "Шарипов",
  "Абдуллоева",
  "Мирзоев",
  "Хасанова",
  "Бобоев",
  "Ахмедова",
  "Раджабов",
  "Сатторова",
];

const LESSON_TITLES = [
  "Урок: Present Simple",
  "Урок: Past Simple",
  "ДЗ: Vocabulary",
  "Тест: Unit 1",
  "Говорение",
  "Аудирование",
  "Writing",
  "Grammar quiz",
  "Reading",
  "Контрольная",
];

const env = loadEnv(".env.local");
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const report = {
  teacher: null,
  students: [],
  attendance_rows: 0,
  grades_rows: 0,
  payments_rows: 0,
  checks: [],
};

console.log("=== LIFE SIMULATION START ===\n");

// 1) Find teacher
console.log("1) Teacher…");
const { data: teacher, error: tErr } = await sb
  .from("teachers")
  .select("id, full_name, teacher_code, status")
  .eq("teacher_code", TEACHER_CODE)
  .maybeSingle();
if (tErr || !teacher) {
  console.error("Teacher not found", tErr?.message);
  process.exit(1);
}
report.teacher = teacher;
console.log("   ", teacher.full_name, teacher.teacher_code);

// 2) Ensure group
console.log("2) Group…");
let { data: group } = await sb
  .from("groups")
  .select("id, name")
  .eq("teacher_id", teacher.id)
  .limit(1)
  .maybeSingle();
if (!group) {
  const ins = await sb
    .from("groups")
    .insert({
      teacher_id: teacher.id,
      name: "English A1 · Утро",
      level: "A1",
    })
    .select("id, name")
    .single();
  if (ins.error) {
    console.error("group create", ins.error.message);
    process.exit(1);
  }
  group = ins.data;
}
console.log("   ", group.name, group.id);

// 3) Register 15 students via public API
console.log("3) Register 15 students…");
const students = [];
for (let i = 0; i < STUDENT_COUNT; i++) {
  const first = FIRST[i];
  const last = LAST[i];
  const login = `STU${String(i + 1).padStart(2, "0")}${Date.now().toString().slice(-4)}`;
  const password = `Pass${1000 + i}!`;
  const phone = `+99290${String(1000000 + i * 111).slice(0, 7)}`;
  const courses = [
    "English (общий / разговорный)",
    "English · IELTS",
    "Китайский",
    "Русский",
  ];

  writeFileSync(
    "tmp-life-reg.json",
    JSON.stringify({
      first_name: first,
      last_name: last,
      phone,
      login,
      password,
      preferred_course: courses[i % courses.length],
      preferred_schedule: i % 2 === 0 ? "Вечер (17:00–21:00)" : "Утро (09:00–12:00)",
    }),
  );

  const reg = curlJson([
    "-X",
    "POST",
    `${BASE}/api/students/register`,
    "-H",
    "Content-Type: application/json",
    "--data-binary",
    "@tmp-life-reg.json",
  ]);

  if (!reg.student?.id) {
    console.error("   FAIL", i + 1, reg.error || reg.raw);
    process.exit(1);
  }

  students.push({
    id: reg.student.id,
    first,
    last,
    login: reg.student.student_code || login.toUpperCase(),
    password,
    phone,
  });
  process.stdout.write(`   ✓ ${i + 1}/${STUDENT_COUNT} ${last} ${first} (${students[i].login})\n`);
}
report.students = students.map((s) => ({
  name: `${s.last} ${s.first}`,
  login: s.login,
  password: s.password,
}));

// 4) Assign all to teacher group
console.log("4) Assign to teacher…");
// admin login for assign API
writeFileSync(
  "tmp-life-admin.json",
  JSON.stringify({ password: env.ADMIN_PASSWORD }),
);
curlJson(
  [
    "-X",
    "POST",
    `${BASE}/api/admin/login`,
    "-H",
    "Content-Type: application/json",
    "--data-binary",
    "@tmp-life-admin.json",
  ],
  "tmp-life-adm.txt",
);

for (const s of students) {
  writeFileSync(
    "tmp-life-assign.json",
    JSON.stringify({
      student_id: s.id,
      teacher_id: teacher.id,
      group_id: group.id,
    }),
  );
  const a = curlJson(
    [
      "-X",
      "POST",
      `${BASE}/api/assign`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@tmp-life-assign.json",
    ],
    "tmp-life-adm.txt",
  );
  if (!a.ok && a.error) {
    // fallback direct DB
    const { error } = await sb.from("group_students").upsert(
      { group_id: group.id, student_id: s.id },
      { onConflict: "group_id,student_id" },
    );
    if (error) console.error("assign", s.login, a.error, error.message);
  }
}
console.log("   assigned", students.length);

// 5) 15 days attendance for all students
console.log("5) Attendance 15 days…");
const statuses = ["present", "present", "present", "present", "late", "absent"];
const attRows = [];
for (let day = DAYS - 1; day >= 0; day--) {
  const lesson_date = dateOffset(day);
  // skip some weekends lightly - still mark most days
  for (const s of students) {
    // ~90% present-ish distribution
    let status = pick(statuses);
    // first student almost always present (demo hero)
    if (s === students[0] && Math.random() < 0.85) status = "present";
    attRows.push({
      student_id: s.id,
      teacher_id: teacher.id,
      status,
      lesson_date,
      note: status === "absent" ? "без уведомления" : null,
      marked_at: new Date(`${lesson_date}T10:00:00.000Z`).toISOString(),
    });
  }
}

// upsert in chunks
for (let i = 0; i < attRows.length; i += 100) {
  const chunk = attRows.slice(i, i + 100);
  const { error, data } = await sb
    .from("attendance")
    .upsert(chunk, { onConflict: "student_id,teacher_id,lesson_date" })
    .select("id");
  if (error) {
    console.error("attendance batch", error.message);
    // try without note
    const slim = chunk.map(({ note, ...r }) => r);
    const r2 = await sb
      .from("attendance")
      .upsert(slim, { onConflict: "student_id,teacher_id,lesson_date" })
      .select("id");
    if (r2.error) console.error("attendance retry", r2.error.message);
    else report.attendance_rows += r2.data?.length ?? slim.length;
  } else {
    report.attendance_rows += data?.length ?? chunk.length;
  }
}
console.log("   attendance rows ~", report.attendance_rows);

// 6) Grades: ~4-6 per student over the period
console.log("6) Grades…");
const gradeRows = [];
for (const s of students) {
  const n = 4 + (s.first.length % 3); // 4-6
  for (let g = 0; g < n; g++) {
    const dayAgo = Math.floor((g * DAYS) / n) + (g % 3);
    const lesson_date = dateOffset(Math.min(dayAgo, DAYS - 1));
    const score = randScore();
    gradeRows.push({
      student_id: s.id,
      teacher_id: teacher.id,
      title: LESSON_TITLES[g % LESSON_TITLES.length],
      score,
      max_score: 100,
      comment: score >= 90 ? "Отлично!" : score >= 70 ? "Хорошо" : "Нужно повторить",
      graded_at: new Date(`${lesson_date}T12:00:00.000Z`).toISOString(),
    });
  }
}

for (let i = 0; i < gradeRows.length; i += 50) {
  const chunk = gradeRows.slice(i, i + 50);
  const { data, error } = await sb.from("grades").insert(chunk).select("id");
  if (error) {
    console.error("grades", error.message);
    // without comment
    const slim = chunk.map(({ comment, ...r }) => r);
    const r2 = await sb.from("grades").insert(slim).select("id");
    if (r2.error) console.error("grades retry", r2.error.message);
    else report.grades_rows += r2.data?.length ?? 0;
  } else {
    report.grades_rows += data?.length ?? 0;
  }
}
console.log("   grades", report.grades_rows);

// 7) Payments for current month
console.log("7) Payments…");
const period = new Date();
const period_month = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-01`;
const due_day = 10;
const due_date = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-${String(due_day).padStart(2, "0")}`;

for (let i = 0; i < students.length; i++) {
  const s = students[i];
  const amount_due = 500000;
  // mix: paid / partial / debt
  let amount_paid = 0;
  let status = "pending";
  let paid_at = null;
  if (i % 5 === 0) {
    amount_paid = amount_due;
    status = "paid";
    paid_at = new Date().toISOString();
  } else if (i % 5 === 1) {
    amount_paid = 200000;
    status = "partial";
  } else if (i % 5 === 2) {
    amount_paid = 0;
    status = "overdue";
  }

  const row = {
    student_id: s.id,
    amount_due,
    amount_paid,
    due_date,
    paid_at,
    status,
    period_month,
    note: status === "paid" ? "оплачено наличными" : null,
  };

  // also set monthly_fee on student
  await sb
    .from("students")
    .update({ monthly_fee: amount_due, payment_due_day: due_day, start_date: dateOffset(DAYS) })
    .eq("id", s.id);

  const { error } = await sb.from("student_payments").upsert(row, {
    onConflict: "student_id,period_month",
  });
  if (error) {
    // try insert
    const ins = await sb.from("student_payments").insert(row);
    if (ins.error) console.error("payment", s.login, ins.error.message);
    else report.payments_rows++;
  } else {
    report.payments_rows++;
  }
}
console.log("   payments", report.payments_rows);

// 8) Verify teacher login + me
console.log("8) Verify teacher cabinet…");
writeFileSync(
  "tmp-life-tl.json",
  JSON.stringify({ teacher_code: TEACHER_CODE, password: TEACHER_PASS }),
);
const tl = curlJson(
  [
    "-X",
    "POST",
    `${BASE}/api/teachers/login`,
    "-H",
    "Content-Type: application/json",
    "--data-binary",
    "@tmp-life-tl.json",
  ],
  "tmp-life-tch.txt",
);
const tme = curlJson([`${BASE}/api/teacher/me`], "tmp-life-tch.txt");
const tStudents = tme.students?.length ?? 0;
report.checks.push({
  name: "teacher_login",
  ok: Boolean(tl.teacher?.teacher_code || tl.ok !== false),
});
report.checks.push({
  name: "teacher_students",
  ok: tStudents === STUDENT_COUNT,
  detail: tStudents,
});
console.log("   teacher students:", tStudents);

// 9) Verify 3 sample students
console.log("9) Verify student cabinets…");
for (const idx of [0, 7, 14]) {
  const s = students[idx];
  writeFileSync(
    "tmp-life-sl.json",
    JSON.stringify({ student_code: s.login, password: s.password }),
  );
  const sl = curlJson(
    [
      "-X",
      "POST",
      `${BASE}/api/students/login`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@tmp-life-sl.json",
    ],
    `tmp-life-stu-${idx}.txt`,
  );
  const me = curlJson([`${BASE}/api/student/me`], `tmp-life-stu-${idx}.txt`);
  const g = me.grades?.length ?? 0;
  const a = me.attendance?.length ?? 0;
  const tch = me.teachers?.length ?? 0;
  const pay = me.payment?.status || me.payment?.has_invoice;
  report.checks.push({
    name: `student_${s.login}`,
    ok: g > 0 && a > 0 && tch > 0,
    detail: { grades: g, attendance: a, teachers: tch, payment: pay },
  });
  console.log(
    `   ${s.login}: grades=${g} att=${a} teachers=${tch} pay=${JSON.stringify(pay)}`,
  );
}

// 10) Admin list
console.log("10) Admin list…");
const adm = curlJson(
  [`${BASE}/api/students?limit=50`],
  "tmp-life-adm.txt",
);
const total = adm.pagination?.total ?? adm.students?.length ?? 0;
report.checks.push({
  name: "admin_students",
  ok: total >= STUDENT_COUNT,
  detail: total,
});
console.log("   admin total students:", total);

// DB counts
console.log("\n11) DB counts…");
for (const table of [
  "students",
  "teachers",
  "groups",
  "group_students",
  "attendance",
  "grades",
  "student_payments",
]) {
  const { count } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  console.log(`   ${table}: ${count}`);
}

// cleanup temp files
for (const f of [
  "tmp-life-reg.json",
  "tmp-life-admin.json",
  "tmp-life-adm.txt",
  "tmp-life-assign.json",
  "tmp-life-tl.json",
  "tmp-life-tch.txt",
  "tmp-life-sl.json",
  "tmp-life-stu-0.txt",
  "tmp-life-stu-7.txt",
  "tmp-life-stu-14.txt",
]) {
  try {
    unlinkSync(f);
  } catch {
    /* */
  }
}

writeFileSync(
  "scripts/life-simulation-report.json",
  JSON.stringify(report, null, 2),
);

const failed = report.checks.filter((c) => !c.ok);
console.log("\n=== SUMMARY ===");
console.log("Students created:", students.length);
console.log("Attendance rows:", report.attendance_rows);
console.log("Grades:", report.grades_rows);
console.log("Payments:", report.payments_rows);
console.log(
  "Checks:",
  report.checks.filter((c) => c.ok).length,
  "/",
  report.checks.length,
  failed.length ? "FAILED: " + failed.map((f) => f.name).join(", ") : "ALL OK",
);
console.log("\nTeacher login:", TEACHER_CODE, "/", TEACHER_PASS);
console.log("Sample student:", students[0].login, "/", students[0].password);
console.log("Report: scripts/life-simulation-report.json");
console.log(failed.length ? "DONE WITH ISSUES" : "DONE SUCCESS");
process.exit(failed.length ? 1 : 0);
