import React, { useState } from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  XCircle,
} from "lucide-react";
import { useArchivedPagination } from "../hooks/useArchivedPagination";
import ArchivedDetailsModal from "../components/modals/ArchivedDetailsModal";
import { archiveService } from "../services/archiveService";

export default function ArchivedTab({ user }) {
  const {
    orders,
    loading,
    nextPage,
    prevPage,
    pageNumber,
    hasMore,
    triggerSearch,
    isSearching,
    refresh, // <--- Usando triggerSearch
  } = useArchivedPagination();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(""); // Estado local do input

  // Dispara a busca ao clicar no botão ou dar Enter
  const handleSearchSubmit = () => {
    triggerSearch(localSearchTerm);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearchSubmit();
    }
  };

  const clearSearch = () => {
    setLocalSearchTerm("");
    triggerSearch(""); // Reseta a lista
  };

  const handleUnarchive = async (order) => {
    if (!window.confirm("Confirmar desarquivamento?")) return;
    try {
      await archiveService.unarchiveOrder(order.id, user?.name || "Admin");
      alert("Pedido desarquivado!");
      setSelectedOrder(null);
      refresh();
    } catch (error) {
      alert("Erro: " + error.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("pt-BR");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 w-full">
      {selectedOrder && (
        <ArchivedDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUnarchive={handleUnarchive}
        />
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2 text-slate-700">
          <Archive size={24} className="text-purple-600" />
          <h1 className="text-xl font-bold">Arquivo Morto</h1>
        </div>

        {/* BARRA DE PESQUISA COM BOTÃO */}
        <div className="flex items-center gap-2 w-full max-w-lg">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Busque por Pedido, Nome ou SKU..."
              className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-l-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {localSearchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>
          <button
            onClick={handleSearchSubmit}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-r-lg font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            {loading && isSearching ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {/* PAGINAÇÃO (Esconde se estiver buscando) */}
        {!isSearching && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500">
              Pág. {pageNumber}
            </span>
            <div className="flex gap-1">
              <button
                onClick={prevPage}
                disabled={pageNumber === 1 || loading}
                className="p-2 border rounded hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextPage}
                disabled={!hasMore || loading}
                className="p-2 border rounded hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LISTA */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-full text-slate-400 animate-pulse">
            Carregando...
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4">Data</th>
                  <th className="p-4">Pedido</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-purple-50 cursor-pointer transition-colors group"
                  >
                    <td className="p-4 text-slate-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="p-4 font-bold text-slate-700">
                      {order.orderNumber || order.order?.number || "S/N"}
                    </td>
                    <td className="p-4 text-slate-600">
                      {order.customerName ||
                        order.order?.customer?.name ||
                        "ND"}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs">
                        {order.sku}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-400 text-xs italic group-hover:text-purple-600">
                      Ver detalhes →
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && !loading && (
                  <tr>
                    <td colSpan="6" className="p-10 text-center text-slate-400">
                      {isSearching
                        ? "Nenhum resultado encontrado."
                        : "Arquivo vazio."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
