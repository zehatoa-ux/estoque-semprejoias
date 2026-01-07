import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

const DATA_PATH = `artifacts/${APP_COLLECTION_ID}/public/data`;

const capitalize = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const archiveService = {
  async searchOrders(term) {
    if (!term) return [];

    const rawTerm = term.trim();
    const capTerm = capitalize(rawTerm);
    const upperTerm = rawTerm.toUpperCase();

    const collRef = collection(db, `${DATA_PATH}/production_orders`);
    const results = new Map();
    const queries = [];

    // Helper para busca EXATA (==)
    const addExactQuery = (field, value) => {
      queries.push(
        query(collRef, where("archived", "==", true), where(field, "==", value))
      );
    };

    // Helper para busca PARCIAL (Começa com...)
    const addPrefixQuery = (field, value) => {
      queries.push(
        query(
          collRef,
          where("archived", "==", true),
          where(field, ">=", value),
          where(field, "<=", value + "\uf8ff")
        )
      );
    };

    // --- 1. SKU (Parcial/Prefixo) ---
    addPrefixQuery("sku", rawTerm);
    if (rawTerm !== upperTerm) {
      addPrefixQuery("sku", upperTerm);
    }

    // --- 2. NÚMERO DO PEDIDO (Exata) ---
    addExactQuery("order.number", rawTerm);
    if (!isNaN(rawTerm)) {
      addExactQuery("order.number", Number(rawTerm));
    }

    // --- 3. NOME DO CLIENTE ---
    addPrefixQuery("order.customer.name", rawTerm);
    if (rawTerm !== capTerm) {
      addPrefixQuery("order.customer.name", capTerm);
    }

    // --- 4. CIDADE (NOVO - Substituiu Tipo de Joia) ---
    // Ex: Busca "Uberaba", "São Paulo"
    addPrefixQuery("shipping.address.city", rawTerm);
    if (rawTerm !== capTerm) {
      addPrefixQuery("shipping.address.city", capTerm);
    }

    // --- 5. CEP ---
    addPrefixQuery("shipping.address.zip", rawTerm);

    // --- 6. RUA ---
    addPrefixQuery("shipping.address.street", rawTerm);

    // --- 7. GRAVAÇÃO ---
    addPrefixQuery("specs.engraving", rawTerm);

    // Executa tudo
    try {
      const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
      snapshots.forEach((snap) => {
        snap.forEach((doc) => {
          results.set(doc.id, { id: doc.id, ...doc.data() });
        });
      });
    } catch (error) {
      console.error("ERRO DE ÍNDICE:", error);
    }

    return Array.from(results.values());
  },

  async unarchiveOrder(orderId, userName) {
    const ref = doc(db, `${DATA_PATH}/production_orders`, orderId);
    await updateDoc(ref, {
      archived: false,
      status: "SOLICITACAO",
      unarchivedAt: serverTimestamp(),
      unarchivedBy: userName,
    });
  },
};
