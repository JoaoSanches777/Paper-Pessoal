-- Rode este script uma vez no seu banco Neon (SQL editor do console Neon).

create table if not exists users (
  id serial primary key,
  username text unique not null,
  password_hash text not null,
  name text not null,
  failed_login_attempts integer not null default 0,
  locked_until timestamptz
);

create table if not exists categories (
  id serial primary key,
  name text not null,
  color text not null default '#94a3b8',
  scope text not null check (scope in ('personal', 'company')),
  owner_id integer references users(id) on delete cascade, -- null quando scope = 'company'
  created_by integer not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  sort_order double precision not null default 0,
  unique (name, scope, owner_id)
);

alter table categories add column if not exists sort_order double precision not null default 0;
alter table categories add column if not exists parent_id integer references categories(id) on delete cascade;

-- Área independente pra Lembretes: "trabalho" (dados atuais) vs "pessoal" (começa vazio).
-- Só é relevante pra categorias de lembrete (kind = 'reminder'); anotações ignoram esta coluna.
alter table categories add column if not exists area text not null default 'trabalho' check (area in ('trabalho', 'pessoal'));

-- backfill pra bancos existentes onde todas as categorias têm sort_order 0 (senão o
-- reordenar por drag-and-drop não consegue distinguir a posição entre elas)
update categories c set sort_order = t.rn
from (select id, row_number() over (order by scope desc, name asc) as rn from categories) t
where c.id = t.id and c.sort_order = 0;

create table if not exists reminders (
  id serial primary key,
  title text not null,
  description text default '',
  due_date date,
  due_time text,
  done boolean not null default false,
  scope text not null check (scope in ('personal', 'company')),
  owner_id integer references users(id) on delete cascade, -- null quando scope = 'company'
  created_by integer not null references users(id) on delete cascade,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly')),
  category_id integer references categories(id) on delete set null,
  importance text not null default 'media' check (importance in ('baixa', 'media', 'alta')),
  sort_order double precision not null default 0,
  created_at timestamptz not null default now()
);

-- Área independente pra Lembretes: "trabalho" (dados atuais) vs "pessoal" (começa vazio).
alter table reminders add column if not exists area text not null default 'trabalho' check (area in ('trabalho', 'pessoal'));

-- Horário do prazo é opcional (formato "HH:MM"); ausente = só data, sem hora marcada.
alter table reminders add column if not exists due_time text;

create index if not exists idx_reminders_owner on reminders(owner_id);
create index if not exists idx_reminders_area on reminders(area);
create index if not exists idx_reminders_scope on reminders(scope);
create index if not exists idx_categories_owner on categories(owner_id);

-- Anexos guardados como base64 direto no Postgres (sem serviço de storage à parte).
-- ponytail: ok para uso pessoal com poucos arquivos pequenos; se crescer, migrar para Vercel Blob.
create table if not exists attachments (
  id serial primary key,
  reminder_id integer not null references reminders(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  data text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_attachments_reminder on attachments(reminder_id);

-- Categorias também servem como "fichário" para Anotações (kind = 'note'),
-- reaproveitando a mesma tabela/CRUD usados pelos lembretes.
alter table categories add column if not exists kind text not null default 'reminder' check (kind in ('reminder', 'note'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_name_scope_owner_kind_key') then
    alter table categories drop constraint if exists categories_name_scope_owner_id_key;
    alter table categories add constraint categories_name_scope_owner_kind_key unique (name, scope, owner_id, kind);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_name_scope_owner_kind_area_key') then
    alter table categories drop constraint if exists categories_name_scope_owner_kind_key;
    alter table categories add constraint categories_name_scope_owner_kind_area_key unique (name, scope, owner_id, kind, area);
  end if;
end $$;

create table if not exists calendar_events (
  id serial primary key,
  title text not null,
  description text default '',
  location text default '',
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  color text not null default '#60a5fa',
  scope text not null check (scope in ('personal', 'company')),
  owner_id integer references users(id) on delete cascade, -- null quando scope = 'company'
  created_by integer not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_owner on calendar_events(owner_id);
create index if not exists idx_calendar_events_start on calendar_events(start_at);

create table if not exists notes (
  id serial primary key,
  title text not null default 'Sem título',
  content text not null default '',
  font text not null default 'poppins',
  owner_id integer not null references users(id) on delete cascade,
  category_id integer references categories(id) on delete set null,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_owner on notes(owner_id);

-- Arquivos pessoais de cada usuário (aba "Arquivos" na sidebar). Mesmo esquema de storage dos anexos.
create table if not exists files (
  id serial primary key,
  owner_id integer not null references users(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  data text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_files_owner on files(owner_id);

-- Pastas para organizar Arquivos reaproveitam a mesma tabela/CRUD de categorias (kind = 'file').
alter table categories drop constraint if exists categories_kind_check;
alter table categories add constraint categories_kind_check check (kind in ('reminder', 'note', 'file'));

alter table files add column if not exists folder_id integer references categories(id) on delete set null;
create index if not exists idx_files_folder on files(folder_id);
