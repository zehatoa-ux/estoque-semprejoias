import React, { useState, useEffect } from "react";
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  Hash,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// Configuração visual das ações
const ACTION_COLORS = {
  CRIAR: "bg-green-100 text-green-700 border-green-200",
  ADICIONAR: "bg-green-100 text-green-700 border-green-200",
  EDITAR: "bg-blue-100 text-blue-700 border-blue-200",
  MOVER: "bg-purple-100 text-purple-700 border-purple-200",
  EXCLUIR: "bg-red-100 text-red-700 border-red-200",
  ARQUIVAR: "bg-gray-100 text-gray-700 border-gray-200",
  LOGIN: "bg-teal-100 text-teal-700 border-teal-200",
};

const LOGS_PATH = `artifacts/${APP_COLLECTION_ID}/public/data/system_logs`;

export default function ReportsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros Locais
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  // Paginação Local
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // --- CARREGAR LOGS (Realtime) ---
  useEffect(() => {
    setLoading(true);
    // Baixamos os últimos 200 logs para não pesar.
    // Num sistema real gigante, faríamos paginação no servidor.
    const q = query(
      collection(db, LOGS_PATH),
      orderBy("timestamp", "desc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLogs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- FILTRAGEM ---
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModule = moduleFilter === "all" || log.module === moduleFilter;

    return matchesSearch && matchesModule;
  });

  // --- PAGINAÇÃO ---
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- CORREÇÃO: Tratamento para logs sem módulo definido ---
  const modules = [
    "all",
    ...new Set(
      logs
        .map((l) => l.module || "OUTROS") // Se for null/undefined, vira "OUTROS"
        .filter((m) => m) // Remove strings vazias se houver
    ),
  ];

  // Helper de Data
  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("pt-BR");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-slate-50 overflow-hidden">
      {/* --- HEADER --- */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shadow-sm z-20">
        <div className="flex items-center gap-2 text-slate-700">
          <Activity size={24} className="text-purple-600" />
          <div>
            <h1 className="text-xl font-bold">Log de Atividades</h1>
            <p className="text-xs text-slate-500 hidden md:block">
              Rastreamento de ações do sistema (Últimos 200)
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {/* Filtro Módulo */}
          <div className="relative w-full md:w-40">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <select
              className="w-full pl-9 pr-2 py-2 border rounded-lg text-sm outline-none bg-white focus:border-purple-500"
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Todos Módulos</option>
              {modules
                .filter((m) => m !== "all")
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </div>

          {/* Busca */}
          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Buscar usuário, ação..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-purple-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* --- TABELA (TABLE TO CARD) --- */}
      <div className="flex-1 overflow-auto custom-scrollbar p-2 md:p-4 bg-slate-50">
        {loading ? (
          <div className="flex justify-center items-center h-full text-slate-400 animate-pulse gap-2">
            <Activity className="animate-spin" /> Carregando logs...
          </div>
        ) : (
          <table className="w-full text-left text-sm block md:table">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b sticky top-0 z-10 hidden md:table-header-group shadow-sm">
              <tr>
                <th className="px-4 py-3 w-40">Data / Hora</th>
                <th className="px-4 py-3 w-48">Usuário</th>
                <th className="px-4 py-3 w-32 text-center">Módulo</th>
                <th className="px-4 py-3 w-32 text-center">Ação</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>

            <tbody className="block md:table-row-group space-y-3 md:space-y-0 pb-20">
              {paginatedLogs.map((log) => {
                const actionColor =
                  ACTION_COLORS[log.action] ||
                  "bg-slate-100 text-slate-700 border-slate-200";

                return (
                  <tr
                    key={log.id}
                    className="
                      block md:table-row 
                      relative 
                      bg-white 
                      border border-slate-200 md:border-b md:border-slate-100 rounded-xl md:rounded-none 
                      shadow-sm md:shadow-none 
                      hover:bg-slate-50 
                      transition-all
                    "
                  >
                    {/* 1. DATA (Mobile: Topo Direito) */}
                    <td className="block md:table-cell px-4 pt-3 pb-1 md:py-3 text-slate-500 text-xs md:whitespace-nowrap absolute top-0 right-0 md:static">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="md:hidden" />
                        {formatDate(log.timestamp)}
                      </div>
                    </td>

                    {/* 2. USUÁRIO (Mobile: Topo Esquerdo) */}
                    <td className="block md:table-cell px-4 pt-3 pb-1 md:py-3 font-bold text-slate-700 md:w-auto">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs">
                          {log.user?.name?.charAt(0) || "?"}
                        </div>
                        <span className="truncate max-w-[150px] md:max-w-none">
                          {log.user?.name}
                        </span>
                      </div>
                    </td>

                    {/* 3. MÓDULO (Mobile: Tag pequena abaixo do nome) */}
                    <td className="block md:table-cell px-4 py-1 md:py-3 md:text-center pl-[3.5rem] -mt-2 md:mt-0 md:pl-4">
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 uppercase tracking-wider">
                        {log.module}
                      </span>
                    </td>

                    {/* 4. AÇÃO (Mobile: Tag colorida) */}
                    <td className="block md:table-cell px-4 py-1 md:py-3 md:text-center pl-[3.5rem] md:pl-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${actionColor}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* 5. DETALHES (Mobile: Texto embaixo) */}
                    <td className="block md:table-cell px-4 pb-3 pt-2 md:py-3 text-slate-600 text-xs md:text-sm border-t md:border-0 mt-2 md:mt-0 bg-slate-50 md:bg-transparent rounded-b-xl md:rounded-none">
                      <div className="flex gap-2">
                        <FileText
                          size={14}
                          className="text-slate-400 mt-0.5 shrink-0"
                        />
                        <span className="whitespace-normal break-words leading-tight">
                          {log.details}
                        </span>
                      </div>
                      {/* Metadados Técnicos (Só mostra se for relevante e no desktop com hover, ou simplificado) */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 ml-6 text-[10px] text-slate-400 font-mono hidden md:block opacity-50 hover:opacity-100 transition-opacity cursor-help truncate max-w-md">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {paginatedLogs.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="p-8 text-center text-slate-400 block md:table-cell"
                  >
                    <ShieldAlert
                      size={48}
                      className="mx-auto mb-2 opacity-20"
                    />
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* --- PAGINAÇÃO --- */}
      <div className="p-4 flex justify-between items-center bg-slate-50 text-xs text-slate-500 border-t shrink-0">
        <span>
          Página {currentPage} de {totalPages || 1}
        </span>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
