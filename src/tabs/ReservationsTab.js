import React, { useState, useMemo } from "react";
import {
  Bookmark,
  Package,
  CheckCircle,
  XCircle,
  AlertOctagon,
  X,
  Trash2,
  Filter,
  User,
  Bot,
  Factory,
} from "lucide-react";
import { formatMoney } from "../utils/formatters";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// Importando o novo Modal
import ProductionConversionModal from "../components/modals/ProductionConversionModal";

export default function ReservationsTab({
  resSku,
  setResSku,
  resQty,
  setResQty,
  resNote,
  setResNote,
  handleCreateReservation,
  reservations,
  reservationsWithStatus,
  selectedReservations,
  setSelectedReservations,
  handleBulkCancelReservations,
  toggleSelectReservation,
  handleCancelReservation,
  findCatalogItem,
}) {
  const [filterUser, setFilterUser] = useState("all");

  // State para controlar qual reserva está sendo convertida
  const [conversionData, setConversionData] = useState(null);

  const rawList =
    reservationsWithStatus?.length > 0 ? reservationsWithStatus : reservations;

  const usersList = useMemo(() => {
    const users = new Set(rawList.map((r) => r.createdBy || "Desconhecido"));
    return Array.from(users).sort();
  }, [rawList]);

  const filteredList = useMemo(() => {
    if (filterUser === "all") return rawList;
    return rawList.filter(
      (r) => (r.createdBy || "Desconhecido") === filterUser
    );
  }, [rawList, filterUser]);

  // Passo 1: Abre o Modal
  const openConversionModal = (reserva) => {
    setConversionData(reserva);
  };

  // Passo 2: Recebe os dados preenchidos e salva no banco
  const handleConfirmConversion = async (enrichedData) => {
    try {
      // Separa o ID antigo do resto dos dados
      const { id: oldId, ...dataToSave } = enrichedData;

      // 1. Cria na coleção production_orders
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
          ...dataToSave, // Salva sem o ID antigo conflituoso
          status: "SOLICITACAO",
          originalReservationId: oldId, // Salvamos o ID antigo num campo separado, por segurança
          convertedAt: serverTimestamp(),
        }
      );

      // ... resto do código (deleteDoc, etc)

      // 2. Apaga da coleção reservations
      await deleteDoc(
        doc(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "reservations",
          enrichedData.id
        )
      );

      alert("Enviado para Produção com sucesso!");
      setConversionData(null); // Fecha o modal
    } catch (error) {
      alert("Erro ao converter: " + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Modal de Conversão (Renderizado Condicionalmente) */}
      {conversionData && (
        <ProductionConversionModal
          isOpen={!!conversionData}
          reservation={conversionData}
          onClose={() => setConversionData(null)}
          onConfirm={handleConfirmConversion}
          findCatalogItem={findCatalogItem}
        />
      )}

      {/* FORMULÁRIO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
          <Bookmark size={18} className="text-yellow-500" /> Nova Reserva Manual
        </h3>
        <form
          onSubmit={handleCreateReservation}
          className="flex flex-col md:flex-row items-end gap-4"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1">
              SKU do Produto
            </label>
            <input
              type="text"
              value={resSku}
              onChange={(e) => setResSku(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg uppercase font-mono text-sm outline-none"
              placeholder="Ex: DIR-NAV-Z-16"
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Qtd
            </label>
            <input
              type="number"
              min="1"
              value={resQty}
              onChange={(e) => setResQty(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
            />
          </div>
          <div className="flex-[2] w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Observação
            </label>
            <input
              type="text"
              maxLength={90}
              value={resNote}
              onChange={(e) => setResNote(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
              placeholder="Ex: Cliente Maria (Zap)"
            />
          </div>
          <button
            type="submit"
            className="w-full md:w-auto bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm text-sm"
          >
            CRIAR
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-slate-700 text-sm">
              Reservas Ativas ({filteredList.length})
            </h3>
            {selectedReservations.size > 0 && (
              <button
                onClick={handleBulkCancelReservations}
                className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 font-bold transition-colors"
              >
                <Trash2 size={14} /> Cancelar ({selectedReservations.size})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              className="bg-white border border-slate-300 text-slate-600 text-xs rounded-lg p-2 outline-none"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="all">Todos os Usuários</option>
              {usersList.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300"
                    onChange={(e) =>
                      e.target.checked
                        ? setSelectedReservations(
                            new Set(filteredList.map((r) => r.id))
                          )
                        : setSelectedReservations(new Set())
                    }
                    checked={
                      filteredList.length > 0 &&
                      selectedReservations.size === filteredList.length
                    }
                  />
                </th>
                <th className="px-4 py-3 w-12">Foto</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Criado Por</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Obs</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map((res) => {
                const details = findCatalogItem(res.sku);
                const isAuto =
                  res.source &&
                  (res.source.includes("n8n") || res.source.includes("auto"));
                return (
                  <tr
                    key={res.id}
                    className={`hover:bg-yellow-50/30 ${
                      selectedReservations.has(res.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300"
                        checked={selectedReservations.has(res.id)}
                        onChange={() => toggleSelectReservation(res.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                        {details?.image ? (
                          <img
                            src={details.image}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={16} className="text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {res.status === "ok" && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                          <CheckCircle size={10} /> OK
                        </span>
                      )}
                      {res.status === "partial" && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                          <AlertOctagon size={10} /> Parcial
                        </span>
                      )}
                      {(res.status === "missing" || !res.status) && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-red-100 text-red-700 px-2 py-1 rounded">
                          <XCircle size={10} /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {res.dateStr?.split(" ")[0] || "-"}
                      <span className="block text-[10px] text-slate-400">
                        {res.dateStr?.split(" ")[1] || ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded w-fit ${
                          isAuto
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isAuto ? <Bot size={12} /> : <User size={12} />}
                        {res.createdBy || "N/I"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-blue-600 text-xs">
                        {res.sku}
                      </div>
                      <div className="text-xs text-slate-700 truncate max-w-[200px]">
                        {details?.name || "Item não catalogado"}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate"
                      title={res.note}
                    >
                      {res.note}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-sm">
                      {res.quantity}
                    </td>
                    <td className="px-4 py-3 text-center flex justify-center gap-2">
                      {/* BOTÃO MUDADO AQUI: Agora chama openConversionModal */}
                      <button
                        onClick={() => openConversionModal(res)}
                        className="text-purple-600 hover:bg-purple-100 p-1.5 rounded transition-colors"
                        title="Enviar para Produção"
                      >
                        <Factory size={16} />
                      </button>
                      <button
                        onClick={() => handleCancelReservation(res.id)}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
