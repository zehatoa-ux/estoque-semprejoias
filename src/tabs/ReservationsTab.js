// src/tabs/ReservationsTab.js
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
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// --- MUDANÇA: Usamos o Service agora, não o Firestore direto ---
import { reservationsService } from "../services/reservationsService";
import { normalizeText } from "../utils/formatters";
import ProductionConversionModal from "../components/modals/ProductionConversionModal";

import { useAuth } from "../contexts/AuthContext"; // Para pegar o user
import { logAction, MODULES, getSafeUser } from "../services/logService";

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
  // Props do App.js (Formulário de criação manual)
  resSku,
  setResSku,
  resQty,
  setResQty,
  resNote,
  setResNote,
  onConvert, // Mantido do App.js por enquanto (pode ser migrado depois)
}) {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conversionData, setConversionData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

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

    // 2. Ordenar (O Mais recente no topo)
    return filtered.sort((a, b) => {
      const dateA = parseDate(a.createdAt);
      const dateB = parseDate(b.createdAt);
      return dateB - dateA;
    });
  }, [reservations, searchText, statusFilter, findCatalogItem]);

  // --- AÇÃO: CRIAR RESERVA (IMPLEMENTADO) ---
  const handleCreateReservation = async (e) => {
    e.preventDefault(); // Evita recarregar a página

    if (!resSku || !resQty) {
      alert("Preencha SKU e Quantidade.");
      return;
    }

    try {
      setLoading(true);

      // Chama o serviço para criar no banco
      await reservationsService.createReservation({
        sku: resSku.toUpperCase().trim(), // Normalize SKU (Uppercase + Trim)
        quantity: Number(resQty), // <--- FORCE NUMBER TYPE HERE
        notes: resNote,
        createdBy: user?.name || "Sistema",
      });

      // --- LOG DE AUDITORIA ---
      logAction(
        getSafeUser(user),
        MODULES.RESERVAS,
        "CRIAR",
        `Nova reserva criada: ${resQty}x ${resSku}`,
        { sku: resSku, qty: resQty, notes: resNote }
      );

      // Limpa o formulário e fecha o modal
      setResSku("");
      setResQty("1");
      setResNote("");
      setIsCreating(false);

      alert("Reserva criada com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao criar reserva: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  // --- AÇÕES (Agora delegadas ao Service) ---

  const handleConfirmConversion = async (enrichedData) => {
    try {
      setLoading(true);
      // O Service cuida de tudo: Criar Pedido, Tirar do Estoque, Apagar Reserva
      await reservationsService.convertToOrder(enrichedData);
      logAction(
        getSafeUser(user),
        MODULES.RESERVAS,
        "CONVERTER_PRODUCAO",
        `Converteu reserva do item ${enrichedData.sku} em Pedido`,
        {
          sku: enrichedData.sku,
          originalReservationId: enrichedData.id,
          wasFromStock: enrichedData.fromStock || false,
        }
      );
      alert(
        enrichedData.fromStock
          ? "Item retirado do estoque e ordem criada!"
          : "Enviado para Produção com sucesso!"
      );
      setConversionData(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao converter: " + error.message);
    } finally {
      setLoading(false);
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
      setLoading(true);
      // Service deleta em lote
      await reservationsService.deleteReservations(Array.from(selectedIds));

      setSelectedIds(new Set());
      alert("Reservas excluídas.");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
            <div className="animate-spin w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full"></div>
            <span className="font-bold text-purple-800">Processando...</span>
          </div>
        </div>
      )}

      {/* Modais */}
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

      {/* HEADER (Com Layout Responsivo) */}
      <div className="bg-white p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2 text-slate-700">
          <Package className="text-purple-600" />
          <h2 className="font-bold text-lg hidden md:block">
            Reservas & Pedidos
          </h2>
          <h2 className="font-bold text-lg md:hidden">Reservas</h2>
          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-500">
            {filteredReservations.length}
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {/* Botões de Ação (Mobile: Grid 2 colunas) */}
          <div className="grid grid-cols-2 gap-2 md:flex">
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm"
            >
              <Plus size={16} /> <span className="md:inline">Nova</span>
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center justify-center gap-2 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
              >
                <Trash2 size={16} />{" "}
                <span className="md:inline">Excluir ({selectedIds.size})</span>
              </button>
            )}
          </div>

          {/* Filtros e Busca */}
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative w-1/3 md:w-auto">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <select
                className="pl-9 pr-2 py-2 border rounded-lg text-sm outline-none bg-white focus:border-purple-500 w-full"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="IA_IMPORTED">Novos</option>
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
      </div>

      {/* TABELA RESPONSIVA (TABLE TO CARD) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 bg-slate-50">
        <table className="w-full text-left text-sm block md:table">
          {/* THEAD (Escondido no Mobile) */}
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b sticky top-0 z-10 hidden md:table-header-group shadow-sm">
            <tr>
              <th className="px-4 py-3 w-10 text-center bg-slate-50">
                <CheckSquare size={14} />
              </th>
              <th className="px-4 py-3 text-center bg-slate-50">
                Disponibilidade
              </th>
              <th className="px-4 py-3 bg-slate-50">Data</th>
              <th className="px-4 py-3 bg-slate-50">Produto / SKU</th>
              <th className="px-4 py-3 bg-slate-50">Cliente / Pedido</th>
              <th className="px-4 py-3 w-1/4 bg-slate-50">Especificações</th>
              <th className="px-4 py-3 text-center bg-slate-50">Criado Por</th>
              <th className="px-4 py-3 text-center bg-slate-50">Ação</th>
            </tr>
          </thead>

          <tbody className="block md:table-row-group space-y-3 md:space-y-0 pb-20">
            {filteredReservations.map((res) => {
              const catalog = findCatalogItem ? findCatalogItem(res.sku) : null;
              const isSelected = selectedIds.has(res.id);

              // Lógica de Disponibilidade
              const stockCount = inventory.filter(
                (i) => i.sku === res.sku && i.status === "in_stock"
              ).length;
              const isAvailable = stockCount > 0;

              // Formatação de Data
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
                  className={`
                    block md:table-row 
                    relative 
                    bg-white 
                    border border-slate-200 md:border-b md:border-slate-100 rounded-xl md:rounded-none 
                    shadow-sm md:shadow-none 
                    hover:bg-slate-50 
                    group 
                    transition-all
                    ${
                      isSelected
                        ? "bg-purple-50 ring-1 ring-purple-400 md:ring-0"
                        : ""
                    }
                  `}
                >
                  {/* 1. CHECKBOX (Absoluto no Mobile - Topo Esquerdo) */}
                  <td className="block md:table-cell md:px-4 md:py-3 text-center align-top p-3 md:p-0 absolute top-0 left-0 md:static z-10">
                    <input
                      type="checkbox"
                      className="w-5 h-5 md:w-4 md:h-4 rounded border-slate-300 cursor-pointer"
                      checked={isSelected}
                      onChange={() => toggleSelection(res.id)}
                    />
                  </td>

                  {/* 2. DISPONIBILIDADE (Absoluto no Mobile - Topo Direito) */}
                  <td className="block md:table-cell md:px-4 md:py-3 text-center align-top p-3 md:p-0 absolute top-0 right-0 md:static z-10">
                    {isAvailable ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-bold border border-emerald-200 shadow-sm">
                        <CheckCircle size={10} /> {stockCount} UN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-[10px] font-bold border border-red-200 shadow-sm">
                        <AlertTriangle size={10} /> FALTA
                      </span>
                    )}
                  </td>

                  {/* 3. DATA (Abaixo do Checkbox no Mobile) */}
                  <td className="block md:table-cell px-4 pb-1 pt-10 md:py-3 text-slate-500 text-xs md:whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} /> {displayDate}
                      <span className="md:hidden text-[10px] opacity-70 ml-1">
                        {displayTime}
                      </span>
                    </div>
                    <div className="hidden md:block text-[10px] opacity-70">
                      {displayTime}
                    </div>
                  </td>

                  {/* 4. PRODUTO (Empilhado) */}
                  <td className="block md:table-cell px-4 py-1 md:py-3">
                    <div className="font-bold text-blue-600 text-sm md:text-xs">
                      {res.sku}
                    </div>
                    <div className="text-xs text-slate-600 md:line-clamp-1 whitespace-normal break-words leading-tight">
                      {catalog?.name || "Produto não identificado"}
                    </div>
                  </td>

                  {/* 5. CLIENTE (Empilhado) */}
                  <td className="block md:table-cell px-4 py-1 md:py-3">
                    <div className="flex items-center gap-1 font-bold text-slate-700 text-xs">
                      <User size={12} /> {res.order?.customer?.name || "Balcão"}
                    </div>
                    <div className="text-[10px] text-slate-400 pl-4">
                      Ped: {res.order?.number || "-"}
                    </div>
                  </td>

                  {/* 6. SPECS (Tags) */}
                  <td className="block md:table-cell px-4 py-2 md:py-3">
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
                      {res.specs?.finishing && res.specs.finishing !== "ND" && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border">
                          Fin: {res.specs.finishing}
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

                  {/* 7. CRIADO POR (Mobile: Inline) */}
                  <td className="block md:table-cell px-4 py-1 md:py-3 md:text-center">
                    <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                      <UserCheck size={10} className="text-slate-400" />
                      {res.createdBy || "SISTEMA"}
                    </div>
                  </td>

                  {/* 8. BOTÃO AÇÃO (Mobile: Largura Total em Baixo) */}
                  <td className="block md:table-cell px-4 py-3 md:py-3 text-center border-t md:border-0 mt-2 md:mt-0 bg-slate-50 md:bg-transparent rounded-b-xl md:rounded-none">
                    <button
                      onClick={() => setConversionData(res)}
                      className="w-full md:w-auto bg-slate-800 hover:bg-purple-600 text-white px-3 py-2 md:py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 mx-auto shadow-sm"
                    >
                      <Factory size={14} />{" "}
                      <span className="md:hidden">Enviar para</span> Fábrica
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
