import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { canAccessReminder } from "@/lib/reminders";

// ponytail: 4MB por arquivo — abaixo do limite de body do runtime serverless da Vercel (~4.5MB).
const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const reminder = await canAccessReminder(id, userId);
  if (!reminder) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const rows = await sql`
    select id, filename, mime_type, size_bytes, uploaded_at
    from attachments where reminder_id = ${id}
    order by uploaded_at asc
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const reminder = await canAccessReminder(id, userId);
  if (!reminder) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não permitido (use imagem, PDF ou Excel)" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 4MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const rows = await sql`
    insert into attachments (reminder_id, filename, mime_type, size_bytes, data)
    values (${id}, ${file.name}, ${file.type}, ${file.size}, ${base64})
    returning id, filename, mime_type, size_bytes, uploaded_at
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
