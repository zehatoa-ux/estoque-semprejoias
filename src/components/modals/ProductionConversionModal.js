import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Factory,
  User,
  Truck,
  Gem,
  CreditCard,
  MapPin,
  Edit3,
  AlertTriangle,
  ShieldCheck,
  PackageCheck,
  Layers,
  ListChecks,
} from "lucide-react";

// --- CONFIGURAÇÕES ---
const STONE_COLORS = [
  "VERMELHO",
  "ROSA",
  "ROSA TURM",
  "AZUL ESCURO",
  "AZUL CLARO",
  "VERDE",
  "VERDE ESCURO",
  "AMARELO",
  "ROXO",
  "LILAS",
  "LARANJA",
  "PERIDOTO",
  "CHAMPAGNE",
  "SKY",
  "BRANCA",
  "PRETA",
  "MARROM - GRANADA",
  "ESPECIAL",
  "SEM PEDRA",
];

// --- MAPEAMENTO: FÁBRICA (StockProduction) -> PRODUÇÃO (ProductionTab) ---
const PE_TO_PRODUCTION_MAP = {
  pe_solicitado: "SOLICITACAO", // Vai para: AGUARDANDO ANÁLISE
  pe_imprimindo: "ESTOQUE_IMPRIMINDO", // Vai para: ESTOQUE - IMPRIMINDO
  pe_fundicao: "ESTOQUE_FUNDIDO", // Vai para: ESTOQUE - FUNDIDO
  pe_conferencia: "INTERCEPTADO_ESTOQUE", // Vai para: PEDIDO MODIFICADO
  pe_interceptado: "SOLICITACAO", // Fallback de segurança
};

// Labels visuais apenas para leitura no card
const PE_LABELS = {
  pe_solicitado: "Solicitado",
  pe_imprimindo: "Imprimindo 3D",
  pe_fundicao: "Fundidos",
  pe_conferencia: "Conferência",
  pe_interceptado: "Já Interceptado",
};

// Opções Manuais Permitidas (Para Estoque Físico ou Zero)
const MANUAL_STATUS_OPTIONS = [
  { value: "SOLICITACAO", label: "AGUARDANDO ANÁLISE" },
  { value: "GRAVACAO", label: "GRAVAÇÃO" },
  { value: "FALHA_BANCA", label: "FALHA BANCA" },
  { value: "MANUTENCAO", label: "AJUSTE/MANUTENÇÃO" },
];

