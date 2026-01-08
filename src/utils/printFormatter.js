export function formatProductionTicket(orders) {
  let content = "";

  orders.forEach((order) => {
    // Tratamento de segurança para dados opcionais
    const dateSimple = order.dateStr ? order.dateStr.split(" ")[0] : "-";
    const orderNum = order.order?.number || "-";
    const sku = order.sku || "-";

    // Lógica para pegar o nome do Cliente
    const customerName =
      order.customerName || order.order?.customer?.name || "ND";

    // Specs (com fallback para "-")
    const size = order.specs?.size || "-";
    const stone = order.specs?.stoneType || "-";
    const color = order.specs?.stoneColor || "-";
    const stoneBatch = order.specs?.stoneBatch || "-"; // <--- NOVO
    const finish = order.specs?.finishing || "-";
    const engraving = order.specs?.engraving || "-";
    const type = order.specs?.jewelryType || "-";
    const material = order.specs?.material || "-";
    const category = order.specs?.category || "-";

    // Montagem do Layout (Otimizado para leitura rápida)
    content += "--------------------------\n";
    content += `PEDIDO: ${orderNum}\n`;
    content += `DATA:   ${dateSimple}\n`;
    content += `CLIENTE: ${customerName}\n`;
    content += "--------------------------\n";

    // Bloco Principal (O que fabricar)
    content += `SKU:  ${sku}\n`;
    content += `ARO:  ${size}\n`;
    content += `METAL: ${material}\n`;
    content += "--------------------------\n";

    // Bloco da Pedra (Incluindo Lote)
    content += `PEDRA: ${stone}\n`;
    content += `COR:   ${color}\n`;
    content += `LOTE:  ${stoneBatch}\n`; // <--- AQUI
    content += "--------------------------\n";

    // Bloco de Acabamento
    content += `ACAB.: ${finish}\n`;
    content += `GRAV.: ${engraving}\n`;
    content += `TIPO:  ${type} / ${category}\n`;

    content +=
      "-------------------------\n       SUBLISMITH\n-------------------------\n\n\n";
  });

  return content;
}
