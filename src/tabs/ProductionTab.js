import React, { useState } from "react";
import {
  Search,
  Printer,
  Calendar,
  Filter,
  Layers,
  CheckCircle,
  LayoutList,
  ArrowUpCircle, // <--- NOVO
  ArrowDownCircle, // <--- NOVO
  // Kanban, // REMOVIDO: Botão Kanban não será mais usado
} from "lucide-react";

// Hooks
import {
  useProductionOrders,
  useProductionStats,
} from "../hooks/useProductionData";
import { useProductionFilter } from "../hooks/useProductionFilter";
import { useProductionGrouping } from "../hooks/useProductionGrouping";
import { logAction, MODULES, getSafeUser } from "../services/logService";

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
  // const stats = useProductionStats(); // (Opcional, já temos AgeChart)

  // 2. Estados Locais
  const [filterText, setFilterText] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("status"); // 'status' (Padrão)

  // --- NOVO: Estado para Filtro de Idade (Vindo do Gráfico) ---
  const [ageFilter, setAgeFilter] = useState(null); // null | { min, max }

  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [editingOrder, setEditingOrder] = useState(null);
  const [printContent, setPrintContent] = useState(null);

  // 3. Processamento (Filtros em Cascata)
  // Passo A: Filtra por Texto e Status
  const baseFilteredOrders = useProductionFilter(
    orders,
    filterText,
    "all", // Filtramos visualmente depois para manter o contador total correto na sidebar
    findCatalogItem
  );

  // Passo B: Filtra por Idade (Se clicou no gráfico)
  const finalFilteredOrders = baseFilteredOrders.filter((order) => {
    if (!ageFilter) return true; // Sem filtro de idade

    const now = new Date();
    const created = order.customCreatedAt
      ? new Date(order.customCreatedAt)
      : order.createdAt?.toDate
      ? order.createdAt.toDate()
      : new Date();

    // Diferença em dias úteis (simplificado para dias corridos para performance, ou use helper)
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Lógica simples: "Mais de X dias" significa dia atual > dia limite
    if (ageFilter.min !== undefined && diffDays < ageFilter.min) return false;
    if (ageFilter.max !== undefined && diffDays > ageFilter.max) return false;

    return true;
  });

  const groupedOrders = useProductionGrouping(finalFilteredOrders, groupBy);

  // --- HANDLERS ---
  const handleBulkTransit = async (direction) => {
    const label =
      direction === "subindo" ? "SUBINDO (Escritório)" : "DESCENDO (Fábrica)";

    if (
      !window.confirm(
        `Confirmar envio de ${selectedOrders.size} itens para: ${label}?`
      )
    ) {
      return;
    }

    try {
      // Cria uma lista de promessas para executar tudo "ao mesmo tempo"
      const updatePromises = Array.from(selectedOrders).map(async (orderId) => {
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;

        // 1. Atualiza no Banco (Força a direção)
        await productionService.toggleTransit(order.id, direction, user?.name);

        // 2. Log Individual (Importante para rastreabilidade)
        await logAction(
          getSafeUser(user),
          MODULES.PRODUCAO,
          "TRANSITO_MASSA",
          `Lote: Marcou ${label} - Item ${order.sku}`,
          { itemId: order.id, sku: order.sku, direction }
        );
      });

      // Espera tudo terminar
      await Promise.all(updatePromises);

      // Limpa a seleção e avisa
      setSelectedOrders(new Set());
      // Se você tiver um toast/notification na ProductionTab, use aqui. Se não, use alert.
      alert(`Trânsito atualizado para ${selectedOrders.size} itens!`);
    } catch (error) {
      console.error("Erro no trânsito em massa:", error);
      alert("Erro ao atualizar alguns itens.");
    }
  };

  // NOVO: Handler ao clicar no gráfico
  const handleChartClick = (range) => {
    // Se clicar no mesmo, limpa o filtro (toggle)
    if (ageFilter && ageFilter.label === range.label) {
      setAgeFilter(null);
    } else {
      setAgeFilter(range);
    }
  };

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

  // Handler para Movimentação em Massa
  const handleBatchMove = async (newStatus) => {
    if (!newStatus) return;
    const confirmMessage = `Tem certeza que deseja mover ${selectedOrders.size} pedidos para "${PRODUCTION_STATUS_CONFIG[newStatus]?.label}"?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const promises = Array.from(selectedOrders).map(async (orderId) => {
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          return productionService.updateStatus(
            orderId,
            newStatus,
            order.status,
            user?.name || "Admin"
          );
        }
      });
      await Promise.all(promises);
      setSelectedOrders(new Set());
      alert("Movimentação em massa concluída!");
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

  if (loading)
    return (
      <div className="p-10 text-center text-slate-500">
        Carregando produção...
      </div>
    );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
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

      {/* --- SIDEBAR LATERAL --- */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 z-10 shadow-sm overflow-hidden">
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
              {finalFilteredOrders.length}
            </span>
          </button>

          <div className="h-px bg-slate-200 my-2"></div>

          {/* Lista de Status Coloridos */}
          {KANBAN_ORDER.map((statusId) => {
            const config = PRODUCTION_STATUS_CONFIG[statusId];
            // Conta os itens filtrados que caem neste status
            const count = groupedOrders[statusId]?.length || 0;
            const isActive = activeStatusFilter === statusId;
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

      {/* --- ÁREA PRINCIPAL --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* MENU MOBILE */}
        <div className="md:hidden bg-slate-100 border-b border-slate-200 p-3 shrink-0 z-20">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <Layers size={12} /> Filtrar Processo:
          </label>
          <div className="relative">
            <select
              value={activeStatusFilter}
              onChange={(e) => setActiveStatusFilter(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-300 text-slate-800 text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
            >
              <option value="all">
                VISÃO GERAL ({finalFilteredOrders.length})
              </option>
              {KANBAN_ORDER.map((statusId) => (
                <option key={statusId} value={statusId}>
                  {PRODUCTION_STATUS_CONFIG[statusId]?.label} (
                  {groupedOrders[statusId]?.length || 0})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <Filter size={14} />
            </div>
          </div>
        </div>

        {/* TOPO: Gráfico + Busca + Filtros */}
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-4">
          {/* Gráfico de Idade Clicável */}
          <div className="w-full hidden sm:block">
            {/* Passamos o handler de clique para o componente do gráfico */}
            {/* IMPORTANTE: Você precisa atualizar o AgeChart.js para aceitar onClick também */}
            <AgeChart
              orders={baseFilteredOrders} // Passamos a base sem filtro de idade para o gráfico não "sumir" com as outras barras ao clicar
              onBarClick={handleChartClick}
              activeFilter={ageFilter}
            />

            {/* Feedback Visual do Filtro Ativo */}
            {ageFilter && (
              <div className="flex items-center justify-center mt-2">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2">
                  Filtro Ativo: {ageFilter.label}
                  <button
                    onClick={() => setAgeFilter(null)}
                    className="hover:text-blue-900"
                  >
                    <CheckCircle size={12} />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            {/* Busca */}
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

            {/* Ações */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Botão Lista (Kanban foi removido) */}
              <div className="hidden sm:block text-xs font-bold text-slate-400 uppercase tracking-wide pt-2">
                Modo Lista
              </div>

              {/* BARRA DE AÇÕES EM MASSA */}
              {selectedOrders.size > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto animate-pulse-once mt-2 sm:mt-0">
                  {/* SELETOR DE STATUS (Mover) */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden h-9 flex-1 sm:flex-none">
                    <div className="bg-slate-100 px-3 py-2 border-r border-slate-200 text-xs font-bold text-slate-600 uppercase">
                      Mover
                    </div>
                    <select
                      className="pl-2 pr-8 py-1 text-sm bg-transparent outline-none cursor-pointer text-slate-700 font-medium hover:bg-slate-50 h-full w-full sm:w-40 appearance-none"
                      onChange={(e) => handleBatchMove(e.target.value)}
                      value=""
                    >
                      <option value="" disabled>
                        Selecione...
                      </option>
                      {KANBAN_ORDER.map((statusKey) => (
                        <option key={statusKey} value={statusKey}>
                          {PRODUCTION_STATUS_CONFIG[statusKey]?.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* --- NOVOS BOTÕES DE TRÂNSITO --- */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkTransit("descendo")}
                      className="flex items-center gap-2 hover:text-orange-400 transition-colors group"
                      title="Enviar Selecionados para Fábrica"
                    >
                      <ArrowDownCircle
                        size={20}
                        className="group-hover:animate-bounce"
                      />
                      <span className="text-xs font-bold uppercase hidden md:inline">
                        Descer
                      </span>
                    </button>

                    <button
                      onClick={() => handleBulkTransit("subindo")}
                      className="flex items-center gap-2 hover:text-indigo-400 transition-colors group"
                      title="Enviar Selecionados para Escritório"
                    >
                      <ArrowUpCircle
                        size={20}
                        className="group-hover:animate-bounce"
                      />
                      <span className="text-xs font-bold uppercase hidden md:inline">
                        Subir
                      </span>
                    </button>
                  </div>
                  {/* -------------------------------- */}
                  {/* BOTÃO IMPRIMIR */}
                  <button
                    onClick={handleBatchPrint}
                    className="h-9 flex items-center justify-center gap-2 bg-slate-800 text-white px-4 rounded-lg text-sm font-bold hover:bg-black transition-colors shadow-sm flex-1 sm:flex-none"
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
        <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-slate-50/50">
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
            setSelectSet={setSelectedOrders}
          />
        </div>
      </main>
    </div>
  );
}
