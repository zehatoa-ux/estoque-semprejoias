import React, { useState } from "react";
import { Lock, User, Key } from "lucide-react";

export default function LoginScreen({ onLoginAttempt, error, loading }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onLoginAttempt(username, password);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={40} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Sempre Joias</h1>
        <p className="text-slate-500 mb-6 text-sm">
          Controle de Estoque & Produção
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
              Usuário
            </label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: admin"
                className="w-full pl-10 p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
              Senha
            </label>
            <div className="relative">
              <Key size={18} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pl-10 p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg text-center border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-200"
          >
            {loading ? "ENTRANDO..." : "ACESSAR SISTEMA"}
          </button>
        </form>
      </div>
    </div>
  );
}
