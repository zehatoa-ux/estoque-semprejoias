import React from "react";
import { Copy, X } from "lucide-react";

export default function TextModal({ title, content, onClose }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    alert("Copiado!");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Copy size={20} />
            <h3 className="font-bold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-1 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 bg-slate-50">
          <textarea
            className="w-full h-64 p-3 font-mono text-xs border border-slate-300 rounded-lg focus:border-blue-500 outline-none resize-none bg-white text-slate-800"
            readOnly
            value={content}
          />
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Copy size={16} /> Copiar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
