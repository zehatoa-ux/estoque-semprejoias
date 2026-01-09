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
  User,
  Boxes,
  Clipboard,
  ArrowUp, // <--- Importado para a aba Trânsito
} from "lucide-react";

// Mapeamento de Ícones
const TAB_ICONS = {
  stock: ClipboardList,
  conference: Barcode,
  reservations: Bookmark,
  production: Factory,
  orders: Truck,
  transit: ArrowUp, // <--- NOVO ÍCONE
  stock_production: Boxes, // Reusando Factory para Fábrica Estoque (ou pode usar outro)
  sales: Upload,
  reports: Clipboard,
  archived: Archive,
  config: Settings,
};

// Mapeamento de Labels (Define a ordem do menu)
export const TAB_LABELS = {
  stock: "ESTOQUE",
  reservations: "RESERVAS",
  production: "PRODUÇÃO",
  orders: "PEDIDOS LOG.", // <--- NOVA ABA ADICIONADA AQUI
  stock_production: "FÁBRICA ESTOQUE",
  conference: "CONFERÊNCIA",
  sales: "BAIXA",
  archived: "ARQUIVO",
  transit: "TRÂNSITO",
  reports: "LOGS",
  config: "CONFIG",
};

export default function Sidebar({
  user,
  activeTab,
  setActiveTab,
  hasAccess,
  logout,
  isOpen, // Indica se o menu mobile está aberto
  onClose,
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Helper para decidir se mostra texto expandido
  // Mostra se: Está com mouse em cima (Desktop) OU Menu está aberto (Mobile)
  const isExpanded = isHovered || isOpen;

  return (
    <>
      {/* Overlay Escuro para Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* A Barra Lateral */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          fixed top-0 left-0 z-50 h-full bg-slate-900 text-white shadow-xl 
          transform transition-all duration-300 ease-in-out
          
          /* Mobile: Largura fixa */
          w-64 ${isOpen ? "translate-x-0" : "-translate-x-full"}
          
          /* Desktop: Lógica de Hover */
          md:translate-x-0 md:static md:flex md:flex-col
          ${isHovered ? "md:w-64" : "md:w-20"}
        `}
      >
        {/* Cabeçalho (Logo) */}
        <div className="h-16 flex items-center px-4 border-b border-slate-700 overflow-hidden shrink-0 transition-all">
          <div className="flex items-center gap-3 w-full">
            <div className="h-10 w-10 min-w-[2.5rem] bg-white rounded flex items-center justify-center overflow-hidden">
              <img
                src="https://www.semprejoias.com.br/favicon/34692/sjoiasfav.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Texto Logo: Usa isExpanded */}
            <div
              className={`transition-all duration-300 overflow-hidden whitespace-nowrap
                ${
                  isExpanded
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 md:opacity-0"
                }
              `}
            >
              <h1 className="font-bold text-sm leading-tight">GESTÃO</h1>
              <span className="text-[10px] text-slate-400">
                Sempre Joias v0.98
              </span>
            </div>
          </div>

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
              !isExpanded ? "justify-center" : ""
            }`}
          >
            <div className="min-w-[2.5rem] h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
              <User size={20} />
            </div>

            <div
              className={`flex flex-col transition-all duration-300 overflow-hidden whitespace-nowrap
              ${isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 md:hidden"}
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
            // Verifica permissão (quem acessa 'production' acessa 'transit' também, geralmente)
            // Se você quiser uma permissão específica para trânsito, crie no AuthContext.
            // Por enquanto, vou assumir que segue a mesma lógica das outras.
            if (!hasAccess(tab)) {
              // EXCEÇÃO: Se for 'transit', vamos permitir se tiver acesso a 'production' ou 'orders'
              if (
                tab === "transit" &&
                (hasAccess("production") || hasAccess("orders"))
              ) {
                // Permite renderizar
              } else {
                return null;
              }
            }

            const Icon = TAB_ICONS[tab] || ClipboardList;
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  onClose();
                }}
                title={!isExpanded ? TAB_LABELS[tab] : ""}
                className={`
                  w-full flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                  ${!isExpanded ? "justify-center" : "justify-start gap-3"}
                `}
              >
                <Icon size={20} className="shrink-0" />

                <span
                  className={`transition-all duration-300 overflow-hidden whitespace-nowrap
                    ${
                      isExpanded
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
            title={!isExpanded ? "Sair do Sistema" : ""}
            className={`
              w-full flex items-center px-4 py-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-bold
              ${!isExpanded ? "justify-center" : "justify-center gap-2"}
            `}
          >
            <LogOut size={18} className="shrink-0" />
            <span
              className={`transition-all duration-300 overflow-hidden whitespace-nowrap
               ${isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 hidden"}
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
