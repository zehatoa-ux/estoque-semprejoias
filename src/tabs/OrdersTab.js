import React, { useState, useMemo } from "react";
import {
  ChevronRight,
  Package,
  Truck,
  Calendar,
  DollarSign,
  User,
  Search,
  Printer,
  Edit2,
  Pencil,
  ArrowRightLeft,
  Trash2,
  Archive,
  MapPin,
  Filter,
  Factory,
} from "lucide-react";

import { formatMoney } from "../utils/formatters";
import ProductionConversionModal from "../components/modals/ProductionConversionModal";
import OrderEditModal from "../components/modals/OrderEditModal";
import OrderMoveModal from "../components/modals/OrderMoveModal";
import { generateCertificatePDF } from "../utils/certificateGenerator";
import { useOrderProcessing } from "../hooks/useOrderProcessing";
import { useOrdersData } from "../hooks/useOrdersData";
import { useOrderActions } from "../hooks/useOrderActions";

// Configs
import {
  LOGISTICS_STATUS_CONFIG,
  LOGISTICS_ORDER,
} from "../config/logisticsStatuses";
import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../config/productionStatuses";
import { canArchiveOrder, canDeleteOrder } from "../utils/logisticsLogic";

export default function OrdersTab({ findCatalogItem }) {
  // --- ESTADOS ---
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // Filtros Globais
  const [activeStatusFilter, setActiveStatusFilter] = useState("all"); // Sidebar (Logístico)
  const [filterUF, setFilterUF] = useState("all"); // Novo: Estado
  const [filterProdStatus, setFilterProdStatus] = useState("all"); // Novo: Status Prod.

  const actions = useOrderActions();

  // Modais
  const [editingItem, setEditingItem] = useState(null);
  const [movingItem, setMovingItem] = useState(null);
  const [editingOrderGroup, setEditingOrderGroup] = useState(null);

  // Dados
  const { rawData } = useOrdersData();

  // Processamento Base (Busca Textual + Agrupamento)
  const groupedOrders = useOrderProcessing(
    rawData,
    searchTerm,
    "all",
    findCatalogItem
  );

  // --- HELPER: CAÇADOR DE UF ---
  // (Precisamos definir isso antes de usar no useMemo dos filtros)
  const getOrderUF = (group) => {
    if (group.customerState) return group.customerState;
    const item = group.items?.[0];
    if (!item) return "-";
    if (item.shipping?.address?.statecode)
      return item.shipping.address.statecode;
    if (item.shipping?.address?.state) return item.shipping.address.state;
    if (item.order?.shipping_address?.state)
      return item.order.shipping_address.state;
    if (item.order?.customer?.state) return item.order.customer.state;
    return "-";
  };

  // --- LISTA DE UFS DISPONÍVEIS (Dinâmica) ---
  const availableUFs = useMemo(() => {
    const ufs = new Set();
    groupedOrders.forEach((g) => {
      const uf = getOrderUF(g);
      if (uf && uf !== "-" && uf.length === 2) ufs.add(uf.toUpperCase());
    });
    return Array.from(ufs).sort();
  }, [groupedOrders]);

  // --- FILTRAGEM FINAL COMBINADA ---
  const displayedOrders = useMemo(() => {
    // 1. Filtro da Sidebar (Status Logístico)
    let data =
      activeStatusFilter === "all"
        ? groupedOrders
        : groupedOrders.filter((g) => g.logisticsStatus === activeStatusFilter);

    // 2. Filtro de UF
    if (filterUF !== "all") {
      data = data.filter((g) => getOrderUF(g) === filterUF);
    }

    // 3. Filtro de Status de Produção (Se algum item do pedido tiver esse status)
    if (filterProdStatus !== "all") {
      data = data.filter((g) =>
        g.items.some((i) => i.status === filterProdStatus)
      );
    }

    return data;
  }, [groupedOrders, activeStatusFilter, filterUF, filterProdStatus]);

  // Contagens para a Sidebar (Baseado nos dados brutos da busca, sem filtrar UF/Prod ainda, para mostrar o panorama)
  const statusCounts = useMemo(() => {
    return groupedOrders.reduce((acc, order) => {
      const status = order.logisticsStatus || "OUTROS";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [groupedOrders]);

  // --- ACTIONS ---
  const toggleExpand = (orderNum) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderNum)) newSet.delete(orderNum);
    else newSet.add(orderNum);
    setExpandedOrders(newSet);
  };

  const toggleSelection = (itemId) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) newSet.delete(itemId);
    else newSet.add(itemId);
    setSelectedItems(newSet);
  };

  const handleMoveItem = async (itemIdFromModal, formData) => {
    if (!formData) return;
    const inputNumber = formData.orderNumber;
    const inputName = formData.customerName;
    let finalName = inputName;

    if (!finalName && inputNumber) {
      const existingOrder = groupedOrders.find(
        (g) => String(g.orderNumber) === String(inputNumber)
      );
      if (existingOrder) finalName = existingOrder.customerName;
    }

    const finalData = {
      orderNumber: inputNumber || "AVULSO",
      customerName: finalName || "Cliente Balcão",
    };

    const success = await actions.moveItem(itemIdFromModal, finalData);
    if (success) setMovingItem(null);
  };

  const handleUpdateOrder = async (newData) => {
    if (!editingOrderGroup) return;
    const success = await actions.saveOrderDetails(
      editingOrderGroup.items,
      newData
    );
    if (success) setEditingOrderGroup(null);
  };

  const handleSaveEditItem = async (updatedData) => {
    const success = await actions.saveItemSpecs(editingItem, updatedData);
    if (success) setEditingItem(null);
  };

  const handlePrintCertificates = async () => {
    const itemsToPrint = Array.from(selectedItems)
      .map(
        (id) =>
          rawData.find((i) => i.id === id) ||
          groupedOrders.flatMap((g) => g.items).find((i) => i.id === id)
      )
      .filter(Boolean);

    if (itemsToPrint.length === 0)
      return alert("Selecione itens para imprimir.");

    const successPDF = generateCertificatePDF(itemsToPrint, findCatalogItem);
    if (successPDF) {
      await actions.markAsPrinted(itemsToPrint);
      setSelectedItems(new Set());
    }
  };

  return (
    // 1. CONTAINER: Coluna no Mobile, Linha no PC
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
      {/* --- MODAIS (Mantidos iguais) --- */}
      {editingItem && (
        <ProductionConversionModal
          isOpen={!!editingItem}
          reservation={editingItem}
          isEditing={true}
          findCatalogItem={findCatalogItem}
          onClose={() => setEditingItem(null)}
          onConfirm={handleSaveEditItem}
        />
      )}
      {movingItem && (
        <OrderMoveModal
          isOpen={!!movingItem}
          item={movingItem}
          onClose={() => setMovingItem(null)}
          onConfirm={handleMoveItem}
        />
      )}
      {editingOrderGroup && (
        <OrderEditModal
          isOpen={!!editingOrderGroup}
          orderGroup={editingOrderGroup}
          onClose={() => setEditingOrderGroup(null)}
          onSave={handleUpdateOrder}
        />
      )}

      {/* --- SIDEBAR LATERAL (VISÍVEL APENAS NO DESKTOP) --- */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 z-10 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <Truck size={18} /> Logística
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {/* Botão TODOS */}
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
              {groupedOrders.length}
            </span>
          </button>

          <div className="h-px bg-slate-200 my-2"></div>

          {/* Lista de Status Logístico */}
          {LOGISTICS_ORDER.map((statusId) => {
            const config = LOGISTICS_STATUS_CONFIG[statusId];
            const count = statusCounts[statusId] || 0;
            const isActive = activeStatusFilter === statusId;

            return (
              <button
                key={statusId}
                onClick={() =>
                  setActiveStatusFilter(isActive ? "all" : statusId)
                }
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex justify-between items-center border border-transparent ${
                  isActive
                    ? `shadow-md ring-1 ring-slate-300 bg-white border-l-4 border-l-blue-500`
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                style={
                  isActive ? { borderLeftColor: config?.hex || "blue" } : {}
                }
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      config?.color
                        ? config.color.split(" ")[0].replace("bg-", "bg-")
                        : "bg-gray-400"
                    }`}
                  ></div>
                  <span className={isActive ? "text-slate-900" : ""}>
                    {statusId}
                  </span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    isActive
                      ? "bg-slate-100 text-slate-700"
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

      {/* --- ÁREA PRINCIPAL (DIREITA) --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* ===> MENU MOBILE (NOVO: APARECE NO TOPO DO MAIN NO CELULAR) <=== */}
        <div className="md:hidden bg-slate-100 border-b border-slate-200 p-3 shrink-0 z-20">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <Truck size={12} /> Filtrar Status Logístico:
          </label>
          <div className="relative">
            <select
              value={activeStatusFilter}
              onChange={(e) => setActiveStatusFilter(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-300 text-slate-800 text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="all">VISÃO GERAL ({groupedOrders.length})</option>
              {LOGISTICS_ORDER.map((statusId) => (
                <option key={statusId} value={statusId}>
                  {statusId} ({statusCounts[statusId] || 0})
                </option>
              ))}
            </select>
            {/* Ícone seta */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <Filter size={14} />
            </div>
          </div>
        </div>
        {/* =============================================================== */}

        {/* TOPO DA TAB: Busca + Filtros Secundários + Ações */}
        <div className="bg-white border-b border-slate-200 p-4 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center shrink-0">
          {/* Grupo de Filtros */}
          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1">
            {/* 1. Busca Texto */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar pedido, cliente, SKU..."
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Container flex para os selects no mobile ficarem lado a lado se der */}
            <div className="flex gap-2 w-full md:w-auto">
              {/* 2. Filtro UF */}
              <div className="relative flex-1 md:min-w-[100px]">
                <MapPin
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <select
                  className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm w-full outline-none appearance-none bg-white cursor-pointer hover:border-blue-400 focus:border-blue-500 font-bold text-slate-600"
                  value={filterUF}
                  onChange={(e) => setFilterUF(e.target.value)}
                >
                  <option value="all">UF</option>
                  {availableUFs.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                <Filter
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={12}
                />
              </div>

              {/* 3. Filtro Status Produção */}
              <div className="relative flex-[1.5] md:min-w-[180px]">
                <Factory
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <select
                  className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm w-full outline-none appearance-none bg-white cursor-pointer hover:border-blue-400 focus:border-blue-500 font-bold text-slate-600"
                  value={filterProdStatus}
                  onChange={(e) => setFilterProdStatus(e.target.value)}
                >
                  <option value="all">Prod: Todos</option>
                  {KANBAN_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {PRODUCTION_STATUS_CONFIG[status]?.label || status}
                    </option>
                  ))}
                </select>
                <Filter
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={12}
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          {selectedItems.size > 0 && (
            <button
              onClick={handlePrintCertificates}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition-colors shadow-sm animate-fade-in whitespace-nowrap w-full md:w-auto justify-center"
            >
              <Printer size={16} /> Imprimir Certificados ({selectedItems.size})
            </button>
          )}
        </div>

        {/* LISTA DE PEDIDOS (Scrollável) */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-slate-50/50">
          {displayedOrders.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Package size={48} className="mx-auto mb-2 opacity-20" />
              <p>Nenhum pedido encontrado nesta visão.</p>
              {(filterUF !== "all" || filterProdStatus !== "all") && (
                <button
                  onClick={() => {
                    setFilterUF("all");
                    setFilterProdStatus("all");
                  }}
                  className="text-blue-500 hover:underline text-sm mt-2"
                >
                  Limpar filtros avançados
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-20">
              {(activeStatusFilter === "all"
                ? LOGISTICS_ORDER
                : [activeStatusFilter]
              ).map((statusLabel) => {
                // Filtra apenas os pedidos que pertencem a este grupo logístico E passaram pelos filtros globais
                const ordersInGroup = displayedOrders.filter(
                  (g) => g.logisticsStatus === statusLabel
                );

                if (ordersInGroup.length === 0) return null;

                const config = LOGISTICS_STATUS_CONFIG[statusLabel] || {};
                const headerColorClass = config.color
                  ? config.color.split(" ")[0]
                  : "bg-slate-100";
                const headerTextClass = config.color
                  ? config.color.split(" ")[1]
                  : "text-slate-700";

                return (
                  <div key={statusLabel} className="space-y-3">
                    {/* Cabeçalho do Grupo */}
                    <div
                      className={`px-4 py-2 rounded-lg flex justify-between items-center ${headerColorClass} border border-transparent shadow-sm`}
                    >
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-bold text-sm uppercase ${headerTextClass}`}
                        >
                          {statusLabel}
                        </h3>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded bg-white/50 ${headerTextClass}`}
                      >
                        {ordersInGroup.length}
                      </span>
                    </div>

                    {/* Cards de Pedidos */}
                    <div className="space-y-3 pl-1 md:pl-2">
                      {ordersInGroup.map((group) => {
                        const isExpanded = expandedOrders.has(
                          group.orderNumber
                        );
                        const uf = getOrderUF(group);

                        return (
                          <div
                            key={group.orderNumber}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
                          >
                            {/* LINHA DE RESUMO */}
                            <div
                              className={`p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer ${
                                isExpanded ? "bg-slate-50" : "bg-white"
                              }`}
                              onClick={() => toggleExpand(group.orderNumber)}
                            >
                              {/* 1. Pedido e Cliente */}
                              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                                <div
                                  className={`p-1 rounded transition-transform ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
                                >
                                  <ChevronRight
                                    size={18}
                                    className="text-slate-400"
                                  />
                                </div>

                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    Pedido
                                  </span>
                                  <span className="text-blue-600 font-bold text-sm">
                                    #{group.orderNumber}
                                  </span>
                                </div>

                                <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>

                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    Cliente
                                  </span>
                                  <div className="flex items-center gap-1 truncate">
                                    <User
                                      size={12}
                                      className="text-slate-400"
                                    />
                                    <span className="font-bold text-slate-700 truncate text-sm">
                                      {group.customerName}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 2. UF e Frete */}
                              <div className="flex items-center gap-2 w-full md:w-auto pl-8 md:pl-0">
                                {/* UF */}
                                <div
                                  className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border border-slate-200 uppercase"
                                  title="Estado"
                                >
                                  <MapPin size={10} />
                                  {uf}
                                </div>

                                {/* Método de Envio */}
                                <div
                                  className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200 truncate max-w-[100px]"
                                  title="Forma de Envio"
                                >
                                  {group.shippingMethod || "Retirada"}
                                </div>
                              </div>

                              {/* 3. Status (Dropdown) */}
                              <div
                                className="w-full md:w-32 pl-8 md:pl-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <select
                                  className="w-full text-xs font-bold px-2 py-1.5 rounded border border-slate-300 bg-white outline-none cursor-pointer hover:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  value={group.logisticsStatus}
                                  onChange={(e) =>
                                    actions.updateLogisticsStatus(
                                      group,
                                      e.target.value
                                    )
                                  }
                                >
                                  {LOGISTICS_ORDER.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 4. Meta Info */}
                              <div className="flex items-center gap-4 justify-between md:justify-end text-sm md:w-auto w-full border-t md:border-t-0 pt-2 md:pt-0 mt-2 md:mt-0 pl-8 md:pl-0">
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    Data
                                  </span>
                                  <span className="font-medium text-slate-600 flex items-center gap-1">
                                    <Calendar size={12} />{" "}
                                    {group.date.toLocaleDateString("pt-BR")}
                                  </span>
                                </div>

                                <div className="flex flex-col items-end w-20">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    Total
                                  </span>
                                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                                    <DollarSign size={12} />{" "}
                                    {formatMoney(group.totalValue)}
                                  </span>
                                </div>

                                {/* Botões de Ação */}
                                <div
                                  className="flex items-center gap-1 pl-2 border-l border-slate-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {canArchiveOrder(group) && (
                                    <button
                                      onClick={() =>
                                        actions.archiveOrder(group)
                                      }
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                      title="Arquivar"
                                    >
                                      <Archive size={16} />
                                    </button>
                                  )}

                                  {canDeleteOrder(group) && (
                                    <button
                                      onClick={() => actions.deleteOrder(group)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                      title="Excluir"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setEditingOrderGroup(group)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Editar Dados"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* LISTA DE ITENS (EXPANDIDO) */}
                            {isExpanded && (
                              <div className="border-t border-slate-200 bg-slate-50/50 p-4 animate-slide-in">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                                  <Package size={12} /> Itens do Pedido (
                                  {group.items.length})
                                </h4>

                                <div className="space-y-2">
                                  {group.items.map((subItem) => {
                                    const statusConf = PRODUCTION_STATUS_CONFIG[
                                      subItem.status
                                    ] || { color: "bg-gray-200 text-gray-700" };
                                    const isSelected = selectedItems.has(
                                      subItem.id
                                    );

                                    return (
                                      <div
                                        key={subItem.id}
                                        className={`flex flex-col md:flex-row md:items-center justify-between p-2 rounded bg-white border ${
                                          isSelected
                                            ? "border-blue-400 ring-1 ring-blue-100"
                                            : "border-slate-200"
                                        } transition-all gap-2`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                            checked={isSelected}
                                            onChange={() =>
                                              toggleSelection(subItem.id)
                                            }
                                          />

                                          <div className="flex gap-1">
                                            <button
                                              onClick={() =>
                                                setEditingItem(subItem)
                                              }
                                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                              <Edit2 size={14} />
                                            </button>
                                            <button
                                              onClick={() =>
                                                setMovingItem(subItem)
                                              }
                                              className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                            >
                                              <ArrowRightLeft size={14} />
                                            </button>
                                          </div>

                                          <div className="flex gap-1">
                                            {subItem.fromStock && (
                                              <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1 rounded cursor-help">
                                                E
                                              </span>
                                            )}
                                            {subItem.printed && (
                                              <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1 rounded cursor-help">
                                                I
                                              </span>
                                            )}
                                            {subItem.certificatePrinted && (
                                              <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1 rounded cursor-help">
                                                C
                                              </span>
                                            )}
                                          </div>

                                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                            {subItem.sku}
                                          </span>

                                          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                                            {subItem.specs?.stoneType && (
                                              <span className="bg-slate-100 px-1.5 rounded">
                                                {subItem.specs.stoneType}
                                              </span>
                                            )}
                                            {subItem.specs?.size && (
                                              <span className="bg-slate-100 px-1.5 rounded">
                                                Aro {subItem.specs.size}
                                              </span>
                                            )}
                                            {subItem.specs?.stoneColor &&
                                              subItem.specs.stoneColor !==
                                                "ND" && (
                                                <span className="bg-pink-50 text-pink-700 px-1.5 rounded border border-pink-100">
                                                  {subItem.specs.stoneColor}
                                                </span>
                                              )}
                                          </div>
                                        </div>

                                        <select
                                          className={`text-[10px] font-bold px-2 py-1 rounded uppercase cursor-pointer outline-none text-center w-full md:w-auto ${statusConf.color}`}
                                          value={subItem.status}
                                          onChange={(e) =>
                                            actions.updateItemStatus(
                                              subItem.id,
                                              e.target.value
                                            )
                                          }
                                        >
                                          {KANBAN_ORDER.map((key) => (
                                            <option
                                              key={key}
                                              value={key}
                                              className="bg-white text-slate-800 font-normal"
                                            >
                                              {PRODUCTION_STATUS_CONFIG[key]
                                                ?.label || key}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
