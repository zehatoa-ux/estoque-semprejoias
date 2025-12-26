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
} from "lucide-react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import { normalizeText } from "../utils/formatters"; // Certifique-se de que essa função existe no utils

// Importar o Modal para Edição
import ProductionConversionModal from "../components/modals/ProductionConversionModal";

// CORES BASEADAS NA SUA IMAGEM (Aprox. Tailwind)
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
  }, // Amarelo Importante
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

// Ordem de exibição (Seguindo fluxo lógico aproximado)
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

export default function ProductionTab({ user, findCatalogItem }) {
  const [orders, setOrders] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [viewMode, setViewMode] = useState("list"); // 'list' ou 'kanban'
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
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
    return () => unsub();
  }, []);

  // Lógica de Filtro Avançada
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Filtro de Status
      if (statusFilter !== "all" && order.status !== statusFilter) return false;

      // 2. Filtro de Texto (Busca em tudo)
      if (!filterText) return true;

      const search = normalizeText(filterText);
      const sku = normalizeText(order.sku || "");
      const orderNum = normalizeText(order.order?.number || "");
      const client = normalizeText(order.order?.customer?.name || "");

      // Busca no Catálogo (Nome do Produto)
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

  // Agrupamento
  const groupedOrders = useMemo(() => {
    const groups = {};
    STATUS_ORDER.forEach((id) => (groups[id] = []));

    filteredOrders.forEach((order) => {
      const st = order.status || "SOLICITACAO";
      if (!groups[st]) groups[st] = []; // Caso venha um status novo/desconhecido
      groups[st].push(order);
    });
    return groups;
  }, [filteredOrders]);

  const handleMoveStatus = async (orderId, newStatus) => {
    try {
      // CORREÇÃO DO CAMINHO DO DOCUMENTO
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
    } catch (error) {
      alert("Erro ao mover: " + error.message);
      console.error(error);
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
      // Atualiza apenas o que é relevante para produção (Specs)
      await updateDoc(docRef, {
        specs: updatedData.specs,
        updatedBy: user?.name || "Sistema",
        lastUpdate: serverTimestamp(),
      });
      setEditingOrder(null);
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-slate-100">
      {/* MODAL DE EDIÇÃO (Renderizado Condicionalmente) */}
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

      {/* HEADER DA ABA */}
      <div className="bg-white p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Factory className="text-purple-600" />
          <h2 className="font-bold text-slate-800">Produção</h2>
          <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
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
          {/* Filtro de Status */}
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

          {/* Busca */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Buscar Pedido, SKU, Cliente..."
              className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-purple-500 w-full md:w-64"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {/* --- MODO LISTA (ESTILO MONDAY) --- */}
        {viewMode === "list" && (
          <div className="space-y-6 max-w-5xl mx-auto">
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
                  {/* Cabeçalho do Grupo */}
                  <div
                    className={`px-4 py-2 font-bold text-sm flex justify-between items-center ${config.color}`}
                  >
                    <span>
                      {config.label} ({items.length})
                    </span>
                  </div>

                  {/* Tabela do Grupo */}
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b">
                      <tr>
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2">Especificações</th>
                        <th className="px-4 py-2">Cliente / Pedido</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((order) => {
                        const catalog = findCatalogItem
                          ? findCatalogItem(order.sku)
                          : null;
                        return (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-bold text-blue-600 text-xs">
                                {order.sku}
                              </div>
                              <div className="text-xs text-slate-600 truncate max-w-[150px]">
                                {catalog?.name || "Carregando..."}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
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
                                {order.specs?.engraving && (
                                  <span className="bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded text-[10px] border border-purple-100">
                                    ✒️ {order.specs.engraving}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div className="font-bold text-slate-700">
                                {order.order?.customer?.name || "Balcão"}
                              </div>
                              <div className="text-slate-400">
                                Ped: {order.order?.number || "-"}
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
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setEditingOrder(order)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar Especificações"
                              >
                                <Edit3 size={16} />
                              </button>
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

        {/* --- MODO KANBAN (COLUNAS) --- */}
        {viewMode === "kanban" && (
          <div className="flex gap-4 h-full w-max pb-4">
            {STATUS_ORDER.map((statusId) => {
              const items = groupedOrders[statusId] || [];
              const config = STATUS_CONFIG[statusId] || {
                label: statusId,
                color: "bg-gray-500 text-white",
              };
              // Extrai apenas a cor de fundo para o cabeçalho, removendo text/border para não bugar
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
                    {items.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1 rounded">
                            {order.sku}
                          </span>
                          <button
                            onClick={() => setEditingOrder(order)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                        <div className="text-xs text-slate-700 font-bold mb-1 truncate">
                          {order.order?.customer?.name}
                        </div>

                        {/* Specs Mini */}
                        <div className="bg-slate-50 p-2 rounded text-[10px] space-y-1 border border-slate-100 text-slate-600">
                          {order.specs?.size && (
                            <div>📏 Aro {order.specs.size}</div>
                          )}
                          {order.specs?.stoneType && (
                            <div>💎 {order.specs.stoneType}</div>
                          )}
                        </div>

                        {/* Dropdown Escondido (Move no Hover) */}
                        <div className="mt-2 pt-2 border-t flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">
                            PED: {order.order?.number}
                          </span>
                          <div className="relative w-6 h-6">
                            <ArrowRight
                              size={14}
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <select
                              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                              value={order.status}
                              onChange={(e) =>
                                handleMoveStatus(order.id, e.target.value)
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
                    ))}
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
