import React, { useState } from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  ArrowRight,
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
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 w-full overflow-hidden">
      {/* MODAL DETALHES */}
      {selectedOrder && (
        <ArchivedDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUnarchive={handleUnarchive}
        />
      )}

      {/* HEADER (Responsivo) */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shrink-0 z-20">
        <div className="flex items-center gap-2 text-slate-700">
          <Archive size={24} className="text-purple-600" />
          <h1 className="text-xl font-bold">Arquivo Morto</h1>
        </div>

        {/* BARRA DE PESQUISA COM BOTÃO */}
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:max-w-lg">
          <div className="relative flex-1 w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Busque por Pedido, Nome ou SKU..."
              className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg md:rounded-l-lg md:rounded-r-none focus:ring-2 focus:ring-purple-500 outline-none transition-all"
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
            className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg md:rounded-l-none md:rounded-r-lg font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            {loading && isSearching ? "..." : "Buscar"}
          </button>
        </div>

        {/* PAGINAÇÃO */}
        {!isSearching && (
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
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

      {/* LISTA (TABLE TO CARD) */}
      <div className="flex-1 overflow-auto p-2 md:p-6 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-full text-slate-400 animate-pulse">
            Carregando...
          </div>
        ) : (
          <div className="md:bg-white md:rounded-xl md:shadow md:border md:border-slate-200 md:overflow-hidden">
            <table className="w-full text-left border-collapse block md:table">
              {/* THEAD (Escondido no Mobile) */}
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 hidden md:table-header-group sticky top-0">
                <tr>
                  <th className="p-4">Data</th>
                  <th className="p-4">Pedido</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>

              <tbody className="block md:table-row-group space-y-3 md:space-y-0 text-sm pb-20">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="
                      block md:table-row 
                      relative 
                      bg-white 
                      border border-slate-200 md:border-b md:border-slate-100 rounded-xl md:rounded-none 
                      shadow-sm md:shadow-none 
                      hover:bg-purple-50 
                      cursor-pointer 
                      transition-colors 
                      group
                    "
                  >
                    {/* 1. DATA (Mobile: Topo Direito) */}
                    <td className="block md:table-cell px-4 pt-3 pb-1 md:p-4 text-slate-500 text-xs md:text-sm absolute top-0 right-0 md:static">
                      {formatDate(order.createdAt)}
                    </td>

                    {/* 2. PEDIDO (Mobile: Topo Esquerdo) */}
                    <td className="block md:table-cell px-4 pt-3 pb-1 md:p-4 font-bold text-slate-700 text-sm md:text-base">
                      <span className="md:hidden text-slate-400 font-normal text-xs mr-1">
                        Pedido:
                      </span>
                      {order.orderNumber || order.order?.number || "S/N"}
                    </td>

                    {/* 3. CLIENTE (Mobile: Abaixo do Pedido) */}
                    <td className="block md:table-cell px-4 py-1 md:p-4 text-slate-600 font-medium">
                      {order.customerName ||
                        order.order?.customer?.name ||
                        "ND"}
                    </td>

                    {/* 4. SKU (Mobile: Tag) */}
                    <td className="block md:table-cell px-4 py-1 md:p-4">
                      <span className="font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs font-bold">
                        {order.sku}
                      </span>
                    </td>

                    {/* 5. STATUS (Mobile: Tag) */}
                    <td className="block md:table-cell px-4 py-2 md:p-4">
                      <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-medium text-slate-600">
                        {order.status}
                      </span>
                    </td>

                    {/* 6. AÇÃO (Mobile: Botão visível) */}
                    <td className="block md:table-cell px-4 py-3 md:p-4 text-right text-slate-400 text-xs italic group-hover:text-purple-600 border-t md:border-0 mt-2 md:mt-0 bg-slate-50 md:bg-transparent rounded-b-xl md:rounded-none">
                      <span className="md:hidden font-bold flex items-center justify-center gap-1">
                        Ver Detalhes <ArrowRight size={12} />
                      </span>
                      <span className="hidden md:inline">Ver detalhes →</span>
                    </td>
                  </tr>
                ))}

                {orders.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan="6"
                      className="p-10 text-center text-slate-400 block md:table-cell"
                    >
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
