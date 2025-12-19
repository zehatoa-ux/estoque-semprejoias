import React from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";

export default function EditModal({ isOpen, data, onClose, onAdjust }) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Ajustar Estoque</h3>
            <p className="text-sm text-slate-500">{data.sku}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        <div className="flex items-center justify-center gap-6 mb-8">
          <button
            onClick={() => onAdjust(data, -1)}
            className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors"
          >
            <Minus size={32} />
          </button>
          <div className="text-center">
            <span className="block text-3xl font-bold text-slate-800">
              {data.quantity}
            </span>
            <span className="text-xs text-slate-400 uppercase">Atual</span>
          </div>
          <button
            onClick={() => onAdjust(data, 1)}
            className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors"
          >
            <Plus size={32} />
          </button>
        </div>
        <div className="border-t pt-4">
          <button
            onClick={() => {
              if (window.confirm(`Excluir TODOS os ${data.quantity} itens?`)) {
                onAdjust(data, -data.quantity);
              }
            }}
            className="w-full py-3 rounded-xl border-2 border-red-100 text-red-600 font-bold hover:bg-red-50 flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> Excluir Tudo
          </button>
        </div>
      </div>
    </div>
  );
}