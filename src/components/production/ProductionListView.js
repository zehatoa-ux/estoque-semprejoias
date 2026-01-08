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
} from "lucide-react";
import DaysBadge from "./DaysBadge";

import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../../config/productionStatuses";
import TransitToggle from "./TransitToggle";

// Helper para formatar data
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
    if (onUpdateDate) {
      await onUpdateDate(orderId, tempDate);
    }
    setEditingDateId(null);
  };

  return (
    // 1. REMOVIDO overflow-hidden e classes que forçam largura fixa
    <div className="space-y-6 w-full pb-20">
      {KANBAN_ORDER.map((statusId) => {
        const items = groupedOrders[statusId] || [];
        if (items.length === 0) return null;

        const config = PRODUCTION_STATUS_CONFIG[statusId] || {
          label: statusId,
          color: "bg-gray-500 text-white",
        };
        // --- NOVO: LÓGICA DE SELEÇÃO DE GRUPO ---
        // 1. Verifica se TODOS estão marcados
        const allSelected = items.every((order) =>
          selectedOrders.has(order.id)
        );

        // 2. Função para alternar o grupo
        const toggleGroup = () => {
          // Precisamos atualizar o Set pai.
          // Se a prop 'toggleSelect' só aceita ID único, isso vai ser difícil.
          // O ideal é que o componente Pai passe uma função 'setSelectedOrders' ou 'handleBatchSelect'.

          // SUPONDO que você pode passar a prop 'handleBatchSelect' do pai:
          // Se não tiver, você vai ter que fazer um loop chamando toggleSelect (feio mas funciona)

          const newSet = new Set(selectedOrders);
          if (allSelected) {
            items.forEach((i) => newSet.delete(i.id));
          } else {
            items.forEach((i) => newSet.add(i.id));
          }

          // AQUI ESTÁ O TRUQUE:
          // Você precisa passar esse 'newSet' para o pai.
          // Se o Pai é ProductionTab.js, passe a prop `setSelectedOrders={setSelectedOrders}` para cá.
          if (setSelectSet) {
            setSelectSet(newSet);
          } else {
            // Fallback: Tenta alternar um por um (pode ser lento)
            items.forEach((i) => {
              if (allSelected) {
                if (selectedOrders.has(i.id)) toggleSelect(i.id);
              } else {
                if (!selectedOrders.has(i.id)) toggleSelect(i.id);
              }
            });
          }
        };
        // ----------------------------------------
        return (
          <div
            key={statusId}
            className="bg-white md:rounded-xl shadow-sm border border-slate-200 md:overflow-hidden bg-transparent border-0 md:bg-white md:border"
          >
            {/* Cabeçalho da Seção (Status) */}
            <div
              className={`px-4 py-2 font-bold text-sm flex justify-between items-center rounded-t-xl md:rounded-none mb-2 md:mb-0 ${config.color}`}
            >
              <span>
                {config.label} ({items.length})
              </span>
            </div>

            {/* A Mágica Acontece Aqui: Table vira Block no Mobile */}
            <table className="w-full text-left text-sm block md:table">
              {/* Oculta cabeçalho da tabela no mobile */}
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b hidden md:table-header-group">
                <tr>
                  <th className="px-4 py-2 w-10 text-center">
                    <div className="flex items-center gap-3">
                      {/* --- NOVO: CHECKBOX MESTRE --- */}
                      <div
                        className="bg-white/20 p-1 rounded hover:bg-white/30 cursor-pointer transition-colors"
                        onClick={toggleGroup}
                        title={allSelected ? "Desmarcar Grupo" : "Marcar Grupo"}
                      >
                        {allSelected ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </div>
                      {/* ----------------------------- */}

                      <span>
                        {config.label} ({items.length})
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-2 w-28 text-center">Prazo / Data</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 w-1/3">Especificações</th>
                  <th className="px-4 py-2">Cliente / Pagamento</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="block md:table-row-group space-y-3 md:space-y-0">
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
                      // TRANSFORMA TR EM CARD NO MOBILE
                      className={`
                        block md:table-row 
                        relative 
                        bg-white 
                        border border-slate-200 md:border-0 rounded-lg md:rounded-none 
                        shadow-sm md:shadow-none 
                        mb-4 md:mb-0 
                        transition-colors
                        ${
                          isSelected
                            ? "bg-purple-50 ring-1 ring-purple-400 md:ring-0"
                            : ""
                        }
                      `}
                    >
                      {/* 1. CHECKBOX (Posição Absoluta no Mobile - Canto esquerdo) */}
                      <td className="block md:table-cell md:px-4 md:py-3 text-center align-top pt-3 pl-3 md:p-0 absolute top-0 left-0 md:static z-10">
                        <input
                          type="checkbox"
                          className="w-5 h-5 md:w-4 md:h-4 rounded border-slate-300 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>

                      {/* 2. DATA (Posição Absoluta no Mobile - Canto direito) */}
                      <td className="block md:table-cell md:px-4 md:py-3 text-center align-top pt-3 pr-3 md:p-0 absolute top-0 right-0 md:static z-10">
                        {isEditingDate ? (
                          <div className="flex flex-col gap-1 items-center animate-fade-in bg-white p-1 rounded shadow border z-20">
                            <input
                              type="date"
                              className="w-[110px] text-[10px] p-1 border rounded bg-white shadow-sm"
                              value={tempDate}
                              onChange={(e) => setTempDate(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex gap-1">
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
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer hover:scale-105 transition-transform relative group inline-block"
                            onClick={(e) => startEditing(e, order)}
                          >
                            <DaysBadge
                              date={order.customCreatedAt || order.createdAt}
                            />
                            <div className="hidden md:block absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-blue-600 text-white rounded-full p-0.5 shadow-sm transition-opacity">
                              <Edit3 size={8} />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 3. ITEM (Conteúdo Principal - Empurrado para baixo no mobile para não bater no checkbox) */}
                      <td className="block md:table-cell px-4 pb-2 md:py-3 align-top mt-10 md:mt-0">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* Tags */}
                            {order.isInterceptedPE && (
                              <span className="bg-orange-100 text-orange-700 text-[9px] px-1.5 py-0.5 rounded font-bold border border-orange-200 flex items-center gap-1 whitespace-nowrap">
                                <Layers size={10} /> INTERCEPTADO
                              </span>
                            )}
                            {order.fromStock &&
                              !order.isPE &&
                              !order.isInterceptedPE && (
                                <span className="bg-emerald-700 text-white text-[9px] px-1 rounded font-bold">
                                  E
                                </span>
                              )}
                            {order.isPE && !order.isInterceptedPE && (
                              <span className="bg-orange-500 text-white text-[9px] px-1 rounded font-bold flex items-center gap-0.5 whitespace-nowrap">
                                <Layers size={8} /> PE
                              </span>
                            )}
                            {order.printed && (
                              <span className="bg-amber-400 text-amber-900 text-[9px] px-1 rounded font-bold">
                                I
                              </span>
                            )}

                            <span className="font-bold text-blue-600 whitespace-nowrap">
                              {order.sku}
                            </span>
                          </div>

                          <span className="text-xs text-slate-500 whitespace-normal break-words leading-tight">
                            {catalog?.name || "Carregando..."}
                          </span>
                        </div>
                      </td>

                      {/* 4. ESPECIFICAÇÕES */}
                      <td className="block md:table-cell px-4 pb-2 md:py-3 align-top">
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          {order.specs?.size && (
                            <span className="bg-slate-100 border px-1 rounded font-bold whitespace-nowrap">
                              Aro: {order.specs.size}
                            </span>
                          )}

                          {order.specs?.stoneColor && (
                            <span
                              className={`bg-slate-100 border px-1 rounded font-bold flex items-center gap-1 whitespace-normal break-words ${
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
                            <span className="bg-slate-100 border px-1 rounded whitespace-nowrap">
                              Fin: {order.specs.finishing}
                            </span>
                          )}

                          {order.specs?.stoneBatch && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1 rounded font-mono whitespace-nowrap">
                              Lote: {order.specs.stoneBatch}
                            </span>
                          )}

                          {order.specs?.engraving &&
                            order.specs.engraving !== "ND" && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-100 px-1 rounded italic break-words w-full md:w-auto">
                                "{order.specs.engraving}"
                              </span>
                            )}

                          {isNatural && (
                            <span className="text-blue-600 font-bold flex items-center gap-1 animate-pulse whitespace-nowrap">
                              <ShieldCheck size={10} /> Natural
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. CLIENTE */}
                      <td className="block md:table-cell px-4 pb-2 md:py-3 align-top">
                        <div className="flex md:block items-center justify-between">
                          <div className="font-bold text-slate-700 text-xs whitespace-normal break-words leading-tight">
                            {order.order?.customer?.name ||
                              order.customerName ||
                              "Balcão"}
                          </div>
                          <div className="text-[10px] text-slate-400 md:mt-0.5">
                            {order.order?.number
                              ? `#${order.order.number}`
                              : "-"}
                          </div>
                        </div>
                      </td>

                      {/* 6. STATUS (No mobile, ocupa largura total) */}
                      <td className="block md:table-cell px-4 pb-2 md:py-3 text-center align-top">
                        <select
                          className="text-[10px] p-1.5 border rounded bg-slate-50 w-full md:w-[120px] font-bold uppercase"
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

                      {/* 7. AÇÕES (Barra inferior no card mobile) */}
                      <td className="block md:table-cell px-4 py-3 md:py-3 text-center align-top border-t md:border-0 bg-slate-50 md:bg-transparent rounded-b-lg md:rounded-none">
                        <div className="flex justify-end md:justify-center gap-4 items-center">
                          <TransitToggle
                            order={order}
                            onToggle={onToggleTransit}
                          />

                          <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>

                          <button
                            onClick={() => setEditingOrder(order)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded flex items-center gap-1"
                          >
                            <Edit3 size={16} />{" "}
                            <span className="md:hidden text-xs">Editar</span>
                          </button>

                          {order.status === "CANCELADO" && (
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
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
