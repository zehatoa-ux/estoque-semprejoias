import React, { useState, useEffect, useMemo } from "react";
import {
  Factory,
  Calendar,
  ArrowRight,
  Search,
  MapPin,
  Truck,
  User,
  LayoutList,
  Kanban,
  Edit3,
  Filter,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import { normalizeText } from "../utils/formatters";
import ProductionConversionModal from "../components/modals/ProductionConversionModal";

// --- CONFIGURAÇÃO DE STATUS ---
const STATUS_CONFIG = {
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
    label: "FALHA-BANCA",
    color: "bg-pink-500 text-white border-pink-600",
  },
  IMPRIMIR: {
    label: "IMPRIMIR",
    color: "bg-emerald-500 text-white border-emerald-600",
  },
  PEDIDO_PRONTO: {
    label: "PEDIDO PRONTO",
    color: "bg-green-400 text-green-900 border-green-500",
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
  RESINA_LINHA_GOLD: {
    label: "RESINA/LINHA/GOLD",
    color: "bg-blue-300 text-blue-900 border-blue-400",
  },
  VERIFICAR: {
    label: "VERIFICAR",
    color: "bg-pink-400 text-white border-pink-500",
  },
  ESTOQUE_FUNDIDO: {
    label: "ESTOK FUNDIDO",
    color: "bg-blue-600 text-white border-blue-700",
  },
  IMPRIMINDO: {
    label: "IMPRIMINDO",
    color: "bg-orange-500 text-white border-orange-600",
  },
  BANHO: { label: "BANHO", color: "bg-cyan-600 text-white border-cyan-700" },
  IA_IMPORTED: {
    label: "IA - IMPORTADO",
    color: "bg-yellow-400 text-yellow-900 border-yellow-500",
  },
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

const STATUS_ORDER = [
  "SOLICITACAO",
  "IA_IMPORTED",
  "IMPRIMIR",
  "IMPRIMINDO",
  "CURA",
  "INJECAO",
  "FUNDICAO",
  "ESTOQUE_FUNDIDO",
  "IR_PARA_BANCA",
  "BANCA",
  "FALTA_BANCA",
  "MODELAGEM",
  "GRAVACAO",
  "RESINA_LINHA_GOLD",
  "POLIMENTO",
  "BANHO",
  "VERIFICAR",
  "QUALIDADE",
  "FALTA_PEDRA",
  "MANUTENCAO",
  "PEDIDO_PRONTO",
  "ENVIADO",
  "CANCELADO",
];

const getBusinessDaysDiff = (startDate) => {
  if (!startDate) return 0;
  const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  let curDate = new Date(start.getTime());
  while (curDate < end) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
};

const DaysBadge = ({ date }) => {
  const days = getBusinessDaysDiff(date);
  let colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
  let Icon = Clock;
  if (days >= 5 && days < 8) {
    colorClass = "bg-yellow-100 text-yellow-700 border-yellow-200";
    Icon = AlertTriangle;
  } else if (days >= 8 && days <= 9) {
    colorClass = "bg-red-100 text-red-700 border-red-200 animate-pulse";
    Icon = AlertTriangle;
  } else if (days > 9) {
    colorClass = "bg-purple-900 text-white border-purple-950";
    Icon = AlertTriangle;
  }
  return (
    <div
      className={`flex flex-col items-center justify-center border rounded-lg px-2 py-1 min-w-[50px] ${colorClass}`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase font-bold">
        <Icon size={10} />
        <span>{days > 9 ? "+9" : days} Dias</span>
      </div>
      <span className="text-[9px] opacity-80 font-mono">ÚTEIS</span>
    </div>
  );
};

export default function ProductionTab({ user, findCatalogItem }) {
  const [orders, setOrders] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [viewMode, setViewMode] = useState("kanban");
  const [editingOrder, setEditingOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders"
      ),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
    return () => unsub();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!filterText) return true;
      const search = normalizeText(filterText);
      const sku = normalizeText(order.sku || "");
      const orderNum = normalizeText(order.order?.number || "");
      const client = normalizeText(order.order?.customer?.name || "");
      const catalogItem = findCatalogItem ? findCatalogItem(order.sku) : null;
      const prodName = normalizeText(catalogItem?.name || "");
      return (
        sku.includes(search) ||
        orderNum.includes(search) ||
        client.includes(search) ||
        prodName.includes(search)
      );
    });
  }, [orders, filterText, statusFilter, findCatalogItem]);

  const groupedOrders = useMemo(() => {
    const groups = {};
    STATUS_ORDER.forEach((id) => (groups[id] = []));
    filteredOrders.forEach((order) => {
      const st = order.status || "SOLICITACAO";
      if (!groups[st]) groups[st] = [];
      groups[st].push(order);
    });
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateA - dateB;
      });
    });
    return groups;
  }, [filteredOrders]);

  // --- LOGGING SYSTEM (AUDITORIA) ---
  const logAction = async (action, details, orderId, sku) => {
    try {
      await addDoc(
        collection(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "system_logs"
        ),
        {
          type: "production",
          action: action,
          details: details,
          targetId: orderId,
          targetSku: sku,
          user: user?.name || "Sistema",
          timestamp: serverTimestamp(),
          dateStr: new Date().toLocaleString("pt-BR"),
        }
      );
    } catch (e) {
      console.error("Erro ao logar:", e);
    }
  };

  // --- ACTIONS ---
  const handleMoveStatus = async (orderId, newStatus, sku) => {
    try {
      const docRef = doc(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders",
        orderId
      );
      await updateDoc(docRef, {
        status: newStatus,
        lastUpdate: serverTimestamp(),
        updatedBy: user?.name || "Sistema",
      });
      // LOG
      logAction(
        "MUDANCA_STATUS",
        `Status alterado para ${newStatus}`,
        orderId,
        sku
      );
    } catch (error) {
      alert("Erro ao mover: " + error.message);
    }
  };

  const handleEditSave = async (updatedData) => {
    try {
      const docRef = doc(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders",
        updatedData.id
      );
      await updateDoc(docRef, {
        specs: updatedData.specs,
        updatedBy: user?.name || "Sistema",
        lastUpdate: serverTimestamp(),
      });
      setEditingOrder(null);
      // LOG (Assumindo que temos o SKU no objeto ou buscando depois, aqui simplifiquei)
      logAction(
        "EDICAO_TECNICA",
        "Especificações da joia alteradas",
        updatedData.id,
        "SKU NA"
      );
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
  };

  // --- DELETE COM CONFIRMAÇÃO ESCANDALOSA ---
  const handleDeleteOrder = async (order) => {
    if (order.status !== "CANCELADO") return;

    // Confirmação 1: Texto
    const confirmCode = order.sku;
    const userInput = window.prompt(
      `⛔️ ATENÇÃO! ZONA DE PERIGO ⛔️\n\n` +
        `Você está prestes a APAGAR PERMANENTEMENTE o pedido de produção do item:\n` +
        `${order.sku} - ${order.order?.customer?.name}\n\n` +
        `Essa ação não pode ser desfeita e sumirá dos relatórios.\n\n` +
        `Para confirmar, DIGITE O SKU EXATO do produto abaixo:`
    );

    if (userInput !== confirmCode) {
      return alert(
        "❌ Código incorreto. A exclusão foi cancelada para sua segurança."
      );
    }

    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "production_orders",
          order.id
        )
      );
      await logAction(
        "EXCLUSAO_FATAL",
        `Ordem de Produção apagada permanentemente`,
        order.id,
        order.sku
      );
      alert("✅ Item apagado com sucesso.");
    } catch (e) {
      alert("Erro ao apagar: " + e.message);
    }
  };

  const getSpecsAlert = (order) => {
    const isNatural = order.specs?.stoneType === "Natural";
    let isDivergent = false;
    if (order.specs?.standardColor && order.specs?.stoneColor) {
      isDivergent =
        order.specs.standardColor !== "MANUAL" &&
        order.specs.standardColor.toUpperCase() !==
          order.specs.stoneColor.toUpperCase();
    }
    if (isNatural) return { type: "natural", label: "Pedra Natural" };
    if (isDivergent) return { type: "divergent", label: "Cor Diferente" };
    return null;
  };

  const MiniDashboard = () => (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
      {STATUS_ORDER.map((st) => {
        const count = groupedOrders[st]?.length || 0;
        if (count === 0 && st !== "SOLICITACAO") return null;
        const conf = STATUS_CONFIG[st] || {};
        const colorClass = conf.color?.split(" ")[0] || "bg-gray-200";
        return (
          <div
            key={st}
            className="flex flex-col items-center justify-center bg-white border rounded-lg px-3 py-1.5 min-w-[80px] shadow-sm shrink-0"
          >
            <span className="text-xl font-bold text-slate-700 leading-none">
              {count}
            </span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[80px]">
                {conf.label || st}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-slate-100">
      {editingOrder && (
        <ProductionConversionModal
          isOpen={!!editingOrder}
          reservation={editingOrder}
          onClose={() => setEditingOrder(null)}
          onConfirm={handleEditSave}
          findCatalogItem={findCatalogItem}
          isEditing={true}
        />
      )}

      {/* HEADER */}
      <div className="bg-white px-4 py-3 border-b flex flex-col gap-3 shadow-sm z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Factory className="text-purple-600" />
            <div>
              <h2 className="font-bold text-slate-800 leading-none">
                Produção
              </h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                ORDENADO POR PRIORIDADE (DATA)
              </p>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 ml-4">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${
                  viewMode === "list"
                    ? "bg-white shadow text-purple-600"
                    : "text-slate-400"
                }`}
                title="Lista"
              >
                <LayoutList size={18} />
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 rounded ${
                  viewMode === "kanban"
                    ? "bg-white shadow text-purple-600"
                    : "text-slate-400"
                }`}
                title="Kanban"
              >
                <Kanban size={18} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <select
                className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-purple-500 bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos Status</option>
                {STATUS_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {STATUS_CONFIG[id]?.label || id}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-purple-500 w-full md:w-64"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
          </div>
        </div>
        <MiniDashboard />
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {STATUS_ORDER.map((statusId) => {
              const items = groupedOrders[statusId] || [];
              if (items.length === 0) return null;
              const config = STATUS_CONFIG[statusId] || {
                label: statusId,
                color: "bg-gray-500 text-white",
              };
              return (
                <div
                  key={statusId}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div
                    className={`px-4 py-2 font-bold text-sm flex justify-between items-center ${config.color}`}
                  >
                    <span>
                      {config.label} ({items.length})
                    </span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b">
                      <tr>
                        <th className="px-4 py-2 w-20 text-center">Prazo</th>
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2">Especificações</th>
                        <th className="px-4 py-2">Cliente / Pagamento</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((order) => {
                        const catalog = findCatalogItem
                          ? findCatalogItem(order.sku)
                          : null;
                        const alert = getSpecsAlert(order);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <DaysBadge date={order.createdAt} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-blue-600 text-xs">
                                {order.sku}
                              </div>
                              <div className="text-xs text-slate-600 truncate max-w-[150px]">
                                {catalog?.name || "Carregando..."}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 items-center">
                                {order.specs?.size && (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    Aro: {order.specs.size}
                                  </span>
                                )}
                                {order.specs?.stoneType &&
                                  order.specs.stoneType !== "ND" && (
                                    <span className="bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] border border-yellow-100">
                                      {order.specs.stoneType}{" "}
                                      {order.specs.stoneColor}
                                    </span>
                                  )}
                                {alert && (
                                  <div
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border font-bold ${
                                      alert.type === "natural"
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                    title={alert.label}
                                  >
                                    {alert.type === "natural" ? (
                                      <ShieldCheck size={10} />
                                    ) : (
                                      <AlertTriangle size={10} />
                                    )}
                                    <span className="hidden sm:inline">
                                      {alert.label}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div className="font-bold text-slate-700">
                                {order.order?.customer?.name || "Balcão"}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Calendar size={10} />{" "}
                                {order.dateStr?.split(" ")[0]}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="relative inline-block w-40">
                                <select
                                  className={`w-full text-[10px] font-bold uppercase p-1.5 rounded appearance-none text-center cursor-pointer outline-none border-2 border-white shadow-sm transition-colors ${
                                    STATUS_CONFIG[order.status]?.color ||
                                    "bg-gray-200 text-gray-700"
                                  }`}
                                  value={order.status}
                                  onChange={(e) =>
                                    handleMoveStatus(
                                      order.id,
                                      e.target.value,
                                      order.sku
                                    )
                                  }
                                >
                                  {STATUS_ORDER.map((s) => (
                                    <option
                                      key={s}
                                      value={s}
                                      className="bg-white text-slate-800"
                                    >
                                      {STATUS_CONFIG[s]?.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center flex justify-center gap-2">
                              <button
                                onClick={() => setEditingOrder(order)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit3 size={16} />
                              </button>

                              {/* BOTÃO DA MORTE: SÓ APARECE SE CANCELADO */}
                              {order.status === "CANCELADO" && (
                                <button
                                  onClick={() => handleDeleteOrder(order)}
                                  className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Apagar Definitivamente"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* KANBAN VIEW */}
        {viewMode === "kanban" && (
          <div className="flex gap-4 h-full w-max pb-4">
            {STATUS_ORDER.map((statusId) => {
              const items = groupedOrders[statusId] || [];
              const config = STATUS_CONFIG[statusId] || {
                label: statusId,
                color: "bg-gray-500 text-white",
              };
              const bgClass = config.color.split(" ")[0];
              return (
                <div
                  key={statusId}
                  className="w-72 flex flex-col h-full rounded-xl bg-slate-200/50 border border-slate-300/50"
                >
                  <div
                    className={`p-3 rounded-t-xl border-b flex justify-between items-center text-white ${bgClass}`}
                  >
                    <span className="font-bold text-xs uppercase shadow-sm">
                      {config.label}
                    </span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                    {items.map((order) => {
                      const alert = getSpecsAlert(order);
                      return (
                        <div
                          key={order.id}
                          className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative flex gap-3"
                        >
                          <div className="shrink-0 pt-1">
                            <DaysBadge date={order.createdAt} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded">
                                {order.sku}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setEditingOrder(order)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600"
                                >
                                  <Edit3 size={12} />
                                </button>

                                {/* BOTÃO DA MORTE KANBAN */}
                                {order.status === "CANCELADO" && (
                                  <button
                                    onClick={() => handleDeleteOrder(order)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-300 hover:text-red-600"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-slate-700 font-bold mb-1 truncate">
                              {order.order?.customer?.name}
                            </div>
                            <div className="text-[9px] text-slate-400 mb-2 flex items-center gap-1">
                              <Calendar size={9} />{" "}
                              {order.dateStr?.split(" ")[0]}
                            </div>

                            <div className="bg-slate-50 p-2 rounded text-[10px] space-y-1 border border-slate-100 text-slate-600 mb-2">
                              {order.specs?.size && (
                                <div>📏 Aro {order.specs.size}</div>
                              )}
                              {order.specs?.stoneType && (
                                <div>💎 {order.specs.stoneType}</div>
                              )}
                              {alert && (
                                <div
                                  className={`mt-1 flex items-center gap-1 font-bold ${
                                    alert.type === "natural"
                                      ? "text-blue-600"
                                      : "text-amber-600"
                                  }`}
                                >
                                  {alert.type === "natural" ? (
                                    <ShieldCheck size={10} />
                                  ) : (
                                    <AlertTriangle size={10} />
                                  )}
                                  <span>{alert.label}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-1 border-t flex justify-between items-center">
                              <span className="text-[9px] text-slate-400">
                                PED: {order.order?.number}
                              </span>
                              <div className="relative w-5 h-5">
                                <ArrowRight
                                  size={12}
                                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                />
                                <select
                                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                  value={order.status}
                                  onChange={(e) =>
                                    handleMoveStatus(
                                      order.id,
                                      e.target.value,
                                      order.sku
                                    )
                                  }
                                >
                                  {STATUS_ORDER.map((s) => (
                                    <option key={s} value={s}>
                                      {STATUS_CONFIG[s]?.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
