import React, { useMemo } from "react";
import { getBusinessDaysDiff } from "../../utils/formatters";

export default function AgeChart({ orders, onBarClick, activeFilter }) {
  const distribution = useMemo(() => {
    const counts = Array(11).fill(0);

    orders.forEach((o) => {
      // Ignora pedidos finalizados ou cancelados
      if (
        o.status === "PEDIDO_PRONTO" ||
        o.status === "CANCELADO" ||
        o.status === "ENVIADO"
      )
        return;

      // Usa a customCreatedAt se existir, senão usa createdAt
      const dateToUse = o.customCreatedAt || o.createdAt;

      let days = getBusinessDaysDiff(dateToUse);
      // Garante que não seja negativo (caso de data futura por erro)
      if (days < 0) days = 0;
      if (days > 10) days = 10;
      counts[days]++;
    });

    return counts;
  }, [orders]);

  const maxVal = Math.max(...distribution, 1);

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex justify-between items-center">
        <span>Idade dos Pedidos em Aberto (Dias Úteis)</span>
        {activeFilter && (
          <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded animate-pulse">
            Filtro Ativo
          </span>
        )}
      </h4>

      <div className="flex items-end gap-1.5 h-20 w-full px-1 border-b border-slate-200 pb-1">
        {distribution.map((count, day) => {
          let colorClass = "bg-emerald-400";
          if (day >= 3) colorClass = "bg-green-500";
          if (day >= 5) colorClass = "bg-yellow-400";
          if (day >= 8) colorClass = "bg-orange-500";
          if (day >= 10) colorClass = "bg-purple-600";

          const heightPercent =
            count > 0 ? Math.max((count / maxVal) * 100, 15) : 0;

          // Lógica de Seleção Visual
          const isSelected =
            activeFilter &&
            ((day === 10 && activeFilter.min === 10) || // Caso 10+
              activeFilter.max === day); // Casos normais

          // Se tem filtro ativo e essa barra NÃO é a selecionada, fica opaca
          const isDimmed = activeFilter && !isSelected;

          return (
            <button
              key={day}
              onClick={() =>
                onBarClick &&
                onBarClick({
                  min: day,
                  max: day === 10 ? undefined : day, // Se for 10, max é infinito (undefined)
                  label: day === 10 ? "Mais de 10 dias" : `${day} dias`,
                })
              }
              disabled={count === 0}
              className={`
                flex-1 flex flex-col justify-end group relative h-full transition-all duration-300 outline-none
                ${
                  count === 0
                    ? "cursor-default"
                    : "cursor-pointer hover:-translate-y-1"
                }
                ${isDimmed ? "opacity-20 grayscale" : "opacity-100"}
              `}
            >
              {/* Tooltip Customizado */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-20 pointer-events-none transform scale-90 group-hover:scale-100 duration-200">
                <span className="font-bold">{count} pedidos</span>
                <div className="text-[9px] text-slate-400">
                  {day === 10 ? "10 dias ou mais" : `Exatamente ${day} dias`}
                </div>
                {/* Setinha do tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
              </div>

              {/* A Barra */}
              <div className="w-full bg-slate-50 rounded-t-md relative h-full flex items-end overflow-hidden">
                {count > 0 && (
                  <div
                    className={`w-full transition-all duration-700 ease-out ${colorClass} ${
                      isSelected ? "ring-2 ring-blue-400 ring-offset-1" : ""
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  >
                    {/* Número dentro da barra se for alta o suficiente */}
                    {heightPercent > 40 && (
                      <div className="text-[9px] text-white/90 font-bold text-center pt-1">
                        {count}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Eixo X (Dias) */}
              <div
                className={`
                text-[10px] text-center font-bold mt-1.5 transition-colors border-t-2 w-full pt-1
                ${
                  isSelected
                    ? "text-blue-600 border-blue-500"
                    : "text-slate-400 border-transparent group-hover:text-slate-600"
                }
              `}
              >
                {day === 10 ? "10+" : day}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
