import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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

async function hasCol(table, col) {
  const r = await sb
    .from(table)
    .update({ [col]: null })
    .eq("id", "00000000-0000-0000-0000-000000000000");
  const msg = r.error?.message || "";
  if (msg.toLowerCase().includes(col) && msg.toLowerCase().includes("could not find")) {
    return false;
  }
  return true;
}

for (const col of ["password_plain", "phone_digits", "notes", "organization_id"]) {
  console.log(`students.${col}:`, (await hasCol("students", col)) ? "OK" : "MISSING");
}
for (const col of ["password_plain", "organization_id"]) {
  console.log(`teachers.${col}:`, (await hasCol("teachers", col)) ? "OK" : "MISSING");
}
