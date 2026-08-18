import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada");
}

export const sql = neon(process.env.DATABASE_URL);

export type User = { id: number; username: string; name: string };

export type Reminder = {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  done: boolean;
  scope: "personal" | "company";
  owner_id: number | null;
  created_by: number;
  recurrence: "none" | "daily" | "weekly";
  category_id: number | null;
  importance: "baixa" | "media" | "alta";
  sort_order: number;
  created_at: string;
};

export type Category = {
  id: number;
  name: string;
  color: string;
  scope: "personal" | "company";
  owner_id: number | null;
  created_by: number;
};

export type Attachment = {
  id: number;
  reminder_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
};
