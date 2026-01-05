import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

export function useInventory(user) {
  const [inventory, setInventory] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;

    // 1. Listener de Estoque
    const qInventory = query(
      collection(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "inventory_items"
      ),
      orderBy("timestamp", "desc")
    );

    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInventory(items);
    });

    // 2. Listener de Reservas
    const qReservations = query(
      collection(
        db,
        "artifacts",
        APP_COLLECTION_ID,
        "public",
        "data",
        "reservations"
      ),
      orderBy("createdAt", "desc")
    );

    const unsubReservations = onSnapshot(qReservations, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReservations(items);
      setLoading(false); // Assume carregado quando ambos respondem
    });

    return () => {
      unsubInventory();
      unsubReservations();
    };
  }, [user]);

  return { inventory, reservations, loading };
}
