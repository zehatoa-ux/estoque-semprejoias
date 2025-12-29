import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Calendar,
  Package,
  CheckSquare,
  Trash2,
  User,
  Factory,
  UserCheck,
  AlertCircle,
  Gem,
  Plus,
  X,
  Save,
  CheckCircle, // Importei para o ícone de sucesso
  AlertTriangle, // Importei para o ícone de alerta
} from "lucide-react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import { normalizeText } from "../utils/formatters";
import ProductionConversionModal from "../components/modals/ProductionConversionModal";

// Helper robusto para converter qualquer coisa em Data JS real
const parseDate = (val) => {
  if (!val) return new Date(0);
  if (val.toDate) return val.toDate(); // Timestamp do Firebase
  if (typeof val === "string") return new Date(val); // Texto ISO
  return new Date(val);
};

export default function ReservationsTab({
  reservations,
  inventory = [],
  findCatalogItem,
  // Props do App.js
  resSku,
  setResSku,
  resQty,
  setResQty,
  resNote,
  setResNote,
  handleCreateReservation,
}) {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conversionData, setConversionData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // --- FILTROS E ORDENAÇÃO ---
  const filteredReservations = useMemo(() => {
    // 1. Filtrar
    const filtered = reservations.filter((res) => {
      const matchesStatus =
        statusFilter === "all" || res.status === statusFilter;
      const search = normalizeText(searchText);

      const sku = normalizeText(res.sku || "");
      const clientName = normalizeText(res.order?.customer?.name || "");
      const orderNum = normalizeText(res.order?.number || "");
      const createdBy = normalizeText(res.createdBy || "");
      const catalogItem = findCatalogItem ? findCatalogItem(res.sku) : null;
      const prodName = normalizeText(catalogItem?.name || "");

      const matchesSearch =
        sku.includes(search) ||
        clientName.includes(search) ||
        orderNum.includes(search) ||
        prodName.includes(search) ||
        createdBy.includes(search);

      return matchesStatus && matchesSearch;
    });

    // 2. Ordenar (O Mais recente no topo, usando Timestamp Real)
    return filtered.sort((a, b) => {
      const dateA = parseDate(a.createdAt);
      const dateB = parseDate(b.createdAt);
      return dateB - dateA;
    });
  }, [reservations, searchText, statusFilter, findCatalogItem]);

  // --- AÇÕES ---
  const handleConfirmConversion = async (enrichedData) => {
    try {
      if (enrichedData.fromStock && enrichedData.stockItemId) {
        await deleteDoc(
          doc(
            db,
            "artifacts",
            APP_COLLECTION_ID,
            "public",
            "data",
            "inventory_items",
            enrichedData.stockItemId
          )
        );
      }

      const { id: oldId, stockItemId, ...dataToSave } = enrichedData;

      await addDoc(
        collection(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "production_orders"
        ),
        {
          ...dataToSave,
          status: dataToSave.status || "SOLICITACAO",
          originalReservationId: oldId,
          convertedAt: serverTimestamp(),
        }
      );

      await deleteDoc(
        doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "reservations",
          oldId
        )
      );

      alert(
        enrichedData.fromStock
          ? "Item retirado do estoque e ordem criada!"
          : "Enviado para Produção com sucesso!"
      );
      setConversionData(null);
    } catch (error) {
      alert("Erro ao converter: " + error.message);
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Tem certeza que deseja EXCLUIR ${selectedIds.size} reservas?`
      )
    )
      return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        const ref = doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "reservations",
          id
        );
        batch.delete(ref);
      });
      await batch.commit();
      setSelectedIds(new Set());
      alert("Reservas excluídas.");
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-slate-50 p-4 overflow-hidden">
      {conversionData && (
        <ProductionConversionModal
          isOpen={!!conversionData}
          reservation={conversionData}
          onClose={() => setConversionData(null)}
          onConfirm={handleConfirmConversion}
          findCatalogItem={findCatalogItem}
          inventory={inventory}
        />
      )}

      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-purple-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">
                <Plus size={20} /> Nova Reserva
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                handleCreateReservation(e);
                setIsCreating(false);
              }}
              className="p-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  SKU
                </label>
                <input
                  autoFocus
                  type="text"
                  className="w-full p-2 border rounded font-bold text-slate-700"
                  value={resSku}
                  onChange={(e) => setResSku(e.target.value)}
                  placeholder="Ex: ANEL-01"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={resQty}
                  onChange={(e) => setResQty(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Obs
                </label>
                <textarea
                  className="w-full p-2 border rounded text-sm resize-none h-24"
                  value={resNote}
                  onChange={(e) => setResNote(e.target.value)}
                  placeholder="Detalhes..."
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 border rounded text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-bold flex items-center gap-2"
                >
                  <Save size={16} /> Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2 text-slate-700">
          <Package className="text-purple-600" />
          <h2 className="font-bold text-lg">Reservas & Pedidos</h2>
          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-500">
            {filteredReservations.length}
          </span>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Nova Reserva
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
            >
              <Trash2 size={16} /> Excluir ({selectedIds.size})
            </button>
          )}

          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <select
              className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none bg-white focus:border-purple-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos Status</option>
              <option value="IA_IMPORTED">Novos (IA)</option>
              <option value="PENDENTE">Pendentes</option>
            </select>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none w-full focus:border-purple-500"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-10 text-center">
                <CheckSquare size={14} />
              </th>
              {/* NOVA COLUNA AQUI */}
              <th className="px-4 py-3 text-center">Disponibilidade</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Produto / SKU</th>
              <th className="px-4 py-3">Cliente / Pedido</th>
              <th className="px-4 py-3 w-1/4">Especificações</th>
              <th className="px-4 py-3 text-center">Criado Por</th>
              <th className="px-4 py-3 text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredReservations.map((res) => {
              const catalog = findCatalogItem ? findCatalogItem(res.sku) : null;
              const isSelected = selectedIds.has(res.id);

              // --- LÓGICA DE DISPONIBILIDADE ---
              // Conta quantos itens "in_stock" existem para esse SKU
              const stockCount = inventory.filter(
                (i) => i.sku === res.sku && i.status === "in_stock"
              ).length;
              const isAvailable = stockCount > 0;

              // --- CORREÇÃO DE DATA ---
              let displayDate = "-";
              let displayTime = "";

              if (res.createdAt) {
                const d = parseDate(res.createdAt);
                displayDate = d.toLocaleDateString("pt-BR");
                displayTime = d.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              } else if (res.dateStr) {
                const parts = res.dateStr.split(" ");
                displayDate = parts[0];
                displayTime = parts[1] || "";
              }

              return (
                <tr
                  key={res.id}
                  className={`hover:bg-slate-50 group ${
                    isSelected ? "bg-purple-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                      checked={isSelected}
                      onChange={() => toggleSelection(res.id)}
                    />
                  </td>

                  {/* INDICADOR DE DISPONIBILIDADE */}
                  <td className="px-4 py-3 text-center">
                    {isAvailable ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-bold border border-emerald-200">
                        <CheckCircle size={10} /> {stockCount} UN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-[10px] font-bold border border-red-200">
                        <AlertTriangle size={10} /> FALTA
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} /> {displayDate}
                    </div>
                    <div className="text-[10px] opacity-70">{displayTime}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-blue-600 text-xs">
                      {res.sku}
                    </div>
                    <div className="text-xs text-slate-600 line-clamp-1 max-w-[200px]">
                      {catalog?.name || "Produto não identificado"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 font-bold text-slate-700 text-xs">
                      <User size={12} /> {res.order?.customer?.name || "Balcão"}
                    </div>
                    <div className="text-[10px] text-slate-400 pl-4">
                      Ped: {res.order?.number || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {res.specs?.size && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold border">
                          Aro {res.specs.size}
                        </span>
                      )}
                      {res.specs?.stoneType && res.specs.stoneType !== "ND" && (
                        <span className="bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] border border-yellow-100 flex items-center gap-1">
                          <Gem size={8} /> {res.specs.stoneType}
                        </span>
                      )}
                      {res.specs?.stoneColor &&
                        res.specs.stoneColor !== "ND" && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border">
                            {res.specs.stoneColor}
                          </span>
                        )}

                      {/* MUDANÇA AQUI: De Banho para Finalização */}
                      {res.specs?.finishing && res.specs.finishing !== "ND" && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border">
                          Finalização: {res.specs.finishing}
                        </span>
                      )}

                      {!res.specs?.size &&
                        !res.specs?.stoneType &&
                        !res.specs?.finishing && (
                          <span className="text-[10px] text-slate-400 italic flex items-center gap-1">
                            <AlertCircle size={10} /> Sem specs
                          </span>
                        )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                      <UserCheck size={10} className="text-slate-400" />
                      {res.createdBy || "SISTEMA"}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setConversionData(res)}
                      className="bg-slate-800 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 mx-auto shadow-sm"
                    >
                      <Factory size={14} /> Fábrica
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
