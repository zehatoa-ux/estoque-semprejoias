import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  getDoc, // Importante para ler o pedido antes de apagar
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

const DATA_PATH = `artifacts/${APP_COLLECTION_ID}/public/data`;

export const productionService = {
  // ... (outras funções updateStatus, toggleTransit, etc. mantêm-se iguais) ...

  // --- NOVA LÓGICA DE EXCLUSÃO COM DEVOLUÇÃO ---
  async deleteOrder(orderId) {
    const orderRef = doc(db, `${DATA_PATH}/production_orders`, orderId);

    // 1. Ler o pedido antes de apagar para saber se tem estoque atrelado
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) return;

    const orderData = orderSnap.data();
    const batch = writeBatch(db);

    // 2. Se for um item de Fábrica Interceptado, DEVOLVER para a fila
    if (orderData.isInterceptedPE && orderData.stockItemId) {
      const itemRef = doc(
        db,
        `${DATA_PATH}/inventory_items`,
        orderData.stockItemId
      );

      // Verifica se o item ainda existe antes de tentar atualizar
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        batch.update(itemRef, {
          status: "pe_solicitado", // Devolve para o início da fila ou status anterior
          linkedOrderNumber: null,
          linkedCustomer: null,
          interceptedAt: null,
          lastAction: "Liberado por cancelamento de pedido",
        });
      }
    }

    // 3. Se for Estoque Físico, opcionalmente devolver para 'in_stock'
    // (Depende da sua regra de negócio. Se cancelou o pedido, o item volta pra prateleira?)
    if (
      orderData.fromStock &&
      !orderData.isInterceptedPE &&
      orderData.stockItemId
    ) {
      const itemRef = doc(
        db,
        `${DATA_PATH}/inventory_items`,
        orderData.stockItemId
      );
      // Vamos tentar reativar o item físico
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        batch.update(itemRef, {
          status: "in_stock", // Volta para disponível
          outTimestamp: null,
          removedBy: null,
          reason: null,
        });
      }
    }

    // 4. Deleta o pedido
    batch.delete(orderRef);

    // 5. Executa
    await batch.commit();
  },

  // ... (mantenha updateSpecs, updateOrderField, etc) ...

  // Se precisar das outras funções para o arquivo ficar completo, me avise.
  // Mas assumindo que você já tem o productionService, basta substituir a deleteOrder.

  // (Aqui vai um esqueleto das outras funções caso precise copiar tudo)
  async updateStatus(orderId, newStatus) {
    const ref = doc(db, `${DATA_PATH}/production_orders`, orderId);
    await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
  },

  async toggleTransit(orderId, transitStatus) {
    const ref = doc(db, `${DATA_PATH}/production_orders`, orderId);
    await updateDoc(ref, { transit_status: transitStatus });
  },

  async updateSpecs(orderId, specs) {
    const ref = doc(db, `${DATA_PATH}/production_orders`, orderId);
    await updateDoc(ref, { specs });
  },

  async updateOrderField(orderId, field, value) {
    const ref = doc(db, `${DATA_PATH}/production_orders`, orderId);
    await updateDoc(ref, { [field]: value });
  },

  async markBatchAsPrinted(orderIds) {
    const batch = writeBatch(db);
    orderIds.forEach((id) => {
      const ref = doc(db, `${DATA_PATH}/production_orders`, id);
      batch.update(ref, { printed: true });
    });
    await batch.commit();
  },
};
