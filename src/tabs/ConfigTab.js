import React, { useState, useEffect } from "react";
import {
  Users,
  Save,
  Trash2,
  Plus,
  RefreshCw,
  AlertTriangle,
  Shield,
  CheckSquare,
  Square,
  Mail,
  Phone,
  Wrench,
  ShieldAlert,
  Flame, // Ícone para o Wipe
} from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// --- MAPEAMENTO DAS PERMISSÕES (ABAS) ---
const AVAILABLE_MODULES = [
  { id: "stock", label: "Estoque (Visualização)" },
  { id: "conference", label: "Conferência (Bipar)" },
  { id: "reservations", label: "Reservas" },
  { id: "production", label: "Produção (Fábrica)" },
  { id: "orders", label: "Logística & Expedição" },
  { id: "sales", label: "Baixa / Vendas" },
  { id: "reports", label: "Relatórios" },
  { id: "config", label: "Configurações (Admin)" },
];

const DATA_PATH = `artifacts/${APP_COLLECTION_ID}/public/data`;

export default function ConfigTab({ handleResetStock }) {
  const [users, setUsers] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false); // Loading global para ações admin

  // Form State
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    role: "user",
    access: [],
  });

  // Carregar usuários
  useEffect(() => {
    const q = query(
      collection(db, "artifacts", APP_COLLECTION_ID, "public", "data", "users"),
      orderBy("name")
    );
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
    return () => unsub();
  }, []);

  // --- FERRAMENTAS ADMIN (NOVAS) ---

  // 1. CORRIGIR DADOS LEGADOS (Adiciona archived: false)
  const handleFixLegacyData = async () => {
    if (
      !window.confirm(
        "Isso vai varrer todos os pedidos antigos e adicionar 'archived: false' para que apareçam nas listas. Continuar?"
      )
    )
      return;

    setLoadingAction(true);
    try {
      const batch = writeBatch(db);
      let count = 0;

      const ref = collection(db, `${DATA_PATH}/production_orders`);
      const snapshot = await getDocs(ref);

      snapshot.docs.forEach((document) => {
        const data = document.data();
        // Se não tiver o campo 'archived', adicionamos false
        if (data.archived === undefined) {
          batch.update(document.ref, {
            archived: false,
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        alert(
          `SUCESSO! ${count} pedidos antigos foram corrigidos e devem aparecer agora.`
        );
        window.location.reload();
      } else {
        alert("Nenhum pedido precisava de correção.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao corrigir: " + error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // 2. WIPE NUCLEAR (Limpar tudo)
  const handleWipeData = async () => {
    const confirmText = prompt(
      "PARA APAGAR TUDO (PEDIDOS, RESERVAS, ESTOQUE), DIGITE: DELETAR TUDO"
    );
    if (confirmText !== "DELETAR TUDO") return alert("Ação cancelada.");

    setLoadingAction(true);
    try {
      const batch = writeBatch(db);
      let count = 0;

      const collectionsToWipe = [
        "production_orders",
        "reservations",
        "inventory_items",
      ];

      for (const colName of collectionsToWipe) {
        const ref = collection(db, `${DATA_PATH}/${colName}`);
        const snapshot = await getDocs(ref);

        snapshot.docs.forEach((document) => {
          batch.delete(doc(db, `${DATA_PATH}/${colName}`, document.id));
          count++;
        });
      }

      await batch.commit();
      alert(
        `WIPE CONCLUÍDO! ${count} registros apagados. O sistema está zerado.`
      );
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Erro ao limpar: " + error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // --- CRUD USUÁRIOS ---

  const handleEdit = (user) => {
    setFormData({
      id: user.id,
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      role: user.role || "user",
      access: user.access || [],
    });
    setIsEditing(true);
  };

  const handleNew = () => {
    setFormData({
      id: null,
      name: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      role: "user",
      access: ["stock"],
    });
    setIsEditing(true);
  };

  const toggleAccess = (moduleId) => {
    setFormData((prev) => {
      const current = new Set(prev.access);
      if (current.has(moduleId)) current.delete(moduleId);
      else current.add(moduleId);
      return { ...prev, access: Array.from(current) };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        access: formData.access,
      };

      if (formData.password && formData.password.trim() !== "") {
        payload.password = formData.password;
      }

      if (formData.id) {
        await updateDoc(
          doc(
            db,
            "artifacts",
            APP_COLLECTION_ID,
            "public",
            "data",
            "users",
            formData.id
          ),
          payload
        );
        alert("Usuário atualizado!");
      } else {
        if (!formData.password)
          return alert("Senha é obrigatória para novos usuários.");
        await addDoc(
          collection(
            db,
            "artifacts",
            APP_COLLECTION_ID,
            "public",
            "data",
            "users"
          ),
          payload
        );
        alert("Usuário criado!");
      }
      setIsEditing(false);
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", APP_COLLECTION_ID, "public", "data", "users", id)
      );
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      {/* SEÇÃO DE SISTEMA (PERIGO & MANUTENÇÃO) */}
      <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm">
        <h3 className="text-lg font-bold text-red-700 flex items-center gap-2 mb-4">
          <AlertTriangle size={20} /> Zona de Manutenção & Perigo
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. RESETAR ESTOQUE (Existente) */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex flex-col justify-between gap-3">
            <div>
              <h4 className="font-bold text-red-900 flex items-center gap-2">
                <RefreshCw size={16} /> Resetar Estoque
              </h4>
              <p className="text-xs text-red-700 mt-1">
                Apaga itens "in_stock". Mantém vendas.
              </p>
            </div>
            <button
              onClick={handleResetStock}
              disabled={loadingAction}
              className="w-full bg-white border border-red-300 text-red-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-colors"
            >
              Executar Reset
            </button>
          </div>

          {/* 2. CORRIGIR LEGADO (Novo) */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col justify-between gap-3">
            <div>
              <h4 className="font-bold text-blue-900 flex items-center gap-2">
                <Wrench size={16} /> Corrigir Legado
              </h4>
              <p className="text-xs text-blue-700 mt-1">
                Faz pedidos antigos aparecerem nas listas.
              </p>
            </div>
            <button
              onClick={handleFixLegacyData}
              disabled={loadingAction}
              className="w-full bg-white border border-blue-300 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-colors"
            >
              {loadingAction ? "Processando..." : "Rodar Correção"}
            </button>
          </div>

          {/* 3. WIPE TOTAL (Novo) */}
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col justify-between gap-3">
            <div>
              <h4 className="font-bold text-white flex items-center gap-2">
                <Flame size={16} className="text-orange-500" /> WIPE TOTAL
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Apaga TUDO (Estoque, Pedidos, Reservas). Cuidado!
              </p>
            </div>
            <button
              onClick={handleWipeData}
              disabled={loadingAction}
              className="w-full bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-lg border border-red-500"
            >
              {loadingAction ? "Apagando..." : "DELETAR BANCO"}
            </button>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE USUÁRIOS (MANTIDA IGUAL) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-blue-600" /> Gestão de Usuários
            </h3>
            <p className="text-sm text-slate-500">
              Controle quem acessa cada módulo do sistema.
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={handleNew}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus size={18} /> Novo Usuário
            </button>
          )}
        </div>

        <div className="p-6">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* DADOS BÁSICOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Login (Username)
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* CONTATO (NOVO) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <Mail size={12} /> Email
                  </label>
                  <input
                    type="email"
                    className="w-full p-2 border rounded"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="exemplo@semprejoias.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <Phone size={12} /> Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* SEGURANÇA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Senha {formData.id && "(Deixe vazio para manter)"}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="******"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nível de Acesso
                  </label>
                  <select
                    className="w-full p-2 border rounded bg-white"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    <option value="user">Usuário Comum</option>
                    <option value="master">Master / Admin</option>
                  </select>
                </div>
              </div>

              {/* PERMISSÕES */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Shield size={16} /> Permissões de Acesso
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {AVAILABLE_MODULES.map((mod) => {
                    const hasAccess = formData.access.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleAccess(mod.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          hasAccess
                            ? "bg-blue-50 border-blue-300"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`text-blue-600 ${
                            hasAccess ? "opacity-100" : "opacity-30"
                          }`}
                        >
                          {hasAccess ? (
                            <CheckSquare size={20} />
                          ) : (
                            <Square size={20} />
                          )}
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            hasAccess ? "text-blue-800" : "text-slate-500"
                          }`}
                        >
                          {mod.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2 border rounded text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 flex items-center gap-2"
                >
                  <Save size={18} /> Salvar Usuário
                </button>
              </div>
            </form>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b">
                  <tr>
                    <th className="px-4 py-3">Nome / Email</th>
                    <th className="px-4 py-3">Login</th>
                    <th className="px-4 py-3">Função</th>
                    <th className="px-4 py-3">Acessos</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700">{u.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.username}</td>
                      <td className="px-4 py-3">
                        {u.role === "master" ? (
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">
                            MASTER
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                            USUÁRIO
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.access &&
                            u.access.map((acc) => (
                              <span
                                key={acc}
                                className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase"
                              >
                                {AVAILABLE_MODULES.find(
                                  (m) => m.id === acc
                                )?.label.split(" ")[0] || acc}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(u)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
