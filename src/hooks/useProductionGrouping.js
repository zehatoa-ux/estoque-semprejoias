import { useMemo } from "react";
import { getBusinessDaysDiff } from "../utils/formatters";

export function useProductionGrouping(orders, groupBy) {
  return useMemo(() => {
    // 1. Inicializa os grupos
    // Se for por status, o ProductionTab/ListView lidam com as chaves do config
    // Se for por dias, definimos as chaves fixas:
    // 5 (Normal), 8 (Atenção), 10 (Urgente), 99 (Crítico)
    const groups = groupBy === "days" ? { 5: [], 8: [], 10: [], 99: [] } : {};

    orders.forEach((order) => {
      // --- LÓGICA DE AGRUPAMENTO POR STATUS ---
      if (groupBy === "status") {
        const status = order.status || "UNKNOWN";
        if (!groups[status]) groups[status] = [];
        groups[status].push(order);
        return;
      }

      // --- LÓGICA DE AGRUPAMENTO POR DIAS (AQUI ESTAVA O ERRO) ---
      if (groupBy === "days") {
        // Ignora pedidos finalizados no Kanban temporal
        if (
          order.status === "PEDIDO_PRONTO" ||
          order.status === "CANCELADO" ||
          order.status === "ENVIADO"
        ) {
          return;
        }

        // CORREÇÃO: Usa a data customizada se existir, senão usa a original
        const dateToUse = order.customCreatedAt || order.createdAt;

        // Calcula dias úteis baseado na data escolhida
        const days = getBusinessDaysDiff(dateToUse);

        // Distribui nas colunas (Buckets)
        if (days < 5) {
          groups[5].push(order);
        } else if (days >= 5 && days < 8) {
          groups[8].push(order);
        } else if (days >= 8 && days <= 9) {
          // Ajuste fino para pegar 8 e 9
          groups[10].push(order);
        } else {
          groups[99].push(order); // 10 dias ou mais
        }
      }
    });

    return groups;
  }, [orders, groupBy]);
}
