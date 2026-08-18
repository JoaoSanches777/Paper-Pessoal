// Uso: node scripts/create-user.mjs <username> <senha> <nome>
// Gera o INSERT com a senha já com hash (bcrypt) para colar no SQL editor do Neon,
// ou roda direto se DATABASE_URL estiver no ambiente.
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const [username, password, name] = process.argv.slice(2);
if (!username || !password || !name) {
  console.error("Uso: node scripts/create-user.mjs <username> <senha> <nome>");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);

if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  await sql`insert into users (username, password_hash, name) values (${username}, ${hash}, ${name})`;
  console.log(`Usuário ${username} criado no banco.`);
} else {
  console.log("DATABASE_URL não definida. Rode este SQL manualmente no Neon:\n");
  console.log(
    `insert into users (username, password_hash, name) values ('${username}', '${hash}', '${name}');`
  );
}
