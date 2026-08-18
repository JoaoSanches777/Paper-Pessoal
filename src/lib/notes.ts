import { sql } from "@/lib/db";

export async function canAccessNote(id: number, userId: number) {
  const rows = await sql`select * from notes where id = ${id}`;
  const note = rows[0];
  if (!note) return null;
  return note.owner_id === userId ? note : undefined;
}

// Só permite anexar uma categoria de anotação (kind = 'note') que o usuário pode ver.
export async function resolveNoteCategoryId(categoryId: unknown, userId: number): Promise<number | null> {
  if (!categoryId) return null;
  const id = Number(categoryId);
  if (!Number.isInteger(id)) return null;
  const rows = await sql`
    select id from categories
    where id = ${id} and kind = 'note' and (scope = 'company' or owner_id = ${userId})
  `;
  return rows[0] ? id : null;
}
