"use client";

import { useEffect, useRef, useState } from "react";

type Folder = { id: number; name: string; color: string; parent_id: number | null };
type FileItem = {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  folder_id: number | null;
  uploaded_at: string;
};

const FOLDER_COLORS = ["#f87171", "#fb923c", "#fbbf24", "#4ade80", "#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#94a3b8"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesApp() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [addingUnder, setAddingUnder] = useState<number | null | false>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(FOLDER_COLORS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories?kind=file").then((r) => r.json()),
      fetch("/api/files").then((r) => r.json()),
    ]).then(([f, files]) => {
      setFolders(f);
      setFiles(files);
      setLoading(false);
    });
  }, []);

  async function refreshFolders() {
    setFolders(await fetch("/api/categories?kind=file").then((r) => r.json()));
  }

  async function refreshFiles() {
    setFiles(await fetch("/api/files").then((r) => r.json()));
  }

  async function createFolder() {
    if (!newFolderName.trim() || addingUnder === false) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName, scope: "personal", color: newFolderColor, kind: "file", parent_id: addingUnder }),
    });
    const created = await res.json();
    if (res.ok) {
      setNewFolderName("");
      setAddingUnder(false);
      await refreshFolders();
      setSelectedFolder(created.id);
    }
  }

  async function deleteFolder(id: number) {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (selectedFolder === id) setSelectedFolder("all");
    refreshFolders();
    refreshFiles();
  }

  function startEdit(f: Folder) {
    setEditingId(f.id);
    setEditName(f.name);
    setEditColor(f.color);
  }

  async function saveEdit() {
    if (editingId === null || !editName.trim()) return;
    await fetch(`/api/categories/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    setEditingId(null);
    await refreshFolders();
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError("");
    const folderId = selectedFolder === "all" ? null : selectedFolder;
    for (const file of Array.from(fileList)) {
      const form = new FormData();
      form.append("file", file);
      if (folderId !== null) form.append("folder_id", String(folderId));
      const res = await fetch("/api/files", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erro ao enviar arquivo");
        break;
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refreshFiles();
  }

  async function remove(id: number) {
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    setFiles((atual) => atual.filter((f) => f.id !== id));
  }

  if (loading) return <div className="p-8 text-sm text-slate-400 dark:text-slate-500">Carregando...</div>;

  const query = search.trim().toLowerCase();
  const visibleFiles = files
    .filter((f) => (query ? true : selectedFolder === "all" ? true : f.folder_id === selectedFolder))
    .filter((f) => (query ? f.filename.toLowerCase().includes(query) : true));

  return (
    <main className="flex h-screen">
      <div className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-2 pb-1">Pastas</p>
        <button
          type="button"
          onClick={() => setSelectedFolder("all")}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border-l-4 transition ${
            selectedFolder === "all" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600" : "border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Todos os arquivos
        </button>

        <FolderTree
          folders={folders}
          parentId={null}
          depth={0}
          selectedFolder={selectedFolder}
          onSelect={setSelectedFolder}
          onDelete={deleteFolder}
          addingUnder={addingUnder}
          onStartAdd={setAddingUnder}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          newFolderColor={newFolderColor}
          setNewFolderColor={setNewFolderColor}
          onCreate={createFolder}
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
          <NewFolderForm
            name={newFolderName}
            setName={setNewFolderName}
            color={newFolderColor}
            setColor={setNewFolderColor}
            onCancel={() => setAddingUnder(false)}
            onCreate={createFolder}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingUnder(null)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            + nova pasta
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            {query
              ? "Resultados da busca"
              : selectedFolder === "all"
                ? "Todos os arquivos"
                : folders.find((f) => f.id === selectedFolder)?.name ?? "Arquivos"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Seus arquivos pessoais, visíveis só para você.</p>

          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
              <IconeBusca />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar arquivo em todas as pastas..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
              className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Até 4MB por arquivo{uploading && " · enviando..."}
              {selectedFolder !== "all" && " · vai para esta pasta"}
            </p>
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
          </div>

          {visibleFiles.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{query ? "Nenhum arquivo encontrado." : "Nenhum arquivo aqui."}</p>
          ) : (
            <ul className="space-y-2">
              {visibleFiles.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3"
                >
                  <a
                    href={`/api/files/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 min-w-0 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    <IconeArquivo />
                    <span className="truncate text-sm font-medium">{f.filename}</span>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatSize(f.size_bytes)}</span>
                    {query && (
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                        {folders.find((fo) => fo.id === f.folder_id)?.name ?? "Sem pasta"}
                      </span>
                    )}
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 px-1"
                    aria-label="Remover arquivo"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function FolderTree({
  folders,
  parentId,
  depth,
  selectedFolder,
  onSelect,
  onDelete,
  addingUnder,
  onStartAdd,
  newFolderName,
  setNewFolderName,
  newFolderColor,
  setNewFolderColor,
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
  folders: Folder[];
  parentId: number | null;
  depth: number;
  selectedFolder: number | "all";
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  addingUnder: number | null | false;
  onStartAdd: (id: number | false) => void;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  newFolderColor: string;
  setNewFolderColor: (v: string) => void;
  onCreate: () => void;
  editingId: number | null;
  onStartEdit: (f: Folder) => void;
  editName: string;
  setEditName: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const children = folders.filter((f) => f.parent_id === parentId);
  if (children.length === 0 && addingUnder !== parentId) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0 }} className={depth > 0 ? "border-l border-slate-100 dark:border-slate-800 pl-2 space-y-1" : "space-y-1"}>
      {children.map((f) => (
        <div key={f.id}>
          {editingId === f.id ? (
            <NewFolderForm
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
                onClick={() => onSelect(f.id)}
                className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium border-l-4 transition truncate ${
                  selectedFolder === f.id ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                style={{ borderLeftColor: f.color }}
              >
                {f.name}
              </button>
              <button
                type="button"
                onClick={() => onStartEdit(f)}
                className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs px-1 opacity-0 group-hover:opacity-100"
                aria-label={`Editar pasta ${f.name}`}
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => onStartAdd(f.id)}
                className="text-slate-300 dark:text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs px-1 opacity-0 group-hover:opacity-100"
                aria-label={`Nova subpasta em ${f.name}`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => onDelete(f.id)}
                className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100"
                aria-label={`Excluir pasta ${f.name}`}
              >
                ×
              </button>
            </div>
          )}

          <FolderTree
            folders={folders}
            parentId={f.id}
            depth={depth + 1}
            selectedFolder={selectedFolder}
            onSelect={onSelect}
            onDelete={onDelete}
            addingUnder={addingUnder}
            onStartAdd={onStartAdd}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            newFolderColor={newFolderColor}
            setNewFolderColor={setNewFolderColor}
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
        <NewFolderForm
          name={newFolderName}
          setName={setNewFolderName}
          color={newFolderColor}
          setColor={setNewFolderColor}
          onCancel={() => onStartAdd(false)}
          onCreate={onCreate}
        />
      )}
    </div>
  );
}

function NewFolderForm({
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
        placeholder="Nome da pasta"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onCreate()}
      />
      <div className="flex gap-1 flex-wrap">
        {FOLDER_COLORS.map((hex) => (
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

function IconeBusca() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function IconeArquivo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
