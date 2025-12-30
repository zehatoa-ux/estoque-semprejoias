// src/hooks/useProductionGrouping.js
import { useMemo } from "react";
// 👇 Importando a função oficial do seu projeto
import { getBusinessDaysDiff } from "../utils/formatters"; 

export function useProductionGrouping(orders, groupBy) {
  return useMemo(() => {
    // Retorna objeto vazio se não houver pedidos
    if (!orders) return {};

    const groups = {};

    orders.forEach((order) => {
      let key = "";

      // --- MODO 1: Por Status (Para sua Lista Principal) ---
      if (groupBy === "status") {
        key = order.status || "SEM_STATUS";
      } 
      
      // --- MODO 2: Por Dias (Para Kanban ou agrupamentos futuros) ---
      else if (groupBy === "days") {
        // Usa a sua função utilitária para calcular dias úteis corretamente
        const diff = getBusinessDaysDiff(order.createdAt);
        
        // Mantém as mesmas faixas de urgência do seu visual
        if (diff < 5) key = 5;       // Normal
        else if (diff < 8) key = 8;  // Atenção
        else if (diff < 10) key = 10; // Urgente
        else key = 99;               // Crítico
      }

      // Inicializa o array do grupo se ainda não existir
      if (!groups[key]) {
        groups[key] = [];
      }

      // Adiciona o pedido ao grupo
      groups[key].push(order);
    });

    return groups;
  }, [orders, groupBy]);
}