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
  limit,
  orderBy,
} from "firebase/firestore";

// Caminho base da coleção
const COLLECTION_PATH = `artifacts/${APP_COLLECTION_ID}/public/data/inventory_items`;

export const inventoryService = {
  /**
   * Ajusta a quantidade (Adiciona itens NOVOS ou Baixa itens EXISTENTES)
   * @param {string} sku - O SKU do produto
   * @param {number} delta - Quantidade a ajustar (+1 ou -1)
   * @param {string} userName - Nome do usuário que fez a ação (importante para histórico)
   */
  async adjustQuantity(sku, delta, userName = "Sistema") {
    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

    if (delta > 0) {
      // --- ADICIONAR: Cria novos documentos para cada unidade ---
      for (let i = 0; i < delta; i++) {
        const newDocRef = doc(collectionRef); // Gera ID automático
        batch.set(newDocRef, {
          sku: sku,
          baseSku: sku, // Simplificação, idealmente viria do catálogo
          status: "in_stock",
          addedBy: userName,
          timestamp: serverTimestamp(),
          dateIn: new Date().toLocaleString("pt-BR"),
          manualAdjustment: true,
        });
      }
    } else {
      // --- REMOVER: Busca itens 'in_stock' e marca como 'adjusted_out' ---
      const qtyToRemove = Math.abs(delta);

      // Busca os itens mais antigos primeiro (FIFO) ou mais novos (LIFO)
      // Aqui ordenamos por timestamp desc (LIFO - Last In, First Out) para bater com App.js
      const q = query(
        collectionRef,
        where("sku", "==", sku),
        where("status", "==", "in_stock"),
        orderBy("timestamp", "desc"),
        limit(qtyToRemove)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error("Não há itens em estoque suficientes para remover.");
      }

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          status: "adjusted_out",
          removedBy: userName,
          outTimestamp: serverTimestamp(),
          dateOut: new Date().toLocaleString("pt-BR"),
        });
      });
    }

    await batch.commit();
  },

  /**
   * "Excluir Tudo": Na verdade faz uma baixa lógica (adjusted_out) em massa
   * para manter o histórico de que os itens saíram.
   */
  async deleteItem(sku, userName = "Sistema") {
    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

    // Busca TODOS os itens em estoque deste SKU
    const q = query(
      collectionRef,
      where("sku", "==", sku),
      where("status", "==", "in_stock")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return; // Nada a deletar

    const chunkSize = 450; // Limite do batch do Firestore é 500
    let operationCount = 0;

    // Processa em pedaços se houver muitos itens
    for (const docSnap of snapshot.docs) {
      batch.update(docSnap.ref, {
        status: "adjusted_out",
        removedBy: userName,
        outTimestamp: serverTimestamp(),
        dateOut: new Date().toLocaleString("pt-BR"),
        bulkAction: true,
      });

      operationCount++;

      // Commit parcial se atingir o limite do batch
      if (operationCount >= chunkSize) {
        await batch.commit();
        operationCount = 0;
        // Reinicia batch para o próximo loop
        // (Nota: em casos muito grandes isso precisaria de lógica mais complexa,
        // mas para uso manual funciona bem)
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }
  },

  /**
   * Processa vendas em lote
   */
  async batchDeduct(skuList, userName = "Venda") {
    if (!skuList || skuList.length === 0) return;

    // Agrupa SKUs para saber quantos buscar de cada
    const counts = {};
    skuList.forEach((sku) => (counts[sku] = (counts[sku] || 0) + 1));

    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

    // Processar cada SKU
    for (const [sku, qty] of Object.entries(counts)) {
      const q = query(
        collectionRef,
        where("sku", "==", sku),
        where("status", "==", "in_stock"),
        limit(qty)
      );

      const snapshot = await getDocs(q);

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          status: "sold", // Status diferente para venda
          soldBy: userName,
          soldTimestamp: serverTimestamp(),
          dateOut: new Date().toLocaleString("pt-BR"),
        });
      });
    }

    await batch.commit();
  },
};
