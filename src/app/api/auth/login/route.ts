import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: NextRequest) {
  const { username: rawUsername, password } = await req.json();
  const username = rawUsername?.trim();
  if (!username || !password) {
    return NextResponse.json({ error: "Usuário e senha são obrigatórios" }, { status: 400 });
  }

  const rows = await sql`
    select id, password_hash, failed_login_attempts, locked_until from users where username = ${username}
  `;
  const user = rows[0];

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em alguns minutos.` },
      { status: 429 }
    );
  }

  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) {
    if (user) {
      const attempts = user.failed_login_attempts + 1;
      const lockedUntil =
        attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
      await sql`
        update users set failed_login_attempts = ${attempts}, locked_until = ${lockedUntil}
        where id = ${user.id}
      `;
    }
    return NextResponse.json({ error: "Usuário ou senha inválidos" }, { status: 401 });
  }

  await sql`update users set failed_login_attempts = 0, locked_until = null where id = ${user.id}`;
  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
