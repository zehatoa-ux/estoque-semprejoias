import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Trash2,
  UserPlus,
  Save,
  Users,
  CheckSquare,
  Square,
  Edit,
} from "lucide-react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { APP_COLLECTION_ID } from "../config/constants";

// Máscara de Telefone: 11 - 99999 - 9999
const formatPhone = (value) => {
  if (!value) return "";
  const v = value.replace(/\D/g, ""); // Remove tudo que não é dígito
  if (v.length <= 2) return v;
  if (v.length <= 7) return `${v.slice(0, 2)} - ${v.slice(2)}`;
  return `${v.slice(0, 2)} - ${v.slice(2, 7)} - ${v.slice(7, 11)}`;
};

export default function ConfigTab({ handleResetStock }) {
  const [users, setUsers] = useState([]);
  const [view, setView] = useState("list"); // 'list' ou 'form'
  const [editingId, setEditingId] = useState(null); // ID do usuário sendo editado

  // Form State
  const initialFormState = {
    name: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    permissions: {
      stock: false,
      conference: false,
      reservations: false,
      sales: false,
      reports: false,
      config: false,
      production: false,
    },
  };
  const [formData, setFormData] = useState(initialFormState);

  // Carregar Usuários
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "artifacts", APP_COLLECTION_ID, "public", "data", "users")
    );
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreateNew = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setView("form");
  };

  const handleEditUser = (user) => {
    setEditingId(user.id);
    setFormData({
      name: user.name,
      phone: user.phone,
      email: user.email,
      username: user.username,
      password: user.password,
      permissions: {
        ...initialFormState.permissions,
        ...(user.permissions || {}),
      },
    });
    setView("form");
  };

  const handleSaveUser = async () => {
    if (!formData.name || !formData.username || !formData.password)
      return alert("Preencha os campos obrigatórios (Nome, Usuário e Senha)");

    try {
      if (editingId) {
        // MODO EDIÇÃO: Atualiza o existente
        await updateDoc(
          doc(
            db,
            "artifacts",
            APP_COLLECTION_ID,
            "public",
            "data",
            "users",
            editingId
          ),
          formData
        );
        alert("Usuário atualizado com sucesso!");
      } else {
        // MODO CRIAÇÃO: Cria um novo
        await addDoc(
          collection(
            db,
            "artifacts",
            APP_COLLECTION_ID,
            "public",
            "data",
            "users"
          ),
          formData
        );
        alert("Novo usuário cadastrado!");
      }

      setView("list");
      setFormData(initialFormState);
      setEditingId(null);
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (
      window.confirm(
        "Tem certeza que deseja remover este usuário permanentemente?"
      )
    ) {
      try {
        await deleteDoc(
          doc(db, "artifacts", APP_COLLECTION_ID, "public", "data", "users", id)
        );
      } catch (e) {
        alert("Erro ao deletar: " + e.message);
      }
    }
  };

  const togglePermission = (key) => {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* --- BLOCO DE ZONA DE PERIGO --- */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-red-100 p-2 rounded-full text-red-600">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="font-bold text-red-800">Zona de Perigo</h3>
            <p className="text-xs text-red-600">
              Apagar todo o banco de dados de estoque.
            </p>
          </div>
        </div>
        <button
          onClick={handleResetStock}
          className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50"
        >
          ZERAR ESTOQUE
        </button>
      </div>

      {/* --- GESTÃO DE USUÁRIOS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-blue-600" /> Gestão de Usuários
          </h2>
          {view === "list" && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={18} /> Novo Usuário
            </button>
          )}
        </div>

        {view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Telefone</th>
                  <th className="px-6 py-4 text-center">Permissões</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {u.name}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{u.username}</td>
                    <td className="px-6 py-3 font-mono text-xs">
                      {u.phone || "-"}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                        {
                          Object.values(u.permissions || {}).filter(Boolean)
                            .length
                        }{" "}
                        Abas
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar Usuário"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir Usuário"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      Nenhum usuário cadastrado (apenas Admin Master).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 bg-slate-50">
            <h3 className="font-bold text-slate-700 mb-4">
              {editingId ? "Editar Usuário" : "Novo Usuário"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg"
                  placeholder="Ex: Sabrina Silva"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Telefone (Celular)
                </label>
                {/* MUDANÇA AQUI: maxLength ajustado para 17 caracteres */}
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: formatPhone(e.target.value),
                    })
                  }
                  className="w-full p-2 border rounded-lg"
                  placeholder="11 - 99999 - 9999"
                  maxLength={17}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/\s/g, ""),
                      })
                    }
                    className="w-full p-2 border rounded-lg"
                    placeholder="sabrina"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Senha *
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg"
                    placeholder="senha123"
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 mb-3 uppercase">
                Controle de Acesso (Abas)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { k: "stock", label: "Estoque" },
                  { k: "conference", label: "Conferência" },
                  { k: "reservations", label: "Reservas" },
                  { k: "sales", label: "Baixa" },
                  { k: "reports", label: "Relatórios" },
                  { k: "config", label: "Config / Usuários" },
                  { k: "production", label: "Produção (Futuro)" },
                ].map((item) => (
                  <div
                    key={item.k}
                    onClick={() => togglePermission(item.k)}
                    className={`cursor-pointer border rounded-lg p-3 flex items-center gap-3 transition-colors ${
                      formData.permissions[item.k]
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    {formData.permissions[item.k] ? (
                      <CheckSquare size={20} className="text-blue-600" />
                    ) : (
                      <Square size={20} className="text-slate-300" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        formData.permissions[item.k]
                          ? "text-blue-800"
                          : "text-slate-600"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setView("list")}
                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Save size={18} />{" "}
                {editingId ? "Atualizar Usuário" : "Salvar Usuário"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
