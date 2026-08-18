import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await sql`select id, username, name from users where id = ${userId}`;
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { currentPassword, username: rawUsername, newPassword } = await req.json();
  const username = rawUsername?.trim();
  if (!currentPassword) {
    return NextResponse.json({ error: "Informe a senha atual" }, { status: 400 });
  }

  const rows = await sql`select id, password_hash from users where id = ${userId}`;
  const user = rows[0];
  const valid = user && (await bcrypt.compare(currentPassword, user.password_hash));
  if (!valid) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });
  }

  if (username) {
    const existing = await sql`select id from users where username = ${username} and id != ${userId}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Usuário já em uso" }, { status: 409 });
    }
    await sql`update users set username = ${username} where id = ${userId}`;
  }

  if (newPassword) {
    const hash = await bcrypt.hash(newPassword, 10);
    await sql`update users set password_hash = ${hash} where id = ${userId}`;
  }

  return NextResponse.json({ ok: true });
}
