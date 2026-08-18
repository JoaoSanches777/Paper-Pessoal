import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { canAccessReminder } from "@/lib/reminders";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const rows = await sql`select * from attachments where id = ${id}`;
  const attachment = rows[0];
  if (!attachment) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const reminder = await canAccessReminder(attachment.reminder_id, userId);
  if (!reminder) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const buffer = Buffer.from(attachment.data, "base64");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mime_type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const rows = await sql`select * from attachments where id = ${id}`;
  const attachment = rows[0];
  if (!attachment) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const reminder = await canAccessReminder(attachment.reminder_id, userId);
  if (!reminder) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await sql`delete from attachments where id = ${id}`;
  return NextResponse.json({ ok: true });
}
