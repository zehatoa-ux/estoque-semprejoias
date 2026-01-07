import React from "react";
import { X, RefreshCcw, Calendar, User, Box, FileText } from "lucide-react";

export default function ArchivedDetailsModal({ order, onClose, onUnarchive }) {
  if (!order) return null;

  const formatDate = (ts) =>
    ts ? new Date(ts.seconds * 1000).toLocaleString("pt-BR") : "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Box className="text-purple-400" />
              Pedido #{order.orderNumber || order.order?.number}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              ID: <span className="font-mono text-xs">{order.id}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* CORPO COM SCROLL */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          {/* Status e Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Status Final
              </span>
              <div className="font-medium text-slate-800 mt-1">
                {order.status}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Data Criação
              </span>
              <div className="font-medium text-slate-800 mt-1 flex items-center gap-2">
                <Calendar size={14} /> {formatDate(order.createdAt)}
              </div>
            </div>
          </div>

          {/* Dados do Cliente */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <User size={16} /> Cliente
            </h3>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm space-y-1 shadow-sm">
              <p>
                <strong>Nome:</strong>{" "}
                {order.customerName || order.order?.customer?.name}
              </p>
              <p>
                <strong>Email:</strong> {order.order?.customer?.email || "-"}
              </p>
              <p>
                <strong>CPF/CNPJ:</strong>{" "}
                {order.order?.customer?.cpfCnpj || "-"}
              </p>
            </div>
          </div>

          {/* Especificações do Produto */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <FileText size={16} /> Especificações (Specs)
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(order.specs || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {key}
                  </span>
                  <span className="font-medium text-slate-700">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dados Brutos (JSON) - Útil para debug */}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer hover:text-purple-600 mb-2">
              Ver dados brutos (Debug)
            </summary>
            <pre className="bg-slate-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(order, null, 2)}
            </pre>
          </details>
        </div>

        {/* FOOTER - AÇÃO DE RESTAURAR */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            Fechar
          </button>

          <button
            onClick={() => {
              if (
                window.confirm(
                  "Tem certeza? Esse pedido voltará para a aba de PRODUÇÃO como 'SOLICITAÇÃO'."
                )
              ) {
                onUnarchive(order);
              }
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105"
          >
            <RefreshCcw size={18} />
            Desarquivar Pedido
          </button>
        </div>
      </div>
    </div>
  );
}
