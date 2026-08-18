import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { resolveCategoryId } from "@/lib/reminders";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const area = req.nextUrl.searchParams.get("area") === "pessoal" ? "pessoal" : "trabalho";

  const reminders = await sql`
    select r.*, c.name as category_name, c.color as category_color, coalesce(
      (select json_agg(json_build_object(
          'id', a.id, 'filename', a.filename, 'mime_type', a.mime_type, 'size_bytes', a.size_bytes
        ) order by a.uploaded_at)
       from attachments a where a.reminder_id = r.id),
      '[]'
    ) as attachments
    from reminders r
    left join categories c on c.id = r.category_id
    where r.area = ${area} and (r.scope = 'company' or r.owner_id = ${userId} or r.created_by = ${userId})
    order by r.done asc, r.sort_order asc
  `;
  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { title, description, due_date, due_time, scope, owner_id, recurrence, category_id, importance, area: rawArea } = await req.json();

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  }
  if (scope !== "personal" && scope !== "company") {
    return NextResponse.json({ error: "Escopo inválido" }, { status: 400 });
  }
  if (scope === "personal" && !owner_id) {
    return NextResponse.json({ error: "Selecione para quem é o lembrete" }, { status: 400 });
  }
  const area = rawArea === "pessoal" ? "pessoal" : "trabalho";
  const rec = ["none", "daily", "weekly"].includes(recurrence) ? recurrence : "none";
  const imp = ["baixa", "media", "alta"].includes(importance) ? importance : "media";
  const safeCategoryId = await resolveCategoryId(category_id, userId, area);

  const rows = await sql`
    insert into reminders (title, description, due_date, due_time, scope, owner_id, created_by, recurrence, category_id, importance, sort_order, area)
    values (
      ${title},
      ${description ?? ""},
      ${due_date || null},
      ${due_date && due_time ? due_time : null},
      ${scope},
      ${scope === "personal" ? owner_id : null},
      ${userId},
      ${rec},
      ${safeCategoryId},
      ${imp},
      ${Date.now()},
      ${area}
    )
    returning *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
