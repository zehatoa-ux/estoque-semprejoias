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
  // Substitui Linha 99
  async updateLogisticsStatusBatch(ids, newStatus) {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = getOrderRef(id);
      batch.update(ref, { logisticsStatus: newStatus });
    });
    await batch.commit();
  },

  // --- 2. MUDAR STATUS DE ITEM INDIVIDUAL ---
  // Substitui Linha 116 (handleItemStatusChange)
  async updateItemStatus(itemId, newStatus) {
    const ref = getOrderRef(itemId);
    await updateDoc(ref, {
      status: newStatus,
      lastUpdate: serverTimestamp(),
    });
  },

  // --- 3. DELETAR PEDIDO (EM LOTE) ---
  // Substitui Linha 137
  async deleteOrderBatch(ids) {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = getOrderRef(id);
      batch.delete(ref);
    });
    await batch.commit();
  },

  // --- 4. ARQUIVAR PEDIDO (EM LOTE) ---
  // Substitui Linha 116 (handleArchiveOrder)
  async archiveOrderBatch(ids) {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const ref = getOrderRef(id);
      batch.update(ref, {
        archived: true,
        archivedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  },

  // --- 5. ATUALIZAR DADOS DO PEDIDO (EDITZÃO GIGANTE) ---
  // Substitui Linha 119
  async updateOrderDetailsBatch(items, newData) {
    const batch = writeBatch(db);

    items.forEach((item) => {
      const ref = getOrderRef(item.id);

      // Mapeamento dos campos
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
  // Substitui Linha 267
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
  // Substitui Linha 292
  async moveItemToOrder(itemId, targetOrderData) {
    const ref = getOrderRef(itemId);

    // 🛡️ PROTEÇÃO: Garante que nunca seja undefined
    // Tenta ler .orderNumber, se não tiver tenta .number, se não tiver usa "AVULSO"
    const safeOrderNumber =
      targetOrderData.orderNumber || targetOrderData.number || "AVULSO";

    // Tenta ler .customerName, se não tiver tenta .name, se não tiver usa "Cliente Balcão"
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
  // Substitui Linha 326
  async markCertificatesPrinted(itemsToPrint) {
    const batch = writeBatch(db);
    itemsToPrint.forEach((item) => {
      const ref = getOrderRef(item.id);
      batch.update(ref, { certificatePrinted: true });
    });
    await batch.commit();
  },
};
