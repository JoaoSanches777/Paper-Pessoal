import { sql } from "@/lib/db";

export async function canAccessEvent(id: number, userId: number) {
  const rows = await sql`select * from calendar_events where id = ${id}`;
  const event = rows[0];
  if (!event) return null;
  const allowed = event.scope === "company" || event.owner_id === userId || event.created_by === userId;
  return allowed ? event : undefined;
}
