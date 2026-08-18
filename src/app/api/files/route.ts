import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { resolveFileFolderId } from "@/lib/files";

// ponytail: 4MB por arquivo — abaixo do limite de body do runtime serverless da Vercel (~4.5MB).
const MAX_SIZE = 4 * 1024 * 1024;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await sql`
    select id, filename, mime_type, size_bytes, folder_id, uploaded_at
    from files where owner_id = ${userId}
    order by uploaded_at desc
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 4MB)" }, { status: 400 });
  }
  const folderId = await resolveFileFolderId(form.get("folder_id"), userId);

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const rows = await sql`
    insert into files (owner_id, filename, mime_type, size_bytes, data, folder_id)
    values (${userId}, ${file.name}, ${file.type || "application/octet-stream"}, ${file.size}, ${base64}, ${folderId})
    returning id, filename, mime_type, size_bytes, folder_id, uploaded_at
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
