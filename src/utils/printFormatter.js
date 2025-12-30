// src/utils/printFormatter.js

export function formatProductionTicket(orders) {
  let content = "";

  orders.forEach((order) => {
    // Tratamento de segurança para dados opcionais
    const dateSimple = order.dateStr ? order.dateStr.split(" ")[0] : "-";
    const orderNum = order.order?.number || "-";
    const sku = order.sku || "-";

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
    content += `Data: ${dateSimple}\nPedido: ${orderNum}\nSKU: ${sku}\n`;
    content += "--------------------------\n";
    content += `Aro: ${size}\nPedra: ${stone}\nCor: ${color}\nBanho: ${finish}\n`;
    content += "--------------------------\n";
    content += `GRAV: ${engraving}\nTipo: ${type}\nMat: ${material}\nCat: ${category}\n`;
    content +=
      "--------------------------\nF\n--------------------------\n\n\n";
  });

  return content;
}
