import React from "react";

export default function SalesTab({ salesInput, setSalesInput, processSales }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold mb-4">Baixa em Massa</h2>
      <textarea
        value={salesInput}
        onChange={(e) => setSalesInput(e.target.value)}
        placeholder={`Cole SKUs aqui...\nDIR-NAV-Z-16\n...`}
        className="w-full p-4 border rounded-xl font-mono text-sm h-48 mb-4 bg-slate-50"
      />
      <button
        onClick={processSales}
        disabled={!salesInput}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
      >
        BAIXAR ITENS
      </button>
    </div>
  );
}
