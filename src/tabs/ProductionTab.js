import React, { useState, useEffect, useMemo } from "react";
import {
  Factory,
  Calendar,
  ArrowRight,
  Search,
  LayoutList,
  Kanban,
  Edit3,
  Filter,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  Printer,
  CheckSquare,
  Hourglass,
  Copy,
  X,
  PackageCheck,
  BarChart3,
  TrendingUp,
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
  writeBatch,
  increment,
  setDoc,
  getDoc,
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
  ESTOQUE_FUNDIDO: {
    label: "ESTOK FUNDIDO",
    color: "bg-blue-600 text-white border-blue-700",
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

const STATUS_ORDER = [
  "MODELAGEM",
  "GRAVACAO",
  "MANUTENCAO",
  "FALTA_BANCA",
  "SOLICITACAO",
  "IMPRIMIR",
  "IMPRIMINDO",
  "CURA",
  "FUNDICAO",
  "BANCA",
  "POLIMENTO",
  "RESINA_FINALIZACAO",
  "VERIFICAR",
  "PEDIDO_PRONTO",
  "CANCELADO",
];

const DAYS_COLUMNS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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

const TextModal = ({ title, content, onClose }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    alert("Copiado!");
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Copy size={20} />
            <h3 className="font-bold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-1 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 bg-slate-50">
          <textarea
            className="w-full h-64 p-3 font-mono text-xs border border-slate-300 rounded-lg focus:border-blue-500 outline-none resize-none bg-white text-slate-800"
            readOnly
            value={content}
          />
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Copy size={16} /> Copiar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// --- GRÁFICO DE BARRAS ---
const AgeChart = ({ orders }) => {
  const distribution = useMemo(() => {
    const counts = Array(11).fill(0);
    orders.forEach((o) => {
      if (
        o.status === "PEDIDO_PRONTO" ||
        o.status === "CANCELADO" ||
        o.status === "ENVIADO"
      )
        return;
      let days = getBusinessDaysDiff(o.createdAt);
      if (days > 10) days = 10;
      counts[days]++;
    });
    return counts;
  }, [orders]);

  const maxVal = Math.max(...distribution, 1);

  return (
    <div className="flex items-end gap-1 h-16 w-full mt-2 px-1 border-b border-slate-200 pb-1">
      {distribution.map((count, day) => {
        let colorClass = "bg-emerald-400";
        if (day >= 5) colorClass = "bg-yellow-400";
        if (day >= 8) colorClass = "bg-orange-500";
        if (day >= 10) colorClass = "bg-purple-600";

        const heightPercent =
          count > 0 ? Math.max((count / maxVal) * 100, 10) : 0;

        return (
          <div
            key={day}
            className="flex-1 flex flex-col justify-end group relative h-full"
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
              <span className="font-bold">{count} pedidos</span> (
              {day === 10 ? "10+" : day} dias)
            </div>
            <div className="w-full bg-slate-100 rounded-t-sm relative h-full flex items-end overflow-hidden">
              {count > 0 && (
                <div
                  className={`w-full transition-all duration-500 ${colorClass}`}
                  style={{ height: `${heightPercent}%` }}
                ></div>
              )}
            </div>
            <div className="text-[9px] text-center text-slate-400 font-bold mt-1 border-t border-transparent group-hover:border-slate-300 group-hover:text-slate-600">
              {day === 10 ? "10+" : day}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function ProductionTab({ user, findCatalogItem }) {
  const [orders, setOrders] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [groupBy, setGroupBy] = useState("status");
  const [editingOrder, setEditingOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [textModalData, setTextModalData] = useState(null);
  const [stats, setStats] = useState({});

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

  useEffect(() => {
    if (!db) return;
    const statsRef = doc(
      db,
      "artifacts",
      APP_COLLECTION_ID,
      "public",
      "data",
      "statistics",
      "production_monthly"
    );
    const unsub = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data());
      }
    });
    return () => unsub();
  }, []);

  // --- MINI DASHBOARD ---
  const MiniDashboard = () => (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 pt-2 custom-scrollbar">
      {STATUS_ORDER.map((st) => {
        const count = orders.filter((o) => o.status === st).length;
        if (count === 0 && st !== "SOLICITACAO") return null;
        const conf = STATUS_CONFIG[st] || {};
        const colorClass = conf.color?.split(" ")[0] || "bg-gray-200";
        return (
          <div
            key={st}
            className="flex flex-col items-center justify-center bg-white border rounded-lg px-3 py-1.5 min-w-[80px] shadow-sm shrink-0 cursor-default hover:shadow-md transition-shadow"
          >
            <span className="text-xl font-bold text-slate-700 leading-none">
              {count}
            </span>
            <div className="flex items-center gap-1 mt-1">
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
    if (groupBy === "status") {
      STATUS_ORDER.forEach((id) => (groups[id] = []));
      filteredOrders.forEach((order) => {
        const st = order.status || "SOLICITACAO";
        if (!groups[st]) groups[st] = [];
        groups[st].push(order);
      });
    } else {
      DAYS_COLUMNS.forEach((d) => (groups[d] = []));
      filteredOrders.forEach((order) => {
        let days = getBusinessDaysDiff(order.createdAt);
        if (days > 10) days = 10;
        if (groups[days]) groups[days].push(order);
      });
    }
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateA - dateB;
      });
    });
    return groups;
  }, [filteredOrders, groupBy]);

  const handleMoveStatus = async (orderId, newStatus) => {
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
      const currentOrder = orders.find((o) => o.id === orderId);
      const currentStatus = currentOrder ? currentOrder.status : "";

      await updateDoc(docRef, {
        status: newStatus,
        lastUpdate: serverTimestamp(),
        updatedBy: user?.name || "Sistema",
      });

      if (newStatus === "PEDIDO_PRONTO" && currentStatus !== "PEDIDO_PRONTO") {
        const now = new Date();
        const monthKey = `${now.getFullYear()}_${String(
          now.getMonth() + 1
        ).padStart(2, "0")}`;
        const displayKey = `${new Intl.DateTimeFormat("pt-BR", {
          month: "short",
        }).format(now)}/${String(now.getFullYear()).slice(-2)}`;
        const statsRef = doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "statistics",
          "production_monthly"
        );
        await setDoc(
          statsRef,
          {
            [monthKey]: increment(1),
            [`label_${monthKey}`]: displayKey,
          },
          { merge: true }
        );
      }
    } catch (error) {
      alert("Erro: " + error.message);
    }
  };

  const handleShowHistory = () => {
    let content = "MES/ANO - NUMERO DE PEDIDOS\n";
    const keys = Object.keys(stats)
      .filter((k) => k.match(/^\d{4}_\d{2}$/))
      .sort()
      .reverse();
    keys.forEach((key) => {
      const count = stats[key];
      const label = stats[`label_${key}`] || key;
      content += `${label} - ${count}\n`;
    });
    setTextModalData({ title: "Histórico de Produção", content });
  };

  const getCurrentMonthCount = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}_${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    return stats[monthKey] || 0;
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
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (order.status !== "CANCELADO") return;
    const confirmCode = order.sku;
    const userInput = window.prompt(
      `⛔️ APAGAR ${order.sku}?\nDigite o SKU EXATO:`
    );
    if (userInput !== confirmCode) return alert("❌ Código incorreto.");
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
      alert("✅ Item apagado.");
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const toggleSelect = (orderId) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(orderId)) newSet.delete(orderId);
    else newSet.add(orderId);
    setSelectedOrders(newSet);
  };

  const handleGeneratePrintText = async () => {
    const itemsToPrint = orders.filter((o) => selectedOrders.has(o.id));
    if (itemsToPrint.length === 0) return;
    let content = "";
    const batch = writeBatch(db);
    itemsToPrint.forEach((order) => {
      const ref = doc(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders",
        order.id
      );
      batch.update(ref, { printed: true });
      const dateSimple = order.dateStr ? order.dateStr.split(" ")[0] : "-";
      content += "--------------------------\n";
      content += `Data: ${dateSimple}\nPedido: ${
        order.order?.number || "-"
      }\nSKU: ${order.sku}\n`;
      content += "--------------------------\n";
      content += `Aro: ${order.specs?.size || "-"}\nPedra: ${
        order.specs?.stoneType || "-"
      }\nCor: ${order.specs?.stoneColor || "-"}\nBanho: ${
        order.specs?.finishing || "-"
      }\n`;
      content += "--------------------------\n";
      content += `GRAV: ${order.specs?.engraving || "-"}\nTipo: ${
        order.specs?.jewelryType || "-"
      }\nMat: ${order.specs?.material || "-"}\nCat: ${
        order.specs?.category || "-"
      }\n`;
      content +=
        "--------------------------\nF\n--------------------------\n\n\n";
    });
    try {
      await batch.commit();
      setTextModalData({ title: "Texto para Impressão", content });
      setSelectedOrders(new Set());
    } catch (e) {
      alert("Erro: " + e.message);
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

  const OrderCard = ({ order }) => {
    const catalog = findCatalogItem ? findCatalogItem(order.sku) : null;
    const isSelected = selectedOrders.has(order.id);
    const isNatural = order.specs?.stoneType === "Natural";
    let isDivergent = false;
    if (order.specs?.standardColor && order.specs?.stoneColor) {
      isDivergent =
        order.specs.standardColor !== "MANUAL" &&
        order.specs.standardColor.toUpperCase() !==
          order.specs.stoneColor.toUpperCase();
    }

    return (
      <div
        className={`bg-white p-3 rounded-lg shadow-sm border hover:shadow-md transition-all group relative flex flex-col gap-2 ${
          isSelected
            ? "ring-2 ring-purple-500 bg-purple-50 border-purple-300"
            : "border-slate-200"
        }`}
      >
        <div className="absolute top-2 right-2 z-10">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
            checked={isSelected}
            onChange={() => toggleSelect(order.id)}
          />
        </div>
        <div className="flex justify-between items-start pr-6">
          <div className="flex items-center gap-1">
            {order.fromStock && (
              <div
                className="bg-emerald-700 text-white text-[8px] font-bold px-1 rounded cursor-help"
                title="Item retirado do estoque"
              >
                E
              </div>
            )}
            {order.printed && (
              <div
                className="bg-amber-400 text-amber-900 text-[8px] font-bold px-1.5 rounded cursor-help"
                title="Impresso oficina"
              >
                I
              </div>
            )}
            <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded">
              {order.sku}
            </span>
          </div>
          {groupBy === "days" && (
            <span
              className={`text-[8px] px-1 rounded font-bold uppercase truncate max-w-[80px] ${
                STATUS_CONFIG[order.status]?.color
              }`}
            >
              {STATUS_CONFIG[order.status]?.label}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-700 font-bold truncate">
          {order.order?.customer?.name}
        </div>

        <div className="bg-slate-50 p-2 rounded text-[10px] space-y-1.5 border border-slate-100 text-slate-600">
          <div className="flex justify-between border-b border-slate-200 pb-1">
            <span className="font-bold">Aro: {order.specs?.size || "-"}</span>
            <span>{order.specs?.stoneType || "-"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Cor:</span>
            <span
              className={`font-bold ${isDivergent ? "text-amber-600" : ""}`}
            >
              {order.specs?.stoneColor || "-"}
            </span>
            {isDivergent && (
              <AlertTriangle size={10} className="text-amber-500" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Banho:</span>
            <span className="font-bold">{order.specs?.finishing || "-"}</span>
          </div>
          {order.specs?.engraving && order.specs.engraving !== "ND" && (
            <div className="pt-1 text-purple-700 font-mono italic text-[9px] border-t border-slate-200">
              "{order.specs.engraving}"
            </div>
          )}
          {isNatural && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 animate-pulse mt-1">
              <ShieldCheck size={10} /> Natural
            </div>
          )}
        </div>

        <div className="pt-1 border-t flex justify-between items-center mt-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingOrder(order)}
              className="p-1 text-slate-400 hover:text-blue-600"
            >
              <Edit3 size={14} />
            </button>
            {order.status === "CANCELADO" && (
              <button
                onClick={() => handleDeleteOrder(order)}
                className="p-1 text-red-300 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="relative w-24">
            <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 cursor-pointer hover:text-purple-600">
              <span>Mover</span> <ArrowRight size={10} />
            </div>
            <select
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              value={order.status}
              onChange={(e) => handleMoveStatus(order.id, e.target.value)}
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
    );
  };

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
      {textModalData && (
        <TextModal
          title={textModalData.title}
          content={textModalData.content}
          onClose={() => setTextModalData(null)}
        />
      )}

      <div className="bg-white px-4 pt-3 pb-2 border-b flex flex-col shadow-sm z-10 space-y-2">
        {/* ANDAR 1: GRÁFICO */}
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
            <BarChart3 size={12} /> Urgência dos Pedidos
          </h4>
          <AgeChart orders={orders} />
        </div>

        {/* ANDAR 2: MINI DASHBOARD */}
        <div className="border-t border-slate-100 pt-2">
          <MiniDashboard />
        </div>

        {/* ANDAR 3: CONTROLES ALINHADOS HORIZONTALMENTE */}
        <div className="flex flex-col xl:flex-row justify-between items-end gap-4 pt-2 border-t border-slate-100">
          {/* LADO ESQUERDO: TÍTULO + BOTÕES + IMPRIMIR */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Factory className="text-purple-600" />
              <div>
                <h2 className="font-bold text-slate-800 leading-none">
                  Produção
                </h2>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  {groupBy === "status"
                    ? "POR PROCESSO"
                    : "POR URGÊNCIA (DIAS)"}
                </p>
              </div>
            </div>

            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 gap-1">
              <button
                onClick={() => {
                  setViewMode("list");
                  setGroupBy("status");
                }}
                className={`p-1.5 rounded ${
                  viewMode === "list"
                    ? "bg-white shadow text-purple-600"
                    : "text-slate-400"
                }`}
                title="Lista (Por Status)"
              >
                <LayoutList size={18} />
              </button>
              <button
                onClick={() => {
                  setViewMode("kanban");
                  setGroupBy("days");
                }}
                className={`p-1.5 rounded ${
                  viewMode === "kanban"
                    ? "bg-white shadow text-purple-600"
                    : "text-slate-400"
                }`}
                title="Kanban Temporal"
              >
                <Kanban size={18} />
              </button>
              <div className="w-[1px] bg-slate-300 mx-1"></div>
              <button
                onClick={() => setGroupBy("status")}
                disabled={viewMode === "list"}
                className={`p-1.5 rounded flex items-center gap-1 ${
                  groupBy === "status" && viewMode === "kanban"
                    ? "bg-purple-100 text-purple-700 font-bold"
                    : "text-slate-400"
                }`}
                title="Por Status"
              >
                <span className="text-[10px]">STATUS</span>
              </button>
              <button
                onClick={() => setGroupBy("days")}
                disabled={viewMode === "list"}
                className={`p-1.5 rounded flex items-center gap-1 ${
                  groupBy === "days" && viewMode === "kanban"
                    ? "bg-purple-100 text-purple-700 font-bold"
                    : "text-slate-400"
                }`}
                title="Por Dias"
              >
                <Hourglass size={14} />{" "}
                <span className="text-[10px]">TEMPO</span>
              </button>
            </div>

            {selectedOrders.size > 0 && (
              <button
                onClick={handleGeneratePrintText}
                className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-black transition-colors animate-pulse shadow-lg"
              >
                <Printer size={16} /> IMPRIMIR ({selectedOrders.size})
              </button>
            )}
          </div>

          {/* LADO DIREITO: CONTADOR + FILTRO + BUSCA */}
          <div className="flex items-center gap-2 w-full xl:w-auto">
            {/* CONTADOR DE PRODUTIVIDADE (AGORA UM BADGE/BOTÃO) */}
            <div
              onClick={handleShowHistory}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-purple-100 hover:text-purple-700 cursor-pointer transition-colors border border-slate-200 select-none whitespace-nowrap"
              title="Clique para ver histórico"
            >
              <TrendingUp size={14} />
              <span>Mês: {getCurrentMonthCount()}</span>
            </div>

            <div className="relative">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <select
                className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none bg-white w-40"
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

            <div className="relative flex-1 xl:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none w-full"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
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
                        <th className="px-4 py-2 w-10 text-center">
                          <CheckSquare size={14} />
                        </th>
                        <th className="px-4 py-2 w-20 text-center">Prazo</th>
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2 w-1/3">Especificações</th>
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
                        const isDivergent = alert?.type === "divergent";
                        return (
                          <tr
                            key={order.id}
                            className={`hover:bg-slate-50 ${
                              selectedOrders.has(order.id) ? "bg-purple-50" : ""
                            }`}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                checked={selectedOrders.has(order.id)}
                                onChange={() => toggleSelect(order.id)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <DaysBadge date={order.createdAt} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {order.fromStock && (
                                  <div
                                    className="bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help"
                                    title="Item retirado do estoque"
                                  >
                                    E
                                  </div>
                                )}
                                {order.printed && (
                                  <div
                                    className="bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help"
                                    title="Impresso oficina"
                                  >
                                    I
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-blue-600 text-xs">
                                    {order.sku}
                                  </div>
                                  <div className="text-xs text-slate-600 truncate max-w-[150px]">
                                    {catalog?.name || "Carregando..."}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2 items-center text-[10px]">
                                {order.specs?.size && (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                                    Aro: {order.specs.size}
                                  </span>
                                )}
                                {order.specs?.stoneType &&
                                  order.specs.stoneType !== "ND" && (
                                    <span className="bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-100 font-bold">
                                      {order.specs.stoneType}
                                    </span>
                                  )}
                                {order.specs?.stoneColor &&
                                  order.specs.stoneColor !== "ND" && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded border font-bold flex items-center gap-1 ${
                                        isDivergent
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-slate-100 border-slate-200"
                                      }`}
                                    >
                                      Cor: {order.specs.stoneColor}
                                      {isDivergent && (
                                        <AlertTriangle size={10} />
                                      )}
                                    </span>
                                  )}
                                {order.specs?.finishing &&
                                  order.specs.finishing !== "ND" && (
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                      Banho: {order.specs.finishing}
                                    </span>
                                  )}
                                {order.specs?.engraving &&
                                  order.specs.engraving !== "ND" && (
                                    <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 italic">
                                      "{order.specs.engraving}"
                                    </span>
                                  )}
                                {alert?.type === "natural" && (
                                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold flex items-center gap-1">
                                    <ShieldCheck size={10} /> Natural
                                  </span>
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
                                    handleMoveStatus(order.id, e.target.value)
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
                              {order.status === "CANCELADO" && (
                                <button
                                  onClick={() => handleDeleteOrder(order)}
                                  className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Apagar"
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

        {viewMode === "kanban" && (
          <div className="flex gap-4 h-full w-max pb-4">
            {(groupBy === "status" ? STATUS_ORDER : DAYS_COLUMNS).map(
              (colId) => {
                const items = groupedOrders[colId] || [];
                let label = colId;
                let headerColor = "bg-gray-500";
                let countColor = "bg-white/20";
                if (groupBy === "status") {
                  const conf = STATUS_CONFIG[colId] || {};
                  label = conf.label || colId;
                  headerColor = conf.color.split(" ")[0];
                } else {
                  label =
                    colId === 10 ? "10+ DIAS (CRÍTICO)" : `${colId} DIAS ÚTEIS`;
                  if (colId < 5) headerColor = "bg-emerald-500";
                  else if (colId < 8) headerColor = "bg-yellow-500";
                  else if (colId < 10) headerColor = "bg-orange-500";
                  else headerColor = "bg-purple-900";
                }
                return (
                  <div
                    key={colId}
                    className="w-72 flex flex-col h-full rounded-xl bg-slate-200/50 border border-slate-300/50"
                  >
                    <div
                      className={`p-3 rounded-t-xl border-b flex justify-between items-center text-white shadow-sm ${headerColor}`}
                    >
                      <span className="font-bold text-xs uppercase">
                        {label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${countColor}`}
                      >
                        {items.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                      {items.map((order) => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
