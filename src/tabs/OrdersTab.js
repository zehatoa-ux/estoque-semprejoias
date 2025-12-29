import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Truck,
  Calendar,
  DollarSign,
  User,
  Search,
  Filter,
  Printer,
  Edit2,
  Pencil,
} from "lucide-react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import { formatMoney, normalizeText } from "../utils/formatters";
import ProductionConversionModal from "../components/modals/ProductionConversionModal";
import OrderEditModal from "../components/modals/OrderEditModal";

// --- STATUS LOGÍSTICOS ---
const LOGISTICS_STATUS = [
  "SEM ETIQUETA",
  "CANCELADO",
  "ENVIADO",
  "REPOSTAGEM",
  "AGUARDANDO",
  "AGUARDANDO RETIRADA",
  "PRONTO PARA POSTAR",
  "GOLPE",
  "FOTO",
  "ML",
  "MOTOBOY",
  "FELIPPE",
  "PRONTO EM ESPERA",
];

// --- STATUS DE PRODUÇÃO ---
const PRODUCTION_STATUS_CONFIG = {
  PEDIDO_MODIFICADO: {
    label: "PEDIDO MODIFICADO",
    color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300",
  },
  SOLICITACAO: {
    label: "AGUARDANDO ANÁLISE",
    color: "bg-slate-600 text-white border-slate-700",
  },
  GRAVACAO: {
    label: "GRAVAÇÃO",
    color: "bg-orange-400 text-white border-orange-500",
  },
  MODELAGEM: {
    label: "MODELAGEM",
    color: "bg-pink-300 text-pink-900 border-pink-400",
  },
  FALTA_BANCA: {
    label: "FALHA BANCA",
    color: "bg-red-500 text-white border-red-600",
  },
  IMPRIMIR: {
    label: "IMPRIMIR",
    color: "bg-emerald-500 text-white border-emerald-600",
  },
  PEDIDO_PRONTO: {
    label: "PEDIDO PRONTO",
    color: "bg-green-600 text-white border-green-700",
  },
  CANCELADO: {
    label: "CANCELADO",
    color: "bg-gray-700 text-gray-300 border-gray-800",
  },
  CURA: { label: "CURA", color: "bg-purple-600 text-white border-purple-700" },
  INJECAO: {
    label: "INJEÇÃO",
    color: "bg-indigo-600 text-white border-indigo-700",
  },
  RESINA_FINALIZACAO: {
    label: "RESINA/FINALIZAÇÃO",
    color: "bg-blue-400 text-white border-blue-500",
  },
  VERIFICAR: {
    label: "VERIFICAR",
    color: "bg-pink-400 text-white border-pink-500",
  },
  ESTOQUE_IMPRIMINDO: {
    label: "ESTOQUE - IMPRIMINDO",
    color: "bg-cyan-700 text-white border-cyan-800",
  },
  ESTOQUE_FUNDIDO: {
    label: "ESTOQUE - FUNDIDO",
    color: "bg-blue-800 text-white border-blue-900",
  },
  IMPRIMINDO: {
    label: "IMPRIMINDO",
    color: "bg-orange-500 text-white border-orange-600",
  },
  BANHO: { label: "BANHO", color: "bg-cyan-600 text-white border-cyan-700" },
  IR_PARA_BANCA: {
    label: "IR PARA BANCA",
    color: "bg-stone-600 text-white border-stone-700",
  },
  FUNDICAO: {
    label: "FUNDIÇÃO",
    color: "bg-teal-400 text-teal-900 border-teal-500",
  },
  POLIMENTO: {
    label: "POLIMENTO",
    color: "bg-yellow-600 text-white border-yellow-700",
  },
  ENVIADO: {
    label: "ENVIADO",
    color: "bg-stone-500 text-white border-stone-600",
  },
  QUALIDADE: { label: "Q", color: "bg-blue-700 text-white border-blue-800" },
  BANCA: { label: "BANCA", color: "bg-lime-500 text-lime-900 border-lime-600" },
  MANUTENCAO: {
    label: "AJUSTE/MANUTENÇÃO",
    color: "bg-sky-400 text-white border-sky-500",
  },
  FALTA_PEDRA: {
    label: "FALTA PEDRA",
    color: "bg-purple-400 text-purple-900 border-purple-500",
  },
};

