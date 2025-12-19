import React from "react";
import {
  Bookmark,
  Package,
  CheckCircle,
  XCircle,
  AlertOctagon,
  X,
} from "lucide-react";
import { formatMoney } from "../utils/formatters";

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
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Bookmark size={18} className="text-yellow-500" /> Nova Reserva
          </h3>
          <form onSubmit={handleCreateReservation} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                SKU do Produto
              </label>
              <input
                type="text"
                value={resSku}
                onChange={(e) => setResSku(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg uppercase font-mono"
                placeholder="Ex: DIR-NAV-Z-16"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                value={resQty}
                onChange={(e) => setResQty(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Observação
              </label>
              <input
                type="text"
                maxLength={90}
                value={resNote}
                onChange={(e) => setResNote(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg"
                placeholder="Ex: Cliente Maria"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg transition-colors shadow-sm"
            >
              CRIAR RESERVA
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">
              Reservas Ativas ({reservations.length})
            </h3>
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
                              new Set(reservations.map((r) => r.id))
                            )
                          : setSelectedReservations(new Set())
                      }
                      checked={
                        reservations.length > 0 &&
                        selectedReservations.size === reservations.length
                      }
                    />
                  </th>
                  <th className="px-4 py-3 w-12">Foto</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Obs</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservationsWithStatus.map((res) => {
                  const details = findCatalogItem(res.sku);
                  return (
                    <tr key={res.id} className="hover:bg-yellow-50/30">
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
                              alt=""
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
                          <span
                            className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded"
                            title={`Faltam ${res.missing} peças`}
                          >
                            <AlertOctagon size={10} /> Parcial
                          </span>
                        )}
                        {res.status === "missing" && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-red-100 text-red-700 px-2 py-1 rounded">
                            <XCircle size={10} /> Sem Estoque
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {res.dateStr?.split(" ")[0] || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-blue-600 text-xs">
                          {res.sku}
                        </div>
                        <div className="text-xs text-slate-700 truncate max-w-[150px]">
                          {details?.name || "N/I"}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-600">
                          {formatMoney(details?.price)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {res.note}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {res.quantity}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleCancelReservation(res.id)}
                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {reservations.length === 0 && (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      Nenhuma reserva ativa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
