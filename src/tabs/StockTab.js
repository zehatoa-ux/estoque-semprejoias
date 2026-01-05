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
} from "lucide-react";
import { normalizeText, formatMoney } from "../utils/formatters";
import { APP_COLLECTION_ID } from "../config/constants";
import { db } from "../config/firebase";
import {
  doc,
  writeBatch,
  serverTimestamp,
  collection,
} from "firebase/firestore";

// Services (Para as ações de delete em massa)
import { inventoryService } from "../services/inventoryService";

// Modais
import EditModal from "../components/modals/EditModal";
import QuickResModal from "../components/modals/QuickResModal";

export default function StockTab({
  inventory,
  reservations,
  findCatalogItem, // Vem do useCatalog
  user,
  loadingCatalog,
  onRefreshCatalog, // Função para recarregar o XLSX
}) {
  // --- ESTADOS LOCAIS DA ABA ---
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
  const [qrQty, setQrQty] = useState("1");
  const [qrNote, setQrNote] = useState("");

  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [zoomedImage, setZoomedImage] = useState(null);

  const itemsPerPage = 50;

  // --- 1. LÓGICA DE AGRUPAMENTO (Idêntica ao App.js antigo) ---
  const groupedInventory = useMemo(() => {
    const groups = {};
    const reservationsMap = {};

    reservations.forEach((r) => {
      if (!reservationsMap[r.sku]) reservationsMap[r.sku] = 0;
      reservationsMap[r.sku] += r.quantity;
    });

    inventory.forEach((i) => {
      if (i.status !== "in_stock") return;

      if (!groups[i.sku]) {
        const d = findCatalogItem(i.sku);
        groups[i.sku] = {
          sku: i.sku,
          baseSku: d?.baseSku || i.sku,
          name: d?.name || "N/I",
          model: d?.model || "-",
          price: d?.price || 0,
          image: d?.image,
          quantity: 0,
          reservedQuantity: reservationsMap[i.sku] || 0,
          entries: [],
          lastModified: i.timestamp?.seconds || 0,
          lastModifiedStr: i.dateIn,
          lastModifiedUser: i.addedBy,
        };
      }

      groups[i.sku].quantity++;
      groups[i.sku].entries.push(i); // Guarda referência dos itens individuais

      if (i.timestamp?.seconds > groups[i.sku].lastModified) {
        groups[i.sku].lastModified = i.timestamp.seconds;
        groups[i.sku].lastModifiedStr = i.dateIn;
        groups[i.sku].lastModifiedUser = i.addedBy;
      }
    });

    Object.values(groups).forEach(
      (g) => (g.displayQuantity = g.quantity - g.reservedQuantity)
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

  // --- 3. PAGINAÇÃO E LISTAS AUXILIARES ---
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

  // --- 4. AÇÕES (Export, Bulk Delete) ---

  const handleExportXLSX = () => {
    if (!window.XLSX) return;
    const ws = window.XLSX.utils.json_to_sheet(
      filteredAndSortedGroups.map((g) => ({
        SKU: g.sku,
        Nome: g.name,
        Qtd: g.displayQuantity,
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
    doc.text(
      `Total Peças: ${inventory.filter((i) => i.status === "in_stock").length}`,
      14,
      30
    );
    doc.autoTable({
      head: [["SKU", "Nome", "Qtd", "Preço"]],
      body: filteredAndSortedGroups.map((g) => [
        g.sku,
        g.name,
        g.displayQuantity,
        formatMoney(g.price),
      ]),
    });
    doc.save("estoque.pdf");
  };

  // Bulk Delete (Mantendo lógica local segura por enquanto)
  const handleBulkDelete = async () => {
    if (selectedSkus.size === 0) return alert("Nada selecionado.");

    // Verifica conflitos com reservas
    let hasConflict = false;
    selectedSkus.forEach((sku) => {
      const group = groupedInventory.find((g) => g.sku === sku);
      if (group && group.reservedQuantity > 0) hasConflict = true;
    });

    if (hasConflict && !window.confirm("Reservas serão afetadas. Continuar?"))
      return;
    if (
      !hasConflict &&
      !window.confirm(`Remover itens de ${selectedSkus.size} SKUs?`)
    )
      return;

    try {
      const batch = writeBatch(db);
      let count = 0;

      // Itera sobre os grupos selecionados
      selectedSkus.forEach((sku) => {
        const group = groupedInventory.find((g) => g.sku === sku);
        if (!group) return;

        // Pega todos os itens desse grupo
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
          batch.update(ref, {
            status: "adjusted_out",
            outTimestamp: serverTimestamp(),
            dateOut: new Date().toLocaleString("pt-BR"),
            removedBy: user.name,
            bulkAction: true,
          });
          count++;
        });
      });

      await batch.commit();
      alert(`${count} itens removidos.`);
      setSelectedSkus(new Set());
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  // --- 5. RENDER HELPERS ---
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* --- MODAIS INTERNOS --- */}
      <EditModal
        isOpen={!!editModal}
        data={editModal}
        onClose={() => setEditModal(null)}
        // onAdjust removido! EditModal usa inventoryService diretamente agora.
      />

      {/* Modal de Zoom de Imagem */}
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

      {/* --- BARRA DE FERRAMENTAS --- */}
      <div className="p-4 border-b flex justify-between gap-4 flex-col md:flex-row items-center">
        <div className="relative flex-1 w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Pesquisar..."
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

      {/* --- TABELA --- */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 font-bold">
            <tr>
              <th className="px-4 py-3 w-10 text-center">
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
              <th className="px-4 py-3 w-16">Foto</th>
              <th
                className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                onClick={() => requestSort("sku")}
              >
                SKU <SortIcon colKey="sku" />
              </th>
              <th
                className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                onClick={() => requestSort("name")}
              >
                Nome <SortIcon colKey="name" />
              </th>
              <th
                className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                onClick={() => requestSort("lastModified")}
              >
                Última Mod. <SortIcon colKey="lastModified" />
              </th>
              <th className="px-4 py-3">Quem Modificou</th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100"
                onClick={() => requestSort("quantity")}
              >
                Qtd <SortIcon colKey="quantity" />
              </th>
              <th className="px-4 py-3 text-center">Ações</th>
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
                    <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
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
                    <Calendar size={12} />
                    {group.lastModifiedStr || "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded w-fit">
                    <User size={10} />
                    {group.lastModifiedUser || "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold ${
                      group.displayQuantity < 0
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {group.displayQuantity}
                  </span>
                </td>
                <td className="px-4 py-3 text-center flex justify-center gap-1">
                  {/* Botão + foi removido pois a lógica de QuickResModal estava duplicada e confusa. 
                      Podemos reativar se quiser a "Reserva Rápida" aqui. 
                      Por enquanto, deixei apenas a edição. */}

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
      <div className="p-4 flex justify-between items-center bg-slate-50 text-xs text-slate-500">
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
