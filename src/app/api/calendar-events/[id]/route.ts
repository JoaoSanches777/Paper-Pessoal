import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { canAccessEvent } from "@/lib/calendar";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const event = await canAccessEvent(id, userId);
  if (event === null) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (event === undefined) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : event.title;
  const description = body.description ?? event.description;
  const location = body.location ?? event.location;
  const start_at = body.start_at ?? event.start_at;
  const end_at = body.end_at !== undefined ? body.end_at || null : event.end_at;
  const all_day = body.all_day !== undefined ? Boolean(body.all_day) : event.all_day;
  const color = typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : event.color;
  const scope = body.scope === "personal" || body.scope === "company" ? body.scope : event.scope;
  const owner_id = scope === "company" ? null : body.owner_id !== undefined ? body.owner_id : event.owner_id;

  if (scope === "personal" && !owner_id) {
    return NextResponse.json({ error: "Selecione para quem é o compromisso" }, { status: 400 });
  }

  const rows = await sql`
    update calendar_events
    set title = ${title}, description = ${description}, location = ${location},
        start_at = ${start_at}, end_at = ${end_at}, all_day = ${all_day}, color = ${color},
        scope = ${scope}, owner_id = ${owner_id}
    where id = ${id}
    returning *
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const event = await canAccessEvent(id, userId);
  if (event === null) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (event === undefined) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await sql`delete from calendar_events where id = ${id}`;
  return NextResponse.json({ ok: true });
}
