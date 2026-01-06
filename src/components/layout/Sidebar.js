import React from "react";
import {
  ClipboardList,
  Barcode,
  Bookmark,
  Factory,
  Truck,
  Upload,
  BarChart2,
  Settings,
  LogOut,
  X,
  Menu,
} from "lucide-react";

// Mapeamento de Ícones para facilitar
const TAB_ICONS = {
  stock: ClipboardList,
  conference: Barcode,
  reservations: Bookmark,
  production: Factory,
  orders: Truck,
  sales: Upload,
  reports: BarChart2,
  config: Settings,
};

// Mapeamento de Labels (se quiser centralizar aqui ou receber via props)
export const TAB_LABELS = {
  stock: "ESTOQUE",
  conference: "CONFERÊNCIA",
  reservations: "RESERVAS",
  production: "PRODUÇÃO",
  orders: "PEDIDOS LOG.",
  sales: "BAIXA",
  reports: "RELATÓRIOS",
  config: "CONFIG",
};

export default function Sidebar({
  user,
  activeTab,
  setActiveTab,
  hasAccess,
  logout,
  isOpen,
  onClose,
}) {
  return (
    <>
      {/* Overlay Escuro para Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* A Barra Lateral em si */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white shadow-xl transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:flex md:flex-col
        `}
      >
        {/* Cabeçalho da Sidebar (Logo) */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-white rounded flex items-center justify-center overflow-hidden">
              <img
                src="https://cdn.iset.io/assets/34692/imagens/mkt.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">GESTÃO</h1>
              <span className="text-[10px] text-slate-400">
                Sempre Joias v0.96
              </span>
            </div>
          </div>
          {/* Botão fechar (só mobile) */}
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Info do Usuário */}
        <div className="p-4 bg-slate-800/50">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Logado como:</span>
            <span className="font-bold truncate">{user?.name}</span>
            {user?.role === "master" && (
              <span className="text-[10px] bg-yellow-500 text-black px-1.5 rounded w-fit font-bold mt-1">
                MASTER
              </span>
            )}
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2 custom-scrollbar">
          {Object.keys(TAB_LABELS).map((tab) => {
            if (!hasAccess(tab)) return null;

            const Icon = TAB_ICONS[tab] || ClipboardList;
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  onClose(); // Fecha menu no mobile ao clicar
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-all
                  ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                <Icon size={18} />
                <span>{TAB_LABELS[tab]}</span>
              </button>
            );
          })}
        </nav>

        {/* Rodapé (Logout) */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-bold"
          >
            <LogOut size={16} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>
    </>
  );
}
