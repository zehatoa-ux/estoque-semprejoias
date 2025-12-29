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
  ArrowRightLeft,
  Trash2, // <--- ADICIONE ESTE
  Archive, // <--- E ESTE
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
import OrderMoveModal from "../components/modals/OrderMoveModal"; // <--- NOVO: Move item individual
import { generateCertificatePDF } from "../utils/certificateGenerator";

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
  const [editingItem, setEditingItem] = useState(null); // Specs
  const [movingItem, setMovingItem] = useState(null); // Move Order (NOVO)
  const [editingOrderGroup, setEditingOrderGroup] = useState(null); // Batch Edit

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
      // FILTRO: Só mostra o que NÃO está arquivado (!d.archived)
      const data = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((d) => !d.archived);

      setRawData(data);
    });
  }, []);

  // --- AGRUPAMENTO ---
  // --- AGRUPAMENTO E BUSCA PROFUNDA ---
  // --- AGRUPAMENTO E BUSCA PROFUNDA (TURBINADA) ---
  const groupedOrders = useMemo(() => {
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

          // Especificações (Adicionado Finalização e Gravação)
          const stone = normalizeText(item.specs?.stoneType || "");
          const color = normalizeText(item.specs?.stoneColor || "");
          const finishing = normalizeText(item.specs?.finishing || ""); // <--- NOVO
          const engraving = normalizeText(item.specs?.engraving || ""); // <--- NOVO

          // Dados de Contato
          const phone = normalizeText(item.order?.customer?.phone || "");
          const cpf = normalizeText(item.order?.customer?.cpf || "");
          const email = normalizeText(item.order?.customer?.email || "");
          const notes = normalizeText(item.order?.notes || ""); // <--- NOVO (Obs)

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
            finishing.includes(search) || // <--- Checa Banho
            engraving.includes(search) || // <--- Checa Gravação
            phone.includes(search) ||
            cpf.includes(search) ||
            email.includes(search) ||
            notes.includes(search) || // <--- Checa Obs
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
  // --- AÇÃO: EXCLUIR PEDIDO (CANCELADO) ---
  const handleDeleteOrder = async (group) => {
    if (
      !window.confirm(
        `ATENÇÃO: Isso apagará DEFINITIVAMENTE o pedido #${group.orderNumber} e seus ${group.items.length} itens.\n\nTem certeza?`
      )
    )
      return;

    try {
      const batch = writeBatch(db);
      group.referenceIds.forEach((id) => {
        const ref = doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "production_orders",
          id
        );
        batch.delete(ref);
      });
      await batch.commit();
      alert("Pedido excluído permanentemente.");
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  };

  // --- AÇÃO: ARQUIVAR PEDIDO (ENVIADO) ---
  const handleArchiveOrder = async (group) => {
    if (
      !window.confirm(
        `Arquivar o pedido #${group.orderNumber}? Ele sairá desta tela.`
      )
    )
      return;

    try {
      const batch = writeBatch(db);
      group.referenceIds.forEach((id) => {
        const ref = doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "production_orders",
          id
        );
        batch.update(ref, {
          archived: true,
          archivedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      // Não precisa de alert, ele vai sumir da tela automaticamente pelo filtro do useEffect
    } catch (e) {
      alert("Erro ao arquivar: " + e.message);
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

  const handleMoveItem = async (itemId, data) => {
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
        "order.number": data.orderNumber,
        "order.customer.name": data.customerName,
        status: "PEDIDO_MODIFICADO", // Opcional: marca como modificado para alertar
        lastModified: serverTimestamp(),
      });
      setMovingItem(null);
      // Não precisa de alert, o item vai "sumir" do grupo atual e aparecer no novo automaticamente
    } catch (e) {
      alert("Erro ao mover item: " + e.message);
    }
  };

  // --- AÇÃO: IMPRIMIR CERTIFICADOS (REFATORADA) ---
  const handlePrintCertificates = async () => {
    if (selectedItems.size === 0) return;

    const itemsToPrint = rawData.filter((i) => selectedItems.has(i.id));

    // 1. Chama o Gerador (Lógica separada em src/utils)
    const success = generateCertificatePDF(itemsToPrint, findCatalogItem);
    if (!success) return;

    // 2. Atualiza o Banco de Dados (Marca como impresso)
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
      setSelectedItems(new Set()); // Limpa seleção
    } catch (e) {
      console.error("Erro ao marcar como impresso:", e);
    }
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
      {/* MODAL 2: MOVER ITEM (Novo - Simples) */}
      {movingItem && (
        <OrderMoveModal
          isOpen={!!movingItem}
          item={movingItem}
          onClose={() => setMovingItem(null)}
          onConfirm={handleMoveItem}
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
        <div className="space-y-8">
          {/* 1. ESTRUTURA DE AGRUPAMENTO POR STATUS LOGÍSTICO */}
          {LOGISTICS_STATUS.map((statusLabel) => {
            // Filtra quais pedidos (GRUPOS PAI) pertencem a este status
            const ordersInStatus = groupedOrders.filter(
              (g) => g.logisticsStatus === statusLabel
            );

            // Se não tiver nenhum pedido neste status, pula (não renderiza nada)
            if (ordersInStatus.length === 0) return null;

            return (
              <div
                key={statusLabel}
                className="bg-slate-50/50 rounded-xl border border-slate-200/60 overflow-hidden mb-6"
              >
                {/* CABEÇALHO DO STATUS (Ex: ENVIADO - 5 Pedidos) */}
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h3
                      className={`font-bold text-xs uppercase px-2 py-1 rounded border ${getLogisticsColor(
                        statusLabel
                      )}`}
                    >
                      {statusLabel}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {ordersInStatus.length}{" "}
                    {ordersInStatus.length === 1 ? "Pedido" : "Pedidos"}
                  </span>
                </div>

                {/* LISTA DE PEDIDOS DENTRO DESTE STATUS */}
                <div className="p-3 space-y-3">
                  {ordersInStatus.map((group) => {
                    const isExpanded = expandedOrders.has(group.orderNumber);

                    return (
                      <div
                        key={group.orderNumber}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
                      >
                        {/* HEADER DO PEDIDO (PAI) */}
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
                                <DollarSign size={12} />{" "}
                                {formatMoney(group.totalValue)}
                              </span>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2 pl-4 border-l ml-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* BOTÃO ARQUIVAR (Só aparece se estiver ENVIADO ou ENTREGUE) */}
                            {group.logisticsStatus === "ENVIADO" && (
                              <button
                                onClick={() => handleArchiveOrder(group)}
                                className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                title="Arquivar Pedido (Sai da tela)"
                              >
                                <Archive size={16} />
                              </button>
                            )}

                            {/* BOTÃO EXCLUIR (Só aparece se estiver CANCELADO) */}
                            {group.logisticsStatus === "CANCELADO" && (
                              <button
                                onClick={() => handleDeleteOrder(group)}
                                className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                title="Excluir Pedido Definitivamente"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}

                            <button
                              onClick={() => setEditingOrderGroup(group)}
                              className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Editar Dados do Pedido"
                            >
                              <Pencil size={16} />
                            </button>

                            {/* ... (o restante dos seus campos de Envio e Status continuam aqui embaixo) ... */}

                            <div className="text-right">
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                Envio
                              </div>
                              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold truncate max-w-[100px] block text-center">
                                {group.shippingMethod}
                              </span>
                            </div>

                            {/* Mover de Status (Dropdown) */}
                            <div className="text-right">
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                Mover Para
                              </div>
                              <select
                                className="text-xs font-bold px-2 py-1.5 rounded border outline-none cursor-pointer bg-white text-slate-600 border-slate-300 hover:border-blue-400"
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

                        {/* LISTA DE SUBITENS (FILHOS) */}
                        {isExpanded && (
                          <div className="bg-slate-50 border-t p-4 animate-slide-in">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Package size={14} /> Itens do Pedido (
                              {group.items.length})
                            </h4>
                            <div className="space-y-2">
                              {group.items.map((subItem, idx) => {
                                const statusConf = PRODUCTION_STATUS_CONFIG[
                                  subItem.status
                                ] || {
                                  label: subItem.status,
                                  color: "bg-gray-200 text-gray-700",
                                };
                                const isSelected = selectedItems.has(
                                  subItem.id
                                );

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
                                        onChange={() =>
                                          toggleSelection(subItem.id)
                                        }
                                      />

                                      <button
                                        onClick={() => setEditingItem(subItem)}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                        title="Editar Especificações"
                                      >
                                        <Edit2 size={16} />
                                      </button>

                                      <button
                                        onClick={() => setMovingItem(subItem)}
                                        className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                        title="Mover / Corrigir Nº Pedido"
                                      >
                                        <ArrowRightLeft size={16} />
                                      </button>

                                      <div className="flex gap-1">
                                        {subItem.fromStock && (
                                          <div
                                            className="bg-emerald-700 text-white text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4 cursor-help"
                                            title="Estoque"
                                          >
                                            E
                                          </div>
                                        )}
                                        {subItem.printed && (
                                          <div
                                            className="bg-amber-400 text-amber-900 text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4 cursor-help"
                                            title="Produção Impressa"
                                          >
                                            I
                                          </div>
                                        )}
                                        {subItem.certificatePrinted && (
                                          <div
                                            className="bg-blue-600 text-white text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4 cursor-help"
                                            title="Certificado Impresso"
                                          >
                                            C
                                          </div>
                                        )}
                                      </div>

                                      <div className="font-mono text-xs font-bold bg-slate-100 px-1.5 py-0.5 rounded text-blue-600">
                                        {subItem.sku}
                                      </div>

                                      <div className="text-slate-700 flex flex-wrap items-center gap-2 text-xs">
                                        {subItem.specs?.stoneType && (
                                          <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100">
                                            {subItem.specs.stoneType}
                                          </span>
                                        )}
                                        {subItem.specs?.stoneColor &&
                                          subItem.specs.stoneColor !== "ND" && (
                                            <span className="text-xs bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded border border-pink-100 font-bold">
                                              Cor: {subItem.specs.stoneColor}
                                            </span>
                                          )}
                                        {subItem.specs?.size && (
                                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                            Aro {subItem.specs.size}
                                          </span>
                                        )}
                                        {subItem.specs?.finishing &&
                                          subItem.specs.finishing !== "ND" && (
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                              {subItem.specs.finishing}
                                            </span>
                                          )}
                                        {subItem.specs?.engraving &&
                                          subItem.specs.engraving !== "ND" && (
                                            <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 italic">
                                              Grav: "{subItem.specs.engraving}"
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
                                        value={subItem.status}
                                        onChange={(e) =>
                                          handleItemStatusChange(
                                            subItem.id,
                                            e.target.value
                                          )
                                        }
                                      >
                                        {Object.keys(
                                          PRODUCTION_STATUS_CONFIG
                                        ).map((key) => (
                                          <option
                                            key={key}
                                            value={key}
                                            className="bg-white text-slate-800 font-normal"
                                          >
                                            {
                                              PRODUCTION_STATUS_CONFIG[key]
                                                .label
                                            }
                                          </option>
                                        ))}
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
                </div>
              </div>
            );
          })}

          {/* MENSAGEM SE NÃO TIVER NADA */}
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
