import React, { useState, useEffect } from "react";
import { X, User, MapPin, Truck, Save, CreditCard, Hash } from "lucide-react";

export default function OrderEditModal({
  isOpen,
  onClose,
  onSave,
  orderGroup,
}) {
  // 1. Estado "Flat"
  const [formData, setFormData] = useState({
    orderNumber: "",
    customerName: "",
    customerCpf: "",
    customerPhone: "",
    customerEmail: "",
    addrZip: "",
    addrStreet: "",
    addrNumber: "",
    addrComp: "",
    addrDistrict: "",
    addrCity: "",
    addrUf: "",
    shipMethod: "",
    shipPrice: "",
    shipTracking: "",
    payMethod: "",
    payTotal: "",
    notes: "",
  });

  // --- CARREGAR DADOS ---
  useEffect(() => {
    if (isOpen && orderGroup && orderGroup.items.length > 0) {
      const refItem = orderGroup.items[0];

      const safeOrder = refItem.order || {};
      const safeCust = safeOrder.customer || {};
      const safePay = safeOrder.payment || {};
      const safeShipping = refItem.shipping || {};
      const safeAddr = safeShipping.address || safeOrder.shipping_address || {};

      setFormData({
        orderNumber: safeOrder.number || orderGroup.orderNumber || "",
        customerName: safeCust.name || orderGroup.customerName || "",
        customerCpf: safeCust.cpf || "",
        customerPhone: safeCust.phone || "",
        customerEmail: safeCust.email || "",
        addrZip: safeAddr.zip || "",
        addrStreet: safeAddr.street || "",
        addrNumber: safeAddr.number || "",
        addrComp: safeAddr.complemento || "",
        addrDistrict: safeAddr.bairro || "",
        addrCity: safeAddr.city || "",
        addrUf: safeAddr.statecode || safeAddr.state || "",
        shipMethod: safeShipping.tipoenvio || orderGroup.shippingMethod || "",
        shipPrice: safeShipping.price || "",
        shipTracking: safeShipping.tracking || safeShipping.rastreamento || "",
        payMethod: safePay.method || "",
        payTotal: orderGroup.totalValue || safePay.total || "",
        notes: safeOrder.notes || "",
      });
    }
  }, [isOpen, orderGroup]);

  if (!isOpen) return null;

  // --- FUNÇÃO DE LIMPEZA ---
  const sanitizePayload = (obj) => {
    const clean = {};
    Object.keys(obj).forEach((key) => {
      clean[key] = obj[key] === undefined || obj[key] === null ? "" : obj[key];
    });
    return clean;
  };

  const handleSubmit = () => {
    // 2. MAPEAMENTO EXATO PARA O SERVICE
    // Baseado na leitura do arquivo src/services/ordersService.js

    const rawUpdates = {
      // Pedido e Notas
      orderNumber: formData.orderNumber,
      notes: formData.notes, // AQUI ESTAVA O ERRO! O service lê .notes

      // Cliente
      customerName: formData.customerName,
      customerCpf: formData.customerCpf,
      customerPhone: formData.customerPhone,
      customerEmail: formData.customerEmail,

      // Logística
      shippingMethod: formData.shipMethod,
      shippingPrice: formData.shipPrice,
      tracking: formData.shipTracking, // O service lê .tracking, não shippingTracking

      // Endereço (Nomes curtos conforme o Service)
      zip: formData.addrZip,
      street: formData.addrStreet,
      number: formData.addrNumber,
      comp: formData.addrComp,
      district: formData.addrDistrict,
      city: formData.addrCity,
      state: formData.addrUf.toUpperCase(), // O service lê .state e grava em statecode

      // Pagamento
      paymentMethod: formData.payMethod,
      totalValueOverride: formData.payTotal, // O service usa esse nome para total
    };

    // 3. Limpeza final
    const finalUpdates = sanitizePayload(rawUpdates);

    console.log("Enviando updates corrigidos:", finalUpdates);
    onSave(finalUpdates);
  };

  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <User size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">
                Editar Dados do Pedido
              </h2>
              <p className="text-blue-100 text-xs">
                Editando dados mestres para {orderGroup?.items?.length} itens
                vinculados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          {/* SEÇÃO CLIENTE */}
          <div className="border rounded-xl p-4 bg-slate-50 border-slate-200">
            <h3 className="font-bold text-blue-800 text-xs uppercase mb-3 flex items-center gap-2">
              <User size={14} /> Dados do Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Hash size={10} /> Número Pedido
                </label>
                <input
                  className="w-full p-2 border border-blue-200 rounded outline-none focus:border-blue-500 font-bold text-blue-700 bg-blue-50/50"
                  value={formData.orderNumber}
                  onChange={(e) => update("orderNumber", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Nome Completo
                </label>
                <input
                  className="w-full p-2 border rounded outline-none focus:border-blue-500"
                  value={formData.customerName}
                  onChange={(e) => update("customerName", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  CPF
                </label>
                <input
                  className="w-full p-2 border rounded outline-none focus:border-blue-500"
                  value={formData.customerCpf}
                  onChange={(e) => update("customerCpf", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Telefone / Zap
                  </label>
                  <input
                    className="w-full p-2 border rounded outline-none focus:border-blue-500"
                    value={formData.customerPhone}
                    onChange={(e) => update("customerPhone", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Email
                  </label>
                  <input
                    className="w-full p-2 border rounded outline-none focus:border-blue-500"
                    value={formData.customerEmail}
                    onChange={(e) => update("customerEmail", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO ENDEREÇO */}
          <div className="border rounded-xl p-4 bg-white border-slate-200">
            <h3 className="font-bold text-orange-700 text-xs uppercase mb-3 flex items-center gap-2">
              <MapPin size={14} /> Endereço de Entrega
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  CEP
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={formData.addrZip}
                  onChange={(e) => update("addrZip", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Rua / Logradouro
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={formData.addrStreet}
                  onChange={(e) => update("addrStreet", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Número
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={formData.addrNumber}
                  onChange={(e) => update("addrNumber", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Complemento
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={formData.addrComp}
                  onChange={(e) => update("addrComp", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Bairro
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={formData.addrDistrict}
                  onChange={(e) => update("addrDistrict", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Cidade
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={formData.addrCity}
                  onChange={(e) => update("addrCity", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase text-red-600">
                  UF
                </label>
                <input
                  className="w-full p-2 border rounded font-bold uppercase text-center"
                  maxLength={2}
                  value={formData.addrUf}
                  onChange={(e) =>
                    update("addrUf", e.target.value.toUpperCase())
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SEÇÃO LOGÍSTICA */}
            <div className="border rounded-xl p-4 bg-slate-50 border-slate-200">
              <h3 className="font-bold text-purple-700 text-xs uppercase mb-3 flex items-center gap-2">
                <Truck size={14} /> Logística
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Método de Envio
                  </label>
                  <input
                    className="w-full p-2 border rounded"
                    value={formData.shipMethod}
                    onChange={(e) => update("shipMethod", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Custo Frete (R$)
                    </label>
                    <input
                      className="w-full p-2 border rounded"
                      value={formData.shipPrice}
                      onChange={(e) => update("shipPrice", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Rastreio
                    </label>
                    <input
                      className="w-full p-2 border rounded"
                      value={formData.shipTracking}
                      onChange={(e) => update("shipTracking", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO FINANCEIRO */}
            <div className="border rounded-xl p-4 bg-emerald-50 border-emerald-200">
              <h3 className="font-bold text-emerald-700 text-xs uppercase mb-3 flex items-center gap-2">
                <CreditCard size={14} /> Financeiro
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Forma Pagamento
                  </label>
                  <input
                    className="w-full p-2 border rounded"
                    value={formData.payMethod}
                    onChange={(e) => update("payMethod", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Valor Total (Manual)
                  </label>
                  <input
                    className="w-full p-2 border rounded font-bold text-emerald-700"
                    value={formData.payTotal}
                    onChange={(e) => update("payTotal", e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    * Preencher para forçar valor total diferente da soma dos
                    itens.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              Observações do Pedido
            </label>
            <textarea
              className="w-full p-3 border rounded-lg h-20 resize-none outline-none focus:border-blue-500"
              value={formData.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg flex items-center gap-2 text-sm"
          >
            <Save size={18} /> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