const getLogisticsColor = (status) => {
  switch (status) {
    case "ENVIADO":
      return "bg-green-100 text-green-700 border-green-200";
    case "CANCELADO":
      return "bg-red-100 text-red-700 border-red-200";
    case "GOLPE":
      return "bg-red-600 text-white border-red-700 animate-pulse";
    case "MOTOBOY":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "PRONTO PARA POSTAR":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "SEM ETIQUETA":
      return "bg-gray-100 text-gray-600 border-gray-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export default function OrdersTab({ findCatalogItem }) {
  const [rawData, setRawData] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modais
  const [editingItem, setEditingItem] = useState(null);
  const [editingOrderGroup, setEditingOrderGroup] = useState(null);

  useEffect(() => {
    const q = query(
      collection(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders"
      ),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setRawData(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
  }, []);

  // --- AGRUPAMENTO ---
  const groupedOrders = useMemo(() => {
    const groups = {};
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

      // Soma dinâmica
      let itemPrice = 0;
      const catalogItem = findCatalogItem ? findCatalogItem(item.sku) : null;
      if (catalogItem && catalogItem.price) {
        itemPrice = parseFloat(catalogItem.price);
      } else if (item.price) {
        itemPrice = parseFloat(item.price);
      }
      groups[orderNum].totalValue += itemPrice;
    });

    // Override se houver total gravado e soma for 0
    Object.values(groups).forEach((group) => {
      const legacyTotal = group.items[0]?.order?.payment?.total;
      if (legacyTotal && (group.totalValue === 0 || legacyTotal !== "")) {
        // Se tem um override explícito no banco, usa ele (para manter edições manuais)
        // Nota: A lógica aqui pode variar conforme preferência: sempre somar ou respeitar o gravado?
        // Vou manter: Se tem valor gravado > 0, usa ele. Se não, usa a soma.
        if (parseFloat(legacyTotal) > 0)
          group.totalValue = parseFloat(legacyTotal);
      }
    });

    let result = Object.values(groups).sort((a, b) => b.date - a.date);
    if (searchTerm || statusFilter !== "all") {
      const search = normalizeText(searchTerm);
      result = result.filter((g) => {
        const matchesSearch =
          normalizeText(g.orderNumber).includes(search) ||
          normalizeText(g.customerName).includes(search);
        const matchesStatus =
          statusFilter === "all" || g.logisticsStatus === statusFilter;
        return matchesSearch && matchesStatus;
      });
    }
    return result;
  }, [rawData, searchTerm, statusFilter, findCatalogItem]);

  // --- AÇÕES ---
  const toggleExpand = (orderNum) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderNum)) newSet.delete(orderNum);
    else newSet.add(orderNum);
    setExpandedOrders(newSet);
  };

  const toggleSelection = (itemId) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) newSet.delete(itemId);
    else newSet.add(itemId);
    setSelectedItems(newSet);
  };

  const handleStatusChange = async (group, newStatus) => {
    if (!window.confirm(`Mudar pedido ${group.orderNumber} para ${newStatus}?`))
      return;
    group.referenceIds.forEach(async (id) => {
      const ref = doc(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders",
        id
      );
      await updateDoc(ref, { logisticsStatus: newStatus });
    });
  };

  const handleItemStatusChange = async (itemId, newStatus) => {
    if (!window.confirm("Confirmar alteração de status de produção?")) return;
    try {
      const ref = doc(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders",
        itemId
      );
      await updateDoc(ref, {
        status: newStatus,
        lastUpdate: serverTimestamp(),
      });
    } catch (e) {
      alert("Erro ao atualizar status: " + e.message);
    }
  };

  // --- SALVAR EDIÇÃO DO PEDIDO (COMPLETO) ---
  const handleUpdateOrder = async (newData) => {
    if (!editingOrderGroup) return;
    if (
      !window.confirm(
        `Atualizar dados de ${editingOrderGroup.items.length} itens?`
      )
    )
      return;

    try {
      const batch = writeBatch(db);

      editingOrderGroup.items.forEach((item) => {
        const ref = doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "production_orders",
          item.id
        );

        // Mapeamento COMPLETO dos campos novos
        const updateData = {
          "order.number": newData.orderNumber,
          "order.notes": newData.notes, // Notas gerais

          // Cliente
          "order.customer.name": newData.customerName,
          "order.customer.cpf": newData.customerCpf,
          "order.customer.phone": newData.customerPhone,
          "order.customer.email": newData.customerEmail,

          // Logística
          "shipping.tipoenvio": newData.shippingMethod,
          "shipping.price": newData.shippingPrice,
          "shipping.tracking": newData.tracking,

          // Endereço (Flat structure inside address object)
          "shipping.address.zip": newData.zip,
          "shipping.address.street": newData.street,
          "shipping.address.number": newData.number,
          "shipping.address.complemento": newData.comp,
          "shipping.address.bairro": newData.district,
          "shipping.address.city": newData.city,
          "shipping.address.statecode": newData.state, // ou state

          // Pagamento
          "order.payment.method": newData.paymentMethod,
        };

        // Valor Total (Apenas se preenchido para override)
        if (newData.totalValueOverride) {
          updateData["order.payment.total"] = newData.totalValueOverride;
        }

        batch.update(ref, updateData);
      });

      await batch.commit();
      setEditingOrderGroup(null);
      alert("Dados do pedido atualizados com sucesso!");
    } catch (e) {
      alert("Erro ao atualizar pedido: " + e.message);
    }
  };

  const handleSaveEditItem = async (updatedData) => {
    if (!editingItem) return;
    try {
      const ref = doc(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders",
        editingItem.id
      );
      await updateDoc(ref, {
        specs: updatedData.specs,
        status: "PEDIDO_MODIFICADO",
        lastModified: serverTimestamp(),
        modifiedBy: "Logística",
      });
      setEditingItem(null);
      alert("Item atualizado! Status alterado para PEDIDO MODIFICADO.");
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const handlePrintCertificates = async () => {
    if (selectedItems.size === 0) return;
    if (!window.jspdf) return alert("Erro: Biblioteca PDF não carregada.");

    const itemsToPrint = rawData.filter((i) => selectedItems.has(i.id));
    const pdfDoc = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [100, 150],
    });

    itemsToPrint.forEach((item, index) => {
      if (index > 0) pdfDoc.addPage();
      const catalogData = findCatalogItem ? findCatalogItem(item.sku) : null;
      const productName = catalogData?.name || item.sku;
      const specs = item.specs || {};
      const dateStr = new Date().toLocaleDateString("pt-BR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      pdfDoc.setFontSize(10);
      pdfDoc.setFont("helvetica", "bold");
      let y = 10;
      const lineHeight = 6;
      const leftMargin = 5;

      pdfDoc.text(`Data: ${dateStr}`, leftMargin, y);
      y += lineHeight;
      pdfDoc.text(`Pedido: ${item.order?.number || "Balcão"}`, leftMargin, y);
      y += lineHeight;
      pdfDoc.text(
        `Nome: ${item.order?.customer?.name || "Cliente"}`,
        leftMargin,
        y
      );
      y += lineHeight;
      y += 2;
      pdfDoc.text(`Referência (SKU): ${item.sku}`, leftMargin, y);
      y += lineHeight;

      pdfDoc.text("Descrição:", leftMargin, y);
      pdfDoc.setFont("helvetica", "normal");
      const splitDesc = pdfDoc.splitTextToSize(productName, 90);
      pdfDoc.text(splitDesc, leftMargin + 20, y);
      y += splitDesc.length * lineHeight;

      const addField = (label, value) => {
        if (!value || value === "ND") return;
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text(`${label}:`, leftMargin, y);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.text(String(value), leftMargin + 30, y);
        y += lineHeight;
      };

      addField("Medidas", specs.size ? `Aro ${specs.size}` : "");
      addField("Tipo de Pedra", specs.stoneType);
      addField("Cor da Pedra", specs.stoneColor);
      addField("Metal", specs.material || "Prata 925");
      addField("Finalização", specs.finishing);
      addField("Gravação", specs.engraving);

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("Observações:", leftMargin, y);
    });

    pdfDoc.save("certificados_garantia.pdf");

    const batch = writeBatch(db);
    itemsToPrint.forEach((item) => {
      const ref = doc(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders",
        item.id
      );
      batch.update(ref, { certificatePrinted: true });
    });
    try {
      await batch.commit();
      setSelectedItems(new Set());
    } catch (e) {}
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {editingItem && (
        <ProductionConversionModal
          isOpen={!!editingItem}
          reservation={editingItem}
          isEditing={true}
          findCatalogItem={findCatalogItem}
          onClose={() => setEditingItem(null)}
          onConfirm={handleSaveEditItem}
        />
      )}

      {editingOrderGroup && (
        <OrderEditModal
          isOpen={!!editingOrderGroup}
          orderGroup={editingOrderGroup}
          onClose={() => setEditingOrderGroup(null)}
          onSave={handleUpdateOrder}
        />
      )}

      <div className="bg-white p-4 border-b flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <Truck className="text-blue-600" />
          <div>
            <h2 className="font-bold text-lg text-slate-800">
              Expedição & Logística
            </h2>
            <p className="text-xs text-slate-400 font-bold">
              {groupedOrders.length} Pedidos Listados
            </p>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto items-center">
          {selectedItems.size > 0 && (
            <button
              onClick={handlePrintCertificates}
              className="flex items-center gap-2 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors animate-fade-in shadow-lg mr-2"
            >
              <Printer size={16} /> Imprimir Certificados ({selectedItems.size})
            </button>
          )}

          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <select
              className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none bg-white focus:border-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos Status</option>
              {LOGISTICS_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Buscar pedido, cliente..."
              className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none w-full focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="space-y-3">
          {groupedOrders.map((group) => {
            const isExpanded = expandedOrders.has(group.orderNumber);

            return (
              <div
                key={group.orderNumber}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                <div
                  className={`p-4 flex items-center justify-between cursor-pointer ${
                    isExpanded ? "bg-blue-50/50" : "bg-white"
                  }`}
                  onClick={() => toggleExpand(group.orderNumber)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button className="text-slate-400 hover:text-blue-600">
                      {isExpanded ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>

                    <div className="flex flex-col w-24">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Data
                      </span>
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Calendar size={12} />{" "}
                        {group.date.toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    <div className="flex flex-col w-32">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Nº Pedido
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        #{group.orderNumber}
                      </span>
                    </div>

                    <div className="flex flex-col flex-1 min-w-[150px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Cliente
                      </span>
                      <span className="text-sm font-bold text-slate-700 truncate flex items-center gap-1">
                        <User size={12} /> {group.customerName}
                      </span>
                    </div>

                    <div className="flex flex-col w-32 text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Valor Total
                      </span>
                      <span className="text-sm font-bold text-emerald-600 flex items-center justify-end gap-1">
                        <DollarSign size={12} /> {formatMoney(group.totalValue)}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-4 pl-4 border-l ml-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setEditingOrderGroup(group)}
                      className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Editar Dados do Pedido"
                    >
                      <Pencil size={16} />
                    </button>

                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Envio
                      </div>
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold truncate max-w-[100px] block text-center">
                        {group.shippingMethod}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Status Logístico
                      </div>
                      <select
                        className={`text-xs font-bold px-2 py-1.5 rounded border outline-none cursor-pointer ${getLogisticsColor(
                          group.logisticsStatus
                        )}`}
                        value={group.logisticsStatus}
                        onChange={(e) =>
                          handleStatusChange(group, e.target.value)
                        }
                      >
                        {LOGISTICS_STATUS.map((s) => (
                          <option
                            key={s}
                            value={s}
                            className="bg-white text-slate-800"
                          >
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-slate-50 border-t p-4 animate-slide-in">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                      <Package size={14} /> Itens do Pedido (
                      {group.items.length})
                    </h4>
                    <div className="space-y-2">
                      {group.items.map((item, idx) => {
                        const statusConf = PRODUCTION_STATUS_CONFIG[
                          item.status
                        ] || {
                          label: item.status,
                          color: "bg-gray-200 text-gray-700",
                        };
                        const isSelected = selectedItems.has(item.id);

                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded border border-slate-200 flex justify-between items-center text-sm transition-all ${
                              isSelected
                                ? "bg-purple-50 border-purple-300"
                                : "bg-white hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                checked={isSelected}
                                onChange={() => toggleSelection(item.id)}
                              />

                              <button
                                onClick={() => setEditingItem(item)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Editar Especificações (Muda Status)"
                              >
                                <Edit2 size={16} />
                              </button>

                              <div className="flex gap-1">
                                {item.fromStock && (
                                  <div
                                    className="bg-emerald-700 text-white text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4 cursor-help"
                                    title="Estoque"
                                  >
                                    E
                                  </div>
                                )}
                                {item.printed && (
                                  <div
                                    className="bg-amber-400 text-amber-900 text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4 cursor-help"
                                    title="Produção Impressa"
                                  >
                                    I
                                  </div>
                                )}
                                {item.certificatePrinted && (
                                  <div
                                    className="bg-blue-600 text-white text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4 cursor-help"
                                    title="Certificado Impresso"
                                  >
                                    C
                                  </div>
                                )}
                              </div>

                              <div className="font-mono text-xs font-bold bg-slate-100 px-1.5 py-0.5 rounded text-blue-600">
                                {item.sku}
                              </div>

                              <div className="text-slate-700 flex flex-wrap items-center gap-2 text-xs">
                                {item.specs?.stoneType && (
                                  <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100">
                                    {item.specs.stoneType}
                                  </span>
                                )}
                                {item.specs?.stoneColor &&
                                  item.specs.stoneColor !== "ND" && (
                                    <span className="text-xs bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded border border-pink-100 font-bold">
                                      Cor: {item.specs.stoneColor}
                                    </span>
                                  )}
                                {item.specs?.size && (
                                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                    Aro {item.specs.size}
                                  </span>
                                )}
                                {item.specs?.finishing &&
                                  item.specs.finishing !== "ND" && (
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                      {item.specs.finishing}
                                    </span>
                                  )}
                                {item.specs?.engraving &&
                                  item.specs.engraving !== "ND" && (
                                    <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 italic">
                                      Grav: "{item.specs.engraving}"
                                    </span>
                                  )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">
                                Produção:
                              </span>
                              <select
                                className={`text-[10px] font-bold px-2 py-1 rounded uppercase cursor-pointer outline-none text-center ${statusConf.color}`}
                                value={item.status}
                                onChange={(e) =>
                                  handleItemStatusChange(
                                    item.id,
                                    e.target.value
                                  )
                                }
                              >
                                {Object.keys(PRODUCTION_STATUS_CONFIG).map(
                                  (key) => (
                                    <option
                                      key={key}
                                      value={key}
                                      className="bg-white text-slate-800 font-normal"
                                    >
                                      {PRODUCTION_STATUS_CONFIG[key].label}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {groupedOrders.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Package size={48} className="mx-auto mb-2 opacity-20" />
              <p>Nenhum pedido encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
