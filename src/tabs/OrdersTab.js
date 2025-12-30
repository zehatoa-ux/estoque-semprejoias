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
import { useOrderProcessing } from "../hooks/useOrderProcessing";
import {
  LOGISTICS_STATUS_CONFIG,
  LOGISTICS_ORDER,
} from "../config/logisticsStatuses";
import { useOrdersData } from "../hooks/useOrdersData";
import { useOrderActions } from "../hooks/useOrderActions";
import {
  PRODUCTION_STATUS_CONFIG,
  KANBAN_ORDER, // <--- Importante: Vamos usar esse array para montar o dropdown
} from "../config/productionStatuses";
import {
  processAndGroupOrders,
  filterOrders,
  canArchiveOrder, // <--- Novo
  canDeleteOrder, // <--- Novo
} from "../utils/logisticsLogic";

export default function OrdersTab({ findCatalogItem }) {
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const actions = useOrderActions();

  // Modais
  const [editingItem, setEditingItem] = useState(null); // Specs
  const [movingItem, setMovingItem] = useState(null); // Move Order (NOVO)
  const [editingOrderGroup, setEditingOrderGroup] = useState(null); // Batch Edit

  // Substitui todo aquele useEffect e useState de rawData
  const { rawData } = useOrdersData();

  // --- AGRUPAMENTO E BUSCA (Refatorado para Hook) ---
  const groupedOrders = useOrderProcessing(
    rawData,
    searchTerm,
    statusFilter,
    findCatalogItem
  );
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

  // --- WRAPPER: MOVER ITEM (Versão Corrigida para o seu Modal) ---
  const handleMoveItem = async (itemIdFromModal, formData) => {
    // ATENÇÃO: O modal manda (id, data). Precisamos do segundo argumento 'formData'.

    if (!formData) return; // Segurança

    // 1. Captura o que veio do Modal (O que você digitou)
    // Como vi no seu código do Modal, os campos são exatamente: orderNumber e customerName
    const inputNumber = formData.orderNumber;
    const inputName = formData.customerName;

    // 2. Lógica de Prioridade para o Nome:
    let finalName = inputName;

    // Só se você DEIXOU O NOME EM BRANCO é que tentamos "adivinhar" pela lista
    if (!finalName && inputNumber) {
      const existingOrder = groupedOrders.find(
        (g) => String(g.orderNumber) === String(inputNumber)
      );
      if (existingOrder) {
        finalName = existingOrder.customerName;
      }
    }

    // 3. Monta o objeto final
    const finalData = {
      orderNumber: inputNumber || "AVULSO",
      customerName: finalName || "Cliente Balcão",
    };

    console.log("Movendo item:", itemIdFromModal, "para:", finalData);

    // Usa o ID que veio do modal (ou do state movingItem.id, tanto faz, são iguais)
    const success = await actions.moveItem(itemIdFromModal, finalData);

    if (success) {
      setMovingItem(null);
    }
  };
  // --- WRAPPER: EDITAR PEDIDO (EDITZÃO) ---
  const handleUpdateOrder = async (newData) => {
    if (!editingOrderGroup) return;

    // A action precisa da lista de itens para saber quem atualizar
    const success = await actions.saveOrderDetails(
      editingOrderGroup.items,
      newData
    );

    if (success) {
      setEditingOrderGroup(null); // Fecha o modal se deu certo
    }
  };

  // --- SALVAR EDIÇÃO DO PEDIDO (COMPLETO) ---

  const handleSaveEditItem = async (updatedData) => {
    const success = await actions.saveItemSpecs(editingItem, updatedData);
    if (success) {
      setEditingItem(null); // Fecha o modal
    }
  };

  // --- AÇÃO: IMPRIMIR CERTIFICADOS (REFATORADA) ---
  const handlePrintCertificates = async () => {
    const itemsToPrint = Array.from(selectedItems)
      .map(
        (id) =>
          rawData.find((i) => i.id === id) ||
          groupedOrders.flatMap((g) => g.items).find((i) => i.id === id)
      )
      .filter(Boolean);

    if (itemsToPrint.length === 0)
      return alert("Selecione itens para imprimir.");

    // 1. Gera o PDF (Responsabilidade Visual/Utils)
    const successPDF = generateCertificatePDF(itemsToPrint, findCatalogItem);

    if (successPDF) {
      // 2. Atualiza o Banco (Responsabilidade da Action)
      await actions.markAsPrinted(itemsToPrint);
      setSelectedItems(new Set()); // Limpa seleção
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
              {LOGISTICS_ORDER.map((s) => (
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
          {LOGISTICS_ORDER.map((statusLabel) => {
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
                      className={`font-bold text-xs uppercase px-2 py-1 rounded border ${
                        LOGISTICS_STATUS_CONFIG[statusLabel]?.color ||
                        "bg-gray-100"
                      }`}
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
                            {canArchiveOrder(group) && (
                              <button
                                onClick={() => actions.archiveOrder(group)}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Arquivar Pedido"
                              >
                                <Archive size={16} />
                              </button>
                            )}

                            {/* BOTÃO EXCLUIR (Só aparece se estiver CANCELADO) */}
                            {canDeleteOrder(group) && (
                              <button
                                onClick={() => actions.deleteOrder(group)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Excluir Pedido"
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
                                  actions.updateLogisticsStatus(
                                    group,
                                    e.target.value
                                  )
                                }
                              >
                                {LOGISTICS_ORDER.map((s) => (
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
                                    key={subItem.id}
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
                                      {/* 🟢 TRECHO NOVO (COPIE E COLE SUBSTITUINDO O SELECT ANTIGO) */}
                                      <select
                                        className={`text-[10px] font-bold px-2 py-1 rounded uppercase cursor-pointer outline-none text-center ${statusConf.color}`}
                                        value={subItem.status}
                                        onChange={(e) =>
                                          actions.updateItemStatus(
                                            subItem.id,
                                            e.target.value
                                          )
                                        }
                                        onClick={(e) => e.stopPropagation()} // Importante: pra não fechar o card quando clicar
                                      >
                                        {KANBAN_ORDER.map((key) => (
                                          <option
                                            key={key}
                                            value={key}
                                            className="bg-white text-slate-800 font-normal"
                                          >
                                            {PRODUCTION_STATUS_CONFIG[key]
                                              ?.label || key}
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
