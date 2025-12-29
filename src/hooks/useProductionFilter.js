import { useMemo } from "react";
import { normalizeText } from "../utils/formatters";

export function useProductionFilter(
  orders,
  filterText,
  statusFilter,
  findCatalogItem
) {
  return useMemo(() => {
    return orders.filter((order) => {
      // 1. Filtro de Status
      if (statusFilter !== "all" && order.status !== statusFilter) return false;

      // 2. Se não tiver texto de busca, passa direto
      if (!filterText) return true;

      const search = normalizeText(filterText);

      // --- DADOS BÁSICOS ---
      const sku = normalizeText(order.sku || "");
      const orderNum = normalizeText(order.order?.number || "");
      const client = normalizeText(order.order?.customer?.name || "");

      const catalogItem = findCatalogItem ? findCatalogItem(order.sku) : null;
      const prodName = normalizeText(catalogItem?.name || "");

      // --- DADOS PROFUNDOS (TURBINADOS) ---
      // Agora a produção também busca por pedra, cor, gravação, etc.
      const stone = normalizeText(order.specs?.stoneType || "");
      const color = normalizeText(order.specs?.stoneColor || "");
      const finishing = normalizeText(order.specs?.finishing || "");
      const engraving = normalizeText(order.specs?.engraving || "");
      const notes = normalizeText(order.order?.notes || "");

      // Logística (às vezes útil saber pra onde vai)
      const tracking = normalizeText(order.shipping?.tracking || "");

      return (
        sku.includes(search) ||
        orderNum.includes(search) ||
        client.includes(search) ||
        prodName.includes(search) ||
        // Novos campos:
        stone.includes(search) ||
        color.includes(search) ||
        finishing.includes(search) ||
        engraving.includes(search) ||
        notes.includes(search) ||
        tracking.includes(search)
      );
    });
  }, [orders, filterText, statusFilter, findCatalogItem]);
}
