import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";
import { archiveService } from "../services/archiveService";

const PAGE_SIZE = 20;
const DATA_PATH = `artifacts/${APP_COLLECTION_ID}/public/data`;

export function useArchivedPagination() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Controle de Busca e Paginação
  const [lastDoc, setLastDoc] = useState(null);
  const [pageHistory, setPageHistory] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [isSearching, setIsSearching] = useState(false); // Estado para saber se estamos em modo busca

  // --- BUSCA INICIAL / PAGINAÇÃO ---
  const fetchOrders = async (direction = "initial") => {
    setLoading(true);
    setIsSearching(false); // Garante que estamos no modo lista
    try {
      const collectionRef = collection(db, `${DATA_PATH}/production_orders`);

      let q = query(
        collectionRef,
        where("archived", "==", true),
        orderBy("createdAt", "desc"), // Garanta que o índice archived + createdAt (desc) existe!
        limit(PAGE_SIZE)
      );

      // Lógica de cursor (Next/Prev)
      if (direction === "next" && lastDoc) {
        q = query(
          collectionRef,
          where("archived", "==", true),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      } else if (direction === "prev" && pageHistory.length > 1) {
        const targetStartAfter = pageHistory[pageNumber - 2] || null;
        if (targetStartAfter) {
          q = query(
            collectionRef,
            where("archived", "==", true),
            orderBy("createdAt", "desc"),
            startAfter(targetStartAfter),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(
            collectionRef,
            where("archived", "==", true),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
          );
        }
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      setOrders(data);

      // Atualiza cursores
      if (!snapshot.empty) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        if (direction === "next") {
          setPageHistory((prev) => [
            ...prev,
            snapshot.docs[snapshot.docs.length - 1],
          ]);
          setPageNumber((prev) => prev + 1);
        } else if (direction === "initial") {
          setPageHistory([null]);
          setPageNumber(1);
        } else if (direction === "prev") {
          setPageHistory((prev) => prev.slice(0, -1));
          setPageNumber((prev) => prev - 1);
        }
      }
    } catch (error) {
      console.error("Erro paginação:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÃO DE DISPARO DA BUSCA (MANUAL) ---
  const triggerSearch = async (term) => {
    if (!term || term.trim().length === 0) {
      fetchOrders("initial"); // Se limpar, volta ao normal
      return;
    }

    setIsSearching(true); // Entra em modo busca
    setLoading(true);
    try {
      const results = await archiveService.searchOrders(term);
      setOrders(results);
    } catch (error) {
      console.error("Erro na busca:", error);
      alert("Erro ao buscar. Verifique o console para criar os índices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders("initial");
  }, []);

  return {
    orders,
    loading,
    nextPage: () => fetchOrders("next"),
    prevPage: () => fetchOrders("prev"),
    pageNumber,
    hasMore: orders.length === PAGE_SIZE,
    triggerSearch, // <--- Agora expomos essa função
    isSearching,
    refresh: () => fetchOrders("initial"),
  };
}
