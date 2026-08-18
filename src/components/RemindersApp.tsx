"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type User = { id: number; username: string; name: string };
type AttachmentMeta = { id: number; filename: string; mime_type: string; size_bytes: number };
type Category = { id: number; name: string; color: string; scope: "personal" | "company"; owner_id: number | null; sort_order: number };
type Importance = "baixa" | "media" | "alta";
type Reminder = {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  done: boolean;
  scope: "personal" | "company";
  owner_id: number | null;
  created_by: number;
  recurrence: "none" | "daily" | "weekly";
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  importance: Importance;
  sort_order: number;
  attachments: AttachmentMeta[];
};

const RECURRENCE_LABEL: Record<Reminder["recurrence"], string> = {
  none: "Não repete",
  daily: "Repete diariamente",
  weekly: "Repete semanalmente",
};

const IMPORTANCE_LABEL: Record<Importance, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const IMPORTANCE_STYLE: Record<Importance, string> = {
  baixa: "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  media: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800",
  alta: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800",
};

const CATEGORY_COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#4ade80",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#94a3b8",
];

function daysUntil(dueDate: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  const due = new Date(y, m - 1, d);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// Farol de trânsito: amanhã = amarelo escuro, 2-3 dias = amarelo claro, 4+ dias = verde
function dueDateStyle(days: number) {
  if (days < 0) return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 font-medium";
  if (days === 1) return "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700";
  if (days >= 2 && days <= 3) return "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
  if (days >= 4) return "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
  return "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700";
}

type Group = { category: Category | null; items: Reminder[] };

function groupByCategory(items: Reminder[], categories: Category[], scope: "personal" | "company"): Group[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string, Group>();
  for (const c of categories) {
    if (c.scope === scope) groups.set(String(c.id), { category: c, items: [] });
  }
  groups.set("none", { category: null, items: [] });
  for (const r of items) {
    const key = r.category_id ? String(r.category_id) : "none";
    if (!groups.has(key)) groups.set(key, { category: r.category_id ? byId.get(r.category_id) ?? null : null, items: [] });
    groups.get(key)!.items.push(r);
  }
  return [...groups.values()]
    .filter((g) => g.items.length > 0 || g.category !== null)
    .sort((a, b) => {
      if (!a.category) return 1;
      if (!b.category) return -1;
      return a.category.sort_order - b.category.sort_order;
    });
}

export default function RemindersApp({ variant }: { variant: "trabalho" | "pessoal" }) {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [hasDueTime, setHasDueTime] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [target, setTarget] = useState<string>("me"); // "me" | "company" | userId
  const [recurrence, setRecurrence] = useState<Reminder["recurrence"]>("none");
  const [importance, setImportance] = useState<Importance>("media");
  const [categoryId, setCategoryId] = useState<string>(""); // "" = sem categoria
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryScope, setNewCategoryScope] = useState<"personal" | "company">("personal");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryColor, setEditCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [editCategoryScope, setEditCategoryScope] = useState<"personal" | "company">("personal");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null);
  const [dragOverCategoryKey, setDragOverCategoryKey] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryOpenScope, setNewCategoryOpenScope] = useState<"personal" | "company" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch(`/api/reminders?area=${variant}`).then((r) => r.json()),
      fetch(`/api/categories?area=${variant}`).then((r) => r.json()),
    ]).then(([meData, usersData, remindersData, categoriesData]) => {
      setMe(meData);
      setUsers(usersData);
      setReminders(remindersData);
      setCategories(categoriesData);
      setLoading(false);
    });
  }, [variant]);

  async function refreshReminders() {
    const data = await fetch(`/api/reminders?area=${variant}`).then((r) => r.json());
    setReminders(data);
  }

  async function refreshCategories() {
    const data = await fetch(`/api/categories?area=${variant}`).then((r) => r.json());
    setCategories(data);
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName, scope: newCategoryScope, color: newCategoryColor, area: variant }),
    });
    const created = await res.json();
    if (res.ok) {
      setNewCategoryName("");
      setNewCategoryOpenScope(null);
      await refreshCategories();
      setCategoryId(String(created.id));
    }
  }

  function openCreateCategory(scope: "personal" | "company") {
    setNewCategoryScope(scope);
    setNewCategoryName("");
    setNewCategoryOpenScope(scope);
  }

  async function deleteCategory(id: number) {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (categoryId === String(id)) setCategoryId("");
    refreshCategories();
    refreshReminders();
  }

  function startEditCategory(c: Category) {
    setEditingCategoryId(c.id);
    setEditCategoryName(c.name);
    setEditCategoryColor(c.color);
    setEditCategoryScope(c.scope);
  }

  async function saveEditCategory() {
    if (editingCategoryId === null || !editCategoryName.trim()) return;
    await fetch(`/api/categories/${editingCategoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editCategoryName, color: editCategoryColor, scope: editCategoryScope }),
    });
    setEditingCategoryId(null);
    refreshCategories();
    refreshReminders();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const scope = target === "company" ? "company" : "personal";
    const owner_id = target === "company" ? null : target === "me" ? me?.id : Number(target);

    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        due_date: dueDate,
        due_time: hasDueTime ? dueTime : null,
        scope,
        owner_id,
        recurrence,
        importance,
        category_id: categoryId ? Number(categoryId) : null,
        area: variant,
      }),
    });
    const created = await res.json();
    if (!res.ok) {
      alert(created.error || "Não foi possível criar o lembrete");
      setSaving(false);
      return;
    }

    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      await fetch(`/api/reminders/${created.id}/attachments`, { method: "POST", body: form });
    }

    setTitle("");
    setDescription("");
    setDueDate("");
    setHasDueTime(false);
    setDueTime("");
    setTarget("me");
    setRecurrence("none");
    setImportance("media");
    setCategoryId("");
    setFiles([]);
    setShowForm(false);
    setSaving(false);
    refreshReminders();
  }

  async function toggleDone(r: Reminder) {
    await fetch(`/api/reminders/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !r.done }),
    });
    refreshReminders();
  }

  async function remove(id: number) {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    refreshReminders();
  }

  async function addAttachment(reminderId: number, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/reminders/${reminderId}/attachments`, { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Não foi possível anexar o arquivo");
      return;
    }
    refreshReminders();
  }

  async function removeAttachment(attachmentId: number) {
    await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
    refreshReminders();
  }

  async function updateReminder(id: number, payload: Record<string, unknown>) {
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    refreshReminders();
  }

  function reorderWithinGroup(groupItems: Reminder[], targetId: number | null, categoryId: number | null) {
    if (draggedId === null) return;
    const remaining = groupItems.filter((x) => x.id !== draggedId);
    let before: Reminder | undefined;
    let after: Reminder | undefined;
    if (targetId === null) {
      before = remaining[remaining.length - 1];
      after = undefined;
    } else {
      if (draggedId === targetId) return;
      const idx = remaining.findIndex((x) => x.id === targetId);
      before = remaining[idx - 1];
      after = remaining[idx];
    }
    const newOrder =
      !before && !after ? Date.now() : !before ? after!.sort_order - 1 : !after ? before.sort_order + 1 : (before.sort_order + after.sort_order) / 2;
    const dragged = reminders.find((r) => r.id === draggedId);
    const payload: Record<string, unknown> = { sort_order: newOrder };
    if (dragged && dragged.category_id !== categoryId) payload.category_id = categoryId;
    updateReminder(draggedId, payload);
    setDraggedId(null);
  }

  function reorderCategories(targetId: number | null) {
    if (draggedCategoryId === null) return;
    const remaining = categories.filter((c) => c.id !== draggedCategoryId);
    let before: Category | undefined;
    let after: Category | undefined;
    if (targetId === null) {
      before = remaining[remaining.length - 1];
      after = undefined;
    } else {
      if (draggedCategoryId === targetId) return;
      const idx = remaining.findIndex((c) => c.id === targetId);
      before = remaining[idx - 1];
      after = remaining[idx];
    }
    const newOrder =
      !before && !after ? Date.now() : !before ? after!.sort_order - 1 : !after ? before.sort_order + 1 : (before.sort_order + after.sort_order) / 2;
    const dragged = categories.find((c) => c.id === draggedCategoryId);
    if (dragged) setCategories(categories.map((c) => (c.id === dragged.id ? { ...c, sort_order: newOrder } : c)));
    fetch(`/api/categories/${draggedCategoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort_order: newOrder }),
    }).then(refreshCategories);
    setDraggedCategoryId(null);
  }

  // ponytail: fallback pra celular — drag-and-drop HTML5 nativo não funciona em touch.
  function moveInGroup(groupItems: Reminder[], id: number, direction: "up" | "down") {
    const idx = groupItems.findIndex((x) => x.id === id);
    if (direction === "up") {
      if (idx <= 0) return;
      const other = groupItems[idx - 1];
      const prevPrev = groupItems[idx - 2];
      const newOrder = prevPrev ? (prevPrev.sort_order + other.sort_order) / 2 : other.sort_order - 1;
      updateReminder(id, { sort_order: newOrder });
    } else {
      if (idx === -1 || idx >= groupItems.length - 1) return;
      const other = groupItems[idx + 1];
      const nextNext = groupItems[idx + 2];
      const newOrder = nextNext ? (other.sort_order + nextNext.sort_order) / 2 : other.sort_order + 1;
      updateReminder(id, { sort_order: newOrder });
    }
  }

  function openFormFor(catId: number | null, scope: "personal" | "company") {
    setCategoryId(catId ? String(catId) : "");
    setTarget(scope === "company" ? "company" : "me");
    setShowForm(true);
  }

  function renderCategoryPill(c: Category) {
    if (editingCategoryId === c.id) {
      return (
        <div key={c.id} className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              {CATEGORY_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setEditCategoryColor(hex)}
                  className={`h-4 w-4 rounded-full ring-2 ${editCategoryColor === hex ? "ring-slate-900 dark:ring-slate-100" : "ring-transparent"}`}
                  style={{ backgroundColor: hex }}
                  aria-label={`Cor ${hex}`}
                />
              ))}
            </div>
            <input
              autoFocus
              className="w-24 bg-transparent text-sm focus:outline-none"
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEditCategory();
                }
                if (e.key === "Escape") setEditingCategoryId(null);
              }}
            />
            <button type="button" onClick={saveEditCategory} className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-300" aria-label="Salvar categoria">
              <IconeCheck />
            </button>
            <button
              type="button"
              onClick={() => setEditingCategoryId(null)}
              className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 text-xs"
              aria-label="Cancelar edição"
            >
              ×
            </button>
          </div>
          {variant === "trabalho" && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">Quem pode ver:</span>
              <TargetPill label="Só eu" active={editCategoryScope === "personal"} onClick={() => setEditCategoryScope("personal")} />
              <TargetPill label="Toda a empresa" active={editCategoryScope === "company"} onClick={() => setEditCategoryScope("company")} />
            </div>
          )}
        </div>
      );
    }
    return (
      <span key={c.id} className="inline-flex items-center group">
        <button
          type="button"
          onClick={() => setCategoryId(String(c.id))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
            categoryId === String(c.id) ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
          {c.name}
        </button>
        <button
          type="button"
          onClick={() => startEditCategory(c)}
          className="-ml-1 text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 px-1 opacity-0 group-hover:opacity-100 transition"
          aria-label={`Editar categoria ${c.name}`}
        >
          <IconeLapisMini />
        </button>
        <button
          type="button"
          onClick={() => deleteCategory(c.id)}
          className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 text-xs px-1"
          aria-label={`Excluir categoria ${c.name}`}
        >
          ×
        </button>
      </span>
    );
  }

  function renderCreateCategoryForm() {
    return (
      <div className="space-y-2.5 mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            placeholder="Nome da categoria"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createCategory();
              }
              if (e.key === "Escape") setNewCategoryOpenScope(null);
            }}
          />
          <div className="flex gap-1">
            {CATEGORY_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setNewCategoryColor(hex)}
                className={`h-6 w-6 rounded-full ring-2 ${
                  newCategoryColor === hex ? "ring-slate-900 dark:ring-slate-100" : "ring-transparent"
                }`}
                style={{ backgroundColor: hex }}
                aria-label={`Cor ${hex}`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNewCategoryOpenScope(null)}
            className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={createCategory}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-300 px-2 ml-auto"
          >
            + criar
          </button>
        </div>
      </div>
    );
  }

  function renderCategoryManager(filterByTarget = false) {
    const showPersonal = !filterByTarget || target !== "company";
    const showCompany = variant === "trabalho" && (!filterByTarget || target === "company");
    return (
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Categoria</label>

        {showPersonal && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              {variant === "trabalho" ? (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Minhas categorias</p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => openCreateCategory("personal")}
                className="text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300"
                aria-label="Criar categoria pessoal"
              >
                <IconeMais />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <TargetPill label="Sem categoria" active={categoryId === ""} onClick={() => setCategoryId("")} />
              {availableCategories.filter((c) => c.scope === "personal").map(renderCategoryPill)}
            </div>
            {newCategoryOpenScope === "personal" && renderCreateCategoryForm()}
          </div>
        )}

        {showCompany && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Categorias da empresa</p>
              <button
                type="button"
                onClick={() => openCreateCategory("company")}
                className="text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300"
                aria-label="Criar categoria da empresa"
              >
                <IconeMais />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableCategories.filter((c) => c.scope === "company").map(renderCategoryPill)}
              {availableCategories.filter((c) => c.scope === "company").length === 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">Nenhuma ainda</span>
              )}
            </div>
            {newCategoryOpenScope === "company" && renderCreateCategoryForm()}
          </div>
        )}
      </div>
    );
  }

  if (loading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm">
        Carregando...
      </div>
    );
  }

  const visible = reminders.filter((r) => showDone || !r.done);
  const company = visible.filter((r) => r.scope === "company");
  const myPersonal = visible.filter((r) => r.scope === "personal" && r.owner_id === me.id);
  const sentByMe = visible.filter(
    (r) => r.scope === "personal" && r.owner_id !== me.id && r.created_by === me.id
  );
  const otherUsers = users.filter((u) => u.id !== me.id);
  const doneCount = reminders.filter((r) => r.done).length;
  const availableCategories = variant === "pessoal" ? categories.filter((c) => c.scope !== "company") : categories;
  const dueToday = visible.filter((r) => !r.done && r.due_date && daysUntil(r.due_date) === 0);
  const dueTodayCount = dueToday.length;

  function goToDueToday() {
    const el = document.getElementById(`lembrete-${dueToday[0].id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedIds(new Set(dueToday.map((r) => r.id)));
    setTimeout(() => setHighlightedIds(new Set()), 5000);
  }

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {!showForm && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-emerald-800 dark:hover:bg-emerald-700"
            >
              <IconeMais />
              Novo lembrete
            </button>
            <button
              onClick={() => setShowCategoryManager(true)}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2"
            >
              <IconeTag />
              Categorias
            </button>
            {doneCount > 0 && (
              <button
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2"
              >
                {showDone ? "Ocultar concluídos" : `Ver concluídos (${doneCount})`}
              </button>
            )}
          </div>
        )}

        {dueTodayCount > 0 && (
          <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 text-sm rounded-lg px-4 py-2.5">
            <span className="flex items-center gap-2">
              <IconeAlerta />
              {dueTodayCount === 1 ? "1 lembrete vence hoje" : `${dueTodayCount} lembretes vencem hoje`}
            </span>
            <button
              type="button"
              onClick={goToDueToday}
              className="shrink-0 text-sm font-medium text-amber-900 dark:text-amber-300 underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-200"
            >
              Ver lembrete{dueTodayCount > 1 ? "s" : ""}
            </button>
          </div>
        )}

        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowForm(false)}
          >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-900/20 max-w-2xl w-full max-h-full flex flex-col overflow-hidden"
          >
            <div className="shrink-0 bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4">
              <h2 className="text-white font-semibold text-base flex items-center gap-2">
                <IconeMais />
                Novo lembrete
              </h2>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Título</label>
                <input
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                  placeholder="Ex: Renovar contrato do fornecedor"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Detalhes</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                  placeholder="Opcional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Prazo</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded accent-emerald-700"
                      checked={hasDueTime}
                      onChange={(e) => setHasDueTime(e.target.checked)}
                    />
                    Definir horário
                  </label>
                  {hasDueTime && (
                    <input
                      type="time"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Repetição</label>
                  <div className="flex flex-wrap gap-2">
                    <TargetPill label="Não repete" active={recurrence === "none"} onClick={() => setRecurrence("none")} />
                    <TargetPill label="Diário" active={recurrence === "daily"} onClick={() => setRecurrence("daily")} />
                    <TargetPill label="Semanal" active={recurrence === "weekly"} onClick={() => setRecurrence("weekly")} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Importância</label>
                <div className="flex flex-wrap gap-2">
                  {(["baixa", "media", "alta"] as Importance[]).map((imp) => (
                    <TargetPill
                      key={imp}
                      label={IMPORTANCE_LABEL[imp]}
                      active={importance === imp}
                      onClick={() => setImportance(imp)}
                    />
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Para quem</label>
                <div className="flex flex-wrap gap-2">
                  <TargetPill label="Eu" active={target === "me"} onClick={() => { setTarget("me"); setCategoryId(""); }} />
                  {otherUsers.map((u) => (
                    <TargetPill
                      key={u.id}
                      label={u.name.split(" ")[0]}
                      active={target === String(u.id)}
                      onClick={() => { setTarget(String(u.id)); setCategoryId(""); }}
                    />
                  ))}
                  {variant === "trabalho" && (
                    <TargetPill label="NYC Digital" active={target === "company"} onClick={() => { setTarget("company"); setCategoryId(""); }} />
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              {renderCategoryManager(true)}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Anexos</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.xls,.xlsx"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 dark:bg-slate-700"
                />
                {files.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{files.length} arquivo(s) selecionado(s)</p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">Imagens, PDF ou Excel · até 4MB cada</p>
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-500 dark:text-slate-400 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm hover:bg-emerald-800 dark:hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </form>
          </div>
        )}

        {showCategoryManager && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCategoryManager(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-900/20 max-w-2xl w-full max-h-full flex flex-col overflow-hidden"
            >
              <div className="shrink-0 bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4 flex items-center justify-between">
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <IconeTag />
                  Categorias
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(false)}
                  className="text-white/80 hover:text-white text-xl leading-none"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <div className="p-6 overflow-y-auto">{renderCategoryManager()}</div>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 gap-8 items-start ${variant === "trabalho" ? "lg:grid-cols-2" : ""}`}>
          {variant === "trabalho" && (
            <Section
              title="Empresa NYC Digital"
              groupScope="company"
              reminders={company}
              users={users}
              categories={availableCategories}
              variant={variant}
              draggedId={draggedId}
              onDragStart={setDraggedId}
              dragOverKey={dragOverKey}
              onDragOverKey={setDragOverKey}
              onDropReorder={reorderWithinGroup}
              onMove={moveInGroup}
              onToggle={toggleDone}
              onDelete={remove}
              onAddAttachment={addAttachment}
              onRemoveAttachment={removeAttachment}
              onEdit={updateReminder}
              draggedCategoryId={draggedCategoryId}
              onDragStartCategory={setDraggedCategoryId}
              dragOverCategoryKey={dragOverCategoryKey}
              onDragOverCategoryKey={setDragOverCategoryKey}
              onDropCategory={reorderCategories}
              onQuickAdd={openFormFor}
              highlightedIds={highlightedIds}
            />
          )}
          <Section
            title="Meus lembretes"
            groupScope="personal"
            reminders={myPersonal}
            users={users}
            categories={availableCategories}
            variant={variant}
            draggedId={draggedId}
            onDragStart={setDraggedId}
            dragOverKey={dragOverKey}
            onDragOverKey={setDragOverKey}
            onDropReorder={reorderWithinGroup}
            onMove={moveInGroup}
            onToggle={toggleDone}
            onDelete={remove}
            onAddAttachment={addAttachment}
            onRemoveAttachment={removeAttachment}
            onEdit={updateReminder}
            draggedCategoryId={draggedCategoryId}
            onDragStartCategory={setDraggedCategoryId}
            dragOverCategoryKey={dragOverCategoryKey}
            onDragOverCategoryKey={setDragOverCategoryKey}
            onDropCategory={reorderCategories}
            onQuickAdd={openFormFor}
            highlightedIds={highlightedIds}
          />
          {sentByMe.length > 0 && (
            <Section
              title="Enviados por mim"
              groupScope="personal"
              reminders={sentByMe}
              users={users}
              categories={availableCategories}
              variant={variant}
              draggedId={draggedId}
              onDragStart={setDraggedId}
              dragOverKey={dragOverKey}
              onDragOverKey={setDragOverKey}
              onDropReorder={reorderWithinGroup}
              onMove={moveInGroup}
              onToggle={toggleDone}
              onDelete={remove}
              onAddAttachment={addAttachment}
              onRemoveAttachment={removeAttachment}
              onEdit={updateReminder}
              draggedCategoryId={draggedCategoryId}
              onDragStartCategory={setDraggedCategoryId}
              dragOverCategoryKey={dragOverCategoryKey}
              onDragOverCategoryKey={setDragOverCategoryKey}
              onDropCategory={reorderCategories}
              onQuickAdd={openFormFor}
              highlightedIds={highlightedIds}
            />
          )}
        </div>
      </main>
    </>
  );
}

function TargetPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
        active
          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  groupScope,
  reminders,
  users,
  categories,
  variant,
  draggedId,
  onDragStart,
  dragOverKey,
  onDragOverKey,
  onDropReorder,
  onMove,
  onToggle,
  onDelete,
  onAddAttachment,
  onRemoveAttachment,
  onEdit,
  draggedCategoryId,
  onDragStartCategory,
  dragOverCategoryKey,
  onDragOverCategoryKey,
  onDropCategory,
  onQuickAdd,
  highlightedIds,
}: {
  title: string;
  groupScope: "personal" | "company";
  reminders: Reminder[];
  users: User[];
  categories: Category[];
  variant: "trabalho" | "pessoal";
  draggedId: number | null;
  onDragStart: (id: number | null) => void;
  dragOverKey: string | null;
  onDragOverKey: (key: string | null) => void;
  onDropReorder: (groupItems: Reminder[], targetId: number | null, categoryId: number | null) => void;
  onMove: (groupItems: Reminder[], id: number, direction: "up" | "down") => void;
  onToggle: (r: Reminder) => void;
  onDelete: (id: number) => void;
  onAddAttachment: (reminderId: number, file: File) => void;
  onRemoveAttachment: (attachmentId: number) => void;
  onEdit: (id: number, payload: Record<string, unknown>) => void;
  draggedCategoryId: number | null;
  onDragStartCategory: (id: number | null) => void;
  dragOverCategoryKey: string | null;
  onDragOverCategoryKey: (key: string | null) => void;
  onDropCategory: (targetId: number | null) => void;
  onQuickAdd: (categoryId: number | null, scope: "personal" | "company") => void;
  highlightedIds: Set<number>;
}) {
  const groups = groupByCategory(reminders, categories, groupScope);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  function toggleCollapsed(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</h2>
      {reminders.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-4 py-6 text-center">
          Nenhum lembrete por aqui.
        </p>
      ) : (
        <>
          {groups.map((group) => {
            const groupKey = `${title}::${group.category?.id ?? "none"}`;
            const catId = group.category?.id ?? null;
            const overThisCategory = draggedCategoryId !== null && catId !== null && dragOverCategoryKey === `cat:${catId}`;
            return (
              <div
                key={group.category?.id ?? "none"}
                className={`rounded-lg transition-colors ${overThisCategory ? "bg-emerald-50 dark:bg-emerald-950/40/60" : ""}`}
                onDragOver={(e) => {
                  if (draggedCategoryId === null || catId === null || draggedCategoryId === catId) return;
                  e.preventDefault();
                  onDragOverCategoryKey(`cat:${catId}`);
                }}
                onDrop={(e) => {
                  if (draggedCategoryId === null || catId === null || draggedCategoryId === catId) return;
                  e.preventDefault();
                  onDropCategory(catId);
                  onDragOverCategoryKey(null);
                }}
              >
                {catId !== null && <CategoryDropIndicator active={overThisCategory} />}
                <div
                  className={`flex items-center gap-1.5 mb-2 rounded-md ${
                    draggedCategoryId !== null && draggedCategoryId === catId ? "opacity-40" : ""
                  }`}
                >
                  {catId !== null && (
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(catId));
                        onDragStartCategory(catId);
                      }}
                      onDragEnd={() => {
                        onDragStartCategory(null);
                        onDragOverCategoryKey(null);
                      }}
                      className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing"
                      aria-label={`Mover categoria ${group.category?.name}`}
                      title="Arraste para reordenar a categoria"
                    >
                      <IconeArrasto />
                    </span>
                  )}
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: group.category?.color ?? "#cbd5e1" }}
                  />
                  <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {group.category?.name ?? "Sem categoria"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(groupKey)}
                    className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
                    aria-label={collapsedKeys.has(groupKey) ? "Expandir categoria" : "Comprimir categoria"}
                    title={collapsedKeys.has(groupKey) ? "Expandir categoria" : "Comprimir categoria"}
                  >
                    <IconeSeta direction={collapsedKeys.has(groupKey) ? "up" : "down"} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickAdd(catId, groupScope)}
                    className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300"
                    aria-label="Criar lembrete nesta categoria"
                    title="Criar lembrete nesta categoria"
                  >
                    <IconeMais />
                  </button>
                </div>
                <ul
                hidden={collapsedKeys.has(groupKey)}
                className="space-y-2"
                onDragOver={(e) => {
                  if (draggedCategoryId !== null) return;
                  e.preventDefault();
                  onDragOverKey(`${groupKey}:end`);
                }}
                onDrop={() => {
                  if (draggedCategoryId !== null) return;
                  onDropReorder(group.items, null, catId);
                  onDragOverKey(null);
                }}
              >
                {group.items.map((r, idx) => (
                  <Fragment key={r.id}>
                    <li aria-hidden="true">
                      <DropIndicator active={draggedId !== null && draggedId !== r.id && dragOverKey === `${groupKey}:${r.id}`} />
                    </li>
                    <ReminderCard
                      reminder={r}
                      users={users}
                      categories={categories}
                      variant={variant}
                      highlighted={highlightedIds.has(r.id)}
                      dragging={draggedId === r.id}
                      onDragStart={() => onDragStart(r.id)}
                      onDragEnd={() => {
                        onDragStart(null);
                        onDragOverKey(null);
                      }}
                      onDragOverThis={(e) => {
                        if (draggedCategoryId !== null) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onDragOverKey(`${groupKey}:${r.id}`);
                      }}
                      onDropOn={(e) => {
                        if (draggedCategoryId !== null) return;
                        e.stopPropagation();
                        onDropReorder(group.items, r.id, catId);
                        onDragOverKey(null);
                      }}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < group.items.length - 1}
                      onMoveUp={() => onMove(group.items, r.id, "up")}
                      onMoveDown={() => onMove(group.items, r.id, "down")}
                      onToggle={onToggle}
                      onDelete={onDelete}
                      onAddAttachment={onAddAttachment}
                      onRemoveAttachment={onRemoveAttachment}
                      onEdit={onEdit}
                    />
                  </Fragment>
                ))}
                  {group.items.length === 0 ? (
                    <li>
                      <div
                        className={`rounded-lg border border-dashed text-xs py-3 px-3 transition-colors flex items-center justify-center gap-2 ${
                          draggedId !== null && dragOverKey === `${groupKey}:end`
                            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                            : "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"
                        }`}
                      >
                        <span>Arraste para cá ou crie um novo lembrete</span>
                        <button
                          type="button"
                          onClick={() => onQuickAdd(catId, groupScope)}
                          className="text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 shrink-0"
                          aria-label="Criar lembrete nesta categoria"
                        >
                          <IconeMais />
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li aria-hidden="true">
                      <DropIndicator active={draggedId !== null && dragOverKey === `${groupKey}:end`} />
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
          <div
            onDragOver={(e) => {
              if (draggedCategoryId === null) return;
              e.preventDefault();
              onDragOverCategoryKey("cat:end");
            }}
            onDrop={(e) => {
              if (draggedCategoryId === null) return;
              e.preventDefault();
              e.stopPropagation();
              onDropCategory(null);
              onDragOverCategoryKey(null);
            }}
          >
            <CategoryDropIndicator active={draggedCategoryId !== null && dragOverCategoryKey === "cat:end"} />
          </div>
        </>
      )}
    </section>
  );
}

