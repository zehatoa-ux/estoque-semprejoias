import React, { useState, useEffect } from "react";
import { X, Save, Hash, User, ArrowRightLeft } from "lucide-react";

export default function OrderMoveModal({ isOpen, item, onClose, onConfirm }) {
  const [formData, setFormData] = useState({
    orderNumber: "",
    customerName: "",
  });

  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        orderNumber: item.order?.number || "",
        customerName: item.order?.customer?.name || item.order?.customer || "",
      });
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(item.id, formData);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center gap-2 text-sm">
            <ArrowRightLeft size={18} /> Mover / Corrigir Pedido
          </h3>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-1 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mb-2">
            Editando item: <strong>{item.sku}</strong>
            <br />
            Atual:{" "}
            <span className="font-mono">
              {item.order?.number || "Sem Número"}
            </span>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Hash size={10} /> Novo Número do Pedido
            </label>
            <input
              autoFocus
              type="text"
              required
              className="w-full p-2 border rounded font-bold text-slate-700 focus:border-blue-500 outline-none text-sm"
              value={formData.orderNumber}
              onChange={(e) =>
                setFormData({ ...formData, orderNumber: e.target.value })
              }
              placeholder="Ex: 12345"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <User size={10} /> Nome do Cliente
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded text-slate-700 focus:border-blue-500 outline-none text-sm"
              value={formData.customerName}
              onChange={(e) =>
                setFormData({ ...formData, customerName: e.target.value })
              }
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 border rounded text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 text-white rounded text-xs font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md"
            >
              <Save size={14} /> Salvar Mudança
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
