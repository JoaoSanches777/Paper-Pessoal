"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountModal } from "@/components/AccountModal";

export type View = "lembretes-trabalho" | "lembretes-pessoal" | "calendario" | "anotacoes" | "arquivos";

const ITEMS: { key: View; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { key: "lembretes-trabalho", label: "Lembretes Trabalho", icon: (a) => <IconeLembretes active={a} /> },
  { key: "lembretes-pessoal", label: "Lembretes Pessoais", icon: (a) => <IconeLembretes active={a} /> },
  { key: "calendario", label: "Calendário", icon: (a) => <IconeCalendario active={a} /> },
  { key: "anotacoes", label: "Anotações", icon: (a) => <IconeAnotacoes active={a} /> },
  { key: "arquivos", label: "Arquivos", icon: (a) => <IconeArquivos active={a} /> },
];

export function Sidebar({
  view,
  onChange,
  userName,
  onLogout,
  colapsada,
  onToggleColapsada,
}: {
  view: View;
  onChange: (v: View) => void;
  userName: string;
  onLogout: () => void;
  colapsada: boolean;
  onToggleColapsada: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);

  function selecionar(v: View) {
    onChange(v);
    setMobileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className="sm:hidden fixed top-3 left-3 z-30 h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm text-slate-600 dark:text-slate-300"
      >
        <IconeMenu />
      </button>

      {mobileOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-slate-900/40 dark:bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed sm:static inset-y-0 left-0 z-40 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-screen flex flex-col transition-transform sm:transition-all duration-200 w-56 ${
          colapsada ? "sm:w-[76px]" : "sm:w-56"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} sm:translate-x-0`}
      >
      <div
        className={`border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 ${
          colapsada ? "justify-center px-3 py-5" : "px-4 py-4 justify-between"
        }`}
      >
        <div className={colapsada ? "hidden" : ""}>
          <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Paper Pessoal</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">Olá, {userName}</p>
        </div>
        <button
          type="button"
          onClick={onToggleColapsada}
          aria-label={colapsada ? "Expandir menu" : "Recolher menu"}
          title={colapsada ? "Expandir menu" : "Recolher menu"}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <IconeColapsar colapsada={colapsada} />
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        {ITEMS.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => selecionar(item.key)}
              title={colapsada ? item.label : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                colapsada ? "justify-center" : ""
              } ${active ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              {item.icon(active)}
              {!colapsada && item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
        <ThemeToggle colapsada={colapsada} />
        <button
          type="button"
          onClick={() => setContaAberta(true)}
          title={colapsada ? "Conta" : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 ${
            colapsada ? "justify-center" : ""
          }`}
        >
          <IconeConta />
          {!colapsada && "Conta"}
        </button>
        <button
          onClick={onLogout}
          title={colapsada ? "Sair" : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 ${
            colapsada ? "justify-center" : ""
          }`}
        >
          <IconeSair />
          {!colapsada && "Sair"}
        </button>
      </div>
    </aside>

    {contaAberta && <AccountModal onClose={() => setContaAberta(false)} />}
    </>
  );
}

function IconeMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeLembretes({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeCalendario({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeAnotacoes({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeArquivos({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeColapsar({ colapsada }: { colapsada: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform ${colapsada ? "rotate-180" : ""}`}
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeConta() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeSair() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