function DropIndicator({ active }: { active: boolean }) {
  return (
    <div
      className={`rounded-full bg-emerald-500 transition-all ${active ? "h-1.5 my-1 opacity-100" : "h-0 opacity-0"}`}
    />
  );
}

function CategoryDropIndicator({ active }: { active: boolean }) {
  return (
    <div
      className={`rounded-full bg-emerald-600 transition-all ${active ? "h-2 my-1.5 opacity-100" : "h-0 opacity-0"}`}
    />
  );
}

function ReminderCard({
  reminder: r,
  users,
  categories,
  variant,
  highlighted,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOverThis,
  onDropOn,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDelete,
  onAddAttachment,
  onRemoveAttachment,
  onEdit,
}: {
  reminder: Reminder;
  users: User[];
  categories: Category[];
  variant: "trabalho" | "pessoal";
  highlighted: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverThis: (e: React.DragEvent) => void;
  onDropOn: (e: React.DragEvent) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: (r: Reminder) => void;
  onDelete: (id: number) => void;
  onAddAttachment: (reminderId: number, file: File) => void;
  onRemoveAttachment: (attachmentId: number) => void;
  onEdit: (id: number, payload: Record<string, unknown>) => void;
}) {
  const creator = users.find((u) => u.id === r.created_by);
  const owner = users.find((u) => u.id === r.owner_id);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  const [editTitle, setEditTitle] = useState(r.title);
  const [editDescription, setEditDescription] = useState(r.description);
  const [editDueDate, setEditDueDate] = useState(r.due_date ? r.due_date.slice(0, 10) : "");
  const [editHasDueTime, setEditHasDueTime] = useState(!!r.due_time);
  const [editDueTime, setEditDueTime] = useState(r.due_time ?? "");
  const [editRecurrence, setEditRecurrence] = useState<Reminder["recurrence"]>(r.recurrence);
  const [editImportance, setEditImportance] = useState<Importance>(r.importance);
  const [editCategoryId, setEditCategoryId] = useState<string>(r.category_id ? String(r.category_id) : "");
  const [editTarget, setEditTarget] = useState<string>(r.scope === "company" ? "company" : String(r.owner_id));

  function startEdit() {
    setEditTitle(r.title);
    setEditDescription(r.description);
    setEditDueDate(r.due_date ? r.due_date.slice(0, 10) : "");
    setEditHasDueTime(!!r.due_time);
    setEditDueTime(r.due_time ?? "");
    setEditRecurrence(r.recurrence);
    setEditImportance(r.importance);
    setEditCategoryId(r.category_id ? String(r.category_id) : "");
    setEditTarget(r.scope === "company" ? "company" : String(r.owner_id));
    setEditing(true);
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) return;
    onEdit(r.id, {
      title: editTitle,
      description: editDescription,
      due_date: editDueDate,
      due_time: editHasDueTime ? editDueTime : null,
      recurrence: editRecurrence,
      importance: editImportance,
      category_id: editCategoryId ? Number(editCategoryId) : null,
      scope: editTarget === "company" ? "company" : "personal",
      owner_id: editTarget === "company" ? null : Number(editTarget),
    });
    setEditing(false);
  }

  const accentColor = r.category_color ?? "#e2e8f0";
  const tintBg = r.category_color ? `${r.category_color}12` : "#ffffff";

  return (
    <>
    {editing && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/50 backdrop-blur-sm p-4"
        onClick={() => setEditing(false)}
      >
        <form
          onSubmit={saveEdit}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-900/20 max-w-2xl w-full max-h-full flex flex-col overflow-hidden"
        >
          <div className="shrink-0 bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4">
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <IconeLapis />
              Editar lembrete
            </h2>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Título</label>
              <input
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Detalhes</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                placeholder="Opcional"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Prazo</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded accent-emerald-700"
                    checked={editHasDueTime}
                    onChange={(e) => setEditHasDueTime(e.target.checked)}
                  />
                  Definir horário
                </label>
                {editHasDueTime && (
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    value={editDueTime}
                    onChange={(e) => setEditDueTime(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Repetição</label>
                <div className="flex flex-wrap gap-2">
                  <TargetPill label="Não repete" active={editRecurrence === "none"} onClick={() => setEditRecurrence("none")} />
                  <TargetPill label="Diário" active={editRecurrence === "daily"} onClick={() => setEditRecurrence("daily")} />
                  <TargetPill label="Semanal" active={editRecurrence === "weekly"} onClick={() => setEditRecurrence("weekly")} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Importância</label>
              <div className="flex flex-wrap gap-2">
                {(["baixa", "media", "alta"] as Importance[]).map((imp) => (
                  <TargetPill
                    key={imp}
                    label={IMPORTANCE_LABEL[imp]}
                    active={editImportance === imp}
                    onClick={() => setEditImportance(imp)}
                  />
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Para quem</label>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <TargetPill
                    key={u.id}
                    label={u.name.split(" ")[0]}
                    active={editTarget === String(u.id)}
                    onClick={() => { setEditTarget(String(u.id)); setEditCategoryId(""); }}
                  />
                ))}
                {variant === "trabalho" && (
                  <TargetPill label="Empresa" active={editTarget === "company"} onClick={() => { setEditTarget("company"); setEditCategoryId(""); }} />
                )}
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Categoria</label>
              {editTarget !== "company" && (
                <div className="space-y-1.5">
                  {variant === "trabalho" && (
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Minhas categorias</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <TargetPill label="Sem categoria" active={editCategoryId === ""} onClick={() => setEditCategoryId("")} />
                    {categories
                      .filter((c) => c.scope === "personal")
                      .map((c) => (
                        <TargetPill key={c.id} label={c.name} active={editCategoryId === String(c.id)} onClick={() => setEditCategoryId(String(c.id))} />
                      ))}
                  </div>
                </div>
              )}
              {variant === "trabalho" && editTarget === "company" && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Categorias da empresa</p>
                  <div className="flex flex-wrap gap-2">
                    {categories
                      .filter((c) => c.scope === "company")
                      .map((c) => (
                        <TargetPill key={c.id} label={c.name} active={editCategoryId === String(c.id)} onClick={() => setEditCategoryId(String(c.id))} />
                      ))}
                    {categories.filter((c) => c.scope === "company").length === 0 && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">Nenhuma ainda</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-slate-500 dark:text-slate-400 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm hover:bg-emerald-800 dark:hover:bg-emerald-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    )}
    <li
      id={`lembrete-${r.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverThis}
      onDrop={onDropOn}
      style={{ backgroundColor: tintBg, borderLeftColor: accentColor }}
      className={`border border-l-4 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3 flex items-start gap-3 transition-opacity ${
        dragging ? "opacity-40" : ""
      } ${highlighted ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
    >
      <span
        className="hidden sm:block mt-1.5 text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing select-none"
        aria-hidden="true"
      >
        <IconeArrasto />
      </span>
      <div className="flex flex-col -my-1 -ml-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-20 disabled:hover:text-slate-300 dark:hover:text-slate-600 p-2.5 sm:p-1.5"
          aria-label="Mover para cima"
        >
          <IconeSeta direction="up" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-20 disabled:hover:text-slate-300 dark:hover:text-slate-600 p-2.5 sm:p-1.5"
          aria-label="Mover para baixo"
        >
          <IconeSeta direction="down" />
        </button>
      </div>
      <input
        type="checkbox"
        checked={r.done}
        onChange={() => onToggle(r)}
        className="mt-1 h-4 w-4 rounded accent-emerald-700"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${r.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
          {r.title}
        </p>
        {r.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{r.description}</p>}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${IMPORTANCE_STYLE[r.importance]}`}>
            {IMPORTANCE_LABEL[r.importance]}
          </span>
          {r.due_date &&
            (daysUntil(r.due_date) === 0 ? (
              <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-2 py-0.5 font-medium">
                Vence hoje{r.due_time && ` às ${r.due_time}`}
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 ${dueDateStyle(daysUntil(r.due_date))}`}>
                {new Date(r.due_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                {r.due_time && ` às ${r.due_time}`}
              </span>
            ))}
          {r.recurrence !== "none" && (
            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 rounded-full px-2 py-0.5">
              {RECURRENCE_LABEL[r.recurrence]}
            </span>
          )}
          {r.done && r.scope === "personal" && owner && (
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">concluído por {owner.name.split(" ")[0]}</span>
          )}
          <span>criado por {creator?.name.split(" ")[0] ?? "?"}</span>
          {r.scope === "personal" && owner && <span>· para {owner.name.split(" ")[0]}</span>}
        </div>

        {r.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-2">
            {r.attachments.map((a) => (
              <li key={a.id}>
                <span className="inline-flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2 pr-1 py-1 text-slate-600 dark:text-slate-300">
                  <a
                    href={`/api/attachments/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    <IconeArquivo />
                    <span className="max-w-[140px] truncate">{a.filename}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(a.id)}
                    className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 px-1"
                    aria-label="Remover anexo"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2">
          <button
            type="button"
            onClick={() => attachInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300"
          >
            <IconeClipe />
            Anexar arquivo
          </button>
          <input
            ref={attachInputRef}
            type="file"
            accept="image/*,.pdf,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAddAttachment(r.id, file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={startEdit}
          className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 p-1"
          aria-label="Editar lembrete"
        >
          <IconeLapis />
        </button>
        <button
          onClick={() => {
            if (confirm("Excluir este lembrete?") && confirm("Tem certeza? Essa ação não pode ser desfeita.")) {
              onDelete(r.id);
            }
          }}
          className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 p-1"
          aria-label="Excluir lembrete"
        >
          <IconeLixeira />
        </button>
      </div>
    </li>
    </>
  );
}

function IconeSeta({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={direction === "down" ? "rotate-180" : ""}
    >
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeArrasto() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function IconeCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeLapisMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeLapis() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeAlerta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeTag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeLixeira() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeClipe() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeArquivo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
