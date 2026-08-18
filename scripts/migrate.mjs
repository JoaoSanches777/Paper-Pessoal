// Aplica schema.sql no banco Neon apontado por DATABASE_URL (lido de .env.local se não estiver no ambiente).
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  databaseUrl = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
}
if (!databaseUrl) {
  console.error("DATABASE_URL não encontrada.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rawScript = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
// Remove comentários de linha inteira antes de dividir, senão um ';' dentro do
// comentário confunde o split de statements.
const script = rawScript.replace(/^\s*--.*$/gm, "");

// Divide em statements por ';', mas ignora ';' dentro de blocos "do $$ ... end $$;".
function splitStatements(text) {
  const statements = [];
  let current = "";
  let inDollar = false;
  for (let i = 0; i < text.length; i++) {
    const chunk = text.slice(i, i + 2);
    if (chunk === "$$") {
      inDollar = !inDollar;
      current += chunk;
      i++;
      continue;
    }
    const ch = text[i];
    current += ch;
    if (ch === ";" && !inDollar) {
      statements.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

const statements = splitStatements(script)
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
  console.log("OK:", stmt.slice(0, 70).replace(/\s+/g, " "));
}

console.log("Schema aplicado com sucesso.");
