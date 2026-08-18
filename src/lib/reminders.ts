import { sql } from "@/lib/db";

export async function canAccessReminder(id: number, userId: number) {
  const rows = await sql`select * from reminders where id = ${id}`;
  const reminder = rows[0];
  if (!reminder) return null;
  const allowed =
    reminder.scope === "company" ||
    reminder.owner_id === userId ||
    reminder.created_by === userId;
  return allowed ? reminder : undefined;
}

// Só permite anexar uma categoria que o usuário pode ver (da empresa ou dele mesmo) e que seja da mesma área.
export async function resolveCategoryId(categoryId: unknown, userId: number, area: "trabalho" | "pessoal"): Promise<number | null> {
  if (!categoryId) return null;
  const id = Number(categoryId);
  if (!Number.isInteger(id)) return null;
  const rows = await sql`select id from categories where id = ${id} and area = ${area} and (scope = 'company' or owner_id = ${userId})`;
  return rows[0] ? id : null;
}
