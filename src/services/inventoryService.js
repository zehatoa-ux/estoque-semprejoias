import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import {
  collection,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  orderBy,
  doc,
} from "firebase/firestore";

// Caminho centralizado
const COLLECTION_PATH = `artifacts/${APP_COLLECTION_ID}/public/data/inventory_items`;

export const inventoryService = {
  // ... (mantenha adjustQuantity e deleteItem como estavam) ...

  // Função para importar itens da Conferência (Buffer)
  async importItems(items, userName = "Conferência") {
    if (!items || items.length === 0) return 0;

    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

    items.forEach((item) => {
      // Cria um novo documento com ID automático
      const newDocRef = doc(collectionRef);

      batch.set(newDocRef, {
        sku: item.sku,
        baseSku: item.baseSku || item.sku,
        status: "in_stock",
        addedBy: userName,
        timestamp: serverTimestamp(), // Hora do servidor
        dateIn: item.dateIn || new Date().toLocaleString("pt-BR"),
        dateOut: null,
        source: "conference_scan",
      });
    });

    await batch.commit();
    return items.length;
  },
  // Função robusta de ajuste (Adicionar ou Remover)
  async adjustQuantity(sku, delta, userName = "Sistema") {
    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, {
          sku: sku,
          baseSku: sku,
          status: "in_stock",
          addedBy: userName,
          timestamp: serverTimestamp(),
          dateIn: new Date().toLocaleString("pt-BR"),
          manualAdjustment: true,
        });
      }
    } else {
      const qtyToRemove = Math.abs(delta);
      const q = query(
        collectionRef,
        where("sku", "==", sku),
        where("status", "==", "in_stock"),
        orderBy("timestamp", "asc"), // FIFO: Tira os mais antigos primeiro
        limit(qtyToRemove)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error("Estoque insuficiente.");

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

  // Função de Venda em Lote (Substitui executeBatchSales do App.js)
  async sellItems(skuList, userName = "Venda") {
    if (!skuList || skuList.length === 0) return;

    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

    // Agrupa contagem: { "ANEL-01": 2, "BRINCO-02": 1 }
    const counts = {};
    skuList.forEach((sku) => (counts[sku] = (counts[sku] || 0) + 1));

    for (const [sku, qty] of Object.entries(counts)) {
      // Busca X itens disponíveis deste SKU no banco
      const q = query(
        collectionRef,
        where("sku", "==", sku),
        where("status", "==", "in_stock"),
        limit(qty)
      );

      const snapshot = await getDocs(q);

      if (snapshot.size < qty) {
        console.warn(
          `Estoque insuficiente para ${sku}. Solicitado: ${qty}, Disponível: ${snapshot.size}`
        );
        // Opcional: Lançar erro ou vender apenas o que tem.
        // Aqui vendemos o que tem para não travar o lote todo.
      }

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          status: "sold", // Status de venda
          soldBy: userName,
          soldTimestamp: serverTimestamp(),
          dateOut: new Date().toLocaleString("pt-BR"),
        });
      });
    }

    await batch.commit();
    return skuList.length; // Retorna quantos itens tentamos vender
  },
};
