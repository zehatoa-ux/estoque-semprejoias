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
  addDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

// --- MUDANÇA CRÍTICA: ISSO TEM QUE SER UM ARRAY, NÃO UMA STRING ---
const INVENTORY_COLLECTION_PATH = [
  "artifacts",
  APP_COLLECTION_ID,
  "public",
  "data",
  "inventory_items",
];

const RESERVATION_COLLECTION_PATH = [
  "artifacts",
  APP_COLLECTION_ID,
  "public",
  "data",
  "reservations",
];

export const inventoryService = {
  // --- 1. IMPORTAR ITENS ---
  async importItems(items, userName = "Conferência") {
    if (!items || items.length === 0) return 0;

    const batch = writeBatch(db);
    // Nota: Usamos o spread (...) para transformar o Array em argumentos
    const collectionRef = collection(db, ...INVENTORY_COLLECTION_PATH);

    items.forEach((item) => {
      const newDocRef = doc(collectionRef);
      batch.set(newDocRef, {
        sku: item.sku,
        baseSku: item.baseSku || item.sku,
        status: "in_stock",
        addedBy: userName,
        timestamp: serverTimestamp(),
        dateIn: item.dateIn || new Date().toLocaleString("pt-BR"),
        dateOut: null,
        source: "conference_scan",
      });
    });

    await batch.commit();
    return items.length;
  },

  // --- 2. AJUSTAR ESTOQUE (Botões + e -) ---
  // OBS: Requer Índice Composto no Firebase para o 'delta < 0'
  async adjustQuantity(sku, delta, userName = "Sistema") {
    const batch = writeBatch(db);
    const collectionRef = collection(db, ...INVENTORY_COLLECTION_PATH);

    if (delta > 0) {
      // ADICIONAR
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
      // REMOVER
      const qtyToRemove = Math.abs(delta);

      // Essa Query exige o Índice: SKU + Status + Timestamp
      const q = query(
        collectionRef,
        where("sku", "==", sku),
        where("status", "==", "in_stock"),
        orderBy("timestamp", "asc"),
        limit(qtyToRemove)
      );

      const snapshot = await getDocs(q);

      // Se não achar nada, erro.
      if (snapshot.empty) {
        throw new Error("Estoque insuficiente ou índice pendente.");
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

  // --- 3. VENDA EM LOTE ---
  async sellItems(skuList, userName = "Venda") {
    if (!skuList || skuList.length === 0) return;

    const batch = writeBatch(db);
    const collectionRef = collection(db, ...INVENTORY_COLLECTION_PATH);

    const counts = {};
    skuList.forEach((sku) => (counts[sku] = (counts[sku] || 0) + 1));

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
          status: "sold",
          soldBy: userName,
          soldTimestamp: serverTimestamp(),
          dateOut: new Date().toLocaleString("pt-BR"),
        });
      });
    }

    await batch.commit();
    return skuList.length;
  },

  // --- 4. CRIAR RESERVA ---
  async createReservation(sku, quantity, userName, note, customerName) {
    const reservationsRef = collection(db, ...RESERVATION_COLLECTION_PATH);

    let legacyNote = note || "";
    if (customerName) {
      legacyNote = legacyNote
        ? `${customerName} - ${legacyNote}`
        : customerName;
    }

    await addDoc(reservationsRef, {
      sku: sku,
      quantity: Number(quantity),
      createdBy: userName,
      createdAt: serverTimestamp(),
      notes: legacyNote,
      customerName: customerName,
      order: {
        customer: {
          name: customerName || "Cliente Reserva",
        },
      },
      status: "pending",
      isManualReservation: true,
    });
  },

  // --- 5. EXCLUIR ITEM INDIVIDUAL (O que estava falhando) ---
  async deleteItem(itemId, isPE, userName) {
    // Monta o caminho exato usando o Array Spread
    // Isso garante que o caminho seja "artifacts/ID/public/data/inventory_items/ITEM_ID"
    const itemRef = doc(db, ...INVENTORY_COLLECTION_PATH, itemId);

    console.log(`InventoryService: Deletando ${itemId}. Modo PE: ${isPE}`);

    if (isPE) {
      // Se for PE, deleta fisicamente
      await deleteDoc(itemRef);
    } else {
      // Se for Físico, baixa logicamente
      await updateDoc(itemRef, {
        status: "adjusted_out",
        outTimestamp: serverTimestamp(),
        dateOut: new Date().toLocaleString("pt-BR"),
        removedBy: userName || "Sistema",
        reason: "manual_deletion_modal",
      });
    }
  },
};
