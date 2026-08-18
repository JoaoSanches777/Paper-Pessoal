import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { canAccessReminder as canAccess, resolveCategoryId } from "@/lib/reminders";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const reminder = await canAccess(id, userId);
  if (reminder === null) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (reminder === undefined) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const title = body.title ?? reminder.title;
  const description = body.description ?? reminder.description;
  const due_date = body.due_date !== undefined ? body.due_date || null : reminder.due_date;
  const due_time = body.due_time !== undefined ? (due_date && body.due_time) || null : due_date ? reminder.due_time : null;
  const done = body.done !== undefined ? body.done : reminder.done;
  const category_id =
    body.category_id !== undefined ? await resolveCategoryId(body.category_id, userId, reminder.area) : reminder.category_id;
  const importance = ["baixa", "media", "alta"].includes(body.importance) ? body.importance : reminder.importance;
  const recurrence = ["none", "daily", "weekly"].includes(body.recurrence) ? body.recurrence : reminder.recurrence;
  const scope = body.scope === "personal" || body.scope === "company" ? body.scope : reminder.scope;
  const owner_id =
    scope === "company" ? null : body.owner_id !== undefined ? body.owner_id : reminder.owner_id;
  const sort_order = body.sort_order !== undefined ? body.sort_order : reminder.sort_order;

  if (scope === "personal" && !owner_id) {
    return NextResponse.json({ error: "Selecione para quem é o lembrete" }, { status: 400 });
  }

  const rows = await sql`
    update reminders
    set title = ${title}, description = ${description}, due_date = ${due_date}, due_time = ${due_time}, done = ${done},
        category_id = ${category_id}, importance = ${importance}, recurrence = ${recurrence},
        scope = ${scope}, owner_id = ${owner_id}, sort_order = ${sort_order}
    where id = ${id}
    returning *
  `;

  const justCompleted = done && !reminder.done;
  if (justCompleted && reminder.recurrence !== "none") {
    const days = reminder.recurrence === "daily" ? 1 : 7;
    const base = reminder.due_date ? new Date(reminder.due_date) : new Date();
    base.setUTCDate(base.getUTCDate() + days);
    const nextDueDate = base.toISOString().slice(0, 10);

    await sql`
      insert into reminders (title, description, due_date, due_time, scope, owner_id, created_by, recurrence, category_id, importance, sort_order, area)
      values (
        ${reminder.title}, ${reminder.description}, ${nextDueDate}, ${reminder.due_time},
        ${reminder.scope}, ${reminder.owner_id}, ${reminder.created_by}, ${reminder.recurrence},
        ${reminder.category_id}, ${reminder.importance}, ${Date.now()}, ${reminder.area}
      )
    `;
  }

  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number((await params).id);
  const reminder = await canAccess(id, userId);
  if (reminder === null) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (reminder === undefined) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await sql`delete from reminders where id = ${id}`;
  return NextResponse.json({ ok: true });
}
