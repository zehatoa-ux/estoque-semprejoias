import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Layers,
  Trash2,
  CheckSquare,
  Square,
  ArrowRight,
  BoxSelect,
  Plus,
  PackagePlus,
  Hash,
  RefreshCw, // Ícone para forçar reload se precisar
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  writeBatch,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// CONFIGURAÇÃO DOS STATUS
const PE_STATUSES = [
  {
    id: "pe_solicitado",
    label: "Solicitado",
    color: "border-l-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    id: "pe_imprimindo",
    label: "Imprimindo",
    color: "border-l-purple-500",
    bg: "bg-purple-50",
    text: "text-purple-700",
  },
  {
    id: "pe_fundicao",
    label: "Fundidos",
    color: "border-l-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-700",
  },
  {
    id: "pe_conferencia",
    label: "Conferência",
    color: "border-l-teal-500",
    bg: "bg-teal-50",
    text: "text-teal-700",
  },
];

export default function StockProductionTab({ user, findCatalogItem }) {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState("pe_solicitado");
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para Adicionar Novo
  const [newSku, setNewSku] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [isAdding, setIsAdding] = useState(false);

  // Estados para Seleção em Massa
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [targetStatus, setTargetStatus] = useState("");

  // --- CARREGAMENTO REALTIME (SIMPLIFICADO E ROBUSTO) ---
  useEffect(() => {
    // CORREÇÃO: Removemos a query composta complexa.
    // Buscamos tudo que é isPE e filtramos o resto no cliente (JS).
    // Isso garante atualização instantânea sem depender de indexação complexa.
    const q = query(
      collection(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "inventory_items"
      ),
      where("isPE", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (item) =>
            // Filtro local (mais rápido e seguro para atualização de UI)
            item.status !== "adjusted_out" &&
            item.status !== "sold" &&
            item.status !== "pe_interceptado"
        );

      setItems(data);
    });

    return () => unsubscribe();
  }, []);

  // --- FILTROS E ORDENAÇÃO (CORREÇÃO DO BUG DO TIME) ---
  const filteredItems = useMemo(() => {
    return items
      .filter((i) => i.status === activeTab)
      .filter((i) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          i.sku?.toLowerCase().includes(search) ||
          i.name?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        // CORREÇÃO CRÍTICA DE ORDENAÇÃO:
        // Se timestamp for null (item acabou de ser criado localmente),
        // consideramos ele como "Futuro Distante" (Date.now() + 99999) para ficar no TOPO.
        // Se não, usa os segundos do Firebase.
        const timeA = a.timestamp
          ? a.timestamp.seconds
          : Number.MAX_SAFE_INTEGER;
        const timeB = b.timestamp
          ? b.timestamp.seconds
          : Number.MAX_SAFE_INTEGER;

        return timeB - timeA; // Decrescente (Mais novo no topo)
      });
  }, [items, activeTab, searchTerm]);

  const counts = useMemo(() => {
    const c = {};
    PE_STATUSES.forEach((s) => (c[s.id] = 0));
    items.forEach((i) => {
      if (c[i.status] !== undefined) c[i.status]++;
    });
    return c;
  }, [items]);

  // --- AÇÕES ---

  const handleAddItem = async (e) => {
    e.preventDefault();
    const skuClean = newSku.trim().toUpperCase();
    const qty = parseInt(newQty);

    if (!skuClean) return alert("Digite o SKU.");
    if (!qty || qty < 1) return alert("Quantidade inválida.");

    setIsAdding(true);

    try {
      const batch = writeBatch(db);
      const catalogItem = findCatalogItem ? findCatalogItem(skuClean) : null;
      const itemName = catalogItem?.name || "Novo Item PE";
      const dateStr = new Date().toLocaleDateString("pt-BR");

      for (let i = 0; i < qty; i++) {
        const newRef = doc(
          collection(
            db,
            "artifacts",
            APP_COLLECTION_ID,
            "public",
            "data",
            "inventory_items"
          )
        );
        batch.set(newRef, {
          sku: skuClean,
          name: itemName,
          status: "pe_solicitado",
          isPE: true,
          dateIn: dateStr,
          timestamp: serverTimestamp(),
          addedBy: user?.name || "Sistema",
        });
      }

      await batch.commit();

      setNewSku("");
      setNewQty("1");
      setActiveTab("pe_solicitado");
    } catch (err) {
      console.error(err);
      alert("Erro ao criar: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = filteredItems.map((i) => i.id);
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkMove = async () => {
    if (selectedIds.size === 0 || !targetStatus) return;
    if (!window.confirm(`Mover ${selectedIds.size} itens?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        const ref = doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "inventory_items",
          id
        );
        batch.update(ref, {
          status: targetStatus,
          lastModified: serverTimestamp(),
          modifiedBy: user?.name || "Sistema",
        });
      });
      await batch.commit();
      setSelectedIds(new Set());
      setTargetStatus("");
    } catch (err) {
      alert("Erro ao mover: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este item?")) return;
    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "inventory_items",
          id
        )
      );
    } catch (e) {
      alert("Erro ao deletar");
    }
  };

  const currentConfig =
    PE_STATUSES.find((s) => s.id === activeTab) || PE_STATUSES[0];

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <Layers size={18} /> Estoque Fábrica
          </h2>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto">
          {PE_STATUSES.map((step) => (
            <button
              key={step.id}
              onClick={() => {
                setActiveTab(step.id);
                setSelectedIds(new Set());
              }}
              className={`w-full text-left px-3 py-3 rounded-lg text-xs font-bold flex justify-between items-center transition-all ${
                activeTab === step.id
                  ? `bg-slate-800 text-white shadow-md`
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{step.label}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] ${
                  activeTab === step.id
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {counts[step.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* HEADER */}
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${currentConfig.bg.replace(
                    "bg-",
                    "bg-"
                  )}-500`}
                ></span>
                {currentConfig.label}
              </h1>
              <p className="text-xs text-slate-500">
                Gestão de lotes (Pronta Entrega)
              </p>
            </div>

            <div className="flex gap-2 w-full md:w-auto items-center">
              {/* FORMULÁRIO DE ADICIONAR */}
              <form
                onSubmit={handleAddItem}
                className="flex gap-1 items-center bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm"
              >
                <div className="relative">
                  <PackagePlus
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-400"
                    size={14}
                  />
                  <input
                    className="pl-7 pr-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-purple-500 w-28 uppercase font-bold bg-white"
                    placeholder="SKU..."
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Hash
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-400"
                    size={12}
                  />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="pl-6 pr-1 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-purple-500 w-14 font-bold text-center bg-white"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="bg-purple-600 text-white p-1.5 rounded hover:bg-purple-700 shadow-sm disabled:opacity-50 transition-colors"
                  title="Adicionar Lote"
                >
                  {isAdding ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              </form>

              <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>

              <div className="relative w-48 md:w-56">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <input
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                  placeholder="Filtrar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* BARRA DE AÇÃO EM MASSA */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-100 p-2 rounded-lg animate-fade-in shadow-sm">
              <div className="flex items-center gap-2 px-2 border-r border-purple-200">
                <BoxSelect size={18} className="text-purple-600" />
                <span className="text-xs font-bold text-purple-900">
                  {selectedIds.size} selecionados
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-purple-700 font-medium">
                  Mover para:
                </span>
                <select
                  className="p-1.5 rounded border border-purple-200 text-xs font-bold text-slate-700 outline-none w-48 bg-white cursor-pointer"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                >
                  <option value="">Selecione o destino...</option>
                  {PE_STATUSES.filter((s) => s.id !== activeTab).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleBulkMove}
                  disabled={!targetStatus}
                  className="bg-purple-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
                >
                  <ArrowRight size={14} /> Mover Itens
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
          <div className="flex items-center gap-4 px-4 py-2 mb-2 text-xs font-bold text-slate-400 uppercase">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 hover:text-slate-600 transition-colors"
            >
              {selectedIds.size > 0 &&
              selectedIds.size === filteredItems.length ? (
                <CheckSquare size={16} className="text-purple-600" />
              ) : (
                <Square size={16} />
              )}
              Selecionar Todos
            </button>
            <span>Detalhes do Item</span>
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => {
              const catalogItem = findCatalogItem
                ? findCatalogItem(item.sku)
                : null;
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`bg-white border p-3 rounded-lg flex items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    isSelected
                      ? "border-purple-400 bg-purple-50 ring-1 ring-purple-400"
                      : "border-slate-200"
                  } ${currentConfig.color} border-l-4`}
                  onClick={() => toggleSelectOne(item.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="text-slate-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectOne(item.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-purple-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </div>

                    <div
                      className={`h-10 w-10 rounded flex items-center justify-center text-[10px] font-bold ${currentConfig.bg} ${currentConfig.text}`}
                    >
                      EP
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-600">
                          {item.sku}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate w-64">
                        {item.name ||
                          catalogItem?.name ||
                          "Produto sem cadastro"}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-right hidden md:block">
                      <span className="text-[10px] text-slate-400 block">
                        Criado em
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {item.dateIn || "Hoje"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remover Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="text-center py-10 text-slate-400 animate-fade-in">
                <Layers size={48} className="mx-auto mb-2 opacity-20" />
                <p>Nenhum item nesta etapa.</p>
                {activeTab === "pe_solicitado" && (
                  <p className="text-xs text-purple-500 mt-2 font-medium">
                    Use o campo acima para criar novos lotes!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
