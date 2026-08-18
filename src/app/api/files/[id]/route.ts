import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const rows = await sql`select * from files where id = ${id} and owner_id = ${userId}`;
  const file = rows[0];
  if (!file) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const buffer = Buffer.from(file.data, "base64");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const rows = await sql`delete from files where id = ${id} and owner_id = ${userId} returning id`;
  if (rows.length === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
