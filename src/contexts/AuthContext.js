import React, { createContext, useState, useContext, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Credenciais MESTRAS (Hardcoded para segurança anti-lockout)
  const MASTER_USER = {
    username: "admin",
    password: "herozerobirobrum",
    name: "Administrador Master",
    permissions: {
      stock: true,
      conference: true,
      reservations: true,
      sales: true,
      reports: true,
      config: true,
      production: true, // Já prevendo o futuro
    },
  };

  const login = async (username, password) => {
    setLoading(true);
    try {
      // 1. Tenta Login Master
      if (
        username === MASTER_USER.username &&
        password === MASTER_USER.password
      ) {
        setUser({ ...MASTER_USER, role: "master" });
        setLoading(false);
        return { success: true };
      }

      // 2. Tenta Login no Banco de Dados
      if (!db) throw new Error("Sem conexão com banco");

      const q = query(
        collection(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "users"
        ),
        where("username", "==", username),
        where("password", "==", password) // Em produção usaríamos hash, mas para este MVP serve
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        setUser({ ...userData, id: querySnapshot.docs[0].id, role: "user" });
        setLoading(false);
        return { success: true };
      } else {
        setLoading(false);
        return { success: false, message: "Usuário ou senha incorretos." };
      }
    } catch (error) {
      console.error("Erro Login:", error);
      setLoading(false);
      return { success: false, message: "Erro ao conectar." };
    }
  };

  const logout = () => {
    setUser(null);
  };

  // Verifica se o usuário tem permissão para uma aba específica
  const hasAccess = (tabKey) => {
    if (!user) return false;
    if (user.role === "master") return true; // Master acessa tudo
    return user.permissions && user.permissions[tabKey] === true;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasAccess, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
