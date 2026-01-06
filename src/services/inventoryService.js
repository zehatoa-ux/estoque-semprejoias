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
  addDoc, // Importante para criar a reserva
} from "firebase/firestore";

// Caminho centralizado
const COLLECTION_PATH = `artifacts/${APP_COLLECTION_ID}/public/data/inventory_items`;
const RESERVATION_PATH = `artifacts/${APP_COLLECTION_ID}/public/data/reservations`; // Caminho das reservas

export const inventoryService = {
  // --- 1. IMPORTAR ITENS (Conferência) ---
  async importItems(items, userName = "Conferência") {
    if (!items || items.length === 0) return 0;

    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

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

  // --- 2. AJUSTAR ESTOQUE (Adicionar/Remover manual) ---
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
        orderBy("timestamp", "asc"),
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

  // --- 3. VENDA EM LOTE ---
  async sellItems(skuList, userName = "Venda") {
    if (!skuList || skuList.length === 0) return;

    const batch = writeBatch(db);
    const collectionRef = collection(db, COLLECTION_PATH);

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

      if (snapshot.size < qty) {
        console.warn(`Estoque insuficiente para ${sku}.`);
      }

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

  // --- 4. CRIAR RESERVA (A FUNÇÃO QUE FALTAVA) ---
  // --- 4. CRIAR RESERVA (RETROCOMPATÍVEL) ---
  async createReservation(sku, quantity, userName, note, customerName) {
    const reservationsRef = collection(db, RESERVATION_PATH);

    // TRUQUE DE COMPATIBILIDADE:
    // Se a aba de Reservas antiga só mostra "notes", vamos garantir que o nome
    // do cliente apareça lá também, formatado como "Cliente: Obs".
    let legacyNote = note || "";
    if (customerName) {
      // Se já tiver uma obs, adiciona o nome antes. Se não, vira só o nome.
      legacyNote = legacyNote
        ? `${customerName} - ${legacyNote}`
        : customerName;
    }

    await addDoc(reservationsRef, {
      sku: sku,
      quantity: Number(quantity),
      createdBy: userName,
      createdAt: serverTimestamp(),

      // Campo antigo (para visualização na lista atual)
      notes: legacyNote,

      // Campos novos (para a inteligência de conversão de pedido)
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
};
