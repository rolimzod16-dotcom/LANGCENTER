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
  process.argv[2] || "supabase/patch-hours-contacts.sql",
);
const sql = fs.readFileSync(file, "utf8");
const client = new Client({
  connectionString: url.split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(sql);
console.log("applied", file);
await client.end();
