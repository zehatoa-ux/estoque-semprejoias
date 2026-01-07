export function formatProductionTicket(orders) {
  let content = "";

  orders.forEach((order) => {
    // Tratamento de segurança para dados opcionais
    const dateSimple = order.dateStr ? order.dateStr.split(" ")[0] : "-";
    const orderNum = order.order?.number || "-";
    const sku = order.sku || "-";

    // --- NOVO: Lógica para pegar o nome do Cliente ---
    // Tenta pegar da raiz (novo service) ou do objeto order (legado)
    const customerName =
      order.customerName || order.order?.customer?.name || "ND";

    // Specs (com fallback para "-")
    const size = order.specs?.size || "-";
    const stone = order.specs?.stoneType || "-";
    const color = order.specs?.stoneColor || "-";
    const finish = order.specs?.finishing || "-";
    const engraving = order.specs?.engraving || "-";
    const type = order.specs?.jewelryType || "-";
    const material = order.specs?.material || "-";
    const category = order.specs?.category || "-";

    // Montagem do Layout
    content += "--------------------------\n";
    // Adicionei \nCliente: ${customerName} aqui na linha de baixo
    content += `Data: ${dateSimple}\nPedido: ${orderNum}\nCliente: ${customerName}\nSKU: ${sku}\n`;
    content += "--------------------------\n";
    content += `Aro: ${size}\nPedra: ${stone}\nCor: ${color}\nBanho: ${finish}\n`;
    content += "--------------------------\n";
    content += `GRAV: ${engraving}\nTipo: ${type}\nMat: ${material}\nCat: ${category}\n`;
    content +=
      "-------------------------\nSUBLISMITH\n-------------------------\n\n\n";
  });

  return content;
}
