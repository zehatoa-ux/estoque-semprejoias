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
  addDoc,
} from "firebase/firestore";

const DATA_PATH = `artifacts/${APP_COLLECTION_ID}/public/data`;

export const reservationsService = {
  async convertToOrder(enrichedData) {
    const batch = writeBatch(db);

    console.log("🛠️ Iniciando Conversão. Dados recebidos:", enrichedData);

    // 1. Extrair metadados
    const {
      id: oldReservationId,
      stockItemId,
      fromStock,
      isInterceptedPE,
      ...dataToSave
    } = enrichedData;

    if (!oldReservationId)
      throw new Error("ID da reserva original não encontrado.");

    // 2. Criar a Ordem de Produção
    const ordersRef = collection(db, `${DATA_PATH}/production_orders`);
    const newOrderDoc = doc(ordersRef);

    const payload = {
      ...dataToSave,
      id: newOrderDoc.id,
      isInterceptedPE: !!isInterceptedPE,
      fromStock: !!fromStock,
      stockItemId: stockItemId || null,
      originalReservationId: oldReservationId,
      convertedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    batch.set(newOrderDoc, payload);

    // 3. DEBITAR DO ESTOQUE (A Correção está aqui)
    if (stockItemId) {
      const itemRef = doc(db, `${DATA_PATH}/inventory_items`, stockItemId);

      if (isInterceptedPE) {
        // --- ESTOQUE FÁBRICA ---
        // MUDANÇA CRÍTICA: setamos isPE: false para ele sumir da contagem de fábrica.
        batch.update(itemRef, {
          status: "adjusted_out", // Status de saída
          isPE: false, // <--- AQUI! Remove da lista de Produção
          outTimestamp: serverTimestamp(),
          reason: "intercepted_for_order",
          linkedOrderNumber: payload.order?.number || "S/N",
          removedBy: "Sistema (Conversão)",
        });
      } else if (fromStock) {
        // --- ESTOQUE FÍSICO ---
        // Se for físico, também garantimos que isPE é false (segurança)
        batch.update(itemRef, {
          status: "adjusted_out",
          isPE: false,
          outTimestamp: serverTimestamp(),
          removedBy: "Sistema (Conversão)",
          reason: "converted_to_order",
        });
      }
    } else {
      console.warn(
        "⚠️ Atenção: Pedido marcado como estoque, mas sem stockItemId."
      );
    }

    // 4. Deletar a Reserva Original
    const reservationRef = doc(
      db,
      `${DATA_PATH}/reservations`,
      oldReservationId
    );
    batch.delete(reservationRef);

    // 5. Commit
    await batch.commit();
    console.log("✅ Conversão realizada e Estoque Debitado.");
    return newOrderDoc.id;
  },

  // ... (Mantenha o restante das funções abaixo idênticas)

  async deleteReservations(ids) {
    if (!ids || ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = doc(db, `${DATA_PATH}/reservations`, id);
      batch.delete(ref);
    });
    await batch.commit();
  },

  async createReservation(data) {
    const ref = collection(db, `${DATA_PATH}/reservations`);
    await addDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      status: "PENDENTE",
    });
  },

  async hasPendingReservations(sku) {
    if (!sku) return false;
    const q = query(
      collection(db, `${DATA_PATH}/reservations`),
      where("sku", "==", sku)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },
};
