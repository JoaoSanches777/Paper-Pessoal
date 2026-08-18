"use client";

import { useEffect, useState } from "react";

const CHAVE = "tema";

export function ThemeToggle({ colapsada }: { colapsada?: boolean }) {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    localStorage.setItem(CHAVE, novo ? "escuro" : "claro");
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={escuro ? "Mudar para modo claro" : "Mudar para modo escuro"}
      aria-label={escuro ? "Mudar para modo claro" : "Mudar para modo escuro"}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 ${
        colapsada ? "justify-center w-full" : "w-full"
      }`}
    >
      {escuro ? <IconeSol /> : <IconeLua />}
      {!colapsada && (escuro ? "Modo claro" : "Modo escuro")}
    </button>
  );
}

function IconeSol() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeLua() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
