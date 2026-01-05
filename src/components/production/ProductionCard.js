// src/components/production/ProductionCard.js
import React, { useState } from "react";
import {
  Edit3,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import DaysBadge from "./DaysBadge";
import TransitToggle from "./TransitToggle";
import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../../config/productionStatuses";

// Helper de formatação de data (mesmo da Lista)
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

export default function ProductionCard({
  order,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onMoveStatus,
  onToggleTransit,
  onUpdateDate, // <--- Recebendo a função de salvar
  findCatalogItem, // Se precisar mostrar nome do produto
}) {
  // --- ESTADOS DE EDIÇÃO DA DATA ---
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState("");

  const catalog = findCatalogItem ? findCatalogItem(order.sku) : null;

  // Lógica visual de specs (igual a lista)
  const isDivergent =
    order.specs?.standardColor &&
    order.specs?.stoneColor &&
    order.specs.standardColor !== "MANUAL" &&
    order.specs.standardColor.toUpperCase() !==
      order.specs.stoneColor.toUpperCase();

  const isNatural = order.specs?.stoneType === "Natural";

  // --- HANDLERS DA DATA ---
  const startEditingDate = (e) => {
    e.stopPropagation();
    setIsEditingDate(true);
    setTempDate(getIsoDate(order.customCreatedAt || order.createdAt));
  };

  const cancelEditingDate = (e) => {
    e.stopPropagation();
    setIsEditingDate(false);
    setTempDate("");
  };

  const saveDate = async (e) => {
    e.stopPropagation();
    if (onUpdateDate) {
      // Chama a função da Tab -> Service -> Firestore
      await onUpdateDate(order.id, tempDate);
    }
    setIsEditingDate(false);
  };

  return (
    <div
      className={`bg-white p-3 rounded-lg shadow-sm border hover:shadow-md transition-all group relative flex flex-col gap-2 ${
        isSelected
          ? "ring-2 ring-purple-500 bg-purple-50 border-purple-300"
          : "border-slate-200"
      }`}
    >
      {/* Checkbox de Seleção */}
      <div className="absolute top-2 right-2 z-10">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
          checked={isSelected}
          onChange={() => onToggleSelect(order.id)}
        />
      </div>

      {/* CABEÇALHO DO CARD */}
      <div className="flex justify-between items-start pr-6">
        <div className="flex flex-col gap-1.5 w-full">
          {/* --- ÁREA DA DATA (EDITÁVEL) --- */}
          <div onClick={(e) => e.stopPropagation()} className="w-fit">
            {isEditingDate ? (
              <div className="flex items-center gap-1 animate-fade-in bg-white p-1 rounded border shadow-sm z-20 absolute top-1 left-1">
                <input
                  type="date"
                  className="w-[95px] text-[10px] p-0.5 border rounded"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={saveDate}
                  className="bg-green-100 text-green-700 p-0.5 rounded hover:bg-green-200"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={cancelEditingDate}
                  className="bg-red-100 text-red-700 p-0.5 rounded hover:bg-red-200"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div
                className="cursor-pointer hover:opacity-80 relative group/date"
                onClick={startEditingDate}
                title="Clique para alterar a data"
              >
                <DaysBadge date={order.customCreatedAt || order.createdAt} />
                <div className="absolute -right-2 -top-1 opacity-0 group-hover/date:opacity-100 bg-blue-600 text-white rounded-full p-[2px]">
                  <Edit3 size={6} />
                </div>
              </div>
            )}
          </div>

          {/* Tags de Status (Estoque, PE, Impresso) */}
          <div className="flex items-center gap-1 mt-1">
            {order.fromStock && !order.isPE && (
              <div
                className="bg-emerald-700 text-white text-[8px] font-bold px-1 rounded cursor-help"
                title="Item retirado do estoque"
              >
                E
              </div>
            )}
            {order.isPE && (
              <div
                className="bg-orange-500 text-white text-[8px] font-bold px-1 rounded flex items-center gap-0.5 cursor-help"
                title="Produção de Estoque"
              >
                <Layers size={8} /> PE
              </div>
            )}
            {order.printed && (
              <div
                className="bg-amber-400 text-amber-900 text-[8px] font-bold px-1.5 rounded cursor-help"
                title="Impresso oficina"
              >
                I
              </div>
            )}
            <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded truncate max-w-[120px]">
              {order.sku}
            </span>
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div className="text-xs text-slate-700 font-bold truncate">
        {order.order?.customer?.name || "Cliente S/ Nome"}
      </div>

      {/* Specs Box */}
      <div className="bg-slate-50 p-2 rounded text-[10px] space-y-1.5 border border-slate-100 text-slate-600">
        <div className="flex justify-between border-b border-slate-200 pb-1">
          <span className="font-bold">Aro: {order.specs?.size || "-"}</span>
          <span className="truncate max-w-[80px]">
            {order.specs?.stoneType || "-"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-400">Cor:</span>
          <span
            className={`font-bold truncate ${
              isDivergent ? "text-amber-600" : ""
            }`}
          >
            {order.specs?.stoneColor || "-"}
          </span>
          {isDivergent && (
            <AlertTriangle size={10} className="text-amber-500" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-400">Fin:</span>
          <span className="font-bold truncate">
            {order.specs?.finishing || "-"}
          </span>
        </div>

        {/* Lote da Pedra (NOVO) */}
        {order.specs?.stoneBatch && (
          <div className="flex items-center gap-1 bg-blue-100/50 px-1 rounded">
            <span className="text-slate-400">Lote:</span>
            <span className="font-mono font-bold text-blue-700">
              {order.specs.stoneBatch}
            </span>
          </div>
        )}

        {order.specs?.engraving && order.specs.engraving !== "ND" && (
          <div className="pt-1 text-purple-700 font-mono italic text-[9px] border-t border-slate-200 truncate">
            "{order.specs.engraving}"
          </div>
        )}

        {isNatural && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 animate-pulse mt-1">
            <ShieldCheck size={10} /> Natural
          </div>
        )}
      </div>

      {/* Footer: Ações */}
      <div className="pt-1 border-t flex justify-between items-center mt-auto">
        <div className="flex items-center gap-1">
          {/* Toggle de Trânsito */}
          <TransitToggle order={order} onToggle={onToggleTransit} />

          <button
            onClick={() => onEdit(order)}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Editar Pedido"
          >
            <Edit3 size={14} />
          </button>

          {order.status === "CANCELADO" && (
            <button
              onClick={() => onDelete(order)}
              className="p-1 text-red-300 hover:text-red-600 hover:bg-red-50 rounded"
              title="Excluir Definitivamente"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Mover Status */}
        <div className="relative w-24">
          <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 cursor-pointer hover:text-purple-600">
            <span>Mover</span> <ArrowRight size={10} />
          </div>
          <select
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            value={order.status}
            onChange={(e) => onMoveStatus(order.id, e.target.value)}
          >
            {KANBAN_ORDER.map((s) => (
              <option key={s} value={s}>
                {PRODUCTION_STATUS_CONFIG[s]?.label || s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
