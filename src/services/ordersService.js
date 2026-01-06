// src/services/ordersService.js
import {
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// Constante do caminho para evitar repetição e erros
const COLLECTION_PATH = [
  "artifacts",
  APP_COLLECTION_ID,
  "public",
  "data",
  "production_orders",
];

const getOrderRef = (id) => doc(db, ...COLLECTION_PATH, id);

export const ordersService = {
  // --- 1. MUDAR STATUS LOGÍSTICO (EM LOTE) ---
  async updateLogisticsStatusBatch(ids, newStatus) {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = getOrderRef(id);
      batch.update(ref, { logisticsStatus: newStatus });
    });
    await batch.commit();
  },

  // --- 2. MUDAR STATUS DE ITEM INDIVIDUAL ---
  async updateItemStatus(itemId, newStatus) {
    const ref = getOrderRef(itemId);
    await updateDoc(ref, {
      status: newStatus,
      lastUpdate: serverTimestamp(),
    });
  },

  // --- 3. DELETAR PEDIDO (EM LOTE) ---
  // CUIDADO: Isso apaga fisicamente. Use archiveOrderBatch preferencialmente.
  async deleteOrderBatch(ids) {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = getOrderRef(id);
      batch.delete(ref);
    });
    await batch.commit();
  },

  // --- 4. ARQUIVAR PEDIDO (EM LOTE) ---
  // Ao marcar archived: true, ele deve sumir de TODAS as abas (Produção e Logística)
  // desde que as abas tenham o filtro where("archived", "!=", true)
  async archiveOrderBatch(ids) {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = getOrderRef(id);
      batch.update(ref, {
        archived: true,
        archivedAt: serverTimestamp(),
        // Opcional: status: "ARQUIVADO" // Se quiser mudar o status do kanban também
      });
    });
    await batch.commit();
  },

  // --- 4.1. DESARQUIVAR (NOVO - ÚTIL PARA CORREÇÕES) ---
  async unarchiveOrderBatch(ids) {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = getOrderRef(id);
      batch.update(ref, {
        archived: false,
        unarchivedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  },

  // --- 5. ATUALIZAR DADOS DO PEDIDO (EDITZÃO GIGANTE) ---
  async updateOrderDetailsBatch(items, newData) {
    const batch = writeBatch(db);

    items.forEach((item) => {
      const ref = getOrderRef(item.id);

      const updateData = {
        "order.number": newData.orderNumber,
        "order.notes": newData.notes,

        "order.customer.name": newData.customerName,
        "order.customer.cpf": newData.customerCpf,
        "order.customer.phone": newData.customerPhone,
        "order.customer.email": newData.customerEmail,

        "shipping.tipoenvio": newData.shippingMethod,
        "shipping.price": newData.shippingPrice,
        "shipping.tracking": newData.tracking,

        "shipping.address.zip": newData.zip,
        "shipping.address.street": newData.street,
        "shipping.address.number": newData.number,
        "shipping.address.complemento": newData.comp,
        "shipping.address.bairro": newData.district,
        "shipping.address.city": newData.city,
        "shipping.address.statecode": newData.state,

        "order.payment.method": newData.paymentMethod,
      };

      if (newData.totalValueOverride) {
        updateData["order.payment.total"] = newData.totalValueOverride;
      }

      batch.update(ref, updateData);
    });

    await batch.commit();
  },

  // --- 6. SALVAR EDIÇÃO DE ITEM (SPECS) ---
  async updateItemSpecs(itemId, newSpecs) {
    const ref = getOrderRef(itemId);
    await updateDoc(ref, {
      specs: newSpecs,
      status: "PEDIDO_MODIFICADO",
      lastModified: serverTimestamp(),
      modifiedBy: "Logística",
    });
  },

  // --- 7. MOVER ITEM DE PEDIDO ---
  async moveItemToOrder(itemId, targetOrderData) {
    const ref = getOrderRef(itemId);

    const safeOrderNumber =
      targetOrderData.orderNumber || targetOrderData.number || "AVULSO";

    const safeCustomerName =
      targetOrderData.customerName || targetOrderData.name || "Cliente Balcão";

    await updateDoc(ref, {
      "order.number": safeOrderNumber,
      "order.customer.name": safeCustomerName,
      status: "PEDIDO_MODIFICADO",
      lastModified: serverTimestamp(),
    });
  },

  // --- 8. MARCAR CERTIFICADOS COMO IMPRESSOS ---
  async markCertificatesPrinted(itemsToPrint) {
    const batch = writeBatch(db);
    itemsToPrint.forEach((item) => {
      const ref = getOrderRef(item.id);
      batch.update(ref, { certificatePrinted: true });
    });
    await batch.commit();
  },
};
