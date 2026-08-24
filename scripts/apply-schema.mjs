import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is empty");
  process.exit(1);
}

const file = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "schema.sql",
);
const raw = fs.readFileSync(file, "utf8");
const statements = raw
  .split(";")
  .map((s) => s.replace(/^(?:\s*--[^\n]*\n)+\s*/g, "").trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

const client = new Client({
  connectionString: url.split("?")[0],
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log(`connected, ${statements.length} statements`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
  try {
    const res = await client.query(stmt);
    if (res.rows?.length) {
      console.log(`ok ${i + 1}/${statements.length}:`, res.rows[0]);
    } else {
      console.log(`ok ${i + 1}/${statements.length}: ${preview}`);
    }
  } catch (err) {
    console.error(`fail ${i + 1}/${statements.length}: ${preview}`);
    console.error(err.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("schema applied");
