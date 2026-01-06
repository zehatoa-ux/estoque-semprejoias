// src/hooks/useProductionData.js
import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  where,
} from "firebase/firestore"; // <--- ADICIONEI 'where'
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// --- HOOK 1: ESCUTAR PEDIDOS (BLINDADO CONTRA ARQUIVADOS) ---
export function useProductionOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;

    // Definição da Query
    const q = query(
      collection(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders"
      ),
      where("archived", "!=", true), // <--- O FILTRO MÁGICO AQUI
      orderBy("createdAt", "asc")
    );

    // Escuta em tempo real
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        setOrders(data);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao buscar pedidos:", error);

        // Dica Pro: Se der erro de índice no console, avisa pra clicar no link
        if (error.code === "failed-precondition") {
          console.warn(
            "⚠️ FALTA ÍNDICE NO FIREBASE: Clique no link do console para criar o índice composto (archived + createdAt)."
          );
        }

        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { orders, loading };
}
// --- HOOK 2: ESCUTAR ESTATÍSTICAS ---
export function useProductionStats() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (!db) return;

    const statsRef = doc(
      db,
      "artifacts",
      APP_COLLECTION_ID,
      "public",
      "data",
      "statistics",
      "production_monthly"
    );

    const unsub = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data());
      }
    });

    return () => unsub();
  }, []);

  return stats;
}
