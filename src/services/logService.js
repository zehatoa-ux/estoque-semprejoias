import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

const LOGS_PATH = `artifacts/${APP_COLLECTION_ID}/public/data/system_logs`;

// DICIONÁRIO DE MÓDULOS
export const MODULES = {
  ESTOQUE: "ESTOQUE_FABRICA",
  PEDIDOS: "LOGISTICA_PEDIDOS",
  PRODUCAO: "PRODUCAO_OFICINA",
  RESERVAS: "RESERVAS",
  ARQUIVO: "ARQUIVO_MORTO",
  GERAL: "SISTEMA",
};

// --- HELPER: NORMALIZA O USUÁRIO ---
// Converte qualquer formato de user (AuthContext, Firebase Auth, ou null)
// para o formato padrão do Log, sem deixar nada 'undefined'.
export const getSafeUser = (user) => {
  if (!user) {
    return {
      name: "Admin (Sistema)",
      email: "sistema@interno.com",
      uid: "sistema_auto",
    };
  }

  return {
    // Garante string ou fallback
    name: user.name || "Usuário Sem Nome",
    // Se não tiver email, usa o username. Se não tiver username, usa fallback.
    email: user.email || user.username || "sem_email",
    // Se não tiver uid, usa o id. Se não tiver id, usa fallback.
    uid: user.uid || user.id || "sem_id",
  };
};

/**
 * Registra uma ação no sistema
 */
export const logAction = async (
  user,
  module,
  action,
  details,
  metadata = {}
) => {
  try {
    const userInfo = getSafeUser(user);

    // Limpeza extra nos metadados para garantir que não vá undefined
    const cleanMetadata = JSON.parse(JSON.stringify(metadata || {}));

    await addDoc(collection(db, LOGS_PATH), {
      timestamp: serverTimestamp(),
      user: {
        name: userInfo.name,
        email: userInfo.email,
        uid: userInfo.uid,
      },
      module: module || "GERAL",
      action: action ? action.toUpperCase() : "ACAO_DESCONHECIDA",
      details: details || "Sem detalhes",
      metadata: cleanMetadata, // Metadados sanitizados
    });

    // console.log("Log gravado com sucesso!");
  } catch (error) {
    console.error("ERRO AO GRAVAR LOG:", error);
    // Não damos alert aqui para não travar o fluxo do usuário se o log falhar
  }
};
