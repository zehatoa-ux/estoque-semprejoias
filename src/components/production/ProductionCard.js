import React from "react";
import {
  AlertTriangle,
  ShieldCheck,
  Layers,
  Edit3,
  Trash2,
  ArrowRight,
} from "lucide-react";
import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER,
} from "../../config/productionStatuses";
import TransitToggle from "./TransitToggle";

export default function ProductionCard({
  order,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onMoveStatus,
  onToggleTransit,
}) {
  // --- LÓGICA VISUAL ---
  const isNatural = order.specs?.stoneType === "Natural";

  // Verifica se a cor da pedra é diferente do padrão do catálogo
  const isDivergent =
    order.specs?.standardColor &&
    order.specs?.stoneColor &&
    order.specs.standardColor !== "MANUAL" &&
    order.specs.standardColor.toUpperCase() !==
      order.specs.stoneColor.toUpperCase();

  return (
    <div
      className={`bg-white p-3 rounded-lg shadow-sm border hover:shadow-md transition-all group relative flex flex-col gap-2 ${
        isSelected
          ? "ring-2 ring-purple-500 bg-purple-50 border-purple-300"
          : "border-slate-200"
      }`}
    >
      {/* Checkbox Absoluto */}
      <div className="absolute top-2 right-2 z-10">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
          checked={isSelected}
          onChange={() => onToggleSelect(order.id)}
        />
      </div>

      {/* Cabeçalho do Card */}
      <div className="flex justify-between items-start pr-6">
        <div className="flex items-center gap-1 flex-wrap">
          {order.fromStock && !order.isPE && (
            <div
              className="bg-emerald-700 text-white text-[8px] font-bold px-1 rounded cursor-help"
              title="Item de Estoque"
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
              title="Impresso"
            >
              I
            </div>
          )}
          <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded">
            {order.sku}
          </span>
        </div>
      </div>

      {/* Nome do Cliente */}
      <div className="text-xs text-slate-700 font-bold truncate">
        {order.order?.customer?.name || "Cliente Balcão"}
      </div>

      {/* Bloco de Especificações */}
      <div className="bg-slate-50 p-2 rounded text-[10px] space-y-1.5 border border-slate-100 text-slate-600">
        <div className="flex justify-between border-b border-slate-200 pb-1">
          <span className="font-bold">Aro: {order.specs?.size || "-"}</span>
          <span>{order.specs?.stoneType || "-"}</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-400">Cor:</span>
          <span className={`font-bold ${isDivergent ? "text-amber-600" : ""}`}>
            {order.specs?.stoneColor || "-"}
          </span>
          {isDivergent && (
            <AlertTriangle size={10} className="text-amber-500" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-400">Finalização:</span>
          <span className="font-bold">{order.specs?.finishing || "-"}</span>
        </div>

        {order.specs?.engraving && order.specs.engraving !== "ND" && (
          <div className="pt-1 text-purple-700 font-mono italic text-[9px] border-t border-slate-200">
            "{order.specs.engraving}"
          </div>
        )}

        {isNatural && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 animate-pulse mt-1">
            <ShieldCheck size={10} /> Natural
          </div>
        )}
      </div>

      {/* Rodapé com Ações */}
      <div className="pt-1 border-t flex justify-between items-center mt-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(order)}
            className="p-1 text-slate-400 hover:text-blue-600"
          >
            <Edit3 size={14} />
          </button>
          <TransitToggle order={order} onToggle={onToggleTransit} />
          {order.status === "CANCELADO" && (
            <button
              onClick={() => onDelete(order)}
              className="p-1 text-red-300 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Dropdown de Mover Status */}
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
