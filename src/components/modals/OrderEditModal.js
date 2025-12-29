import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  User,
  Hash,
  Truck,
  MapPin,
  DollarSign,
  CreditCard,
  FileText,
  Phone,
  Mail,
  FileDigit,
} from "lucide-react";

export default function OrderEditModal({
  isOpen,
  orderGroup,
  onClose,
  onSave,
}) {
  // Estado inicial com TODOS os campos possíveis
  const [formData, setFormData] = useState({
    // Pedido
    orderNumber: "",
    notes: "",

    // Cliente
    customerName: "",
    customerCpf: "",
    customerPhone: "",
    customerEmail: "",

    // Logística
    shippingMethod: "",
    shippingPrice: "",
    tracking: "",

    // Endereço
    zip: "",
    street: "",
    number: "",
    comp: "",
    district: "", // Bairro
    city: "",
    state: "",

    // Financeiro
    paymentMethod: "",
    totalValueOverride: "",
  });

  useEffect(() => {
    if (isOpen && orderGroup && orderGroup.items.length > 0) {
      // Pega os dados do primeiro item do grupo como referência (já que são compartilhados)
      const refItem = orderGroup.items[0];
      const order = refItem.order || {};
      const customer = order.customer || {};
      const shipping = refItem.shipping || {};
      const address = shipping.address || {};
      const payment = order.payment || {};

      setFormData({
        orderNumber: order.number || "",
        notes: order.notes || refItem.note || "", // Tenta pegar nota do pedido ou do item

        customerName: customer.name || "",
        customerCpf: customer.cpf || "",
        customerPhone: customer.phone || "",
        customerEmail: customer.email || "",

        shippingMethod: shipping.tipoenvio || shipping.method || "",
        shippingPrice: shipping.price || "",
        tracking: shipping.tracking || shipping.rastreamento || "",

        zip: address.zip || "",
        street: address.street || "",
        number: address.number || "",
        comp: address.complemento || "",
        district: address.bairro || "",
        city: address.city || "",
        state: address.statecode || address.state || "",

        paymentMethod: payment.method || "",
        totalValueOverride: payment.total || "",
      });
    }
  }, [isOpen, orderGroup]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
          <div>
            <h3 className="font-bold flex items-center gap-2 text-lg">
              <User size={20} /> Editar Dados do Pedido
            </h3>
            <p className="text-xs text-blue-200 opacity-80">
              Editando dados mestres para {orderGroup?.items.length} itens
              vinculados.
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* FORMULÁRIO COM SCROLL */}
        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6"
        >
          {/* SEÇÃO 1: CLIENTE E PEDIDO */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2">
              <User size={14} /> Dados do Cliente
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="lbl">Número Pedido</label>
                <input
                  type="text"
                  className="ipt font-bold text-blue-700"
                  value={formData.orderNumber}
                  onChange={(e) => handleChange("orderNumber", e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="lbl">Nome Completo</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.customerName}
                  onChange={(e) => handleChange("customerName", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="lbl">CPF</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.customerCpf}
                  onChange={(e) => handleChange("customerCpf", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Telefone / Zap</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.customerPhone}
                  onChange={(e) =>
                    handleChange("customerPhone", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="lbl">Email</label>
                <input
                  type="email"
                  className="ipt"
                  value={formData.customerEmail}
                  onChange={(e) =>
                    handleChange("customerEmail", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: ENDEREÇO */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-orange-600 uppercase mb-3 flex items-center gap-2">
              <MapPin size={14} /> Endereço de Entrega
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="lbl">CEP</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.zip}
                  onChange={(e) => handleChange("zip", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="lbl">Rua / Logradouro</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.street}
                  onChange={(e) => handleChange("street", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Número</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.number}
                  onChange={(e) => handleChange("number", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Complemento</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.comp}
                  onChange={(e) => handleChange("comp", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Bairro</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.district}
                  onChange={(e) => handleChange("district", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Cidade</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">UF</label>
                <input
                  type="text"
                  className="ipt uppercase"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: LOGÍSTICA E PAGAMENTO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-purple-600 uppercase mb-3 flex items-center gap-2">
                <Truck size={14} /> Logística
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="lbl">Método de Envio</label>
                  <input
                    type="text"
                    className="ipt"
                    value={formData.shippingMethod}
                    onChange={(e) =>
                      handleChange("shippingMethod", e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="lbl">Custo Frete (R$)</label>
                    <input
                      type="text"
                      className="ipt"
                      value={formData.shippingPrice}
                      onChange={(e) =>
                        handleChange("shippingPrice", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl">Rastreio</label>
                    <input
                      type="text"
                      className="ipt font-mono text-blue-600"
                      value={formData.tracking}
                      onChange={(e) => handleChange("tracking", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-emerald-600 uppercase mb-3 flex items-center gap-2">
                <CreditCard size={14} /> Financeiro
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="lbl">Forma Pagamento</label>
                  <input
                    type="text"
                    className="ipt"
                    placeholder="Ex: PIX, Cartão"
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      handleChange("paymentMethod", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="lbl">Valor Total (Manual)</label>
                  <input
                    type="text"
                    className="ipt font-bold text-emerald-700"
                    value={formData.totalValueOverride}
                    onChange={(e) =>
                      handleChange("totalValueOverride", e.target.value)
                    }
                    placeholder="Deixe vazio p/ soma automática"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    * Preencher para forçar valor total diferente da soma dos
                    itens.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div>
            <label className="lbl flex items-center gap-1">
              <FileText size={12} /> Observações do Pedido
            </label>
            <textarea
              className="w-full p-3 border rounded-lg text-sm focus:border-blue-500 outline-none h-24 resize-none bg-slate-50"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Detalhes internos..."
            />
          </div>
        </form>

        {/* FOOTER */}
        <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-transform active:scale-95"
          >
            <Save size={18} /> Salvar Tudo
          </button>
        </div>

        {/* ESTILOS LOCAIS PARA LIMPEZA */}
        <style>{`
            .lbl { display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
            .ipt { width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; outline: none; transition: border-color 0.2s; background: white; }
            .ipt:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
        `}</style>
      </div>
    </div>
  );
}
