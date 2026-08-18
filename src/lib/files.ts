import { sql } from "@/lib/db";

// Só permite anexar uma pasta (kind = 'file') que pertence ao próprio usuário.
export async function resolveFileFolderId(folderId: unknown, userId: number): Promise<number | null> {
  if (!folderId) return null;
  const id = Number(folderId);
  if (!Number.isInteger(id)) return null;
  const rows = await sql`
    select id from categories where id = ${id} and kind = 'file' and owner_id = ${userId}
  `;
  return rows[0] ? id : null;
}
