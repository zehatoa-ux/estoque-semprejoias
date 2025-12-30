// src/utils/logisticsLogic.js
import { normalizeText } from "./formatters";

/**
 * 1. AGRUPAMENTO E CÁLCULO
 * Transforma a lista bruta do Firebase em grupos de pedidos com totais calculados.
 */
export function processAndGroupOrders(rawData, findCatalogItem) {
  const groups = {};

  rawData.forEach((item) => {
    const orderNum = item.order?.number || "AVULSO";

    if (!groups[orderNum]) {
      // Define nome do cliente (Fallback para Balcão)
      let cName = "Cliente Balcão";
      if (orderNum !== "AVULSO" && item.order?.customer?.name) {
        cName = item.order.customer.name;
      }

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

  // Regra Antiga (Legado): Ajuste de valor total se vier zerado ou explícito no pedido
  Object.values(groups).forEach((group) => {
    const legacyTotal = group.items[0]?.order?.payment?.total;
    if (legacyTotal && (group.totalValue === 0 || legacyTotal !== "")) {
      if (parseFloat(legacyTotal) > 0) {
        group.totalValue = parseFloat(legacyTotal);
      }
    }
  });

  // Retorna array ordenado por data (Decrescente)
  return Object.values(groups).sort((a, b) => b.date - a.date);
}

/**
 * 2. FILTRAGEM
 * Aplica filtros de texto (busca profunda) e status.
 */
export function filterOrders(
  ordersList,
  searchTerm,
  statusFilter,
  findCatalogItem
) {
  // Se não tem filtros, retorna tudo
  if ((!searchTerm || searchTerm === "") && statusFilter === "all") {
    return ordersList;
  }

  const search = normalizeText(searchTerm);

  return ordersList.filter((g) => {
    // 1. Filtro de Status Logístico
    const matchesStatus =
      statusFilter === "all" || g.logisticsStatus === statusFilter;
    if (!matchesStatus) return false;

    // 2. Se não tiver termo de busca, passou pelo status, então retorna true
    if (!search) return true;

    // 3. Busca no Cabeçalho (Pai)
    if (normalizeText(g.orderNumber).includes(search)) return true;
    if (normalizeText(g.customerName).includes(search)) return true;

    // 4. Busca Profunda nos Itens (Filhos)
    return g.items.some((item) => {
      const catalogData = findCatalogItem ? findCatalogItem(item.sku) : null;

      // Monta um "super texto" com todos os campos pesquisáveis do item
      const searchableFields = [
        item.sku,
        catalogData?.name,
        item.specs?.stoneType,
        item.specs?.stoneColor,
        item.specs?.finishing,
        item.specs?.engraving,
        item.order?.customer?.phone,
        item.order?.customer?.cpf,
        item.order?.customer?.email,
        item.order?.notes,
        item.shipping?.address?.street,
        item.shipping?.address?.bairro,
        item.shipping?.address?.city,
        item.shipping?.tracking,
      ]
        .map((field) => normalizeText(field || ""))
        .join(" "); // Junta tudo numa string só

      return searchableFields.includes(search);
    });
  });
}
/**
 * 3. REGRAS DE PERMISSÃO (Quem pode fazer o quê?)
 */

export function canArchiveOrder(group) {
    // Regra: Só pode arquivar se já foi enviado ou entregue (exemplo futuro)
    return group.logisticsStatus === "ENVIADO";
  }
  
  export function canDeleteOrder(group) {
    // Regra: Só pode excluir se for Cancelado OU se for um rascunho sem status (Sem Etiqueta)
    return group.logisticsStatus === "CANCELADO" || group.logisticsStatus === "SEM ETIQUETA";
  }
  
  export function canPrintCertificate(group) {
      // Exemplo: Só imprime certificado se tiver itens
      return group.items && group.items.length > 0;
  }