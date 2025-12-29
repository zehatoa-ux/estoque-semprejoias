import React from "react";
// Importa as configs da fonte da verdade
import { 
  PRODUCTION_STATUS_CONFIG as STATUS_CONFIG, 
  KANBAN_ORDER as STATUS_ORDER 
} from "../../config/productionStatuses";

export default function StatusSummary({ orders }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 pt-2 custom-scrollbar">
      {STATUS_ORDER.map((st) => {
        // Conta quantos pedidos tem neste status
        const count = orders.filter((o) => o.status === st).length;
        
        // Esconde status vazios (exceto SOLICITACAO que é a entrada)
        if (count === 0 && st !== "SOLICITACAO") return null;
        
        const conf = STATUS_CONFIG[st] || {};
        // Pega só a classe de background (hackzinho pra pegar a primeira classe da string 'bg-xxx ...')
        const colorClass = conf.color?.split(" ")[0] || "bg-gray-200";

        return (
          <div
            key={st}
            className="flex flex-col items-center justify-center bg-white border rounded-lg px-3 py-1.5 min-w-[80px] shadow-sm shrink-0 cursor-default hover:shadow-md transition-shadow"
          >
            <span className="text-xl font-bold text-slate-700 leading-none">
              {count}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[80px]" title={conf.label}>
                {conf.label || st}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}