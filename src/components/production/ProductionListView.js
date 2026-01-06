import React, { useState } from "react";
import {
  CheckSquare,
  Edit3,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Layers, // Certifique-se de importar o ícone Layers
  Check,
  X,
} from "lucide-react";
import DaysBadge from "./DaysBadge";

import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../../config/productionStatuses";
import TransitToggle from "./TransitToggle";

// Helper para formatar data para o input (YYYY-MM-DD)
const getIsoDate = (val) => {
  if (!val) return "";
  if (val.toDate) return val.toDate().toISOString().split("T")[0];
  if (typeof val === "string" && val.includes("/")) {
    const parts = val.split(" ")[0].split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  if (typeof val === "string") return val.split("T")[0];
  return "";
};

export default function ProductionListView({
  groupedOrders,
  selectedOrders,
  toggleSelect,
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
    if (onUpdateDate) {
      await onUpdateDate(orderId, tempDate);
    }
    setEditingDateId(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {KANBAN_ORDER.map((statusId) => {
        const items = groupedOrders[statusId] || [];
        if (items.length === 0) return null;

        const config = PRODUCTION_STATUS_CONFIG[statusId] || {
          label: statusId,
          color: "bg-gray-500 text-white",
        };

        return (
          <div
            key={statusId}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div
              className={`px-4 py-2 font-bold text-sm flex justify-between items-center ${config.color}`}
            >
              <span>
                {config.label} ({items.length})
              </span>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b">
                <tr>
                  <th className="px-4 py-2 w-10 text-center">
                    <CheckSquare size={14} />
                  </th>
                  <th className="px-4 py-2 w-28 text-center">Prazo / Data</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 w-1/3">Especificações</th>
                  <th className="px-4 py-2">Cliente / Pagamento</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((order) => {
                  const isSelected = selectedOrders.has(order.id);
                  const isEditingDate = editingDateId === order.id;
                  const catalog = findCatalogItem
                    ? findCatalogItem(order.sku)
                    : null;

                  const isDivergent =
                    order.specs?.standardColor &&
                    order.specs?.stoneColor &&
                    order.specs.standardColor !== "MANUAL" &&
                    order.specs.standardColor.toUpperCase() !==
                      order.specs.stoneColor.toUpperCase();

                  const isNatural = order.specs?.stoneType === "Natural";

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50 ${
                        isSelected ? "bg-purple-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>

                      {/* DATA */}
                      <td className="px-4 py-3 text-center align-middle">
                        {isEditingDate ? (
                          <div className="flex items-center gap-1 animate-fade-in">
                            <input
                              type="date"
                              className="w-[110px] text-[10px] p-1 border rounded bg-white shadow-sm"
                              value={tempDate}
                              onChange={(e) => setTempDate(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => saveDate(e, order.id)}
                              className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="bg-red-100 text-red-700 p-1 rounded hover:bg-red-200"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer hover:scale-105 transition-transform relative group"
                            onClick={(e) => startEditing(e, order)}
                          >
                            <DaysBadge
                              date={order.customCreatedAt || order.createdAt}
                            />
                            <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-blue-600 text-white rounded-full p-0.5 shadow-sm transition-opacity">
                              <Edit3 size={8} />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* ITEM (AQUI ADICIONAMOS O INDICADOR) */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* 1. Indicador de Estoque Interceptado (NOVO) */}
                            {order.isInterceptedPE && (
                              <span
                                className="bg-orange-100 text-orange-700 text-[9px] px-1.5 py-0.5 rounded font-bold border border-orange-200 flex items-center gap-1"
                                title="Interceptado da Fábrica de Estoque"
                              >
                                <Layers size={10} /> ESTOQUE FÁBRICA
                              </span>
                            )}

                            {/* 2. Indicador de Estoque Físico Antigo (Mantido) */}
                            {order.fromStock &&
                              !order.isPE &&
                              !order.isInterceptedPE && (
                                <span className="bg-emerald-700 text-white text-[9px] px-1 rounded font-bold">
                                  E
                                </span>
                              )}

                            {/* 3. Indicador de PE Antigo (se ainda usar) */}
                            {order.isPE && !order.isInterceptedPE && (
                              <span className="bg-orange-500 text-white text-[9px] px-1 rounded font-bold flex items-center gap-0.5">
                                <Layers size={8} /> PE
                              </span>
                            )}

                            {/* 4. Indicador de Impresso */}
                            {order.printed && (
                              <span className="bg-amber-400 text-amber-900 text-[9px] px-1 rounded font-bold">
                                I
                              </span>
                            )}

                            <span className="font-bold text-blue-600">
                              {order.sku}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 truncate max-w-[150px]">
                            {catalog?.name || "Carregando..."}
                          </span>
                        </div>
                      </td>

                      {/* ESPECIFICAÇÕES */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          {order.specs?.size && (
                            <span className="bg-slate-100 border px-1 rounded font-bold">
                              Aro: {order.specs.size}
                            </span>
                          )}

                          {order.specs?.stoneColor && (
                            <span
                              className={`bg-slate-100 border px-1 rounded font-bold flex items-center gap-1 ${
                                isDivergent
                                  ? "text-amber-600 border-amber-200"
                                  : ""
                              }`}
                            >
                              Cor: {order.specs.stoneColor}
                              {isDivergent && <AlertTriangle size={10} />}
                            </span>
                          )}

                          {order.specs?.finishing && (
                            <span className="bg-slate-100 border px-1 rounded">
                              Fin: {order.specs.finishing}
                            </span>
                          )}

                          {order.specs?.stoneBatch && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1 rounded font-mono">
                              Lote: {order.specs.stoneBatch}
                            </span>
                          )}

                          {order.specs?.engraving &&
                            order.specs.engraving !== "ND" && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-100 px-1 rounded italic">
                                "{order.specs.engraving}"
                              </span>
                            )}

                          {isNatural && (
                            <span className="text-blue-600 font-bold flex items-center gap-1 animate-pulse">
                              <ShieldCheck size={10} /> Natural
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CLIENTE */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700 text-xs">
                          {order.order?.customer?.name ||
                            order.customerName ||
                            "Balcão"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {order.order?.number ? `#${order.order.number}` : "-"}
                        </div>
                      </td>

                      {/* STATUS DROPDOWN */}
                      <td className="px-4 py-3 text-center">
                        <select
                          className="text-[10px] p-1 border rounded bg-slate-50 max-w-[120px]"
                          value={order.status}
                          onChange={(e) =>
                            handleMoveStatus(order.id, e.target.value)
                          }
                        >
                          {KANBAN_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {PRODUCTION_STATUS_CONFIG[s]?.label || s}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* AÇÕES */}
                      <td className="px-4 py-3 text-center flex justify-center gap-2 items-center">
                        <TransitToggle
                          order={order}
                          onToggle={onToggleTransit}
                        />

                        <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>

                        <button
                          onClick={() => setEditingOrder(order)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit3 size={16} />
                        </button>

                        {order.status === "CANCELADO" && (
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
