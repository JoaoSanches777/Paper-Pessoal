import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const rows = await sql`select * from categories where id = ${id}`;
  const category = rows[0];
  if (!category) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const allowed = category.scope === "company" || category.owner_id === userId;
  if (!allowed) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { name, color, scope, sort_order } = await req.json();
  const newName = typeof name === "string" && name.trim() ? name.trim() : category.name;
  const newColor = typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : category.color;
  const newScope = scope === "personal" || scope === "company" ? scope : category.scope;
  const newOwnerId = newScope === "personal" ? userId : null;
  const newSortOrder = typeof sort_order === "number" ? sort_order : category.sort_order;

  if (newName.toLowerCase() !== category.name.toLowerCase()) {
    const dup = await sql`
      select id from categories
      where lower(name) = lower(${newName}) and id != ${id}
        and (scope = 'company' or owner_id = ${userId}) and kind = ${category.kind}
        and (kind != 'reminder' or area = ${category.area})
    `;
    if (dup.length > 0) {
      return NextResponse.json({ error: "Já existe uma categoria com esse nome" }, { status: 409 });
    }
  }

  const updated = await sql`
    update categories
    set name = ${newName}, color = ${newColor}, scope = ${newScope}, owner_id = ${newOwnerId}, sort_order = ${newSortOrder}
    where id = ${id}
    returning *
  `;
  return NextResponse.json(updated[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const rows = await sql`select * from categories where id = ${id}`;
  const category = rows[0];
  if (!category) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const allowed = category.scope === "company" || category.owner_id === userId;
  if (!allowed) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await sql`delete from categories where id = ${id}`;
  return NextResponse.json({ ok: true });
}
