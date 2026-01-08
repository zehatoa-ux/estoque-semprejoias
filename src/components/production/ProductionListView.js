import React, { useState } from "react";
import {
  CheckSquare,
  Edit3,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Check,
  Square,
  X,
  User,
  Ruler,
  Gem,
  PenTool,
  AlertCircle, // Ícone para avisar dos status extras
} from "lucide-react";
import DaysBadge from "./DaysBadge";
import TransitToggle from "./TransitToggle";
import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../../config/productionStatuses";

// Helper de Data
const getIsoDate = (val) => {
  if (!val) return "";
  if (val.toDate) return val.toDate().toISOString().split("T")[0];
  if (typeof val === "string") return val.split("T")[0];
  return "";
};

// Helper Anti-ND
const hasValue = (val) => {
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  return s !== "" && s !== "ND" && s !== "-" && s !== "N/A";
};

export default function ProductionListView({
  groupedOrders,
  selectedOrders,
  toggleSelect,
  setSelectSet,
  setEditingOrder,
  handleDeleteOrder,
  handleMoveStatus,
  findCatalogItem,
  onToggleTransit,
  onUpdateDate,
}) {
  const [editingDateId, setEditingDateId] = useState(null);
  const [tempDate, setTempDate] = useState("");

  const startEditing = (e, order) => {
    e.stopPropagation();
    setEditingDateId(order.id);
    setTempDate(getIsoDate(order.customCreatedAt || order.createdAt));
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingDateId(null);
    setTempDate("");
  };

  const saveDate = async (e, orderId) => {
    e.stopPropagation();
    if (onUpdateDate) await onUpdateDate(orderId, tempDate);
    setEditingDateId(null);
  };

  // --- LÓGICA DE SEGURANÇA (Para mostrar pedidos com status desconhecido) ---
  // 1. Identifica quais chaves do agrupamento NÃO estão na configuração oficial
  const allStatusKeys = Object.keys(groupedOrders);
  const orphanStatuses = allStatusKeys.filter(
    (status) =>
      !KANBAN_ORDER.includes(status) && groupedOrders[status].length > 0
  );

  // Função auxiliar para renderizar uma linha (para não repetir código)
  const renderOrderRow = (order, isSelected) => {
    const isEditingDate = editingDateId === order.id;
    const catalog = findCatalogItem ? findCatalogItem(order.sku) : null;
    const isNatural = order.specs?.stoneType === "Natural";

    const isDivergent =
      hasValue(order.specs?.standardColor) &&
      hasValue(order.specs?.stoneColor) &&
      order.specs.standardColor !== "MANUAL" &&
      order.specs.standardColor.toUpperCase() !==
        order.specs.stoneColor.toUpperCase();

    const showSize = hasValue(order.specs?.size);
    const showColor = hasValue(order.specs?.stoneColor);
    const showMainSpecs = showSize || showColor;

    return (
      <div
        key={order.id}
        className={`
          relative group transition-all hover:bg-slate-50
          ${isSelected ? "bg-purple-50/70" : "bg-white"}
        `}
      >
        <div className="p-4 grid grid-cols-1 md:grid-cols-[40px_100px_1.8fr_2fr_1.2fr_120px_auto] gap-4 items-center">
          {/* 1. CHECKBOX */}
          <div className="flex justify-start">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              checked={isSelected}
              onChange={() => toggleSelect(order.id)}
            />
          </div>

          {/* 2. DATA */}
          <div className="text-center flex justify-center">
            {isEditingDate ? (
              <div className="flex flex-col gap-1 items-center bg-white p-2 rounded-lg border shadow-lg absolute z-20 top-0 left-10 md:static animate-in fade-in zoom-in duration-200">
                <input
                  type="date"
                  className="text-xs p-1 border rounded font-mono bg-slate-50 outline-none focus:border-purple-500"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                />
                <div className="flex gap-2 w-full mt-1">
                  <button
                    onClick={(e) => saveDate(e, order.id)}
                    className="flex-1 bg-emerald-100 text-emerald-700 p-1 rounded hover:bg-emerald-200 flex justify-center transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="flex-1 bg-red-100 text-red-700 p-1 rounded hover:bg-red-200 flex justify-center transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="group/date relative cursor-pointer"
                onClick={(e) => startEditing(e, order)}
              >
                <DaysBadge date={order.customCreatedAt || order.createdAt} />
                <div className="opacity-0 group-hover/date:opacity-100 transition-opacity absolute -top-2 -right-2 bg-white rounded-full shadow-sm border border-slate-200 p-1 text-blue-500 hidden md:block">
                  <Edit3 size={10} />
                </div>
              </div>
            )}
          </div>

          {/* 3. PRODUTO */}
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              {order.isInterceptedPE && (
                <span className="bg-orange-100 text-orange-700 text-[9px] px-1.5 rounded font-bold border border-orange-200 flex items-center gap-1">
                  <Layers size={10} /> INTERCEPTADO
                </span>
              )}
              {order.fromStock && !order.isPE && !order.isInterceptedPE && (
                <span className="bg-emerald-600 text-white text-[9px] px-1.5 rounded font-bold shadow-sm">
                  ESTOQUE
                </span>
              )}
              {order.isPE && !order.isInterceptedPE && (
                <span className="bg-purple-600 text-white text-[9px] px-1.5 rounded font-bold flex items-center gap-1 shadow-sm">
                  <Layers size={10} /> PE
                </span>
              )}
              <span className="font-black text-slate-800 text-sm tracking-tight">
                {order.sku}
              </span>
            </div>
            <p
              className="text-xs text-slate-500 line-clamp-1 font-medium"
              title={catalog?.name}
            >
              {catalog?.name || "Carregando..."}
            </p>
          </div>

          {/* 4. SPECS */}
          <div className="flex flex-col gap-2 justify-center">
            {showMainSpecs && (
              <div className="flex items-center gap-3 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 w-fit shadow-sm">
                {showSize && (
                  <div
                    className="flex items-center gap-1.5"
                    title="Tamanho do Aro"
                  >
                    <Ruler size={14} className="text-slate-400" />
                    <span className="font-bold text-xs text-slate-700">
                      {order.specs.size}
                    </span>
                  </div>
                )}
                {showSize && showColor && (
                  <div className="h-3 w-px bg-slate-300"></div>
                )}
                {showColor && (
                  <div
                    className={`flex items-center gap-1.5 font-bold text-xs ${
                      isDivergent ? "text-amber-600" : "text-slate-700"
                    }`}
                    title={
                      isDivergent ? "Diferente do padrão!" : "Cor da Pedra"
                    }
                  >
                    <Gem
                      size={14}
                      className={
                        isDivergent ? "text-amber-500" : "text-purple-400"
                      }
                    />
                    <span className="uppercase tracking-tight">
                      {order.specs.stoneColor}
                    </span>
                    {isDivergent && (
                      <AlertTriangle
                        size={12}
                        className="text-amber-500 animate-pulse"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 items-center">
              {hasValue(order.specs?.stoneBatch) && (
                <span
                  className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-mono border border-blue-100 flex items-center gap-1"
                  title="Lote"
                >
                  <span className="opacity-50">#</span>
                  {order.specs.stoneBatch}
                </span>
              )}
              {hasValue(order.specs?.finishing) && (
                <span
                  className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] border border-slate-200"
                  title="Acabamento"
                >
                  {order.specs.finishing}
                </span>
              )}
              {isNatural && (
                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-bold border border-indigo-100 flex items-center gap-1">
                  <ShieldCheck size={10} /> Natural
                </span>
              )}
            </div>
            {hasValue(order.specs?.engraving) && (
              <div className="flex items-start gap-1.5 text-xs text-purple-800 bg-purple-50 px-2 py-1 rounded-md border border-purple-100 w-fit max-w-full">
                <PenTool
                  size={10}
                  className="mt-0.5 shrink-0 text-purple-400"
                />
                <span className="italic font-medium break-words leading-tight">
                  "{order.specs.engraving}"
                </span>
              </div>
            )}
          </div>

          {/* 5. CLIENTE */}
          <div className="flex flex-col justify-center text-sm">
            <div className="font-bold text-slate-700 flex items-center gap-1.5">
              <User size={14} className="text-slate-400 shrink-0" />
              <span
                className="truncate max-w-[140px]"
                title={order.order?.customer?.name}
              >
                {order.order?.customer?.name || order.customerName || "Balcão"}
              </span>
            </div>
            {hasValue(order.order?.number) && (
              <div className="text-xs text-slate-400 flex items-center gap-1 mt-1 ml-5">
                <span className="font-mono bg-slate-50 border border-slate-100 px-1.5 rounded text-slate-500">
                  #{order.order.number}
                </span>
              </div>
            )}
          </div>

          {/* 6. STATUS */}
          <div>
            <select
              className={`
                w-full text-[10px] font-bold uppercase p-2 rounded-lg border cursor-pointer outline-none focus:ring-2 focus:ring-purple-200 transition-all appearance-none text-center
                ${
                  order.status === "CANCELADO"
                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800 shadow-sm"
                }
              `}
              value={order.status}
              onChange={(e) => handleMoveStatus(order.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Opções Padrão */}
              {KANBAN_ORDER.map((s) => (
                <option key={s} value={s}>
                  {PRODUCTION_STATUS_CONFIG[s]?.label || s}
                </option>
              ))}
              {/* Se o status atual não estiver na lista padrão, adiciona ele para não quebrar o select */}
              {!KANBAN_ORDER.includes(order.status) && (
                <option value={order.status}>
                  ⚠ {order.status} (Desconhecido)
                </option>
              )}
            </select>
          </div>

          {/* 7. AÇÕES */}
          <div className="flex justify-end gap-1 items-center opacity-80 group-hover:opacity-100 transition-opacity">
            <TransitToggle order={order} onToggle={onToggleTransit} />
            <div className="w-px h-5 bg-slate-200 mx-2 hidden md:block"></div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingOrder(order);
              }}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Editar Pedido"
            >
              <Edit3 size={16} />
            </button>
            {order.status === "CANCELADO" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteOrder(order);
                }}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1"
                title="Excluir Definitivamente"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 w-full pb-20 animate-fade-in">
      {/* 1. SEÇÕES PADRÃO (KANBAN) */}
      {KANBAN_ORDER.map((statusId) => {
        const items = groupedOrders[statusId] || [];
        if (items.length === 0) return null;

        const config = PRODUCTION_STATUS_CONFIG[statusId] || {
          label: statusId,
          color: "bg-slate-500 text-white",
        };

        const allSelected = items.every((order) =>
          selectedOrders.has(order.id)
        );

        const toggleGroup = () => {
          const newSet = new Set(selectedOrders);
          if (allSelected) items.forEach((i) => newSet.delete(i.id));
          else items.forEach((i) => newSet.add(i.id));

          if (setSelectSet) setSelectSet(newSet);
          else items.forEach((i) => toggleSelect(i.id));
        };

        return (
          <div
            key={statusId}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div
              className={`px-4 py-3 flex justify-between items-center ${config.color}`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleGroup}
                  className="text-white/80 hover:text-white transition-colors"
                  title={allSelected ? "Desmarcar Todos" : "Marcar Todos"}
                >
                  {allSelected ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
                <span className="font-bold text-sm tracking-wide uppercase">
                  {config.label}
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold text-white">
                  {items.length}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((order) => {
                const isSelected = selectedOrders.has(order.id);
                return renderOrderRow(order, isSelected);
              })}
            </div>
          </div>
        );
      })}

      {/* 2. SEÇÕES "ORFÃS" (Status Desconhecidos) */}
      {orphanStatuses.map((statusId) => {
        const items = groupedOrders[statusId];
        // Seleção em grupo para órfãos
        const allSelected = items.every((order) =>
          selectedOrders.has(order.id)
        );
        const toggleGroup = () => {
          const newSet = new Set(selectedOrders);
          if (allSelected) items.forEach((i) => newSet.delete(i.id));
          else items.forEach((i) => newSet.add(i.id));
          if (setSelectSet) setSelectSet(newSet);
          else items.forEach((i) => toggleSelect(i.id));
        };

        return (
          <div
            key={statusId}
            className="bg-red-50 rounded-xl shadow-sm border-2 border-red-200 overflow-hidden animate-pulse-once"
          >
            <div className="bg-red-100 px-4 py-3 flex justify-between items-center text-red-900">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleGroup}
                  className="text-red-700 hover:text-red-900"
                >
                  {allSelected ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} />
                  <span className="font-bold text-sm uppercase">
                    STATUS DESCONHECIDO: "{statusId}"
                  </span>
                </div>
                <span className="bg-white px-2 py-0.5 rounded text-xs font-bold">
                  {items.length}
                </span>
              </div>
            </div>
            <div className="divide-y divide-red-100">
              {items.map((order) => {
                const isSelected = selectedOrders.has(order.id);
                return renderOrderRow(order, isSelected);
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
