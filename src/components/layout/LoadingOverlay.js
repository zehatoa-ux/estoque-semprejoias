import React from "react";
import { Loader2 } from "lucide-react";

export default function LoadingOverlay({ message = "Carregando..." }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center animate-fade-in">
      <div className="relative">
        {/* Efeito de "Pulse" atrás do loader */}
        <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-75"></div>
        <div className="relative bg-white p-6 rounded-full shadow-xl border border-purple-100">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        </div>
      </div>

      <h2 className="mt-8 text-2xl font-bold text-slate-800 animate-pulse tracking-tight">
        {message}
      </h2>
      <p className="text-sm text-slate-400 mt-2 font-medium">
        Preparando o sistema...
      </p>
    </div>
  );
}
