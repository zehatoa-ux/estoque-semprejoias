import React, { useState } from "react";
import {
  Search,
  Printer,
  Calendar,
  Filter,
  Layers,
  CheckCircle,
  LayoutList,
  ArrowUpCircle,
  ArrowDownCircle,
  X, // Faltava importar o X para fechar a barra flutuante
} from "lucide-react";

// Hooks
import {
  useProductionOrders,
  // useProductionStats,
} from "../hooks/useProductionData";
import { useProductionFilter } from "../hooks/useProductionFilter";
import { useProductionGrouping } from "../hooks/useProductionGrouping";

// Services e Config
import { productionService } from "../services/productionService";
import { logAction, MODULES, getSafeUser } from "../services/logService"; // <--- IMPORTS DE LOG
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

  // 2. Estados Locais
  const [filterText, setFilterText] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("status");

  // Estado para Filtro de Idade (Vindo do Gráfico)
  const [ageFilter, setAgeFilter] = useState(null);

  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [editingOrder, setEditingOrder] = useState(null);
  const [printContent, setPrintContent] = useState(null);

  // 3. Processamento (Filtros em Cascata)
  const baseFilteredOrders = useProductionFilter(
    orders,
    filterText,
    "all",
    findCatalogItem
  );

  const finalFilteredOrders = baseFilteredOrders.filter((order) => {
    if (!ageFilter) return true;

    const now = new Date();
    const created = order.customCreatedAt
      ? new Date(order.customCreatedAt)
      : order.createdAt?.toDate
      ? order.createdAt.toDate()
      : new Date();

    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (ageFilter.min !== undefined && diffDays < ageFilter.min) return false;
    if (ageFilter.max !== undefined && diffDays > ageFilter.max) return false;

    return true;
  });

  const groupedOrders = useProductionGrouping(finalFilteredOrders, groupBy);

  // --- HANDLERS COM LOGS ---

  // 1. TRÂNSITO EM MASSA
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
      const updatePromises = Array.from(selectedOrders).map(async (orderId) => {
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;

        await productionService.toggleTransit(order.id, direction, user?.name);

        // LOG
        await logAction(
          getSafeUser(user),
          MODULES.PRODUCAO,
          "TRANSITO_MASSA",
          `Lote: Marcou ${label} - Item ${order.sku}`,
          { itemId: order.id, sku: order.sku, direction }
        );
      });

      await Promise.all(updatePromises);
      setSelectedOrders(new Set());
      alert(`Trânsito atualizado para ${selectedOrders.size} itens!`);
    } catch (error) {
      console.error("Erro no trânsito em massa:", error);
      alert("Erro ao atualizar alguns itens.");
    }
  };

  // 2. MOVER STATUS INDIVIDUAL
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

      // LOG
      await logAction(
        getSafeUser(user),
        MODULES.PRODUCAO,
        "MOVER_STATUS",
        `Moveu ${order.sku} de "${order.status}" para "${newStatus}"`,
        { itemId: orderId, oldStatus: order.status, newStatus }
      );
    } catch (error) {
      alert("Erro ao mover: " + error.message);
    }
  };

  // 3. EXCLUIR PEDIDO
  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Excluir pedido ${order.order?.number || order.sku}?`))
      return;
    try {
      await productionService.deleteOrder(order.id);

      // LOG
      await logAction(
        getSafeUser(user),
        MODULES.PRODUCAO,
        "EXCLUIR_PEDIDO",
        `Excluiu definitivamente o pedido ${order.sku}`,
        { itemId: order.id, sku: order.sku, data: order }
      );
    } catch (error) {
      alert("Erro ao excluir: " + error.message);
    }
  };

  // 4. TOGGLE TRÂNSITO INDIVIDUAL
  const handleToggleTransit = async (order, direction) => {
    try {
      const newStatus = order.transit_status === direction ? null : direction;
      await productionService.toggleTransit(order.id, newStatus, user?.name);

      // LOG
      const actionText = newStatus
        ? `Marcou trânsito: ${newStatus === "subindo" ? "SUBINDO" : "DESCENDO"}`
        : "Removeu marcação de trânsito";

      await logAction(
        getSafeUser(user),
        MODULES.PRODUCAO,
        "TRANSITO",
        `${actionText} - Item ${order.sku}`,
        { itemId: order.id, newStatus }
      );
    } catch (error) {
      alert("Erro no trânsito: " + error.message);
    }
  };

  // 5. IMPRESSÃO EM LOTE
  const handleBatchPrint = async () => {
    if (selectedOrders.size === 0) return;
    const items = orders.filter((o) => selectedOrders.has(o.id));
    const text = formatProductionTicket(items);
    setPrintContent(text);

    await productionService.markBatchAsPrinted(Array.from(selectedOrders));

    // LOG
    await logAction(
      getSafeUser(user),
      MODULES.PRODUCAO,
      "IMPRIMIR_LOTE",
      `Gerou ticket de produção para ${items.length} itens`,
      { itemIds: Array.from(selectedOrders) }
    );

    setSelectedOrders(new Set());
  };

  // 6. MOVER EM MASSA
  const handleBatchMove = async (newStatus) => {
    if (!newStatus) return;
    const label = PRODUCTION_STATUS_CONFIG[newStatus]?.label || newStatus;
    const confirmMessage = `Tem certeza que deseja mover ${selectedOrders.size} pedidos para "${label}"?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const promises = Array.from(selectedOrders).map(async (orderId) => {
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          await productionService.updateStatus(
            orderId,
            newStatus,
            order.status,
            user?.name || "Admin"
          );

          // LOG INDIVIDUAL
          await logAction(
            getSafeUser(user),
            MODULES.PRODUCAO,
            "MOVER_MASSA",
            `Lote: Moveu ${order.sku} para ${label}`,
            { itemId: orderId, oldStatus: order.status, newStatus }
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

  // 7. SALVAR SPECS (EDIÇÃO)
  const handleSaveSpecs = async (data) => {
    try {
      await productionService.updateSpecs(data.id, data.specs, user?.name);

      // LOG
      await logAction(
        getSafeUser(user),
        MODULES.PRODUCAO,
        "EDITAR_SPECS",
        `Editou especificações do item ${data.id}`,
        { itemId: data.id, newSpecs: data.specs }
      );

      setEditingOrder(null);
    } catch (error) {
      alert("Erro ao salvar specs: " + error.message);
    }
  };

  // 8. ATUALIZAR DATA
  const handleUpdateDate = async (orderId, newDate) => {
    try {
      await productionService.updateOrderField(
        orderId,
        "customCreatedAt",
        newDate,
        user?.name || "Admin"
      );

      // LOG
      await logAction(
        getSafeUser(user),
        MODULES.PRODUCAO,
        "ALTERAR_DATA",
        `Alterou data do pedido ${orderId} para ${newDate}`,
        { itemId: orderId, newDate }
      );
    } catch (error) {
      alert("Erro ao atualizar data: " + error.message);
    }
  };

  // --- OUTROS HANDLERS DE UI ---
  const handleChartClick = (range) => {
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

          {KANBAN_ORDER.map((statusId) => {
            const config = PRODUCTION_STATUS_CONFIG[statusId];
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

        {/* TOPO */}
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-4">
          <div className="w-full hidden sm:block">
            <AgeChart
              orders={baseFilteredOrders}
              onBarClick={handleChartClick}
              activeFilter={ageFilter}
            />
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

          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
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

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="hidden sm:block text-xs font-bold text-slate-400 uppercase tracking-wide pt-2">
                Modo Lista
              </div>

              {/* BARRA DE AÇÕES EM MASSA FLUTUANTE */}
              {selectedOrders.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-slide-up border border-slate-700">
                  <span className="font-bold text-sm bg-slate-700 px-3 py-1 rounded-full">
                    {selectedOrders.size} selecionados
                  </span>

                  <div className="h-6 w-px bg-slate-600"></div>

                  <div className="flex items-center bg-white/10 rounded-lg overflow-hidden h-8">
                    <select
                      className="pl-2 pr-4 py-1 text-sm bg-transparent outline-none cursor-pointer text-white font-bold h-full appearance-none hover:bg-white/20 transition-colors"
                      onChange={(e) => handleBatchMove(e.target.value)}
                      value=""
                    >
                      <option value="" disabled className="text-slate-800">
                        Mover para...
                      </option>
                      {KANBAN_ORDER.map((statusKey) => (
                        <option
                          key={statusKey}
                          value={statusKey}
                          className="text-slate-800"
                        >
                          {PRODUCTION_STATUS_CONFIG[statusKey]?.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkTransit("descendo")}
                      className="flex items-center gap-2 hover:text-orange-400 transition-colors group"
                      title="Enviar para Fábrica"
                    >
                      <ArrowDownCircle
                        size={24}
                        className="group-hover:animate-bounce"
                      />
                    </button>

                    <button
                      onClick={() => handleBulkTransit("subindo")}
                      className="flex items-center gap-2 hover:text-indigo-400 transition-colors group"
                      title="Enviar para Escritório"
                    >
                      <ArrowUpCircle
                        size={24}
                        className="group-hover:animate-bounce"
                      />
                    </button>
                  </div>

                  <div className="h-6 w-px bg-slate-600"></div>

                  <button
                    onClick={handleBatchPrint}
                    className="hover:text-blue-400 transition-colors"
                    title="Imprimir Selecionados"
                  >
                    <Printer size={20} />
                  </button>

                  <button
                    onClick={() => setSelectedOrders(new Set())}
                    className="ml-2 hover:bg-slate-700 p-1 rounded-full text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LISTA */}
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
