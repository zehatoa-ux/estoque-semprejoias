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
  Layers,
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
import { useProductionFilter } from "../hooks/useProductionFilter";
import {
  PRODUCTION_STATUS_CONFIG as STATUS_CONFIG,
  KANBAN_ORDER as STATUS_ORDER,
  DAYS_COLUMNS, //
} from "../config/productionStatuses";
import AgeChart from "../components/dashboard/AgeChart";
import StatusSummary from "../components/dashboard/StatusSummary";
import DaysBadge from "../components/production/DaysBadge";
import { getBusinessDaysDiff } from "../utils/formatters";
import { productionService } from "../services/productionService";
import {
  useProductionOrders,
  useProductionStats,
} from "../hooks/useProductionData";
import { formatProductionTicket } from "../utils/printFormatter";

import { useProductionGrouping } from "../hooks/useProductionGrouping";
// ... outros imports ...
import ProductionCard from "../components/production/ProductionCard"; // <--- ADICIONE ISSO
import TextModal from "../components/modals/TextModal";

export default function ProductionTab({ findCatalogItem, user }) {
  const [filterText, setFilterText] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [groupBy, setGroupBy] = useState("status");
  const [editingOrder, setEditingOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [textModalData, setTextModalData] = useState(null);

  // 2. Substitua toda aquela lógica por apenas duas linhas:
  const { orders } = useProductionOrders();
  const stats = useProductionStats(); // (Caso você use 'stats' em algum lugar da tela)

  const filteredOrders = useProductionFilter(
    orders,
    filterText,
    statusFilter,
    findCatalogItem
  );

  // Adicione apenas isso:// src/hooks/useProductionGrouping.js
  const groupedOrders = useProductionGrouping(filteredOrders, groupBy);

  // --- 1. MOVE STATUS REFATORADO ---
  const handleMoveStatus = async (orderId, newStatus) => {
    try {
      const currentOrder = orders.find((o) => o.id === orderId);
      const currentStatus = currentOrder ? currentOrder.status : "";

      // Uma linha para resolver tudo!
      await productionService.updateStatus(
        orderId,
        newStatus,
        currentStatus,
        user?.name
      );
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
      await productionService.updateSpecs(
        updatedData.id,
        updatedData.specs,
        user?.name
      );
      setEditingOrder(null);
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // --- 3. DELETE REFATORADO ---
  const handleDeleteOrder = async (order) => {
    if (order.status !== "CANCELADO") return;

    // Mantém a validação de segurança no UI (isso é responsabilidade da tela)
    const confirmCode = order.sku;
    const userInput = window.prompt(
      `⛔️ APAGAR ${order.sku}?\nDigite o SKU EXATO:`
    );
    if (userInput !== confirmCode) return alert("❌ Código incorreto.");

    try {
      await productionService.deleteOrder(order.id);
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
    // 1. Filtra os itens selecionados
    const itemsToPrint = orders.filter((o) => selectedOrders.has(o.id));
    if (itemsToPrint.length === 0) return;

    try {
      // 2. Atualiza o banco (Serviço) - Marca como "Imprimindo"
      const ids = itemsToPrint.map((o) => o.id);
      await productionService.markBatchAsPrinted(ids);

      // 3. Gera o texto (Formatador Externo) -> AQUI ESTÁ A MÁGICA ✨
      const content = formatProductionTicket(itemsToPrint);

      // 4. Abre o Modal com o texto pronto
      setTextModalData({ title: "Texto para Impressão", content });
      setSelectedOrders(new Set()); // Limpa seleção
    } catch (e) {
      alert("Erro ao gerar impressão: " + e.message);
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
            {order.fromStock && !order.isPE && (
              <div
                className="bg-emerald-700 text-white text-[8px] font-bold px-1 rounded cursor-help"
                title="Item retirado do estoque"
              >
                E
              </div>
            )}
            {order.isPE && (
              <div
                className="bg-orange-500 text-white text-[8px] font-bold px-1 rounded flex items-center gap-0.5 cursor-help"
                title="Produção de Estoque"
              >
                <Layers size={8} /> PE
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
          {/* MUDANÇA AQUI: Label Finalização */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Finalização:</span>
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
        {/* --- DASHBOARD SUPERIOR (Refatorado) --- */}
        <div className="px-4 pt-4">
          <StatusSummary orders={filteredOrders} />
          <AgeChart orders={filteredOrders} />
        </div>

        {/* --- RESTO DA TELA (Barra de busca, Kanban, etc) --- */}
        {/* ... */}

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
                  {/* CABEÇALHO DO GRUPO (Colorido) */}
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
                                {order.fromStock && !order.isPE && (
                                  <div
                                    className="bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help"
                                    title="Item retirado do estoque"
                                  >
                                    E
                                  </div>
                                )}
                                {order.isPE && (
                                  <div
                                    className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-help"
                                    title="Produção de Estoque"
                                  >
                                    <Layers size={8} /> PE
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

                                {/* MUDANÇA AQUI: Label de Finalização */}
                                {order.specs?.finishing &&
                                  order.specs.finishing !== "ND" && (
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                      Finalização: {order.specs.finishing}
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

        {/* DENTRO DE viewMode === "kanban" */}
        {viewMode === "kanban" && (
          <div className="flex gap-4 h-full w-max pb-4 px-4">
            {(groupBy === "status" ? STATUS_ORDER : [5, 8, 10, 99]).map(
              (colId) => {
                // 1. Pega os itens
                const items = groupedOrders[colId] || [];

                // 🛑 FILTRO DE LIMPEZA: Se for Status e estiver vazio, suma daqui!
                // (Mantemos as colunas de Dias vazias pois elas são fixas e importantes para referência)
                if (groupBy === "status" && items.length === 0) {
                  return null;
                }

                // 2. Configurações Visuais
                let label = colId;
                let headerColor = "bg-slate-500";
                let countColor = "bg-white/20 text-white";

                if (groupBy === "status") {
                  const conf = STATUS_CONFIG[colId] || {};
                  label = conf.label || colId;
                  headerColor = conf.color
                    ? conf.color.split(" ")[0]
                    : "bg-slate-500";
                } else {
                  if (colId === 5) {
                    label = "ATÉ 5 DIAS ÚTEIS (NORMAL)";
                    headerColor = "bg-emerald-600";
                  } else if (colId === 8) {
                    label = "5 A 8 DIAS (ATENÇÃO)";
                    headerColor = "bg-yellow-500";
                  } else if (colId === 10) {
                    label = "8 A 10 DIAS (URGENTE)";
                    headerColor = "bg-orange-500";
                  } else {
                    label = "+10 DIAS (CRÍTICO)";
                    headerColor = "bg-purple-900";
                  }
                }

                return (
                  <div
                    key={colId}
                    className="w-80 flex flex-col h-full rounded-xl bg-slate-100 border border-slate-200 shrink-0"
                  >
                    {/* ... (O resto do cabeçalho e lista continua igual) ... */}
                    <div
                      className={`p-3 rounded-t-xl border-b flex justify-between items-center text-white shadow-sm font-bold text-xs uppercase ${headerColor}`}
                    >
                      <span className="truncate">{label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] ${countColor}`}
                      >
                        {items.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                      {items.map((order) => (
                        <ProductionCard
                          key={order.id}
                          order={order}
                          isSelected={selectedOrders.has(order.id)}
                          onToggleSelect={toggleSelect}
                          onEdit={setEditingOrder}
                          onDelete={handleDeleteOrder}
                          onMoveStatus={handleMoveStatus}
                        />
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
