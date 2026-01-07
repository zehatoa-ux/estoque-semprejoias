import React, { useState } from "react";
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
  Archive,
  User, // Adicionei ícone de User para quando estiver fechado
} from "lucide-react";

// Mapeamento de Ícones
const TAB_ICONS = {
  stock: ClipboardList,
  conference: Barcode,
  reservations: Bookmark,
  production: Factory,
  orders: Truck,
  sales: Upload,
  reports: BarChart2,
  archived: Archive,
  config: Settings,
};

// Mapeamento de Labels
export const TAB_LABELS = {
  stock: "ESTOQUE",
  reservations: "RESERVAS",
  production: "PRODUÇÃO",
  orders: "PEDIDOS LOG.",
  stock_production: "FÁBRICA ESTOQUE",
  reports: "RELATÓRIOS",
  conference: "CONFERÊNCIA",
  sales: "BAIXA",
  archived: "ARQUIVO",
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
  // Estado para controlar se o mouse está em cima da sidebar (apenas Desktop)
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      {/* Overlay Escuro para Mobile (Mantido igual) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* A Barra Lateral em si */}
      <aside
        // Eventos de Mouse para expandir/retrair
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          fixed top-0 left-0 z-50 h-full bg-slate-900 text-white shadow-xl 
          transform transition-all duration-300 ease-in-out
          
          /* Mobile: Fixo w-64, controla visibilidade com Translate */
          w-64 ${isOpen ? "translate-x-0" : "-translate-x-full"}
          
          /* Desktop: Visível sempre, controla LARGURA com Hover */
          md:translate-x-0 md:static md:flex md:flex-col
          ${isHovered ? "md:w-64" : "md:w-20"}
        `}
      >
        {/* Cabeçalho da Sidebar (Logo) */}
        <div className="h-16 flex items-center px-4 border-b border-slate-700 overflow-hidden shrink-0 transition-all">
          <div className="flex items-center gap-3 w-full">
            <div className="h-10 w-10 min-w-[2.5rem] bg-white rounded flex items-center justify-center overflow-hidden">
              <img
                src="https://www.semprejoias.com.br/favicon/34692/sjoiasfav.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Texto do Logo (Sone com opacidade/width) */}
            <div
              className={`transition-all duration-300 overflow-hidden whitespace-nowrap
                ${
                  isHovered
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 md:opacity-0"
                }
              `}
            >
              <h1 className="font-bold text-sm leading-tight">GESTÃO</h1>
              <span className="text-[10px] text-slate-400">
                Sempre Joias v0.97
              </span>
            </div>
          </div>

          {/* Botão fechar (só mobile) */}
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white ml-auto"
          >
            <X size={24} />
          </button>
        </div>

        {/* Info do Usuário */}
        <div className="p-4 bg-slate-800/50 border-b border-slate-700/50 overflow-hidden shrink-0">
          <div
            className={`flex items-center gap-3 transition-all ${
              !isHovered ? "justify-center" : ""
            }`}
          >
            {/* Ícone de Avatar Sempre Visível */}
            <div className="min-w-[2rem] h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
              <User size={18} />
            </div>

            {/* Detalhes do Usuário (Retrátil) */}
            <div
              className={`flex flex-col transition-all duration-300 overflow-hidden whitespace-nowrap
              ${isHovered ? "opacity-100 w-auto" : "opacity-0 w-0 md:hidden"}
              `}
            >
              <span className="text-xs text-slate-400">Olá,</span>
              <span className="font-bold truncate text-sm">{user?.name}</span>
              {user?.role === "master" && (
                <span className="text-[9px] bg-yellow-500 text-black px-1.5 rounded w-fit font-bold mt-0.5">
                  MASTER
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2 custom-scrollbar overflow-x-hidden">
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
                title={!isHovered ? TAB_LABELS[tab] : ""} // Tooltip nativo quando fechado
                className={`
                  w-full flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                  ${!isHovered ? "justify-center" : "justify-start gap-3"}
                `}
              >
                {/* Ícone fixo */}
                <Icon size={20} className="shrink-0" />

                {/* Texto Retrátil */}
                <span
                  className={`transition-all duration-300 overflow-hidden whitespace-nowrap
                    ${
                      isHovered
                        ? "opacity-100 w-auto translate-x-0"
                        : "opacity-0 w-0 -translate-x-2 absolute"
                    }
                  `}
                >
                  {TAB_LABELS[tab]}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Rodapé (Logout) */}
        <div className="p-4 border-t border-slate-700 shrink-0">
          <button
            onClick={logout}
            title={!isHovered ? "Sair do Sistema" : ""}
            className={`
              w-full flex items-center px-4 py-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-bold
              ${!isHovered ? "justify-center" : "justify-center gap-2"}
            `}
          >
            <LogOut size={18} className="shrink-0" />
            <span
              className={`transition-all duration-300 overflow-hidden whitespace-nowrap
               ${isHovered ? "opacity-100 w-auto" : "opacity-0 w-0 hidden"}
               `}
            >
              Sair
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
