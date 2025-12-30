// src/hooks/useOrdersData.js
//conhece Firebase

//monta query

//decide coleção

//filtra arquivados

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

export function useOrdersData() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "production_orders"
      ),
      orderBy("createdAt", "desc") // Logística vê do mais novo pro mais antigo
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((d) => !d.archived); // O filtro de arquivados acontece aqui

        setRawData(data);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao buscar pedidos de logística:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { rawData, loading };
}
