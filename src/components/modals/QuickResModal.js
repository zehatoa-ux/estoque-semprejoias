import React, { useState } from "react";
import { BookmarkPlus, Minus, Plus, X, User } from "lucide-react";

export default function QuickResModal({
  isOpen,
  group, // Mudou de 'data' para 'group' para alinhar com a StockTab nova
  onClose,
  onConfirm,
}) {
  // Estado Interno (Mais limpo, não precisa passar do pai)
  const [qty, setQty] = useState("1");
  const [customerName, setCustomerName] = useState(""); // Adicionei campo específico
  const [note, setNote] = useState("");

  if (!isOpen || !group) return null;

  const handleConfirm = () => {
    if (!customerName) return alert("Digite o nome do cliente");
    onConfirm(qty, note, customerName);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BookmarkPlus size={20} className="text-yellow-500" />
              Reservar Item
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-mono">{group.sku}</p>
            <p className="text-sm text-slate-700 font-medium line-clamp-1">
              {group.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Quantidade */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Quantidade
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty(String(Math.max(1, parseInt(qty) - 1)))}
                className="p-2 bg-slate-100 rounded hover:bg-slate-200"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="flex-1 text-center p-2 border rounded-lg font-bold outline-none focus:border-yellow-500"
              />
              <button
                onClick={() => setQty(String(parseInt(qty) + 1))}
                className="p-2 bg-slate-100 rounded hover:bg-slate-200"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Cliente (NOVO CAMPO NECESSÁRIO) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
              <User size={12} /> Nome do Cliente
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm outline-none focus:border-yellow-500"
              placeholder="Ex: Maria Silva"
              autoFocus
            />
          </div>

          {/* Obs */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm outline-none focus:border-yellow-500"
              placeholder="Ex: Pagamento pendente"
            />
          </div>

          <button
            onClick={handleConfirm}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg mt-2 shadow-sm transition-colors"
          >
            CONFIRMAR RESERVA
          </button>
        </div>
      </div>
    </div>
  );
}
