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
  Printer,
  RefreshCw, // Ícone para forçar reload se precisar
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  writeBatch,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import { formatProductionTicket } from "../utils/printFormatter"; // Importe o formatador
import TextModal from "../components/modals/TextModal";
import { logAction } from "../services/logService";

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

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printContent, setPrintContent] = useState("");

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
    const safeUser = user || {
      name: "Admin (Sistema)",
      email: "sys",
      uid: "sys",
    };

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
      logAction(
        safeUser,
        "ESTOQUE_PE",
        "CRIAR",
        `Criou ${qty} novos lotes do SKU: ${skuClean}`,
        { sku: skuClean, qty: qty }
      );
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

    // 1. Salva estado anterior para rollback em caso de erro (Opcional, mas boa prática)
    const previousItems = [...items];

    try {
      // 2. ATUALIZAÇÃO OTIMISTA (INSTANTÂNEA NA TELA)
      setItems((prevItems) =>
        prevItems.map((item) =>
          selectedIds.has(item.id)
            ? { ...item, status: targetStatus } // Muda o status localmente
            : item
        )
      );

      // 3. Executa no Banco
      const batch = writeBatch(db);

      // Importante: Precisamos iterar sobre selectedIds para adicionar ao batch
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
        batch.update(ref, { status: targetStatus });
      });

      await batch.commit();

      // 4. Log
      logAction(
        user,
        "ESTOQUE_PE",
        "MOVER_EM_MASSA",
        `Moveu ${selectedIds.size} itens para o status: ${targetStatus}`,
        {
          count: selectedIds.size,
          targetStatus: targetStatus,
          itemIds: Array.from(selectedIds),
        }
      );

      // 5. Limpa UI
      setSelectedIds(new Set());
      setTargetStatus("");

      // Se você mudou o status para algo diferente da aba atual, os itens vão "sumir" da tela
      // (filtrados pelo useMemo). Isso é o comportamento esperado e correto visualmente.
    } catch (err) {
      console.error(err);
      alert("Erro ao mover: " + err.message);
      // Rollback em caso de erro
      setItems(previousItems);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este item?")) return;

    // 1. Acha o item na lista para salvar o nome no log (antes de apagar)
    const itemToDelete = items.find((i) => i.id === id);
    const sku = itemToDelete?.sku || "Desconhecido";

    // Trava de segurança do usuário
    const safeUser = user || {
      name: "Admin (Sistema)",
      email: "sys",
      uid: "sys",
    };

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

      // 2. Grava o Log de Exclusão
      logAction(
        safeUser,
        "ESTOQUE_PE",
        "EXCLUIR",
        `Apagou o item ${sku}`,
        { deletedId: id, sku: sku, fullItem: itemToDelete } // Salva tudo se precisar recuperar info
      );
    } catch (e) {
      alert("Erro ao deletar");
    }
  };

  // --- EXCLUSÃO EM MASSA ---
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    // Confirmação de Segurança
    const confirmMessage = `PERIGO: Você tem certeza que deseja EXCLUIR PERMANENTEMENTE ${selectedIds.size} itens?\n\nEssa ação não pode ser desfeita.`;
    if (!window.confirm(confirmMessage)) return;

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
        batch.delete(ref);
      });

      await batch.commit();
      const safeUser = user || {
        name: "Admin (Sistema)",
        email: "sys",
        uid: "sys",
      };

      logAction(
        safeUser,
        "ESTOQUE_PE",
        "EXCLUSAO_EM_MASSA",
        `Excluiu ${selectedIds.size} itens permanentemente`,
        { count: selectedIds.size, deletedIds: Array.from(selectedIds) }
      );

      setSelectedIds(new Set()); // Limpa a seleção após deletar
      // Opcional: alert("Itens excluídos com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir lote: " + err.message);
    }
  };
  // --- FUNÇÃO DE IMPRESSÃO (ADAPTADOR) ---
  const handleBatchPrint = () => {
    if (selectedIds.size === 0) return;

    // 1. Pega os itens selecionados
    const itemsToPrint = items.filter((i) => selectedIds.has(i.id));

    // 2. Adapta os dados para o formatador (Simulando um Pedido)
    const adaptedItems = itemsToPrint.map((item) => ({
      ...item,
      customerName: "PRODUCAO DE ESTOQUE", // Nome fictício
      order: {
        number: item.sku || "SN", // Número fictício
      },
      dateStr: item.dateIn || new Date().toLocaleDateString("pt-BR"),
      specs: item.specs || {},
    }));

    // 3. Gera o Texto
    const text = formatProductionTicket(adaptedItems);

    // 4. Joga no Estado e Abre o Modal
    setPrintContent(text);
    setShowPrintModal(true);
  };

  const currentConfig =
    PE_STATUSES.find((s) => s.id === activeTab) || PE_STATUSES[0];

  return (
    // 1. ALTERAÇÃO PRINCIPAL: 'flex-col' no mobile, 'md:flex-row' no PC
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
      {/* --- SIDEBAR (VISÍVEL APENAS NO DESKTOP) --- */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0">
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

      {/* --- MENU MOBILE (O "SEGUNDO SANDUÍCHE") --- */}
      {/* Agora ele fica empilhado no topo graças ao flex-col do pai */}
      <div className="md:hidden bg-slate-100 border-b border-slate-200 p-3 shrink-0 z-10">
        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
          <Layers size={12} /> Filtrar Etapa:
        </label>
        <div className="relative">
          <select
            value={activeTab}
            onChange={(e) => {
              setActiveTab(e.target.value);
              setSelectedIds(new Set());
            }}
            // Fundo branco para destacar do fundo cinza do header
            className="w-full appearance-none bg-white border border-slate-300 text-slate-800 text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
          >
            {PE_STATUSES.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label} ({counts[status.id] || 0})
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <Layers size={16} />
          </div>
        </div>
      </div>

      {/* --- ÁREA PRINCIPAL --- */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* HEADER DA TAB (Busca e Adicionar) */}
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Título (Escondido no mobile para economizar espaço vertical) */}
            <div className="hidden md:block">
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

            <div className="flex flex-col w-full md:flex-row gap-2 md:w-auto items-center">
              {/* FORMULÁRIO DE ADICIONAR */}
              <form
                onSubmit={handleAddItem}
                className="flex gap-1 items-center bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto"
              >
                <div className="relative flex-1 md:flex-none">
                  <PackagePlus
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-400"
                    size={14}
                  />
                  <input
                    className="pl-7 pr-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-purple-500 w-full md:w-28 uppercase font-bold bg-white"
                    placeholder="SKU..."
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                  />
                </div>
                <div className="relative w-20 md:w-auto">
                  <Hash
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-400"
                    size={12}
                  />
                  <input
                    type="number"
                    min="1"
                    className="pl-6 pr-1 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-purple-500 w-full md:w-14 font-bold text-center bg-white"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="bg-purple-600 text-white p-1.5 rounded hover:bg-purple-700 shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isAdding ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              </form>

              {/* BUSCA */}
              <div className="relative w-full md:w-56">
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
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-purple-50 border border-purple-100 p-2 rounded-lg animate-fade-in shadow-sm">
              <div className="flex items-center gap-2 px-2 md:border-r border-purple-200 mb-2 md:mb-0">
                <BoxSelect size={18} className="text-purple-600" />
                <span className="text-xs font-bold text-purple-900">
                  {selectedIds.size} selecionados
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-1">
                <button
                  onClick={handleBatchDelete}
                  className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-2 border border-red-200 hover:border-red-600 grow md:grow-0 justify-center"
                >
                  <Trash2 size={14} />{" "}
                  <span className="md:hidden">Excluir</span>
                </button>

                <button
                  onClick={handleBatchPrint}
                  className="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-900 flex items-center gap-2 shadow-sm transition-colors grow md:grow-0 justify-center"
                >
                  <Printer size={14} />{" "}
                  <span className="md:hidden">Imprimir</span>
                </button>

                <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto mt-2 md:mt-0">
                  <span className="text-xs text-purple-700 font-medium hidden md:inline">
                    Mover:
                  </span>
                  <select
                    className="p-1.5 rounded border border-purple-200 text-xs font-bold text-slate-700 outline-none flex-1 md:w-40 bg-white cursor-pointer"
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                  >
                    <option value="">Destino...</option>
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
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-slate-50/50">
          <div className="flex items-center gap-4 px-2 md:px-4 py-2 mb-2 text-xs font-bold text-slate-400 uppercase">
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
            <span className="hidden md:inline">Detalhes do Item</span>
          </div>

          <div className="space-y-2 pb-20">
            {filteredItems.map((item) => {
              const catalogItem = findCatalogItem
                ? findCatalogItem(item.sku)
                : null;
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`bg-white border p-3 rounded-lg flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    isSelected
                      ? "border-purple-400 bg-purple-50 ring-1 ring-purple-400"
                      : "border-slate-200"
                  } ${currentConfig.color} border-l-4`}
                  onClick={() => toggleSelectOne(item.id)}
                >
                  <div className="flex items-start gap-3 mb-2 md:mb-0">
                    <div
                      className="mt-1 text-slate-400"
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

                    <div>
                      <div className="flex items-center gap-2">
                        {/* Tag EP visível no mobile */}
                        <div className="md:hidden">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${currentConfig.bg} ${currentConfig.text}`}
                          >
                            EP
                          </span>
                        </div>
                        <span className="font-bold text-blue-600">
                          {item.sku}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate w-full md:w-64">
                        {item.name ||
                          catalogItem?.name ||
                          "Produto sem cadastro"}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between md:justify-end gap-6 pl-8 md:pl-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block md:hidden">
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

      {/* --- AQUI É O LUGAR DO MODAL (FORA DO SCROLL DA MAIN) --- */}
      {showPrintModal && (
        <TextModal
          title={`Etiquetas de Estoque (${selectedIds.size})`}
          content={printContent}
          onClose={() => {
            setShowPrintModal(false);
            setPrintContent("");
          }}
        />
      )}
    </div>
  );
}
