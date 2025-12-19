import React from "react";
import {
  Filter,
  Clock,
  TrendingUp,
  Package,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Bookmark,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function ReportsTab({
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  setReportRange,
  reportStats,
  paginatedReportData,
  currentReportPage,
  setCurrentReportPage,
  totalReportPages,
  reportData,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter size={18} /> Filtros do Relatório
        </h3>
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Data Início
              </label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="border p-2 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Data Fim
              </label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="border p-2 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setReportRange(0)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Clock size={12} /> Hoje
            </button>
            <button
              onClick={() => setReportRange(7)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Clock size={12} /> 7 Dias
            </button>
            <button
              onClick={() => setReportRange(30)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Clock size={12} /> 30 Dias
            </button>
            <button
              onClick={() => setReportRange("month")}
              className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Clock size={12} /> Este Mês
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border-l-4 border-green-500 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold">
                Total Entradas
              </p>
              <h4 className="text-2xl font-bold text-slate-800">
                {reportStats.entries}
              </h4>
            </div>
            <div className="bg-green-100 p-2 rounded-lg text-green-600">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold">
                Total Vendas
              </p>
              <h4 className="text-2xl font-bold text-slate-800">
                {reportStats.sales}
              </h4>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Package size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border-l-4 border-red-500 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold">
                Ajustes / Perdas
              </p>
              <h4 className="text-2xl font-bold text-slate-800">
                {reportStats.adjustments}
              </h4>
            </div>
            <div className="bg-red-100 p-2 rounded-lg text-red-600">
              <TrendingDown size={20} />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b">
              <tr>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedReportData.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs text-slate-600">
                    {event.date.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase ${
                        event.type === "entrada"
                          ? "bg-green-100 text-green-700"
                          : event.type === "saida"
                          ? "bg-blue-100 text-blue-700"
                          : event.type === "reserva_criada"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {event.type === "entrada" && <TrendingUp size={12} />}
                      {event.type === "saida" && <CheckCircle size={12} />}
                      {event.type === "ajuste" && <AlertTriangle size={12} />}
                      {event.type === "reserva_criada" && (
                        <Bookmark size={12} />
                      )}
                      {event.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-bold text-slate-700">
                    {event.sku}
                  </td>
                  <td
                    className="px-6 py-3 text-slate-600 max-w-xs truncate"
                    title={event.name}
                  >
                    {event.name}
                  </td>
                  <td className="px-6 py-3 text-slate-500 flex items-center gap-1">
                    <User size={12} /> {event.user}
                  </td>
                </tr>
              ))}
              {paginatedReportData.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    Nenhum evento encontrado neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalReportPages > 1 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              {(currentReportPage - 1) * itemsPerPage + 1}-
              {Math.min(currentReportPage * itemsPerPage, reportData.length)} de{" "}
              {reportData.length} eventos
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentReportPage((p) => Math.max(1, p - 1))}
                disabled={currentReportPage === 1}
                className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="flex items-center px-2 font-medium bg-white border border-slate-300 rounded">
                Página {currentReportPage} de {totalReportPages}
              </span>
              <button
                onClick={() =>
                  setCurrentReportPage((p) => Math.min(totalReportPages, p + 1))
                }
                disabled={currentReportPage === totalReportPages}
                className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
