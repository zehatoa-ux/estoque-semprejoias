import React from "react";
import {
  Barcode,
  List,
  X,
  RefreshCw,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function ConferenceTab({
  barcodeInput,
  setBarcodeInput,
  inputRef,
  handleScanToBuffer,
  isCommitting,
  scannedBuffer,
  handleClearBuffer,
  handleCommitBuffer,
  removeItemFromBuffer,
  paginatedBuffer,
  bufferPage,
  setBufferPage,
  totalBufferPages,
  db,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="w-full max-w-lg bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 text-center relative overflow-hidden mb-8">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500"></div>
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Barcode size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Leitor Ativo</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Bipe para a lista temporária (Buffer)
          </p>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={handleScanToBuffer}
          disabled={!db || isCommitting}
          className="w-full h-16 px-6 text-3xl font-mono text-center border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all uppercase placeholder:text-slate-300 disabled:bg-slate-100"
          placeholder={isCommitting ? "ENVIANDO..." : "BIPAR..."}
        />
      </div>

      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <List size={20} className="text-blue-600" />
              <h3 className="font-bold text-slate-700">
                Itens Lidos: {scannedBuffer.length}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClearBuffer}
                disabled={scannedBuffer.length === 0 || isCommitting}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors disabled:opacity-50"
              >
                DESCARTAR
              </button>
              <button
                onClick={handleCommitBuffer}
                disabled={scannedBuffer.length === 0 || isCommitting}
                className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCommitting ? (
                  <RefreshCw className="animate-spin" size={14} />
                ) : (
                  <Save size={14} />
                )}
                {isCommitting ? "ENVIANDO..." : "ENVIAR PRO ESTOQUE"}
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-bold sticky top-0">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBuffer.map((item) => (
                  <tr key={item.tempId} className="hover:bg-blue-50/50">
                    <td className="px-4 py-2 font-mono font-bold text-blue-600 text-xs">
                      {item.sku}
                    </td>
                    <td className="px-4 py-2">
                      <span className="block text-xs font-medium text-slate-700 truncate max-w-[200px]">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.baseSku}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeItemFromBuffer(item.tempId)}
                        className="text-slate-300 hover:text-red-500 p-1"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {scannedBuffer.length === 0 && (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Barcode size={32} className="opacity-20" />
                        <p>Lista vazia. Comece a bipar!</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalBufferPages > 1 && (
            <div className="bg-slate-50 px-4 py-2 border-t flex justify-between items-center text-xs text-slate-500">
              <span>
                Página {bufferPage} de {totalBufferPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setBufferPage((p) => Math.max(1, p - 1))}
                  disabled={bufferPage === 1}
                  className="p-1 rounded bg-white border hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() =>
                    setBufferPage((p) => Math.min(totalBufferPages, p + 1))
                  }
                  disabled={bufferPage === totalBufferPages}
                  className="p-1 rounded bg-white border hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
