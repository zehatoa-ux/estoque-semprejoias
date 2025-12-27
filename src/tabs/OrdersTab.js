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
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import { formatMoney, normalizeText } from "../utils/formatters";

// --- STATUS LOGÍSTICOS (DO PEDIDO GERAL) ---
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

// --- STATUS DE PRODUÇÃO (DOS ITENS) - IGUAL À ABA DE PRODUÇÃO ---
const PRODUCTION_STATUS_CONFIG = {
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

// Helper de Cores para os Status Logísticos
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

export default function OrdersTab() {
  const [rawData, setRawData] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Carrega dados da Produção
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

  // --- LÓGICA DE AGRUPAMENTO ---
  const groupedOrders = useMemo(() => {
    const groups = {};

    rawData.forEach((item) => {
      const orderNum = item.order?.number || "AVULSO";

      if (!groups[orderNum]) {
        groups[orderNum] = {
          orderNumber: orderNum,
          customerName: item.order?.customer?.name || "Cliente Balcão",
          date: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(),
          totalValue: 0,
          shippingMethod:
            item.shipping?.tipoenvio || item.shipping?.method || "Retirada",
          logisticsStatus: item.logisticsStatus || "SEM ETIQUETA",
          items: [],
          referenceIds: [],
        };
      }

      if (groups[orderNum].items.length === 0 && item.order?.payment?.total) {
        groups[orderNum].totalValue = parseFloat(item.order.payment.total);
      }

      groups[orderNum].items.push(item);
      groups[orderNum].referenceIds.push(item.id);
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
  }, [rawData, searchTerm, statusFilter]);

  const toggleExpand = (orderNum) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderNum)) newSet.delete(orderNum);
    else newSet.add(orderNum);
    setExpandedOrders(newSet);
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

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* HEADER DA ABA */}
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

        <div className="flex gap-2 w-full md:w-auto">
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

      {/* LISTA DE PEDIDOS */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="space-y-3">
          {groupedOrders.map((group) => {
            const isExpanded = expandedOrders.has(group.orderNumber);

            return (
              <div
                key={group.orderNumber}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* LINHA PAI (CABEÇALHO DO PEDIDO) */}
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

                  {/* CONTROLES DE DIREITA (STATUS E ENVIO) */}
                  <div
                    className="flex items-center gap-4 pl-4 border-l ml-4"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SUB-LISTA DE ITENS (EXPANSIVEL) */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t p-4 animate-slide-in">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                      <Package size={14} /> Itens do Pedido (
                      {group.items.length})
                    </h4>
                    <div className="space-y-2">
                      {group.items.map((item, idx) => {
                        // PEGA A CONFIGURAÇÃO VISUAL DO STATUS
                        const statusConf = PRODUCTION_STATUS_CONFIG[
                          item.status
                        ] || {
                          label: item.status,
                          color: "bg-gray-200 text-gray-700",
                        };

                        return (
                          <div
                            key={idx}
                            className="bg-white p-2 rounded border border-slate-200 flex justify-between items-center text-sm hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center gap-3">
                              {/* Badge de Estoque/Impresso */}
                              <div className="flex gap-1">
                                {item.fromStock && (
                                  <div
                                    className="bg-emerald-700 text-white text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4"
                                    title="Item de Estoque"
                                  >
                                    E
                                  </div>
                                )}
                                {item.printed && (
                                  <div
                                    className="bg-amber-400 text-amber-900 text-[9px] font-bold px-1 rounded flex items-center justify-center w-4 h-4"
                                    title="Impresso"
                                  >
                                    I
                                  </div>
                                )}
                              </div>

                              <div className="font-mono text-xs font-bold bg-slate-100 px-1.5 py-0.5 rounded text-blue-600">
                                {item.sku}
                              </div>

                              <div className="text-slate-700 flex items-center gap-2 text-xs">
                                {item.specs?.stoneType && (
                                  <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100">
                                    {item.specs.stoneType}
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
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">
                                Produção:
                              </span>
                              {/* STATUS COM COR E NOME CORRETO */}
                              <span
                                className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${statusConf.color}`}
                              >
                                {statusConf.label}
                              </span>
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
