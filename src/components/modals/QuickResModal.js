import React, { useState } from "react";
import { BookmarkPlus, X, User, FileText, AlertCircle } from "lucide-react";

export default function QuickResModal({ isOpen, group, onClose, onConfirm }) {
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");

  if (!isOpen || !group) return null;

  const handleConfirm = () => {
    if (!customerName.trim()) return alert("Digite o nome do cliente");

    // Força a quantidade "1" para evitar conflitos de produção
    onConfirm("1", note, customerName);

    // Limpa estados (opcional, pois o componente deve desmontar)
    setCustomerName("");
    setNote("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden transform transition-all scale-100">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 p-5 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BookmarkPlus size={20} className="text-amber-500" />
              Reservar Item
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wide">
              {group.sku}
            </p>
            <p className="text-sm text-slate-600 font-medium line-clamp-1">
              {group.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Aviso Informativo (Lógica Unitária) */}
          <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg flex items-start gap-2 border border-blue-100">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>
              A reserva será de <b>1 unidade</b>. Se precisar reservar mais
              itens para o mesmo cliente, repita o processo.
            </p>
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase ml-1">
              Nome do Cliente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                autoFocus
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all font-medium text-slate-700"
                placeholder="Ex: Maria Silva"
              />
            </div>
          </div>

          {/* Obs */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase ml-1">
              Observação (Opcional)
            </label>
            <div className="relative">
              <FileText
                className="absolute left-3 top-3 text-slate-400"
                size={18}
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all text-sm min-h-[80px] resize-none"
                placeholder="Ex: Pagamento pendente"
              />
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-amber-200 transition-all transform active:scale-95 mt-2"
          >
            CONFIRMAR RESERVA
          </button>
        </div>
      </div>
    </div>
  );
}
