"use client";

import { useEffect, useMemo, useState } from "react";

type User = { id: number; username: string; name: string };
type Reminder = {
  id: number;
  title: string;
  due_date: string | null;
  done: boolean;
  scope: "personal" | "company";
  owner_id: number | null;
  category_color: string | null;
};
type CalendarEvent = {
  id: number;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  color: string;
  scope: "personal" | "company";
  owner_id: number | null;
  created_by: number;
};

const EVENT_COLORS = ["#60a5fa", "#f87171", "#4ade80", "#fbbf24", "#a78bfa", "#f472b6", "#22d3ee", "#94a3b8"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarApp() {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => toKey(new Date()));

  const [showDayModal, setShowDayModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [target, setTarget] = useState("me");
  const [saving, setSaving] = useState(false);

  const [editingReminderId, setEditingReminderId] = useState<number | null>(null);
  const [editRTitle, setEditRTitle] = useState("");
  const [editRDueDate, setEditRDueDate] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/reminders").then((r) => r.json()),
      fetch("/api/calendar-events").then((r) => r.json()),
    ]).then(([meData, usersData, remindersData, eventsData]) => {
      setMe(meData);
      setUsers(usersData);
      setReminders(remindersData);
      setEvents(eventsData);
      setLoading(false);
    });
  }, []);

  async function refreshEvents() {
    const data = await fetch("/api/calendar-events").then((r) => r.json());
    setEvents(data);
  }

  async function refreshReminders() {
    const data = await fetch("/api/reminders").then((r) => r.json());
    setReminders(data);
  }

  function startEditReminder(r: Reminder) {
    setEditingReminderId(r.id);
    setEditRTitle(r.title);
    setEditRDueDate(r.due_date ? r.due_date.slice(0, 10) : "");
  }

  async function saveReminderEdit(id: number) {
    if (!editRTitle.trim()) return;
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editRTitle, due_date: editRDueDate }),
    });
    setEditingReminderId(null);
    refreshReminders();
  }

  const remindersByDay = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const r of reminders) {
      if (!r.due_date) continue;
      const key = r.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [reminders]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = toKey(new Date(e.start_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const todayKey = toKey(new Date());

  function openCreate(dayKey: string) {
    setEditingId(null);
    setTitle("");
    setDate(dayKey);
    setAllDay(false);
    setStartTime("09:00");
    setEndTime("10:00");
    setLocation("");
    setDescription("");
    setColor(EVENT_COLORS[0]);
    setTarget("me");
    setShowModal(true);
  }

  function openEdit(e: CalendarEvent) {
    const start = new Date(e.start_at);
    setEditingId(e.id);
    setTitle(e.title);
    setDate(toKey(start));
    setAllDay(e.all_day);
    setStartTime(e.all_day ? "09:00" : start.toTimeString().slice(0, 5));
    setEndTime(e.end_at ? new Date(e.end_at).toTimeString().slice(0, 5) : "10:00");
    setLocation(e.location);
    setDescription(e.description);
    setColor(e.color);
    setTarget(e.scope === "company" ? "company" : String(e.owner_id));
    setShowModal(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);

    const scope = target === "company" ? "company" : "personal";
    const owner_id = target === "company" ? null : target === "me" ? me?.id : Number(target);
    const start_at = allDay ? new Date(`${date}T00:00:00`).toISOString() : new Date(`${date}T${startTime}:00`).toISOString();
    const end_at = allDay ? null : new Date(`${date}T${endTime}:00`).toISOString();

    const payload = { title, description, location, start_at, end_at, all_day: allDay, color, scope, owner_id };

    if (editingId) {
      await fetch(`/api/calendar-events/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    setShowModal(false);
    refreshEvents();
  }

  async function handleDelete() {
    if (!editingId) return;
    await fetch(`/api/calendar-events/${editingId}`, { method: "DELETE" });
    setShowModal(false);
    refreshEvents();
  }

  if (loading || !me) {
    return <div className="p-8 text-sm text-slate-400 dark:text-slate-500">Carregando...</div>;
  }

  const otherUsers = users.filter((u) => u.id !== me.id);
  const selectedReminders = remindersByDay.get(selectedKey) ?? [];
  const selectedEvents = (eventsByDay.get(selectedKey) ?? []).sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white min-w-[180px] text-center">
            {MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
          </h2>
          <button
            type="button"
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Próximo mês"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setMonthDate(now);
              setSelectedKey(toKey(now));
            }}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-300 px-2"
          >
            Hoje
          </button>
        </div>
        <button
          type="button"
          onClick={() => openCreate(selectedKey)}
          className="flex items-center gap-2 bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-emerald-800 dark:hover:bg-emerald-700"
        >
          <IconeMais />
          Novo compromisso
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = toKey(d);
            const inMonth = d.getMonth() === monthDate.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const dayReminders = remindersByDay.get(key) ?? [];
            const dayEvents = eventsByDay.get(key) ?? [];
            return (
              <button
                type="button"
                key={key}
                onClick={() => {
                  setSelectedKey(key);
                  setShowDayModal(true);
                }}
                className={`h-24 sm:h-28 border-b border-r border-slate-100 dark:border-slate-800 p-1.5 flex flex-col items-start gap-1 text-left transition ${
                  inMonth ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-800/60"
                } ${isSelected ? "ring-2 ring-inset ring-emerald-400" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                <span
                  className={`text-xs h-5 w-5 flex items-center justify-center rounded-full ${
                    isToday ? "bg-emerald-700 text-white font-semibold" : inMonth ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                  {dayEvents.slice(0, 2).map((e) => (
                    <span
                      key={`e${e.id}`}
                      className="text-[10px] leading-tight truncate rounded px-1 py-0.5 text-white"
                      style={{ backgroundColor: e.color }}
                    >
                      {e.title}
                    </span>
                  ))}
                  {dayReminders.slice(0, 2 - Math.min(dayEvents.length, 2)).map((r) => (
                    <span
                      key={`r${r.id}`}
                      className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 border ${
                        r.done ? "line-through text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700" : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      }`}
                    >
                      {r.title}
                    </span>
                  ))}
                  {dayEvents.length + dayReminders.length > 2 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">+{dayEvents.length + dayReminders.length - 2}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {new Date(`${selectedKey}T00:00:00`).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </h3>
          <button
            type="button"
            onClick={() => openCreate(selectedKey)}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1"
          >
            <IconeMais /> Adicionar
          </button>
        </div>

        {selectedEvents.length === 0 && selectedReminders.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nada agendado para este dia.</p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => openEdit(e)}
                  className="w-full flex items-center gap-3 text-left rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{e.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {e.all_day ? "Dia inteiro" : new Date(e.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {selectedReminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2.5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: r.category_color ?? "#cbd5e1" }}
                />
                <p className={`text-sm flex-1 min-w-0 ${r.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"}`}>
                  {r.title}
                </p>
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{r.scope === "company" ? "Empresa" : "Lembrete"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showDayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowDayModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-900/20 max-w-lg w-full max-h-full flex flex-col overflow-hidden"
          >
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {new Date(`${selectedKey}T00:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </h3>
              <button
                type="button"
                onClick={() => setShowDayModal(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto">
              {selectedEvents.length === 0 && selectedReminders.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">Nada agendado para este dia.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2.5"
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: e.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{e.title}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {e.all_day ? "Dia inteiro" : new Date(e.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">Compromisso</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDayModal(false);
                          openEdit(e);
                        }}
                        className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 p-0.5 shrink-0"
                        aria-label="Editar compromisso"
                      >
                        <IconeLapis />
                      </button>
                    </li>
                  ))}
                  {selectedReminders.map((r) =>
                    editingReminderId === r.id ? (
                      <li key={r.id} className="rounded-lg border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 space-y-2">
                        <input
                          autoFocus
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          value={editRTitle}
                          onChange={(ev) => setEditRTitle(ev.target.value)}
                        />
                        <input
                          type="date"
                          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          value={editRDueDate}
                          onChange={(ev) => setEditRDueDate(ev.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingReminderId(null)}
                            className="text-slate-500 dark:text-slate-400 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => saveReminderEdit(r.id)}
                            className="bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-emerald-800 dark:hover:bg-emerald-700"
                          >
                            Salvar
                          </button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={r.id}
                        className="flex items-start gap-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2.5"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: r.category_color ?? "#cbd5e1" }}
                        />
                        <p className={`text-sm flex-1 min-w-0 ${r.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"}`}>
                          {r.title}
                        </p>
                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{r.scope === "company" ? "Empresa" : "Lembrete"}</span>
                        <button
                          type="button"
                          onClick={() => startEditReminder(r)}
                          className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 p-0.5 shrink-0"
                          aria-label="Editar lembrete"
                        >
                          <IconeLapis />
                        </button>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowDayModal(false);
                  openCreate(selectedKey);
                }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-emerald-800 dark:hover:bg-emerald-700"
              >
                <IconeMais />
                Novo compromisso neste dia
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-900/20 max-w-lg w-full max-h-full flex flex-col overflow-hidden"
          >
            <div className="shrink-0 bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4">
              <h2 className="text-white font-semibold text-base flex items-center gap-2">
                <IconeMais />
                {editingId ? "Editar compromisso" : "Novo compromisso"}
              </h2>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Título</label>
                <input
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  placeholder="Ex: Reunião com fornecedor"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Data</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 mt-6 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
                  Dia inteiro
                </label>
              </div>

              {!allDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Início</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fim</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Local</label>
                <input
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Opcional"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notas</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Opcional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cor</label>
                <div className="flex gap-1.5">
                  {EVENT_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColor(hex)}
                      className={`h-6 w-6 rounded-full ring-2 ${color === hex ? "ring-slate-900 dark:ring-slate-100" : "ring-transparent"}`}
                      style={{ backgroundColor: hex }}
                      aria-label={`Cor ${hex}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Para quem</label>
                <div className="flex flex-wrap gap-2">
                  <Pill label="Mim" active={target === "me"} onClick={() => setTarget("me")} />
                  {otherUsers.map((u) => (
                    <Pill key={u.id} label={u.name.split(" ")[0]} active={target === String(u.id)} onClick={() => setTarget(String(u.id))} />
                  ))}
                  <Pill label="Empresa" active={target === "company"} onClick={() => setTarget("company")} />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex justify-between items-center gap-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
              {editingId ? (
                <button type="button" onClick={handleDelete} className="text-red-600 dark:text-red-400 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40">
                  Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="text-slate-500 dark:text-slate-400 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm hover:bg-emerald-800 dark:hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
        active ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeLapis() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
