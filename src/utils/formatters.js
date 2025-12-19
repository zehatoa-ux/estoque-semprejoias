// src/utils/formatters.js

// Normaliza texto (remove acentos e põe minúsculo) para busca
export const normalizeText = (text) => {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

// Formata valor monetário (R$ 1.200,00)
export const formatMoney = (val) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val || 0);
};

// Formata data (Se for Timestamp do Firebase ou String)
export const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  // Se for objeto timestamp do firestore
  if (dateStr?.toDate) return dateStr.toDate().toLocaleString("pt-BR");
  // Se for string
  return dateStr.split(" ")[0];
};
