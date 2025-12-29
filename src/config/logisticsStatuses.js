// src/config/logisticsStatuses.js

export const LOGISTICS_STATUS_CONFIG = {
  "SEM ETIQUETA": {
    color: "bg-slate-100 text-slate-600 border-slate-300",
  },
  CANCELADO: {
    color: "bg-red-100 text-red-700 border-red-200",
  },
  ENVIADO: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  REPOSTAGEM: {
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  AGUARDANDO: {
    color: "bg-amber-50 text-amber-600 border-amber-200",
  },
  "AGUARDANDO RETIRADA": {
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
  "PRONTO PARA POSTAR": {
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  GOLPE: {
    color: "bg-red-600 text-white border-red-700 animate-pulse font-bold",
  },
  FOTO: {
    color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  },
  ML: {
    color: "bg-yellow-300 text-yellow-900 border-yellow-400", // Amarelo Mercado Livre
  },
  MOTOBOY: {
    color: "bg-violet-100 text-violet-700 border-violet-200",
  },
  FELIPPE: {
    color: "bg-zinc-100 text-zinc-700 border-zinc-300",
  },
  "PRONTO EM ESPERA": {
    color: "bg-lime-100 text-lime-700 border-lime-200",
  },
};

// Array ordenado para usar nos Maps e Dropdowns
export const LOGISTICS_ORDER = [
  "SEM ETIQUETA",
  "PRONTO PARA POSTAR",
  "ENVIADO",
  "AGUARDANDO RETIRADA",
  "MOTOBOY",
  "ML",
  "FOTO",
  "AGUARDANDO",
  "PRONTO EM ESPERA",
  "FELIPPE",
  "REPOSTAGEM",
  "CANCELADO",
  "GOLPE",
];
