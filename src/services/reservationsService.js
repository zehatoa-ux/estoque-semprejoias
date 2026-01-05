import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const BASE_PATH = `artifacts/${APP_COLLECTION_ID}/public/data`;

export const reservationsService = {
  /**
   * Converte uma reserva em ordem de produção de forma ATÔMICA.
   * Se uma etapa falhar, nada é alterado no banco.
   * * @param {object} enrichedData - Dados vindos do ProductionConversionModal
   */
  async convertToOrder(enrichedData) {
    const batch = writeBatch(db);

    // 1. Extrair metadados e separar o payload
    const {
      id: oldReservationId,
      stockItemId,
      fromStock,
      ...dataToSave
    } = enrichedData;

    // 2. Referência para a Nova Ordem de Produção
    const ordersRef = collection(db, `${BASE_PATH}/production_orders`);
    const newOrderDoc = doc(ordersRef); // Cria ID automático

    const payload = {
      ...dataToSave,
      status: dataToSave.status || "SOLICITACAO",
      originalReservationId: oldReservationId,
      convertedAt: serverTimestamp(),
      createdAt: serverTimestamp(), // Importante para ordenação
    };

    batch.set(newOrderDoc, payload);

    // 3. Remover do Estoque (se aplicável)
    if (fromStock && stockItemId) {
      const inventoryItemRef = doc(
        db,
        `${BASE_PATH}/inventory_items`,
        stockItemId
      );
      batch.delete(inventoryItemRef);

      // NOTA: Se o seu sistema também reduz a contagem no documento
      // mestre de 'inventory' (agregado), essa lógica deveria estar aqui também.
      // Baseado no seu mapa, parece que 'inventory_items' são itens únicos (tracking individual).
    }

    // 4. Deletar a Reserva Original
    const reservationRef = doc(
      db,
      `${BASE_PATH}/reservations`,
      oldReservationId
    );
    batch.delete(reservationRef);

    // 5. Commit Atômico
    await batch.commit();
    return newOrderDoc.id;
  },

  /**
   * Exclui múltiplas reservas de uma vez
   * @param {string[]} ids - Array de IDs das reservas
   */
  async deleteReservations(ids) {
    if (!ids || ids.length === 0) return;

    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = doc(db, `${BASE_PATH}/reservations`, id);
      batch.delete(ref);
    });

    await batch.commit();
  },

  /**
   * Cria uma nova reserva simples
   * @param {object} data - { sku, qty, note, createdBy }
   */
  async createReservation(data) {
    const ref = collection(db, `${BASE_PATH}/reservations`);
    await addDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      status: "PENDENTE",
    });
  },

  /**
   * O GUARDIÃO: Verifica se existe reserva ativa para um SKU.
   * Usado pelo EditModal antes de permitir exclusão de estoque.
   * * @param {string} sku
   * @returns {Promise<boolean>}
   */
  async hasPendingReservations(sku) {
    if (!sku) return false;

    const reservationsRef = collection(db, `${BASE_PATH}/reservations`);
    const q = query(reservationsRef, where("sku", "==", sku));

    const snapshot = await getDocs(q);
    return !snapshot.empty; // Retorna true se achar alguma reserva
  },
};
