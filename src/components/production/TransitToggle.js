import React from "react";
import { ArrowUpCircle, ArrowDownCircle, XCircle } from "lucide-react";

export default function TransitToggle({ order, onToggle }) {
  const currentStatus = order.transit_status; // 'subindo', 'descendo' ou null/undefined

  // Se já estiver em trânsito, mostra botão para CANCELAR (Chegou no destino)
  if (currentStatus) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(order, null); // Anula o trânsito
        }}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border animate-pulse ${
          currentStatus === "subindo"
            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
            : "bg-orange-100 text-orange-700 border-orange-200"
        }`}
        title="Clique para confirmar recebimento (Desbloquear)"
      >
        {currentStatus === "subindo" ? (
          <ArrowUpCircle size={14} />
        ) : (
          <ArrowDownCircle size={14} />
        )}
        <span className="uppercase">{currentStatus}</span>
        <XCircle size={12} className="ml-1 opacity-50 hover:opacity-100" />
      </button>
    );
  }

  // Se NÃO estiver em trânsito, mostra opções para iniciar (Discreto)
  return (
    <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(order, "descendo");
        }}
        title="Enviar para Oficina (Descendo)"
        className="text-orange-300 hover:text-orange-600"
      >
        <ArrowDownCircle size={22} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(order, "subindo");
        }}
        title="Enviar para Escritório (Subindo)"
        className="text-indigo-300 hover:text-indigo-600"
      >
        <ArrowUpCircle size={22} />
      </button>
    </div>
  );
}
