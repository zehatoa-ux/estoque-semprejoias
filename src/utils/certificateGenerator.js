// src/utils/certificateGenerator.js

export const generateCertificatePDF = (itemsToPrint, findCatalogItem) => {
  if (!window.jspdf) {
    alert("Erro: Biblioteca PDF não carregada.");
    return false;
  }

  // Configuração para papel 100mm x 150mm (Padrão Zebra/Térmica)
  const pdfDoc = new window.jspdf.jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150],
  });

  itemsToPrint.forEach((item, index) => {
    if (index > 0) pdfDoc.addPage();

    // --- 1. PREPARAÇÃO DOS DADOS ---
    const customerName = item.order?.customer?.name || "Cliente Balcão";
    const orderNumber = item.order?.number || "Avulso";

    // Formata data
    let dateStr = "Data Indefinida";
    if (item.createdAt?.toDate) {
      dateStr = item.createdAt.toDate().toLocaleDateString("pt-BR");
    }

    const catalogData = findCatalogItem ? findCatalogItem(item.sku) : null;

    // Nome do produto: tenta catálogo > tenta nome manual > usa SKU
    let productName = catalogData?.name || item.sku;
    if (item.specs?.size) productName += ` (Aro ${item.specs.size})`;

    const specs = item.specs || {};

    // --- 2. CONFIGURAÇÃO DE ESTILO ---
    pdfDoc.setFont("helvetica", "bold"); // Define fonte padrão como Negrito

    const margin = 6;
    const pageWidth = 100;
    const contentWidth = pageWidth - margin * 2;
    let y = 12; // Posição vertical inicial

    // Função auxiliar interna para escrever linhas
    const writeLine = (text, fontSize, align = "left", extraSpacing = 0) => {
      pdfDoc.setFontSize(fontSize);

      if (align === "center") {
        pdfDoc.text(text, pageWidth / 2, y, { align: "center" });
        y += fontSize * 0.35;
      } else {
        const splitText = pdfDoc.splitTextToSize(text, contentWidth);
        pdfDoc.text(splitText, margin, y);
        y += splitText.length * (fontSize * 0.35);
      }
      y += extraSpacing;
    };

    // --- 3. CONTEÚDO DO CERTIFICADO ---

    // Título
    writeLine("Certificado de Garantia", 16, "center", 6);

    // Bloco do Pedido
    writeLine(`Emitido para: ${customerName}`, 11, "left", 1);
    writeLine(`Pedido nº: ${orderNumber}`, 11, "left", 1);
    writeLine(`Data do Pedido: ${dateStr}`, 11, "left", 4);

    // Intro
    writeLine(
      "Este certificado confirma que o cliente adquiriu o seguinte produto:",
      11,
      "left",
      4
    );

    // Bloco do Produto
    writeLine(`Descrição: ${productName}`, 11, "left", 1);
    writeLine(
      `Tipo de Pedra: ${specs.stoneType || "Não Aplica"}`,
      11,
      "left",
      1
    );
    writeLine(
      `Cor da Pedra: ${specs.stoneColor || "Não Aplica"}`,
      11,
      "left",
      1
    );
    writeLine(`Metal: ${specs.material || "Prata 925"}`, 11, "left", 1);
    writeLine(`Finalização: ${specs.finishing || "Polido"}`, 11, "left", 4);

    // Garantia
    writeLine(
      "Este produto possui garantia permanente, conforme os termos fornecidos no momento da compra.",
      11,
      "left",
      6
    );

    // Contato
    writeLine("Entre em contato conosco:", 11, "left", 1);
    writeLine("Site: www.semprejoias.com.br", 11, "left", 1);
    writeLine("WhatsApp: 11-94833-5927", 11, "left", 1);
    writeLine("E-mail: semprejoias@gmail.com", 11, "left", 6);

    // Assinatura
    writeLine("Atenciosamente,", 11, "left", 1);
    writeLine("Equipe Sempre Joias", 11, "left", 0);
  });

  // Salva o arquivo
  pdfDoc.save("certificados_garantia.pdf");
  return true; // Retorna sucesso
};
