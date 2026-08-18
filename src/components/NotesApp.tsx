"use client";

import { useEffect, useRef, useState } from "react";

type Category = { id: number; name: string; color: string; parent_id: number | null };
type Note = {
  id: number;
  title: string;
  content: string;
  font: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  updated_at: string;
};

const CATEGORY_COLORS = ["#f87171", "#fb923c", "#fbbf24", "#4ade80", "#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#94a3b8"];
const TEXT_COLORS = ["#171717", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#db2777", "#64748b"];
const FONTS = [
  { key: "poppins", label: "Padrão do sistema", family: "var(--font-poppins), Arial, sans-serif" },
  { key: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { key: "georgia", label: "Georgia", family: "Georgia, serif" },
  { key: "times", label: "Times New Roman", family: "'Times New Roman', Times, serif" },
  { key: "courier", label: "Courier New", family: "'Courier New', Courier, monospace" },
];

function fontFamilyFor(key: string) {
  return FONTS.find((f) => f.key === key)?.family ?? FONTS[0].family;
}

export default function NotesApp() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [addingUnder, setAddingUnder] = useState<number | null | false>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories?kind=note").then((r) => r.json()),
      fetch("/api/notes").then((r) => r.json()),
    ]).then(([cats, notesData]) => {
      setCategories(cats);
      setNotes(notesData);
      setLoading(false);
      if (notesData.length > 0) setSelectedNoteId(notesData[0].id);
    });
  }, []);

  async function refreshCategories() {
    const data = await fetch("/api/categories?kind=note").then((r) => r.json());
    setCategories(data);
  }

  async function refreshNotes() {
    const data = await fetch("/api/notes").then((r) => r.json());
    setNotes(data);
    return data as Note[];
  }

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  async function createCategory() {
    if (!newCategoryName.trim() || addingUnder === false) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName, scope: "personal", color: newCategoryColor, kind: "note", parent_id: addingUnder }),
    });
    const created = await res.json();
    if (res.ok) {
      setNewCategoryName("");
      setAddingUnder(false);
      await refreshCategories();
      setSelectedCategory(created.id);
    }
  }

  async function deleteCategory(id: number) {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (selectedCategory === id) setSelectedCategory("all");
    refreshCategories();
    refreshNotes();
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
  }

  async function saveEdit() {
    if (editingId === null || !editName.trim()) return;
    await fetch(`/api/categories/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    setEditingId(null);
    await refreshCategories();
  }

  async function createNote() {
    const category_id = selectedCategory === "all" ? null : selectedCategory;
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sem título", content: "", font: "poppins", category_id }),
    });
    const created = await res.json();
    if (res.ok) {
      await refreshNotes();
      setSelectedNoteId(created.id);
    }
  }

  async function deleteNote(id: number) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (selectedNoteId === id) setSelectedNoteId(null);
    refreshNotes();
  }

  if (loading) return <div className="p-8 text-sm text-slate-400 dark:text-slate-500">Carregando...</div>;

  const visibleNotes = notes.filter((n) => (selectedCategory === "all" ? true : n.category_id === selectedCategory));

  return (
    <main className="flex h-screen">
      <div className="w-48 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-2 pb-1">Caderno</p>
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border-l-4 transition ${
            selectedCategory === "all" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600" : "border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Todas as notas
        </button>

        <CategoryTree
          categories={categories}
          parentId={null}
          depth={0}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          onDelete={deleteCategory}
          addingUnder={addingUnder}
          onStartAdd={setAddingUnder}
          newCategoryName={newCategoryName}
          setNewCategoryName={setNewCategoryName}
          newCategoryColor={newCategoryColor}
          setNewCategoryColor={setNewCategoryColor}
          onCreate={createCategory}
          editingId={editingId}
          onStartEdit={startEdit}
          editName={editName}
          setEditName={setEditName}
          editColor={editColor}
          setEditColor={setEditColor}
          onSaveEdit={saveEdit}
          onCancelEdit={() => setEditingId(null)}
        />

        {addingUnder === null ? (
          <NewCategoryForm
            name={newCategoryName}
            setName={setNewCategoryName}
            color={newCategoryColor}
            setColor={setNewCategoryColor}
            onCancel={() => setAddingUnder(false)}
            onCreate={createCategory}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingUnder(null)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            + nova divisória
          </button>
        )}
      </div>

      <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={createNote}
            className="w-full flex items-center justify-center gap-2 bg-emerald-700 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-800 dark:hover:bg-emerald-700"
          >
            <IconeMais />
            Nova nota
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {visibleNotes.length === 0 && <li className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Nenhuma nota aqui.</li>}
          {visibleNotes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setSelectedNoteId(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800 transition ${
                  selectedNoteId === n.id ? "bg-emerald-50 dark:bg-emerald-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{n.title || "Sem título"}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {n.content.replace(/<[^>]+>/g, " ").trim().slice(0, 60) || "Nota vazia"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900">
        {!selectedNote ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">Selecione ou crie uma nota.</div>
        ) : (
          <NoteEditor key={selectedNote.id} note={selectedNote} onDelete={() => deleteNote(selectedNote.id)} onSaved={refreshNotes} />
        )}
      </div>
    </main>
  );
}

function CategoryTree({
  categories,
  parentId,
  depth,
  selectedCategory,
  onSelect,
  onDelete,
  addingUnder,
  onStartAdd,
  newCategoryName,
  setNewCategoryName,
  newCategoryColor,
  setNewCategoryColor,
  onCreate,
  editingId,
  onStartEdit,
  editName,
  setEditName,
  editColor,
  setEditColor,
  onSaveEdit,
  onCancelEdit,
}: {
  categories: Category[];
  parentId: number | null;
  depth: number;
  selectedCategory: number | "all";
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  addingUnder: number | null | false;
  onStartAdd: (id: number | false) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  newCategoryColor: string;
  setNewCategoryColor: (v: string) => void;
  onCreate: () => void;
  editingId: number | null;
  onStartEdit: (c: Category) => void;
  editName: string;
  setEditName: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const children = categories.filter((c) => c.parent_id === parentId);
  if (children.length === 0 && addingUnder !== parentId) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0 }} className={depth > 0 ? "border-l border-slate-100 dark:border-slate-800 pl-2 space-y-1" : "space-y-1"}>
      {children.map((c) => (
        <div key={c.id}>
          {editingId === c.id ? (
            <NewCategoryForm
              name={editName}
              setName={setEditName}
              color={editColor}
              setColor={setEditColor}
              onCancel={onCancelEdit}
              onCreate={onSaveEdit}
              createLabel="Salvar"
            />
          ) : (
            <div className="group flex items-center">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium border-l-4 transition truncate ${
                  selectedCategory === c.id ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                style={{ borderLeftColor: c.color }}
              >
                {c.name}
              </button>
              <button
                type="button"
                onClick={() => onStartEdit(c)}
                className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs px-1 opacity-0 group-hover:opacity-100"
                aria-label={`Editar divisória ${c.name}`}
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => onStartAdd(c.id)}
                className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs px-1 opacity-0 group-hover:opacity-100"
                aria-label={`Nova sub-divisória em ${c.name}`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100"
                aria-label={`Excluir divisória ${c.name}`}
              >
                ×
              </button>
            </div>
          )}

          <CategoryTree
            categories={categories}
            parentId={c.id}
            depth={depth + 1}
            selectedCategory={selectedCategory}
            onSelect={onSelect}
            onDelete={onDelete}
            addingUnder={addingUnder}
            onStartAdd={onStartAdd}
            newCategoryName={newCategoryName}
            setNewCategoryName={setNewCategoryName}
            newCategoryColor={newCategoryColor}
            setNewCategoryColor={setNewCategoryColor}
            onCreate={onCreate}
            editingId={editingId}
            onStartEdit={onStartEdit}
            editName={editName}
            setEditName={setEditName}
            editColor={editColor}
            setEditColor={setEditColor}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
          />
        </div>
      ))}

      {addingUnder === parentId && parentId !== null && (
        <NewCategoryForm
          name={newCategoryName}
          setName={setNewCategoryName}
          color={newCategoryColor}
          setColor={setNewCategoryColor}
          onCancel={() => onStartAdd(false)}
          onCreate={onCreate}
        />
      )}
    </div>
  );
}

function NewCategoryForm({
  name,
  setName,
  color,
  setColor,
  onCancel,
  onCreate,
  createLabel = "Criar",
}: {
  name: string;
  setName: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  onCancel: () => void;
  onCreate: () => void;
  createLabel?: string;
}) {
  return (
    <div className="px-2 py-2 space-y-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
      <input
        autoFocus
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        placeholder="Nome da divisória"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onCreate()}
      />
      <div className="flex gap-1 flex-wrap">
        {CATEGORY_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => setColor(hex)}
            className={`h-5 w-5 rounded-full ring-2 ${color === hex ? "ring-slate-900 dark:ring-slate-100" : "ring-transparent"}`}
            style={{ backgroundColor: hex }}
            aria-label={`Cor ${hex}`}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
          Cancelar
        </button>
        <button type="button" onClick={onCreate} className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-300">
          {createLabel}
        </button>
      </div>
    </div>
  );
}

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // ponytail: mesmo limite usado em /api/files

function NoteEditor({ note, onDelete, onSaved }: { note: Note; onDelete: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(note.title);
  const [font, setFont] = useState(note.font);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(patch: Record<string, unknown>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      onSaved();
    }, 700);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave({ title: value, content: editorRef.current?.innerHTML ?? "" });
  }

  function handleContentInput() {
    scheduleSave({ content: editorRef.current?.innerHTML ?? "", title });
  }

  function handleFontChange(key: string) {
    setFont(key);
    scheduleSave({ font: key, content: editorRef.current?.innerHTML ?? "", title });
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleContentInput();
  }

  function handleImageChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      alert("Imagem muito grande (máx. 4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      exec(
        "insertHTML",
        `<div><br></div><div><img src="${reader.result}" style="max-width:100%;display:block" /></div><div><br></div>`
      );
    reader.readAsDataURL(file);
  }

  return (
    <>
      <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 px-4 py-2 flex-wrap">
        <ToolbarButton onClick={() => exec("cut")} label="Recortar">
          <IconeTesoura />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("copy")} label="Copiar">
          <IconeCopiar />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("paste")} label="Colar">
          <IconeColar />
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <select
          value={font}
          onChange={(e) => handleFontChange(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          {FONTS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          defaultValue="3"
          onChange={(e) => exec("fontSize", e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          aria-label="Tamanho da fonte"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <ToolbarButton onClick={() => exec("bold")} label="Negrito">
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} label="Itálico">
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} label="Sublinhado">
          <span className="underline">S</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("strikeThrough")} label="Tachado">
          <span className="line-through">S</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("subscript")} label="Subscrito">
          <span>
            X<sub>2</sub>
          </span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("superscript")} label="Sobrescrito">
          <span>
            X<sup>2</sup>
          </span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("removeFormat")} label="Limpar formatação">
          <IconeLimpar />
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <div className="flex items-center gap-1">
          {TEXT_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => exec("foreColor", hex)}
              className="h-5 w-5 rounded-full ring-1 ring-slate-200 dark:ring-slate-700"
              style={{ backgroundColor: hex }}
              aria-label={`Cor do texto ${hex}`}
            />
          ))}
        </div>

        <label className="flex items-center" title="Cor de realce">
          <IconeRealce />
          <input
            type="color"
            onChange={(e) => exec("hiliteColor", e.target.value)}
            className="h-5 w-5 border-0 bg-transparent p-0"
            aria-label="Cor de realce"
          />
        </label>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <ToolbarButton onClick={() => exec("insertUnorderedList")} label="Marcadores">
          <IconeMarcadores />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} label="Numeração">
          <IconeNumeracao />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("outdent")} label="Diminuir recuo">
          <IconeRecuoDim />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("indent")} label="Aumentar recuo">
          <IconeRecuoAum />
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <ToolbarButton onClick={() => exec("justifyLeft")} label="Alinhar à esquerda">
          <IconeAlinhar dir="left" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("justifyCenter")} label="Centralizar">
          <IconeAlinhar dir="center" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("justifyRight")} label="Alinhar à direita">
          <IconeAlinhar dir="right" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("justifyFull")} label="Justificar">
          <IconeAlinhar dir="justify" />
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <ToolbarButton onClick={() => imageInputRef.current?.click()} label="Inserir imagem">
          <IconeImagem />
        </ToolbarButton>
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChosen} className="hidden" />

        <button type="button" onClick={onDelete} className="ml-auto text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 text-sm px-2" aria-label="Excluir nota">
          Excluir
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Título da nota"
        className="text-xl font-semibold text-slate-900 dark:text-white px-6 pt-5 pb-2 focus:outline-none"
      />

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleContentInput}
        dangerouslySetInnerHTML={{ __html: note.content }}
        className="flex-1 px-6 pb-6 text-sm text-slate-800 dark:text-slate-100 focus:outline-none overflow-y-auto"
        style={{ fontFamily: fontFamilyFor(font) }}
      />
    </>
  );
}

function ToolbarButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-7 w-7 flex items-center justify-center rounded-md text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {children}
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

function IconeTesoura() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.5 8.5 19 19M19 5 8.5 15.5" strokeLinecap="round" />
    </svg>
  );
}

function IconeCopiar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="12" height="12" rx="1.5" />
      <path d="M6 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V6" />
    </svg>
  );
}

function IconeColar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
    </svg>
  );
}

function IconeLimpar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h16M6 16l7-11 5 3-7 11H9z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4l16 16" strokeLinecap="round" />
    </svg>
  );
}

function IconeRealce() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h16M6 16l7-11 5 3-7 11H9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeMarcadores() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="4" cy="6" r="1.3" fill="currentColor" />
      <circle cx="4" cy="12" r="1.3" fill="currentColor" />
      <circle cx="4" cy="18" r="1.3" fill="currentColor" />
      <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
    </svg>
  );
}

function IconeNumeracao() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <text x="1.5" y="8" fontSize="6" stroke="none" fill="currentColor">1</text>
      <text x="1.5" y="14.5" fontSize="6" stroke="none" fill="currentColor">2</text>
      <text x="1.5" y="21" fontSize="6" stroke="none" fill="currentColor">3</text>
      <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
    </svg>
  );
}

function IconeRecuoDim() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12l5-4v8z" fill="currentColor" stroke="none" />
      <path d="M11 5h9M11 19h9M11 12h9" strokeLinecap="round" />
    </svg>
  );
}

function IconeRecuoAum() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 8l5 4-5 4z" fill="currentColor" stroke="none" />
      <path d="M4 5h9M4 19h9M4 12h9" strokeLinecap="round" />
    </svg>
  );
}

function IconeImagem() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5-9 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeAlinhar({ dir }: { dir: "left" | "center" | "right" | "justify" }) {
  const lines: [number, number][] =
    dir === "left"
      ? [[3, 14], [3, 20], [3, 10]]
      : dir === "right"
        ? [[3, 14], [9, 20], [3, 10]]
        : dir === "center"
          ? [[3, 14], [6, 17], [3, 10]]
          : [[3, 14], [3, 20], [3, 10]];
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 5h18" strokeLinecap="round" />
      {lines.map(([x, w], i) => (
        <path key={i} d={`M${x} ${9 + i * 5}h${w}`} strokeLinecap="round" />
      ))}
    </svg>
  );
}
