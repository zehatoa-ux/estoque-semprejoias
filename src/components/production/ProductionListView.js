import React from "react";
import {
  CheckSquare,
  Edit3,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Layers,
} from "lucide-react";
import DaysBadge from "./DaysBadge";

// 👇 CORREÇÃO AQUI: Usando os nomes exatos que o erro mostrou
import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../../config/productionStatuses";

export default function ProductionListView({
  groupedOrders,
  selectedOrders,
  toggleSelect,
  setEditingOrder,
  handleDeleteOrder,
  handleMoveStatus,
  findCatalogItem,
}) {
  // 👇 CORREÇÃO AQUI: Usando KANBAN_ORDER
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {KANBAN_ORDER.map((statusId) => {
        const items = groupedOrders[statusId] || [];
        if (items.length === 0) return null;

        // 👇 CORREÇÃO AQUI: Usando PRODUCTION_STATUS_CONFIG
        const config = PRODUCTION_STATUS_CONFIG[statusId] || {
          label: statusId,
          color: "bg-gray-500 text-white",
        };

        return (
          <div
            key={statusId}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            {/* Cabeçalho do Grupo */}
            <div
              className={`px-4 py-2 font-bold text-sm flex justify-between items-center ${config.color}`}
            >
              <span>
                {config.label} ({items.length})
              </span>
            </div>

            {/* Tabela */}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b">
                <tr>
                  <th className="px-4 py-2 w-10 text-center">
                    <CheckSquare size={14} />
                  </th>
                  <th className="px-4 py-2 w-20 text-center">Prazo</th>
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

                      <td className="px-4 py-3">
                        <DaysBadge date={order.createdAt} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            {order.fromStock && !order.isPE && (
                              <span className="bg-emerald-700 text-white text-[9px] px-1 rounded font-bold">
                                E
                              </span>
                            )}
                            {order.isPE && (
                              <span className="bg-orange-500 text-white text-[9px] px-1 rounded font-bold flex items-center gap-0.5">
                                <Layers size={8} /> PE
                              </span>
                            )}
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

                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700 text-xs">
                          {order.order?.customer?.name || "Balcão"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {order.order?.number ? `#${order.order.number}` : "-"}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <select
                          className="text-[10px] p-1 border rounded bg-slate-50 max-w-[120px]"
                          value={order.status}
                          onChange={(e) =>
                            handleMoveStatus(order.id, e.target.value)
                          }
                        >
                          {/* 👇 CORREÇÃO AQUI TAMBÉM: KANBAN_ORDER e PRODUCTION_STATUS_CONFIG */}
                          {KANBAN_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {PRODUCTION_STATUS_CONFIG[s]?.label || s}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-center flex justify-center gap-2">
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
