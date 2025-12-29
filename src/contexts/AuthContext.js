import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Chave para salvar a sessão no navegador
  const SESSION_KEY = `@semprejoias:user_v2`;

  useEffect(() => {
    // Ao iniciar, tenta recuperar o usuário salvo no localStorage
    const storedUser = localStorage.getItem(SESSION_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  // --- FUNÇÃO DE LOGIN ---
  const login = async (username, password) => {
    try {
      if (!username || !password) {
        return { success: false, message: "Preencha todos os campos." };
      }

      // Busca o usuário no Firestore pelo username
      const q = query(
        collection(
          db,
          "artifacts",
          APP_COLLECTION_ID,
          "public",
          "data",
          "users"
        ),
        where("username", "==", username)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, message: "Usuário não encontrado." };
      }

      // Pega o primeiro documento encontrado
      const docSnap = querySnapshot.docs[0];
      const userData = { id: docSnap.id, ...docSnap.data() };

      // Verificação simples de senha
      if (userData.password && userData.password !== password) {
        return { success: false, message: "Senha incorreta." };
      }

      // MONTA O OBJETO DE SESSÃO LIMPO
      const sessionUser = {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        role: userData.role || "user",
        access: userData.access || [],
      };

      // Salva no estado e no navegador
      setUser(sessionUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

      return { success: true };
    } catch (error) {
      console.error("Erro no login:", error);
      return { success: false, message: "Erro de conexão com o servidor." };
    }
  };

  // --- FUNÇÃO DE LOGOUT ---
  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  };

  // --- VERIFICAÇÃO DE PERMISSÃO ---
  const hasAccess = (moduleKey) => {
    if (!user) return false;

    // 1. Se for MASTER, tem acesso a tudo.
    if (user.role === "master") return true;

    // 2. Se o array de acesso não existir, bloqueia
    if (!Array.isArray(user.access)) return false;

    // 3. Verifica se a chave da aba está no array
    return user.access.includes(moduleKey);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    hasAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
