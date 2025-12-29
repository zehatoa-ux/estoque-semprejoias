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

// src/utils/formatters.js

export const getBusinessDaysDiff = (startDate) => {
  if (!startDate) return 0;
  // Aceita tanto objeto Timestamp do Firebase quanto Date normal ou string
  const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
  const end = new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  let curDate = new Date(start.getTime());

  while (curDate < end) {
    const dayOfWeek = curDate.getDay();
    // 0 = Domingo, 6 = Sábado. Só conta se não for fds.
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setDate(curDate.getDate() + 1);
  }

  return count;
};
