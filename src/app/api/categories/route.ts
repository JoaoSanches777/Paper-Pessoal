import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind = kindParam === "note" ? "note" : kindParam === "file" ? "file" : "reminder";
  const area = req.nextUrl.searchParams.get("area") === "pessoal" ? "pessoal" : "trabalho";

  const categories = await sql`
    select * from categories
    where (scope = 'company' or owner_id = ${userId}) and kind = ${kind} and (kind != 'reminder' or area = ${area})
    order by sort_order asc, name asc
  `;
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, scope, color, kind: rawKind, parent_id, area: rawArea } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }
  if (scope !== "personal" && scope !== "company") {
    return NextResponse.json({ error: "Escopo inválido" }, { status: 400 });
  }
  const kind = rawKind === "note" ? "note" : rawKind === "file" ? "file" : "reminder";
  const area = rawArea === "pessoal" ? "pessoal" : "trabalho";
  const hex = typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#94a3b8";
  const parentId = typeof parent_id === "number" ? parent_id : null;

  const maxOrder = await sql`
    select coalesce(max(sort_order), 0) as max from categories
    where (scope = 'company' or owner_id = ${userId}) and kind = ${kind} and (kind != 'reminder' or area = ${area})
  `;

  const dup = await sql`
    select id from categories
    where lower(name) = lower(${name.trim()}) and (scope = 'company' or owner_id = ${userId}) and kind = ${kind} and (kind != 'reminder' or area = ${area})
  `;
  if (dup.length > 0) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome" }, { status: 409 });
  }

  const rows = await sql`
    insert into categories (name, scope, owner_id, created_by, color, sort_order, kind, parent_id, area)
    values (${name.trim()}, ${scope}, ${scope === "personal" ? userId : null}, ${userId}, ${hex}, ${maxOrder[0].max + 1}, ${kind}, ${parentId}, ${area})
    returning *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
