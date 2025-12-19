import React from "react";
import { ShieldAlert } from "lucide-react";

export default function ConflictModal({
  data,
  onConfirmForce,
  onConfirmSafe,
  onCancel,
}) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-8 border-4 border-red-500">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <ShieldAlert size={32} />
          <h3 className="text-2xl font-bold">Conflito de Reserva!</h3>
        </div>
        <p className="text-slate-600 mb-6">
          Atenção! Os seguintes itens possuem reservas ativas e a baixa vai
          consumir o estoque reservado:
        </p>
        <div className="bg-red-50 p-4 rounded-lg mb-6 border border-red-100 max-h-40 overflow-y-auto">
          {data.conflicts.map((c, i) => (
            <div
              key={i}
              className="flex justify-between items-center text-sm mb-2 last:mb-0"
            >
              <span className="font-bold text-slate-800">{c.sku}</span>
              <span className="text-red-600">
                Solicitado: {c.req} | Livre: {c.avail}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onConfirmForce(data.lines)}
            className="w-full py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
          >
            SIM PARA TODOS (Baixar inclusive reservados)
          </button>
          <button
            onClick={() => {
              const safeList = [];
              data.safe.forEach((s) => {
                for (let k = 0; k < s.qty; k++) safeList.push(s.sku);
              });
              onConfirmSafe(safeList);
            }}
            className="w-full py-3 rounded-lg bg-slate-200 text-slate-700 font-bold hover:bg-slate-300"
          >
            NÃO (Pular itens conflitantes)
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm font-medium"
          >
            Cancelar Operação
          </button>
        </div>
      </div>
    </div>
  );
}
