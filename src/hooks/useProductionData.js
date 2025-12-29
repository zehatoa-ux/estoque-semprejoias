// src/hooks/useProductionData.js
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// --- HOOK 1: ESCUTAR PEDIDOS ---
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
      orderBy("createdAt", "asc")
    );

    // Escuta em tempo real
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      setOrders(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar pedidos:", error);
      setLoading(false);
    });

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