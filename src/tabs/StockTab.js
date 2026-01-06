import React, { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  Package,
  User,
  Calendar,
  Plus,
  Edit2,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Layers,
  CheckCircle,
} from "lucide-react";
import { normalizeText, formatMoney } from "../utils/formatters";
import { APP_COLLECTION_ID } from "../config/constants";
import { db } from "../config/firebase";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";

// Services
import { inventoryService } from "../services/inventoryService";

// Modais
import EditModal from "../components/modals/EditModal";
import QuickResModal from "../components/modals/QuickResModal";

export default function StockTab({
  inventory,
  reservations,
  findCatalogItem,
  user,
  loadingCatalog,
  onRefreshCatalog,
}) {
  // --- ESTADOS LOCAIS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModel, setFilterModel] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: "lastModified",
    direction: "desc",
  });

  // Modais e Seleção
  const [editModal, setEditModal] = useState(null);
  const [quickResModal, setQuickResModal] = useState(null);

  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [zoomedImage, setZoomedImage] = useState(null);

  const itemsPerPage = 50;

  // --- 1. LÓGICA DE AGRUPAMENTO ---
  const groupedInventory = useMemo(() => {
    const groups = {};
    const reservationsMap = {};

    reservations.forEach((r) => {
      if (!reservationsMap[r.sku]) reservationsMap[r.sku] = 0;
      reservationsMap[r.sku] += r.quantity;
    });

    inventory.forEach((i) => {
      // CORREÇÃO CRÍTICA AQUI:
      // O item só é contado como Estoque Físico se for "in_stock" E não for PE.
      const isRealStock = i.status === "in_stock" && !i.isPE;

      // O item só é contado como Fábrica (PE) se for PE, mas NÃO tiver saído (sold/adjusted_out/interceptado)
      // Isso garante que itens convertidos em pedidos sumam da contagem.
      const isProduction =
        i.isPE === true &&
        i.status !== "adjusted_out" &&
        i.status !== "sold" &&
        i.status !== "pe_interceptado";

      // Se não for nenhum dos dois (ex: vendido ou baixado), ignora
      if (!isRealStock && !isProduction) return;

      if (!groups[i.sku]) {
        const d = findCatalogItem(i.sku);
        groups[i.sku] = {
          sku: i.sku,
          baseSku: d?.baseSku || i.sku,
          name: d?.name || "N/I",
          model: d?.model || "-",
          price: d?.price || 0,
          image: d?.image,

          quantity: 0, // Total Geral
          qtyReal: 0, // Contador Pronta Entrega
          qtyPE: 0, // Contador Fábrica

          reservedQuantity: reservationsMap[i.sku] || 0,
          entries: [],
          lastModified: i.timestamp?.seconds || 0,
          lastModifiedStr: i.dateIn,
          lastModifiedUser: i.addedBy,
        };
      }

      // Incrementa os contadores
      groups[i.sku].quantity++;
      if (isRealStock) groups[i.sku].qtyReal++;
      if (isProduction) groups[i.sku].qtyPE++;

      groups[i.sku].entries.push(i);

      if (i.timestamp?.seconds > groups[i.sku].lastModified) {
        groups[i.sku].lastModified = i.timestamp.seconds;
        groups[i.sku].lastModifiedStr = i.dateIn;
        groups[i.sku].lastModifiedUser = i.addedBy;
      }
    });

    // Calcula disponibilidade baseado no estoque REAL
    Object.values(groups).forEach(
      (g) => (g.displayQuantity = g.qtyReal - g.reservedQuantity)
    );

    return Object.values(groups);
  }, [inventory, reservations, findCatalogItem]);

  // --- 2. FILTROS E BUSCA ---
  const filteredAndSortedGroups = useMemo(() => {
    let result = groupedInventory.filter((group) => {
      const searchLower = normalizeText(searchTerm);
      const skuStr = normalizeText(group.sku);
      const nameStr = normalizeText(group.name);
      const modelStr = normalizeText(group.model);
      return (
        (skuStr.includes(searchLower) ||
          nameStr.includes(searchLower) ||
          modelStr.includes(searchLower)) &&
        (filterModel === "all" || group.model === filterModel)
      );
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        return (
          (valA < valB ? -1 : 1) * (sortConfig.direction === "asc" ? 1 : -1)
        );
      });
    }
    return result;
  }, [groupedInventory, searchTerm, filterModel, sortConfig]);

  // --- 3. PAGINAÇÃO ---
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedGroups, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedGroups.length / itemsPerPage);

  const modelsAvailableInSearch = useMemo(() => {
    const searchLower = normalizeText(searchTerm);
    const matchingItems = groupedInventory.filter((group) => {
      if (!searchLower) return true;
      const skuStr = normalizeText(group.sku);
      const nameStr = normalizeText(group.name);
      const modelStr = normalizeText(group.model);
      return (
        skuStr.includes(searchLower) ||
        nameStr.includes(searchLower) ||
        modelStr.includes(searchLower)
      );
    });
    const models = new Set();
    matchingItems.forEach((item) => {
      if (item.model && item.model !== "-") models.add(item.model);
    });
    return Array.from(models).sort();
  }, [groupedInventory, searchTerm]);

  // --- 4. AÇÕES ---

  const handleQuickReservation = async (qty, note, customerName) => {
    if (!quickResModal) return;
    try {
      await inventoryService.createReservation(
        quickResModal.sku,
        Number(qty),
        user.name,
        note,
        customerName
      );
      setQuickResModal(null);
      alert("Reserva criada com sucesso!");
    } catch (error) {
      alert("Erro ao criar reserva: " + error.message);
    }
  };

  const handleExportXLSX = () => {
    if (!window.XLSX) return;
    const ws = window.XLSX.utils.json_to_sheet(
      filteredAndSortedGroups.map((g) => ({
        SKU: g.sku,
        Nome: g.name,
        "Qtd Real": g.qtyReal,
        "Qtd Fabrica": g.qtyPE,
        Preco: g.price,
      }))
    );
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    window.XLSX.writeFile(wb, "estoque.xlsx");
  };

  const handleExportPDF = () => {
    if (!window.jspdf) return;
    const doc = new window.jspdf.jsPDF();
    doc.text("Relatório de Estoque", 14, 22);
    doc.autoTable({
      head: [["SKU", "Nome", "Qtd Real", "Em Prod.", "Preço"]],
      body: filteredAndSortedGroups.map((g) => [
        g.sku,
        g.name,
        g.qtyReal,
        g.qtyPE,
        formatMoney(g.price),
      ]),
    });
    doc.save("estoque.pdf");
  };

  const handleBulkDelete = async () => {
    if (selectedSkus.size === 0) return alert("Nada selecionado.");

    let hasConflict = false;
    selectedSkus.forEach((sku) => {
      const group = groupedInventory.find((g) => g.sku === sku);
      if (group && group.reservedQuantity > 0) hasConflict = true;
    });

    if (hasConflict && !window.confirm("Reservas serão afetadas. Continuar?"))
      return;
    if (!window.confirm(`Remover itens de ${selectedSkus.size} SKUs?`)) return;

    try {
      const batch = writeBatch(db);
      let count = 0;

      selectedSkus.forEach((sku) => {
        const group = groupedInventory.find((g) => g.sku === sku);
        if (!group) return;

        group.entries.forEach((item) => {
          const ref = doc(
            db,
            "artifacts",
            APP_COLLECTION_ID,
            "public",
            "data",
            "inventory_items",
            item.id
          );
          // Se for PE deleta direto, se for estoque marca saída
          if (item.isPE) {
            batch.delete(ref);
          } else {
            batch.update(ref, {
              status: "adjusted_out",
              outTimestamp: serverTimestamp(),
              dateOut: new Date().toLocaleString("pt-BR"),
              removedBy: user.name,
              bulkAction: true,
            });
          }
          count++;
        });
      });

      await batch.commit();
      alert(`${count} itens processados.`);
      setSelectedSkus(new Set());
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  // Helpers
  const requestSort = (key) =>
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });

  const SortIcon = ({ colKey }) =>
    sortConfig.key !== colKey ? (
      <div className="w-4 h-4" />
    ) : sortConfig.direction === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );

  const toggleSelectOne = (sku) => {
    const newSet = new Set(selectedSkus);
    if (newSet.has(sku)) newSet.delete(sku);
    else newSet.add(sku);
    setSelectedSkus(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedSkus.size === paginatedData.length) setSelectedSkus(new Set());
    else setSelectedSkus(new Set(paginatedData.map((g) => g.sku)));
  };

  // Contadores (CORRIGIDOS)
  const totalStock = inventory.filter(
    (i) => i.status === "in_stock" && !i.isPE
  ).length;

  // Agora filtra apenas PE que está ativo (não baixado/vendido/interceptado)
  const totalPE = inventory.filter(
    (i) =>
      i.isPE === true &&
      i.status !== "adjusted_out" &&
      i.status !== "sold" &&
      i.status !== "pe_interceptado"
  ).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* --- MODAIS --- */}
      <EditModal
        isOpen={!!editModal}
        data={editModal}
        onClose={() => setEditModal(null)}
      />

      {quickResModal && (
        <QuickResModal
          isOpen={!!quickResModal}
          group={quickResModal}
          onClose={() => setQuickResModal(null)}
          onConfirm={handleQuickReservation}
        />
      )}

      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              className="absolute -top-12 right-0 text-white p-2"
              onClick={() => setZoomedImage(null)}
            >
              <X size={32} />
            </button>
            <img
              src={zoomedImage}
              alt="Zoom"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="p-4 border-b flex flex-col gap-4">
        {/* Métricas */}
        <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded border border-emerald-100">
            <CheckCircle size={14} /> Físico: {totalStock}
          </div>
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1.5 rounded border border-orange-100">
            <Layers size={14} /> Fábrica: {totalPE}
          </div>
        </div>

        <div className="flex justify-between gap-4 flex-col md:flex-row items-center">
          <div className="relative flex-1 w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Pesquisar SKU, Nome ou Modelo..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {selectedSkus.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-200"
              >
                <Trash2 size={16} /> Excluir ({selectedSkus.size})
              </button>
            )}

            <button
              onClick={onRefreshCatalog}
              disabled={loadingCatalog}
              className="p-2.5 border rounded-lg hover:bg-slate-50"
              title="Recarregar Catálogo"
            >
              <RefreshCw
                size={20}
                className={loadingCatalog ? "animate-spin" : ""}
              />
            </button>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={handleExportXLSX}
                className="px-3 py-2 bg-white hover:bg-green-50 text-green-600 border-r text-xs font-medium"
              >
                <FileSpreadsheet size={16} /> XLSX
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 text-xs font-medium"
              >
                <FileText size={16} /> PDF
              </button>
            </div>
            <div className="relative w-48">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <select
                className="w-full pl-9 pr-8 py-2.5 border rounded-lg outline-none bg-white text-sm"
                value={filterModel}
                onChange={(e) => {
                  setFilterModel(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todos Modelos</option>
                {modelsAvailableInSearch.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* --- TABELA --- */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 font-bold sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-10 text-center bg-slate-50">
                <input
                  type="checkbox"
                  checked={
                    selectedSkus.size > 0 &&
                    selectedSkus.size === paginatedData.length
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded"
                />
              </th>
              <th className="px-4 py-3 w-16 bg-slate-50">Foto</th>
              <th
                className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50"
                onClick={() => requestSort("sku")}
              >
                SKU <SortIcon colKey="sku" />
              </th>
              <th
                className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50"
                onClick={() => requestSort("name")}
              >
                Nome <SortIcon colKey="name" />
              </th>
              <th
                className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50"
                onClick={() => requestSort("lastModified")}
              >
                Última Mod. <SortIcon colKey="lastModified" />
              </th>
              <th className="px-4 py-3 bg-slate-50">Quem Modificou</th>

              <th
                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 bg-slate-50 w-32"
                onClick={() => requestSort("quantity")}
              >
                Disponibilidade <SortIcon colKey="quantity" />
              </th>

              <th className="px-4 py-3 text-center bg-slate-50">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.map((group, idx) => (
              <tr
                key={idx}
                className={`hover:bg-blue-50/30 ${
                  selectedSkus.has(group.sku) ? "bg-blue-50" : ""
                }`}
              >
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedSkus.has(group.sku)}
                    onChange={() => toggleSelectOne(group.sku)}
                    className="w-4 h-4 rounded"
                  />
                </td>

                <td className="px-4 py-3">
                  <div
                    className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => group.image && setZoomedImage(group.image)}
                  >
                    {group.image ? (
                      <img
                        src={group.image}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <Package size={16} className="text-slate-300" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-blue-600 font-bold text-xs">
                    {group.sku}
                  </span>
                  {group.reservedQuantity > 0 && (
                    <span
                      className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1"
                      title="Reservados"
                    >
                      R {group.reservedQuantity}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-700 text-xs font-medium line-clamp-1">
                    {group.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                      {formatMoney(group.price)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {group.baseSku} • {group.model}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} /> {group.lastModifiedStr || "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded w-fit">
                    <User size={10} /> {group.lastModifiedUser || "-"}
                  </div>
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    {group.qtyReal > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {group.qtyReal}{" "}
                        <span className="text-[9px] uppercase font-normal text-emerald-600">
                          Disp.
                        </span>
                      </span>
                    )}

                    {group.qtyPE > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
                        <Layers size={10} /> {group.qtyPE}{" "}
                        <span className="text-[9px] uppercase font-normal text-orange-600">
                          Prod.
                        </span>
                      </span>
                    )}

                    {group.qtyReal === 0 && group.qtyPE === 0 && (
                      <span className="text-slate-300 text-xs font-bold">
                        0
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-center flex justify-center gap-1">
                  <button
                    onClick={() => setQuickResModal(group)}
                    className="p-1.5 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm"
                    title="Reserva Rápida"
                  >
                    <Plus size={16} />
                  </button>

                  <button
                    onClick={() => setEditModal(group)}
                    className="p-1.5 text-slate-400 bg-slate-100 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="Editar Estoque"
                  >
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td
                  colSpan="8"
                  className="px-6 py-8 text-center text-slate-400"
                >
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- PAGINAÇÃO --- */}
      <div className="p-4 flex justify-between items-center bg-slate-50 text-xs text-slate-500 border-t shrink-0">
        <span>
          {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, filteredAndSortedGroups.length)}{" "}
          de {filteredAndSortedGroups.length}
        </span>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
