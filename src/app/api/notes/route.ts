import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { resolveNoteCategoryId } from "@/lib/notes";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const notes = await sql`
    select n.*, c.name as category_name, c.color as category_color
    from notes n
    left join categories c on c.id = n.category_id
    where n.owner_id = ${userId}
    order by n.sort_order asc, n.updated_at desc
  `;
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { title, content, font, category_id } = await req.json();
  const safeCategoryId = await resolveNoteCategoryId(category_id, userId);

  const maxOrder = await sql`select coalesce(max(sort_order), 0) as max from notes where owner_id = ${userId}`;

  const rows = await sql`
    insert into notes (title, content, font, owner_id, category_id, sort_order)
    values (
      ${typeof title === "string" && title.trim() ? title.trim() : "Sem título"},
      ${typeof content === "string" ? content : ""},
      ${typeof font === "string" ? font : "poppins"},
      ${userId},
      ${safeCategoryId},
      ${maxOrder[0].max + 1}
    )
    returning *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
