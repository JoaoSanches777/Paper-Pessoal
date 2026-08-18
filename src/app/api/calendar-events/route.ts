import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const events = await sql`
    select * from calendar_events
    where scope = 'company' or owner_id = ${userId} or created_by = ${userId}
    order by start_at asc
  `;
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { title, description, location, start_at, end_at, all_day, color, scope, owner_id } = await req.json();

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  }
  if (!start_at) {
    return NextResponse.json({ error: "Data é obrigatória" }, { status: 400 });
  }
  if (scope !== "personal" && scope !== "company") {
    return NextResponse.json({ error: "Escopo inválido" }, { status: 400 });
  }
  if (scope === "personal" && !owner_id) {
    return NextResponse.json({ error: "Selecione para quem é o compromisso" }, { status: 400 });
  }
  const hex = typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#60a5fa";

  const rows = await sql`
    insert into calendar_events (title, description, location, start_at, end_at, all_day, color, scope, owner_id, created_by)
    values (
      ${title.trim()},
      ${description ?? ""},
      ${location ?? ""},
      ${start_at},
      ${end_at || null},
      ${Boolean(all_day)},
      ${hex},
      ${scope},
      ${scope === "personal" ? owner_id : null},
      ${userId}
    )
    returning *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
