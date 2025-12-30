//agrupa pedidos

//calcula valores

//aplica regra antiga

//decide como buscar

//normaliza dados

import { useMemo } from "react";
import { normalizeText } from "../utils/formatters";

export function useOrderProcessing(
  rawData,
  searchTerm,
  statusFilter,
  findCatalogItem
) {
  return useMemo(() => {
    const groups = {};

    // 1. Agrupa os itens brutos por Número de Pedido
    rawData.forEach((item) => {
      const orderNum = item.order?.number || "AVULSO";
      if (!groups[orderNum]) {
        let cName = "Cliente Balcão";
        if (orderNum !== "AVULSO" && item.order?.customer?.name)
          cName = item.order.customer.name;

        groups[orderNum] = {
          orderNumber: orderNum,
          customerName: cName,
          date: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(),
          totalValue: 0,
          shippingMethod:
            item.shipping?.tipoenvio || item.shipping?.method || "Retirada",
          logisticsStatus: item.logisticsStatus || "SEM ETIQUETA",
          items: [],
          referenceIds: [],
        };
      }

      groups[orderNum].items.push(item);
      groups[orderNum].referenceIds.push(item.id);

      // Soma dinâmica do valor
      let itemPrice = 0;
      const catalogItem = findCatalogItem ? findCatalogItem(item.sku) : null;
      if (catalogItem && catalogItem.price) {
        itemPrice = parseFloat(catalogItem.price);
      } else if (item.price) {
        itemPrice = parseFloat(item.price);
      }
      groups[orderNum].totalValue += itemPrice;
    });

    // Ajuste de valor legado se necessário
    Object.values(groups).forEach((group) => {
      const legacyTotal = group.items[0]?.order?.payment?.total;
      if (legacyTotal && (group.totalValue === 0 || legacyTotal !== "")) {
        if (parseFloat(legacyTotal) > 0)
          group.totalValue = parseFloat(legacyTotal);
      }
    });

    // Transforma em array e ordena por data
    let result = Object.values(groups).sort((a, b) => b.date - a.date);

    // --- LÓGICA DE BUSCA GLOBAL ---
    if (searchTerm || statusFilter !== "all") {
      const search = normalizeText(searchTerm);

      result = result.filter((g) => {
        // 1. Filtro de Status Logístico
        const matchesStatus =
          statusFilter === "all" || g.logisticsStatus === statusFilter;
        if (!matchesStatus) return false;

        // 2. Se não tiver termo de busca, retorna true
        if (!search) return true;

        // 3. Busca no Cabeçalho (Pai)
        if (normalizeText(g.orderNumber).includes(search)) return true;
        if (normalizeText(g.customerName).includes(search)) return true;

        // 4. Busca Profunda nos Itens (Filhos)
        const matchDeep = g.items.some((item) => {
          const catalogData = findCatalogItem
            ? findCatalogItem(item.sku)
            : null;

          // Dados Básicos do Produto
          const sku = normalizeText(item.sku || "");
          const prodName = normalizeText(catalogData?.name || "");

          // Especificações
          const stone = normalizeText(item.specs?.stoneType || "");
          const color = normalizeText(item.specs?.stoneColor || "");
          const finishing = normalizeText(item.specs?.finishing || "");
          const engraving = normalizeText(item.specs?.engraving || "");

          // Dados de Contato
          const phone = normalizeText(item.order?.customer?.phone || "");
          const cpf = normalizeText(item.order?.customer?.cpf || "");
          const email = normalizeText(item.order?.customer?.email || "");
          const notes = normalizeText(item.order?.notes || "");

          // Dados de Logística
          const street = normalizeText(item.shipping?.address?.street || "");
          const district = normalizeText(item.shipping?.address?.bairro || "");
          const city = normalizeText(item.shipping?.address?.city || "");
          const tracking = normalizeText(item.shipping?.tracking || "");

          return (
            sku.includes(search) ||
            prodName.includes(search) ||
            stone.includes(search) ||
            color.includes(search) ||
            finishing.includes(search) ||
            engraving.includes(search) ||
            phone.includes(search) ||
            cpf.includes(search) ||
            email.includes(search) ||
            notes.includes(search) ||
            street.includes(search) ||
            district.includes(search) ||
            city.includes(search) ||
            tracking.includes(search)
          );
        });

        return matchDeep;
      });
    }
    return result;
  }, [rawData, searchTerm, statusFilter, findCatalogItem]);
}