export default function ProductionConversionModal({
  isOpen,
  onClose,
  onConfirm,
  reservation,
  findCatalogItem,
  inventory = [],
  isEditing = false,
}) {
  // Helpers para garantir que não quebre se vier null
  const safeRes = reservation || {};
  const safeOrder = safeRes.order || {};
  const safeCustomer = safeOrder.customer || {};
  const safePayment = safeOrder.payment || {};
  const safeShipping = safeRes.shipping || {};
  const safeAddress = safeShipping.address || {};
  const safeSpecs = safeRes.specs || {};

  // --- 1. LÓGICA DE ESTOQUE INTELIGENTE ---
  const stockItem = useMemo(() => {
    if (isEditing || !inventory || inventory.length === 0 || !safeRes.sku)
      return null;
    const targetSku = String(safeRes.sku).trim().toUpperCase();

    // Prioridade: 1. Estoque Físico Real -> 2. Estoque Fábrica (PE) Disponível
    const realStock = inventory.find(
      (i) =>
        String(i.sku).trim().toUpperCase() === targetSku &&
        i.status === "in_stock" &&
        !i.isPE
    );

    // Só pega PE se não tiver status de saída ou travado
    const peStock = inventory.find(
      (i) =>
        String(i.sku).trim().toUpperCase() === targetSku &&
        i.isPE &&
        i.status !== "pe_interceptado" &&
        i.status !== "adjusted_out"
    );

    return realStock || peStock || null;
  }, [inventory, safeRes.sku, isEditing]);

  const hasStock = !!stockItem;
  const isPEItem = stockItem?.isPE || false;

  // --- 2. EXTRAÇÃO CATÁLOGO ---
  const catalogData = useMemo(() => {
    if (!findCatalogItem || !safeRes.sku) return {};
    const item = findCatalogItem(safeRes.sku);
    const extracted = {
      standardColor: "MANUAL",
      jewelryType: "MANUAL",
      material: "MANUAL",
      category: "MANUAL",
    };

    if (item && item.tags) {
      try {
        let tagsArray =
          typeof item.tags === "string"
            ? JSON.parse(item.tags.replace(/\\"/g, '"'))
            : item.tags;

        if (Array.isArray(tagsArray)) {
          const findTag = (g) =>
            tagsArray.find((t) => t.group === g)?.value || "MANUAL";
          extracted.standardColor = findTag("Cor da Pedra");
          extracted.jewelryType = findTag("Tipo de Joia");
          extracted.material = findTag("Material");
          extracted.category = findTag("Categoria");
        }
      } catch (e) {
        console.warn("Erro ao parsear tags", e);
      }
    }
    return extracted;
  }, [safeRes.sku, findCatalogItem]);

  // --- STATE ---
  const [formData, setFormData] = useState({
    specs: {},
    order: { customer: {}, payment: {}, notes: "" },
    shipping: { address: {} },
    customDate: "",
    orderNumber: "",

    // Controles
    useStock: false,
    initialStatus: "SOLICITACAO",
    isStatusLocked: false,
  });

  // --- INICIALIZAÇÃO INTELIGENTE ---
  useEffect(() => {
    if (isOpen && reservation) {
      // 1. Definição de Status Inicial baseado no Estoque
      let startStatus = "SOLICITACAO";
      let locked = false;
      let shouldUseStock = false;

      if (hasStock && stockItem) {
        shouldUseStock = true;
        if (stockItem.isPE) {
          // Fábrica: Herda status mapeado e trava
          startStatus = PE_TO_PRODUCTION_MAP[stockItem.status] || "SOLICITACAO";
          locked = true;
        } else {
          // Físico: Sugere Gravação
          startStatus = "GRAVACAO";
        }
      }

      // 2. Tratamento de Cores
      let fixedStoneType = safeSpecs.stoneType || "";
      if (fixedStoneType && fixedStoneType.toLowerCase().includes("zircônia"))
        fixedStoneType = "Zircônia";

      let targetColor = safeSpecs.stoneColor || "";
      const invalidValues = ["ND", "N/D", "SEM COR", "NAO DEFINIDO", ""];
      const isInvalidColor =
        !targetColor || invalidValues.includes(targetColor.toUpperCase());
      const hasCatalogColor =
        catalogData.standardColor && catalogData.standardColor !== "MANUAL";

      if (isInvalidColor && hasCatalogColor) {
        const catColorUpper = catalogData.standardColor.toUpperCase();
        const exactMatch = STONE_COLORS.find((c) => c === catColorUpper);
        if (exactMatch) targetColor = exactMatch;
        else {
          const partialMatch = STONE_COLORS.find(
            (c) => c.includes(catColorUpper) || catColorUpper.includes(c)
          );
          targetColor = partialMatch || catalogData.standardColor;
        }
      }

      // 3. Populate State
      setFormData({
        useStock: shouldUseStock,
        initialStatus: startStatus,
        isStatusLocked: locked,
        customDate: safeRes.createdAt?.toDate
          ? safeRes.createdAt.toDate().toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        orderNumber: safeOrder.number || safeRes.orderNumber || "",

        specs: {
          size: safeSpecs.size || "",
          stoneType: fixedStoneType,
          stoneColor: targetColor,
          standardColor:
            safeSpecs.standardColor || catalogData.standardColor || "",
          jewelryType: safeSpecs.jewelryType || catalogData.jewelryType || "",
          material: safeSpecs.material || catalogData.material || "",
          category: safeSpecs.category || catalogData.category || "",
          engraving: safeSpecs.engraving || "",
          finishing: safeSpecs.finishing || "",
          stoneBatch: safeSpecs.stoneBatch || "",
        },
        order: {
          number: safeOrder.number || "",
          notes: safeOrder.notes || safeRes.notes || safeRes.note || "",
          customer: {
            name: safeCustomer.name || safeRes.customerName || "",
            cpf: safeCustomer.cpf || "",
            email: safeCustomer.email || "",
            phone: safeCustomer.phone || "",
          },
          payment: {
            method: safePayment.method || "",
            total: safePayment.total || "",
          },
        },
        shipping: {
          tipoenvio: safeShipping.tipoenvio || safeShipping.method || "",
          price: safeShipping.price || "",
          tracking: safeShipping.rastreamento || safeShipping.tracking || "",
          address: {
            destinatario:
              safeAddress.destinatario ||
              safeAddress.recipient ||
              safeCustomer.name ||
              "",
            street: safeAddress.street || "",
            number: safeAddress.number || "",
            complemento: safeAddress.complemento || "",
            city: safeAddress.city || "",
            statecode: safeAddress.statecode || safeAddress.state || "",
            zip: safeAddress.zip || "",
            district: safeAddress.district || "",
          },
        },
      });
    }
  }, [isOpen, reservation, catalogData, hasStock, stockItem]);

  // --- HANDLER DE TOGGLE DE ESTOQUE ---
  const handleStockToggle = (checked) => {
    let newStatus = "SOLICITACAO";
    let newLocked = false;

    if (checked && stockItem) {
      if (stockItem.isPE) {
        // Mapeia usando a nova lógica solicitada
        newStatus = PE_TO_PRODUCTION_MAP[stockItem.status] || "SOLICITACAO";
        newLocked = true;
      } else {
        newStatus = "GRAVACAO";
      }
    }

    setFormData((prev) => ({
      ...prev,
      useStock: checked,
      initialStatus: newStatus,
      isStatusLocked: newLocked,
    }));
  };

  if (!isOpen || !reservation) return null;

  const update = (section, field, value, subField = null) => {
    setFormData((prev) => {
      const newData = { ...prev };
      if (!newData[section]) newData[section] = {};
      if (subField) {
        if (!newData[section][field]) newData[section][field] = {};
        newData[section][field][subField] = value;
      } else {
        newData[section][field] = value;
      }
      return newData;
    });
  };

  const handleSubmit = () => {
    if (isEditing) {
      onConfirm({ id: safeRes.id, specs: formData.specs });
      return;
    }

    const finalData = {
      ...reservation,
      specs: { ...safeSpecs, ...formData.specs },
      customCreatedAt: formData.customDate,
      order: {
        ...safeOrder,
        ...formData.order,
        number: formData.orderNumber,
        customer: { ...safeCustomer, ...formData.order.customer },
        payment: { ...safePayment, ...formData.order.payment },
      },
      shipping: {
        ...safeShipping,
        ...formData.shipping,
        method: formData.shipping.tipoenvio,
        tracking: formData.shipping.tracking,
        address: {
          ...safeAddress,
          ...formData.shipping.address,
          recipient: formData.shipping.address.destinatario,
          state: formData.shipping.address.statecode,
        },
      },

      status: formData.useStock ? formData.initialStatus : "SOLICITACAO",
      fromStock: formData.useStock,
      stockItemId: formData.useStock ? stockItem?.id : null,
      isInterceptedPE: formData.useStock ? stockItem?.isPE || false : false,
    };

    onConfirm(finalData);
  };

  const showFullForm = !isEditing;
  const showColorWarning =
    formData.specs.stoneColor &&
    formData.specs.standardColor &&
    formData.specs.standardColor !== "MANUAL" &&
    formData.specs.stoneColor.trim().toUpperCase() !==
      formData.specs.standardColor.trim().toUpperCase();
  const isNatural = formData.specs.stoneType === "Natural";

  // --- SELETOR DE STATUS REUTILIZÁVEL ---
  const StatusSelector = () => (
    <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-lg border border-slate-200 shadow-sm ml-auto">
      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
        <ListChecks size={12} /> Destino:
      </label>

      {formData.isStatusLocked ? (
        <span className="font-bold text-orange-700 text-xs flex items-center gap-1 bg-orange-100 px-2 py-1 rounded border border-orange-200">
          {/* Traduz a chave para o Label legível das opções manuais se possível */}
          {MANUAL_STATUS_OPTIONS.find(
            (opt) => opt.value === formData.initialStatus
          )?.label || formData.initialStatus.replace(/_/g, " ")}
          <span className="text-[8px] bg-orange-200 px-1 rounded text-orange-800 opacity-70">
            AUTO
          </span>
        </span>
      ) : (
        <select
          className="font-bold text-slate-700 text-xs bg-transparent outline-none cursor-pointer min-w-[140px]"
          value={formData.initialStatus}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, initialStatus: e.target.value }))
          }
        >
          {MANUAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div
        className={`bg-white w-full ${
          isEditing ? "max-w-2xl" : "max-w-5xl"
        } rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]`}
      >
        {/* HEADER */}
        <div className="bg-purple-600 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              {isEditing ? <Edit3 size={24} /> : <Factory size={24} />}
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">
                {isEditing ? "Editar Especificações" : "Converter para Pedido"}
              </h2>
              <p className="text-purple-200 text-xs font-mono">
                {safeRes.sku}{" "}
                {isEditing && safeOrder.number
                  ? `| Pedido ${safeOrder.number}`
                  : ""}
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

        {/* CORPO */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          {/* --- BLOCO DE ESTOQUE --- */}
          {hasStock && !isEditing && (
            <div
              className={`border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-4 animate-fade-in ${
                isPEItem
                  ? "bg-orange-50 border-orange-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${
                    isPEItem
                      ? "bg-orange-100 text-orange-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {isPEItem ? <Layers size={24} /> : <PackageCheck size={24} />}
                </div>
                <div>
                  <h3
                    className={`font-bold text-sm ${
                      isPEItem ? "text-orange-800" : "text-emerald-800"
                    }`}
                  >
                    {isPEItem
                      ? "Item em Produção de Estoque (PE)"
                      : "Disponível em Estoque Físico!"}
                  </h3>
                  <p
                    className={`text-xs font-medium ${
                      isPEItem ? "text-orange-600" : "text-emerald-600"
                    }`}
                  >
                    {isPEItem
                      ? "Item em fabricação. Deseja interceptar?"
                      : "Item pronto na prateleira."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto bg-white p-3 rounded-lg border shadow-sm">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    className={`w-5 h-5 rounded focus:ring-opacity-50 ${
                      isPEItem
                        ? "text-orange-600 focus:ring-orange-500"
                        : "text-emerald-600 focus:ring-emerald-500"
                    }`}
                    checked={formData.useStock}
                    onChange={(e) => handleStockToggle(e.target.checked)}
                  />
                  <span className="uppercase">
                    Usar {isPEItem ? "PE" : "Estoque"}
                  </span>
                </label>

                {formData.useStock && (
                  <div className="pl-3 border-l border-slate-200 ml-2">
                    <StatusSelector />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SELETOR MANUAL SE NÃO TIVER ESTOQUE */}
          {!hasStock && !isEditing && (
            <div className="flex justify-end mb-2">
              <StatusSelector />
            </div>
          )}

          {/* 1. ESPECIFICAÇÕES TÉCNICAS */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2 text-sm uppercase">
              <Gem size={16} /> Especificações da Joia
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 border-b border-yellow-200 pb-4">
              <div>
                <label className="lbl">Aro / Tamanho</label>
                <input
                  type="text"
                  className="ipt font-bold text-blue-700"
                  value={formData.specs.size}
                  onChange={(e) => update("specs", "size", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Tipo de Pedra</label>
                <select
                  className={`ipt ${
                    isNatural
                      ? "bg-blue-50 text-blue-800 border-blue-300 font-bold"
                      : "bg-white"
                  }`}
                  value={formData.specs.stoneType}
                  onChange={(e) => update("specs", "stoneType", e.target.value)}
                >
                  <option value="">Selecione...</option>
                  <option value="Zirconia">Zircônia</option>
                  <option value="Moissanite">Moissanite</option>
                  <option value="Natural">Natural</option>
                  <option value="ND">Não Aplica</option>
                </select>
                {isNatural && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-blue-600 animate-pulse">
                    <ShieldCheck size={10} /> <span>Pedra Natural</span>
                  </div>
                )}
              </div>
              <div>
                <label className="lbl">Lote da Pedra</label>
                <input
                  type="text"
                  className="ipt"
                  placeholder="Ex: LT-2023"
                  value={formData.specs.stoneBatch || ""}
                  onChange={(e) =>
                    update("specs", "stoneBatch", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="lbl">Cor Escolhida</label>
                <select
                  className={`ipt font-bold ${
                    showColorWarning
                      ? "border-amber-400 bg-amber-50 text-amber-900"
                      : "bg-white"
                  }`}
                  value={formData.specs.stoneColor}
                  onChange={(e) =>
                    update("specs", "stoneColor", e.target.value)
                  }
                >
                  <option value="">Selecione...</option>
                  {STONE_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {formData.specs.stoneColor &&
                    !STONE_COLORS.includes(formData.specs.stoneColor) && (
                      <option value={formData.specs.stoneColor}>
                        {formData.specs.stoneColor} (Personalizado)
                      </option>
                    )}
                </select>
                {showColorWarning && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-amber-600 animate-pulse">
                    <AlertTriangle size={10} /> <span>Difere do Padrão</span>
                  </div>
                )}
              </div>
              <div>
                <label className="lbl">Finalização</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.specs.finishing}
                  onChange={(e) => update("specs", "finishing", e.target.value)}
                />
              </div>
              <div className="col-span-1 md:col-span-3">
                <label className="lbl">Gravação</label>
                <input
                  type="text"
                  className="ipt"
                  value={formData.specs.engraving}
                  onChange={(e) => update("specs", "engraving", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="lbl">Cor Padrão</label>
                <input
                  type="text"
                  className="ipt bg-slate-100 text-slate-500"
                  readOnly
                  value={formData.specs.standardColor}
                />
              </div>
              <div>
                <label className="lbl">Tipo de Joia</label>
                <input
                  type="text"
                  className="ipt bg-slate-100 text-slate-500"
                  readOnly
                  value={formData.specs.jewelryType}
                />
              </div>
              <div>
                <label className="lbl">Material</label>
                <input
                  type="text"
                  className="ipt bg-slate-100 text-slate-500"
                  readOnly
                  value={formData.specs.material}
                />
              </div>
              <div>
                <label className="lbl">Categoria</label>
                <input
                  type="text"
                  className="ipt bg-slate-100 text-slate-500"
                  readOnly
                  value={formData.specs.category}
                />
              </div>
            </div>
          </div>

          {/* DADOS EXTRAS */}
          {showFullForm && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2 text-sm uppercase">
                    <User size={16} /> Cliente & Contato
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="lbl">Nº Pedido</label>
                        <input
                          type="text"
                          className="ipt"
                          value={formData.orderNumber}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              orderNumber: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="lbl">Data Entrada</label>
                        <input
                          type="date"
                          className="ipt"
                          value={formData.customDate}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              customDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="lbl">Nome Completo</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.order.customer.name}
                        onChange={(e) =>
                          update("order", "customer", e.target.value, "name")
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="lbl">CPF</label>
                        <input
                          type="text"
                          className="ipt"
                          value={formData.order.customer.cpf}
                          onChange={(e) =>
                            update("order", "customer", e.target.value, "cpf")
                          }
                        />
                      </div>
                      <div>
                        <label className="lbl">Zap</label>
                        <input
                          type="text"
                          className="ipt"
                          value={formData.order.customer.phone}
                          onChange={(e) =>
                            update("order", "customer", e.target.value, "phone")
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="lbl">Email</label>
                      <input
                        type="email"
                        className="ipt"
                        value={formData.order.customer.email}
                        onChange={(e) =>
                          update("order", "customer", e.target.value, "email")
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
                  <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase">
                    <CreditCard size={16} /> Pagamento & Notas
                  </h3>
                  <div className="space-y-3 flex-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="lbl">Valor Total (R$)</label>
                        <input
                          type="text"
                          className="ipt"
                          value={formData.order.payment.total}
                          onChange={(e) =>
                            update("order", "payment", e.target.value, "total")
                          }
                        />
                      </div>
                      <div>
                        <label className="lbl">Forma Pagto.</label>
                        <input
                          type="text"
                          className="ipt"
                          placeholder="Ex: PIX"
                          value={formData.order.payment.method}
                          onChange={(e) =>
                            update("order", "payment", e.target.value, "method")
                          }
                        />
                      </div>
                    </div>
                    <div className="h-full">
                      <label className="lbl">Observações</label>
                      <textarea
                        className="w-full p-2 border rounded-lg text-sm h-24 resize-none focus:border-purple-500 outline-none"
                        value={formData.order.notes}
                        onChange={(e) =>
                          update("order", "notes", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase">
                  <Truck size={16} /> Logística de Envio
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="lbl">Método Envio</label>
                    <input
                      type="text"
                      className="ipt font-bold text-purple-700"
                      value={formData.shipping.tipoenvio}
                      onChange={(e) =>
                        update("shipping", "tipoenvio", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl">Custo Frete</label>
                    <input
                      type="text"
                      className="ipt"
                      value={formData.shipping.price}
                      onChange={(e) =>
                        update("shipping", "price", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl">Rastreamento</label>
                    <input
                      type="text"
                      className="ipt"
                      value={formData.shipping.tracking}
                      onChange={(e) =>
                        update("shipping", "tracking", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase">
                    <MapPin size={12} /> Endereço de Entrega
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="lbl">Destinatário</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.shipping.address.destinatario}
                        onChange={(e) =>
                          update(
                            "shipping",
                            "address",
                            e.target.value,
                            "destinatario"
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="lbl">CEP</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.shipping.address.zip}
                        onChange={(e) =>
                          update("shipping", "address", e.target.value, "zip")
                        }
                      />
                    </div>
                    <div>
                      <label className="lbl">UF</label>
                      <input
                        type="text"
                        className="ipt"
                        maxLength={2}
                        value={formData.shipping.address.statecode}
                        onChange={(e) =>
                          update(
                            "shipping",
                            "address",
                            e.target.value,
                            "statecode"
                          )
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="lbl">Rua</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.shipping.address.street}
                        onChange={(e) =>
                          update(
                            "shipping",
                            "address",
                            e.target.value,
                            "street"
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="lbl">Número</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.shipping.address.number}
                        onChange={(e) =>
                          update(
                            "shipping",
                            "address",
                            e.target.value,
                            "number"
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="lbl">Bairro</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.shipping.address.district}
                        onChange={(e) =>
                          update(
                            "shipping",
                            "address",
                            e.target.value,
                            "district"
                          )
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="lbl">Complemento</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.shipping.address.complemento}
                        onChange={(e) =>
                          update(
                            "shipping",
                            "address",
                            e.target.value,
                            "complemento"
                          )
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="lbl">Cidade</label>
                      <input
                        type="text"
                        className="ipt"
                        value={formData.shipping.address.city}
                        onChange={(e) =>
                          update("shipping", "address", e.target.value, "city")
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-lg text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm shadow-lg shadow-purple-200"
          >
            {isEditing ? <Edit3 size={18} /> : <Factory size={18} />}{" "}
            {isEditing ? "Salvar Alterações" : "Confirmar Ordem"}
          </button>
        </div>

        {/* ESTILOS ORIGINAIS PRESERVADOS */}
        <style>{`.lbl { display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; } .ipt { width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; outline: none; transition: border-color 0.2s; } .ipt:focus { border-color: #a855f7; }`}</style>
      </div>
    </div>
  );
}
