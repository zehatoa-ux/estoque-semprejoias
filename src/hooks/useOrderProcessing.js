/**
 * Hook: useOrderProcessing
 * ------------------------
 * Atua como o "Orquestrador" da aba de Logística/Pedidos.
 * * Responsabilidades:
 * 1. Processamento: Transforma dados brutos do Firebase em grupos organizados por Pedido.
 * 2. Enriquecimento: Calcula totais, define status padrões e normaliza datas.
 * 3. Filtragem: Aplica filtros de busca textual (profunda) e status logístico.
 * 4. Performance: Utiliza useMemo para evitar recálculos desnecessários quando a tela renderiza.
 * * @param {Array} rawData - Dados crus vindos do Firestore.
 * @param {String} searchTerm - Texto digitado no campo de busca.
 * @param {String} statusFilter - Filtro de status selecionado (ex: "ENVIADO").
 * @param {Function} findCatalogItem - Função para buscar preço/nome baseados no SKU.
 * * @returns {Array} Lista final de pedidos agrupados, ordenados e filtrados, pronta para exibição.
 */

// src/hooks/useOrderProcessing.js
import { useMemo } from "react";
import { processAndGroupOrders, filterOrders } from "../utils/logisticsLogic";

export function useOrderProcessing(
  rawData,
  searchTerm,
  statusFilter,
  findCatalogItem
) {
  return useMemo(() => {
    // 1. Processamento Pesado (Agrupar, Calcular, Ordenar)
    const allOrders = processAndGroupOrders(rawData, findCatalogItem);

    // 2. Filtragem (Busca e Status)
    const filteredOrders = filterOrders(
      allOrders,
      searchTerm,
      statusFilter,
      findCatalogItem
    );

    return filteredOrders;
  }, [rawData, searchTerm, statusFilter, findCatalogItem]);
}
