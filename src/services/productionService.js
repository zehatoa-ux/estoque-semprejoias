// src/services/productionService.js
import {
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  setDoc,
  increment,
} from "firebase/firestore";

// IMPORTA O BANCO DO ARQUIVO DE CONFIG DO FIREBASE
import { db } from "../config/firebase";

// IMPORTA O ID DA COLEÇÃO DO ARQUIVO DE CONSTANTES
import { APP_COLLECTION_ID } from "../config/constants";

// --- DEFINIÇÃO DO CAMINHO ---
const COLLECTION_PATH = [
  "artifacts",
  APP_COLLECTION_ID,
  "public",
  "data",
  "production_orders",
];

// Helper para criar referência do documento facilmente
const getOrderRef = (id) => doc(db, ...COLLECTION_PATH, id);

export const productionService = {
  // --- ATUALIZAR STATUS ---
  async updateStatus(orderId, newStatus, currentStatus, userName) {
    const orderRef = getOrderRef(orderId);

    await updateDoc(orderRef, {
      status: newStatus,
      lastUpdate: serverTimestamp(),
      updatedBy: userName || "Sistema",
    });

    // Lógica de Estatística Mensal
    if (newStatus === "PEDIDO_PRONTO" && currentStatus !== "PEDIDO_PRONTO") {
      await this._updateMonthlyStats();
    }
  },

  // Função interna para atualizar estatísticas
  async _updateMonthlyStats() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}_${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    const displayKey = `${new Intl.DateTimeFormat("pt-BR", {
      month: "short",
    }).format(now)}/${String(now.getFullYear()).slice(-2)}`;

    // Caminho da estatística é fixo
    const statsRef = doc(
      db,
      "artifacts",
      APP_COLLECTION_ID,
      "public",
      "data",
      "statistics",
      "production_monthly"
    );

    await setDoc(
      statsRef,
      {
        [monthKey]: increment(1),
        [`label_${monthKey}`]: displayKey,
      },
      { merge: true }
    );
  },

  // --- SALVAR EDIÇÃO DE SPECS ---
  async updateSpecs(orderId, newSpecs, userName) {
    const orderRef = getOrderRef(orderId);
    await updateDoc(orderRef, {
      specs: newSpecs,
      updatedBy: userName || "Sistema",
      lastUpdate: serverTimestamp(),
    });
  },

  // --- DELETAR PEDIDO ---
  async deleteOrder(orderId) {
    const orderRef = getOrderRef(orderId);
    await deleteDoc(orderRef);
  },

  // --- MARCAR COMO IMPRESSO (BATCH) ---
  async markBatchAsPrinted(orderIds) {
    if (orderIds.length === 0) return;

    const batch = writeBatch(db);
    orderIds.forEach((id) => {
      const ref = getOrderRef(id);
      batch.update(ref, { printed: true });
    });

    await batch.commit();
  },

  // --- ALTERNAR TRÂNSITO (SUBINDO/DESCENDO) ---
  async toggleTransit(orderId, direction, userName) {
    const orderRef = getOrderRef(orderId);

    await updateDoc(orderRef, {
      transit_status: direction, // 'subindo', 'descendo' ou null
      transit_updated_at: serverTimestamp(),
      transit_updated_by: userName || "Sistema",
      lastUpdate: serverTimestamp(),
    });
  },

  // --- NOVO: ATUALIZAR CAMPO GENÉRICO (Usado para a Data) ---
  async updateOrderField(orderId, field, value, userName) {
    const orderRef = getOrderRef(orderId);

    await updateDoc(orderRef, {
      [field]: value, // Ex: customCreatedAt: "2023-10-25"
      updatedBy: userName || "Sistema",
      lastUpdate: serverTimestamp(),
    });
  },
};
