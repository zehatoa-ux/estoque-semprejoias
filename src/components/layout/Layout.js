import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

export default function Layout({
  children,
  user,
  activeTab,
  setActiveTab,
  hasAccess,
  logout,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* Sidebar (Gerencia sua própria responsividade) */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasAccess={hasAccess}
        logout={logout}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Área Principal */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Header Mobile (Aparece apenas em telas pequenas) */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <span className="font-bold text-sm">GESTÃO SJ</span>
          </div>
          {/* Se quiser colocar algo na direita mobile, põe aqui */}
        </header>

        {/* Conteúdo (Scrollável) */}
        <main className="flex-1 overflow-auto p-2 md:p-4 w-full">
          <div className="w-full h-full">
            {/* w-full garante que use 100% da largura disponível */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
