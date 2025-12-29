// src/config/productionStatuses.js

export const PRODUCTION_STATUS_CONFIG = {
  PEDIDO_MODIFICADO: {
    label: "PEDIDO MODIFICADO",
    color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300 animate-pulse",
  },
  SOLICITACAO: {
    label: "AGUARDANDO ANÁLISE",
    color: "bg-slate-600 text-white border-slate-700",
  },
  GRAVACAO: {
    label: "GRAVAÇÃO",
    color: "bg-orange-400 text-white border-orange-500",
  },
  MODELAGEM: {
    label: "MODELAGEM",
    color: "bg-pink-300 text-pink-900 border-pink-400",
  },
  FALTA_BANCA: {
    label: "FALHA BANCA",
    color: "bg-red-500 text-white border-red-600",
  },
  IMPRIMIR: {
    label: "IMPRIMIR",
    color: "bg-emerald-500 text-white border-emerald-600",
  },
  PEDIDO_PRONTO: {
    label: "PEDIDO PRONTO",
    color: "bg-green-600 text-white border-green-700",
  },
  CANCELADO: {
    label: "CANCELADO",
    color: "bg-gray-700 text-gray-300 border-gray-800",
  },
  CURA: { label: "CURA", color: "bg-purple-600 text-white border-purple-700" },
  INJECAO: {
    label: "INJEÇÃO",
    color: "bg-indigo-600 text-white border-indigo-700",
  },
  RESINA_FINALIZACAO: {
    label: "RESINA/FINALIZAÇÃO",
    color: "bg-blue-400 text-white border-blue-500",
  },
  VERIFICAR: {
    label: "VERIFICAR",
    color: "bg-pink-400 text-white border-pink-500",
  },
  ESTOQUE_IMPRIMINDO: {
    label: "ESTOQUE - IMPRIMINDO",
    color: "bg-cyan-700 text-white border-cyan-800",
  },
  ESTOQUE_FUNDIDO: {
    label: "ESTOQUE - FUNDIDO",
    color: "bg-blue-800 text-white border-blue-900",
  },
  IMPRIMINDO: {
    label: "IMPRIMINDO",
    color: "bg-orange-500 text-white border-orange-600",
  },
  BANHO: { label: "BANHO", color: "bg-cyan-600 text-white border-cyan-700" },
  IR_PARA_BANCA: {
    label: "IR PARA BANCA",
    color: "bg-stone-600 text-white border-stone-700",
  },
  FUNDICAO: {
    label: "FUNDIÇÃO",
    color: "bg-teal-400 text-teal-900 border-teal-500",
  },
  POLIMENTO: {
    label: "POLIMENTO",
    color: "bg-yellow-600 text-white border-yellow-700",
  },
  ENVIADO: {
    label: "ENVIADO",
    color: "bg-stone-500 text-white border-stone-600",
  },
  QUALIDADE: { label: "Q", color: "bg-blue-700 text-white border-blue-800" },
  BANCA: { label: "BANCA", color: "bg-lime-500 text-lime-900 border-lime-600" },
  MANUTENCAO: {
    label: "AJUSTE/MANUTENÇÃO",
    color: "bg-sky-400 text-white border-sky-500",
  },
  FALTA_PEDRA: {
    label: "FALTA PEDRA",
    color: "bg-purple-400 text-purple-900 border-purple-500",
  },
};

// Ordem do Kanban (Usado na Produção)
export const KANBAN_ORDER = [
  "PEDIDO_MODIFICADO",
  "MODELAGEM",
  "GRAVACAO",
  "MANUTENCAO",
  "FALTA_BANCA",
  "SOLICITACAO",
  "IMPRIMIR",
  "IMPRIMINDO",
  "ESTOQUE_IMPRIMINDO",
  "CURA",
  "FUNDICAO",
  "ESTOQUE_FUNDIDO",
  "BANCA",
  "POLIMENTO",
  "RESINA_FINALIZACAO",
  "VERIFICAR",
  "PEDIDO_PRONTO",
  "CANCELADO",
];

export const DAYS_COLUMNS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
