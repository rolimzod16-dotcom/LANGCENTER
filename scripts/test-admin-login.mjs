import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";

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

const pass = loadEnv(".env.local").ADMIN_PASSWORD;
writeFileSync("tmp-admin.json", JSON.stringify({ password: pass }));

const login = execSync(
  'curl.exe -s -c tmp-adm.txt -X POST "https://langcenter-tillojon.vercel.app/api/admin/login" -H "Content-Type: application/json" --data-binary "@tmp-admin.json"',
  { encoding: "utf8" },
);
console.log("login:", login);

const students = execSync(
  'curl.exe -s -b tmp-adm.txt "https://langcenter-tillojon.vercel.app/api/students?limit=2"',
  { encoding: "utf8" },
);
console.log("students:", students.slice(0, 400));

const teachers = execSync(
  'curl.exe -s -b tmp-adm.txt "https://langcenter-tillojon.vercel.app/api/teachers"',
  { encoding: "utf8" },
);
console.log("teachers:", teachers.slice(0, 300));

try {
  unlinkSync("tmp-admin.json");
  unlinkSync("tmp-adm.txt");
} catch {
  /* ignore */
}
