import React, { useState } from "react";
import {
  Search,
  Printer,
  Calendar,
  Filter,
  Layers,
  CheckCircle,
  LayoutList,
  Kanban,
} from "lucide-react";

// Hooks
import {
  useProductionOrders,
  useProductionStats,
} from "../hooks/useProductionData";
import { useProductionFilter } from "../hooks/useProductionFilter";
import { useProductionGrouping } from "../hooks/useProductionGrouping";

// Services e Config
import { productionService } from "../services/productionService";
import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../config/productionStatuses";
import { formatProductionTicket } from "../utils/printFormatter";

// Componentes
import ProductionListView from "../components/production/ProductionListView";
import AgeChart from "../components/dashboard/AgeChart";
import TextModal from "../components/modals/TextModal";
import ProductionConversionModal from "../components/modals/ProductionConversionModal";

export default function ProductionTab({ user, findCatalogItem }) {
  // 1. Dados (Hooks)
  const { orders, loading } = useProductionOrders();
  const stats = useProductionStats(); // Mantido se precisar para histórico, mas não usado no topo

  // 2. Estados Locais
  const [filterText, setFilterText] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState("all"); // 'all' ou ID do status para scroll/filtro
  const [groupBy, setGroupBy] = useState("status"); // 'status' ou 'days'

  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [editingOrder, setEditingOrder] = useState(null);
  const [printContent, setPrintContent] = useState(null);

  // 3. Processamento
  // Nota: Se quiser que o clique no menu lateral FILTRE a lista (mostre só aquele status),
  // passe activeStatusFilter aqui. Se quiser apenas scroll, mantenha 'all' no hook.
  // Vou fazer filtrando visualmente na lista para "limpar" a visão, conforme parece ser o desejo.
  const filteredOrders = useProductionFilter(
    orders,
    filterText,
    "all",
    findCatalogItem
  );
  const groupedOrders = useProductionGrouping(filteredOrders, groupBy);

  // --- HANDLERS ---

  const toggleSelect = (id) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedOrders(newSet);
  };

  const handleMoveStatus = async (orderId, newStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    try {
      await productionService.updateStatus(
        orderId,
        newStatus,
        order.status,
        user?.name
      );
    } catch (error) {
      alert("Erro ao mover: " + error.message);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Excluir pedido ${order.order?.number || order.sku}?`))
      return;
    try {
      await productionService.deleteOrder(order.id);
    } catch (error) {
      alert("Erro ao excluir: " + error.message);
    }
  };

  const handleToggleTransit = async (order, direction) => {
    try {
      const newStatus = order.transit_status === direction ? null : direction;
      await productionService.toggleTransit(order.id, newStatus, user?.name);
    } catch (error) {
      alert("Erro no trânsito: " + error.message);
    }
  };

  const handleBatchPrint = () => {
    if (selectedOrders.size === 0) return;
    const items = orders.filter((o) => selectedOrders.has(o.id));
    const text = formatProductionTicket(items);
    setPrintContent(text);
    productionService.markBatchAsPrinted(Array.from(selectedOrders));
    setSelectedOrders(new Set());
  };

  // --- NOVO: Handler para Movimentação em Massa ---
  const handleBatchMove = async (newStatus) => {
    if (!newStatus) return;

    // 1. Confirmação de Segurança
    const confirmMessage = `Tem certeza que deseja mover ${selectedOrders.size} pedidos para "${PRODUCTION_STATUS_CONFIG[newStatus]?.label}"?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      // 2. Transforma o Set de IDs em Array para iterar
      const promises = Array.from(selectedOrders).map(async (orderId) => {
        // Precisamos achar o pedido original para saber o status antigo (para o histórico)
        const order = orders.find((o) => o.id === orderId);

        if (order) {
          return productionService.updateStatus(
            orderId,
            newStatus,
            order.status, // Passa o status atual dele
            user?.name || "Admin"
          );
        }
      });

      // 3. Executa tudo junto (Promise.all acelera o processo)
      await Promise.all(promises);

      // 4. Limpeza
      setSelectedOrders(new Set()); // Desmarca tudo
      alert("Movimentação em massa concluída!"); // Ou use seu showNotification se tiver
    } catch (error) {
      console.error("Erro no lote:", error);
      alert("Erro ao mover alguns pedidos. Verifique o console.");
    }
  };

  const handleSaveSpecs = async (data) => {
    try {
      await productionService.updateSpecs(data.id, data.specs, user?.name);
      setEditingOrder(null);
    } catch (error) {
      alert("Erro ao salvar specs: " + error.message);
    }
  };

  const handleUpdateDate = async (orderId, newDate) => {
    try {
      await productionService.updateOrderField(
        orderId,
        "customCreatedAt",
        newDate,
        user?.name || "Admin"
      );
    } catch (error) {
      alert("Erro ao atualizar data: " + error.message);
    }
  };

  // Helper para rolar até a seção (se optarmos por scroll em vez de filtro rígido)
  const scrollToStatus = (statusId) => {
    setActiveStatusFilter(statusId); // Ou use isso para filtrar
    const element = document.getElementById(`status-section-${statusId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center text-slate-500">
        Carregando produção...
      </div>
    );

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
      {/* --- MODAIS --- */}
      {printContent && (
        <TextModal
          content={printContent}
          onClose={() => setPrintContent(null)}
        />
      )}
      {editingOrder && (
        <ProductionConversionModal
          isOpen={!!editingOrder}
          isEditing={true}
          reservation={editingOrder}
          inventory={[]}
          onClose={() => setEditingOrder(null)}
          onConfirm={handleSaveSpecs}
          findCatalogItem={findCatalogItem}
        />
      )}

      {/* --- COLUNA ESQUERDA: MENU DE STATUS (Sidebar Interna) --- */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <Layers size={18} /> Processos
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {/* Botão "Todos" */}
          <button
            onClick={() => setActiveStatusFilter("all")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex justify-between items-center ${
              activeStatusFilter === "all"
                ? "bg-slate-800 text-white shadow-md"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>VISÃO GERAL</span>
            <span className="bg-white/20 px-1.5 rounded text-[10px]">
              {filteredOrders.length}
            </span>
          </button>

          <div className="h-px bg-slate-200 my-2"></div>

          {/* Lista de Status Coloridos */}
          {KANBAN_ORDER.map((statusId) => {
            const config = PRODUCTION_STATUS_CONFIG[statusId];
            const count = groupedOrders[statusId]?.length || 0;
            const isActive = activeStatusFilter === statusId;

            // Pega a cor base do config (ex: "bg-red-500") para usar no botão
            // Hack simples para extrair a cor ou usar uma padrão
            const colorClass = config.color || "bg-slate-500";

            return (
              <button
                key={statusId}
                onClick={() =>
                  setActiveStatusFilter(isActive ? "all" : statusId)
                }
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex justify-between items-center border border-transparent ${
                  isActive
                    ? `shadow-md ring-2 ring-offset-1 ring-slate-300 ${colorClass} text-white`
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{config.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    isActive
                      ? "bg-white/30 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* --- COLUNA DIREITA: CONTEÚDO PRINCIPAL (100% Restante) --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOPO: Gráfico + Busca + Filtros */}
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-4">
          {/* Gráfico de Idade (AgeChart) - Agora aqui dentro */}
          <div className="w-full">
            <AgeChart orders={filteredOrders} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar SKU, Cliente, Pedido..."
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full focus:border-blue-500 outline-none"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setGroupBy("status")}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                    groupBy === "status"
                      ? "bg-white shadow text-blue-600"
                      : "text-slate-500"
                  }`}
                >
                  <LayoutList size={14} /> Lista
                </button>
                <button
                  onClick={() => setGroupBy("days")}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                    groupBy === "days"
                      ? "bg-white shadow text-blue-600"
                      : "text-slate-500"
                  }`}
                >
                  <Kanban size={14} /> Kanban
                </button>
              </div>

              {/* BARRA DE AÇÕES EM MASSA */}
              {selectedOrders.size > 0 && (
                <div className="flex items-center gap-3 animate-pulse-once">
                  {/* 1. SELETOR DE STATUS (NOVO) */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden h-9">
                    <div className="bg-slate-100 px-3 py-2 border-r border-slate-200 text-xs font-bold text-slate-600 uppercase">
                      Mover
                    </div>
                    <select
                      className="pl-2 pr-8 py-1 text-sm bg-transparent outline-none cursor-pointer text-slate-700 font-medium hover:bg-slate-50 h-full w-40 appearance-none"
                      onChange={(e) => handleBatchMove(e.target.value)}
                      value="" // Força o select a ficar sempre no "placeholder" visualmente
                    >
                      <option value="" disabled>
                        Selecione...
                      </option>
                      {/* Filtra para não mostrar status "inúteis" se quiser, ou mostra todos */}
                      {KANBAN_ORDER.map((statusKey) => (
                        <option key={statusKey} value={statusKey}>
                          {PRODUCTION_STATUS_CONFIG[statusKey]?.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. BOTÃO IMPRIMIR (MANTIDO) */}
                  <button
                    onClick={handleBatchPrint}
                    className="h-9 flex items-center gap-2 bg-slate-800 text-white px-4 rounded-lg text-sm font-bold hover:bg-black transition-colors shadow-sm"
                  >
                    <Printer size={16} />
                    <span>Imprimir ({selectedOrders.size})</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ÁREA DE SCROLL DA LISTA */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
          {/* Passamos o groupedOrders FILTRADO pelo status selecionado no menu lateral.
              Se 'all', passa tudo. Se não, cria um objeto contendo apenas aquele status.
           */}
          <ProductionListView
            groupedOrders={
              activeStatusFilter === "all"
                ? groupedOrders
                : {
                    [activeStatusFilter]:
                      groupedOrders[activeStatusFilter] || [],
                  }
            }
            selectedOrders={selectedOrders}
            toggleSelect={toggleSelect}
            setEditingOrder={setEditingOrder}
            handleDeleteOrder={handleDeleteOrder}
            handleMoveStatus={handleMoveStatus}
            findCatalogItem={findCatalogItem}
            onToggleTransit={handleToggleTransit}
            onUpdateDate={handleUpdateDate}
          />
        </div>
      </main>
    </div>
  );
}
