import {
  collection,
  addDoc,
  writeBatch,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// Caminho da coleção de estoque
const INVENTORY_PATH = [
  "artifacts",
  APP_COLLECTION_ID,
  "public",
  "data",
  "inventory_items",
];

export const stockProductionService = {
  // 1. LANÇAR LOTE (Nascimento das peças)
  async launchBatch(sku, qty, user) {
    const batch = writeBatch(db);
    const collectionRef = collection(db, ...INVENTORY_PATH);

    // Cria 'qty' documentos novos
    for (let i = 0; i < qty; i++) {
      // Cria uma referência de documento novo (ID automático)
      const newDocRef = doc(collectionRef);

      batch.set(newDocRef, {
        sku: sku.toUpperCase().trim(),
        status: "pe_solicitado", // Status inicial
        isPE: true, // Flag importante: É Produção de Estoque
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        history: [
          {
            action: "criado_pe",
            user: user || "Sistema",
            date: new Date().toISOString(),
          },
        ],
      });
    }

    await batch.commit();
  },

  // 2. AVANÇAR ETAPA (Em Massa)
  async advanceBatchStatus(itemIds, newStatus, user) {
    const batch = writeBatch(db);

    itemIds.forEach((id) => {
      const ref = doc(db, ...INVENTORY_PATH, id);

      // Se o status for "finalizar" (virar estoque real)
      if (newStatus === "in_stock") {
        batch.update(ref, {
          status: "in_stock",
          isPE: false, // Remove a flag de PE, agora é estoque real
          available: true,
          updatedAt: serverTimestamp(),
          // Adiciona histórico sem apagar o anterior (usando arrayUnion seria melhor,
          // mas update simples é mais seguro se não tivermos arrayUnion importado)
        });
      } else {
        // Apenas troca de fase na produção
        batch.update(ref, {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  },

  // 3. CANCELAR/EXCLUIR (Se lançou errado)
  async deleteBatch(itemIds) {
    const batch = writeBatch(db);
    itemIds.forEach((id) => {
      const ref = doc(db, ...INVENTORY_PATH, id);
      batch.delete(ref);
    });
    await batch.commit();
  },
  // --- NOVA FUNÇÃO: INTERCEPTAR ITEM ---
  async interceptItem(itemId, orderNumber, customerName) {
    const ref = doc(db, ...INVENTORY_PATH, itemId);

    await updateDoc(ref, {
      status: "pe_interceptado", // Status travado
      isPE: true, // Ainda é PE, mas não está disponível
      interceptedAt: serverTimestamp(),
      linkedOrderNumber: orderNumber,
      linkedCustomer: customerName,
      // Adicionamos ao histórico
      history: [
        {
          action: "interceptado_para_pedido",
          obs: `Vinculado ao pedido ${orderNumber} de ${customerName}`,
          date: new Date().toISOString(),
        },
      ],
    });
  },

  // Helper para verificar se está disponível (opcional, mas bom ter)
  isAvailable(item) {
    return item.isPE === true && item.status !== "pe_interceptado";
  },
};
