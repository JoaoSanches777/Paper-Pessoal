import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { canAccessNote, resolveNoteCategoryId } from "@/lib/notes";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const note = await canAccessNote(id, userId);
  if (note === null) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (note === undefined) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title : note.title;
  const content = typeof body.content === "string" ? body.content : note.content;
  const font = typeof body.font === "string" ? body.font : note.font;
  const category_id =
    body.category_id !== undefined ? await resolveNoteCategoryId(body.category_id, userId) : note.category_id;
  const sort_order = body.sort_order !== undefined ? body.sort_order : note.sort_order;

  const rows = await sql`
    update notes
    set title = ${title || "Sem título"}, content = ${content}, font = ${font},
        category_id = ${category_id}, sort_order = ${sort_order}, updated_at = now()
    where id = ${id}
    returning *
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const note = await canAccessNote(id, userId);
  if (note === null) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (note === undefined) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await sql`delete from notes where id = ${id}`;
  return NextResponse.json({ ok: true });
}
