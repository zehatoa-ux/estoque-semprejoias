import React, { useState, useEffect } from "react";
import { X, Save, Hash, User, ArrowRightLeft } from "lucide-react";

export default function OrderMoveModal({ isOpen, item, onClose, onConfirm }) {
  const [formData, setFormData] = useState({
    orderNumber: "",
    customerName: "",
  });

  // --- CORREÇÃO DO useEffect (Evita o erro de Objeto) ---
  useEffect(() => {
    if (isOpen && item) {
      // Lógica de segurança para extrair o nome
      let safeName = "";

      if (typeof item.order?.customer === "string") {
        safeName = item.order.customer;
      } else if (item.order?.customer?.name) {
        safeName = item.order.customer.name;
      } else {
        safeName = ""; // Começa vazio para forçar o usuário a digitar se não achar
      }

      setFormData({
        orderNumber: item.order?.number || "",
        customerName: safeName,
      });
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  // --- AQUI ESTAVA FALTANDO A FUNÇÃO (COM VALIDAÇÃO) ---
  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Validação de Número do Pedido
    if (!formData.orderNumber || formData.orderNumber.trim() === "") {
      alert("ERRO: O Número do Pedido é obrigatório.");
      return;
    }

    // 2. Validação de Nome do Cliente
    if (!formData.customerName || formData.customerName.trim() === "") {
      alert("ERRO: O Nome do Cliente é obrigatório.");
      return;
    }

    // Se passou, envia
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

          {/* CAMPO NÚMERO */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Hash size={10} /> Novo Número do Pedido{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              required // Validação HTML nativa
              className="w-full p-2 border rounded font-bold text-slate-700 focus:border-blue-500 outline-none text-sm"
              value={formData.orderNumber}
              onChange={(e) =>
                setFormData({ ...formData, orderNumber: e.target.value })
              }
              placeholder="Ex: 12345"
            />
          </div>

          {/* CAMPO NOME */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <User size={10} /> Nome do Cliente{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required // Validação HTML nativa
              className="w-full p-2 border rounded text-slate-700 focus:border-blue-500 outline-none text-sm"
              value={formData.customerName}
              onChange={(e) =>
                setFormData({ ...formData, customerName: e.target.value })
              }
              placeholder="Digite o nome..."
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
