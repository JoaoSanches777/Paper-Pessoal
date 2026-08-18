"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, View } from "@/components/Sidebar";
import RemindersApp from "@/components/RemindersApp";
import CalendarApp from "@/components/CalendarApp";
import NotesApp from "@/components/NotesApp";
import FilesApp from "@/components/FilesApp";

const CHAVE_LOCALSTORAGE = "sidebar-colapsada";

const TAB_TITLES: Record<View, string> = {
  "lembretes-trabalho": "Lembretes Trabalho",
  "lembretes-pessoal": "Lembretes Pessoal",
  calendario: "Calendário Pessoal",
  anotacoes: "Anotações Pessoais",
  arquivos: "Arquivos",
};

export default function AppShell() {
  const router = useRouter();
  const [view, setView] = useState<View>("lembretes-trabalho");
  const [userName, setUserName] = useState("");
  const [colapsada, setColapsada] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => setUserName(me.name?.split(" ")[0] ?? ""));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      document.title = TAB_TITLES[view];
    }, 100);
    return () => clearTimeout(id);
  }, [view]);

  useEffect(() => {
    if (localStorage.getItem(CHAVE_LOCALSTORAGE) === "1") setColapsada(true);
  }, []);

  function alternarColapso() {
    setColapsada((atual) => {
      const novo = !atual;
      localStorage.setItem(CHAVE_LOCALSTORAGE, novo ? "1" : "0");
      return novo;
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex">
      <Sidebar
        view={view}
        onChange={setView}
        userName={userName}
        onLogout={logout}
        colapsada={colapsada}
        onToggleColapsada={alternarColapso}
      />
      <div className="flex-1 min-w-0 pt-14 sm:pt-0">
        {view === "lembretes-trabalho" && <RemindersApp variant="trabalho" />}
        {view === "lembretes-pessoal" && <RemindersApp variant="pessoal" />}
        {view === "calendario" && <CalendarApp />}
        {view === "anotacoes" && <NotesApp />}
        {view === "arquivos" && <FilesApp />}
      </div>
    </div>
  );
}
