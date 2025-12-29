import React, { useMemo } from "react";
import { getBusinessDaysDiff } from "../../utils/formatters"; // Ajuste o caminho se necessário

export default function AgeChart({ orders }) {
  const distribution = useMemo(() => {
    const counts = Array(11).fill(0);

    orders.forEach((o) => {
      // Ignora pedidos finalizados ou cancelados no cálculo de idade
      if (
        o.status === "PEDIDO_PRONTO" ||
        o.status === "CANCELADO" ||
        o.status === "ENVIADO"
      )
        return;

      let days = getBusinessDaysDiff(o.createdAt);
      if (days > 10) days = 10;
      counts[days]++;
    });

    return counts;
  }, [orders]);

  const maxVal = Math.max(...distribution, 1);

  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-4">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">
        Idade dos Pedidos em Aberto (Dias)
      </h4>
      <div className="flex items-end gap-1 h-16 w-full px-1 border-b border-slate-200 pb-1">
        {distribution.map((count, day) => {
          let colorClass = "bg-emerald-400";
          if (day >= 5) colorClass = "bg-yellow-400";
          if (day >= 8) colorClass = "bg-orange-500";
          if (day >= 10) colorClass = "bg-purple-600";

          const heightPercent =
            count > 0 ? Math.max((count / maxVal) * 100, 10) : 0;

          return (
            <div
              key={day}
              className="flex-1 flex flex-col justify-end group relative h-full"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
                <span className="font-bold">{count} pedidos</span> (
                {day === 10 ? "10+" : day} dias)
              </div>

              {/* Barra */}
              <div className="w-full bg-slate-100 rounded-t-sm relative h-full flex items-end overflow-hidden">
                {count > 0 && (
                  <div
                    className={`w-full transition-all duration-500 ${colorClass}`}
                    style={{ height: `${heightPercent}%` }}
                  ></div>
                )}
              </div>

              {/* Legenda X */}
              <div className="text-[9px] text-center text-slate-400 font-bold mt-1 border-t border-transparent group-hover:border-slate-300 group-hover:text-slate-600">
                {day === 10 ? "10+" : day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
