import React, { useState, useEffect } from "react";
import { Minus, Plus, Trash2, X, Loader2, AlertTriangle } from "lucide-react";
import { inventoryService } from "../../services/inventoryService";
import { reservationsService } from "../../services/reservationsService";

export default function EditModal({ isOpen, data, onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  // NOVO: Estado local para atualizar o número na hora, visualmente
  const [currentQty, setCurrentQty] = useState(0);

  // Sincroniza o estado local sempre que o modal abrir ou receber dados novos
  useEffect(() => {
    if (data) {
      setCurrentQty(data.displayQuantity || data.quantity || 0);
    }
  }, [data]);

  if (!isOpen || !data) return null;

  // Handler para Adicionar/Remover 1 unidade
  const handleQuantityAdjust = async (delta) => {
    try {
      setIsLoading(true);

      // 1. Chama o serviço (Banco de Dados)
      await inventoryService.adjustQuantity(data.sku, delta, "Admin/Manual");

      // 2. Atualiza a tela imediatamente (Visual)
      // Isso dá a sensação de rapidez enquanto o Firebase processa no fundo
      setCurrentQty((prev) => prev + delta);
    } catch (error) {
      console.error(error); // Ajuda a ver o erro no console se houver
      alert("Erro ao ajustar estoque: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Seguro de Exclusão
  const handleDeleteAll = async () => {
    if (
      !window.confirm(
        `ATENÇÃO: Deseja excluir TODOS os ${currentQty} itens do estoque?`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);

      // 1. O GUARDIÃO: Verifica se existe reserva
      const hasReservation = await reservationsService.hasPendingReservations(
        data.sku
      );

      if (hasReservation) {
        alert(
          "OPERAÇÃO BLOQUEADA!\n\n" +
            "Existem reservas ativas para este SKU.\n" +
            "Você não pode excluir o estoque físico enquanto houver clientes esperando.\n\n" +
            "Vá na aba 'Reservas', converta ou cancele as reservas antes de excluir o item."
        );
        return;
      }

      // 2. Executa a exclusão
      await inventoryService.deleteItem(data.sku, "Admin/Manual");
      onClose();
    } catch (error) {
      alert("Erro ao excluir: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-600" size={48} />
          </div>
        )}

        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Ajustar Estoque
            </h3>
            <p className="text-sm text-slate-500 font-mono">{data.sku}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 mb-8">
          <button
            onClick={() => handleQuantityAdjust(-1)}
            disabled={isLoading || currentQty <= 0}
            className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <Minus size={32} />
          </button>

          <div className="text-center min-w-[80px]">
            {/* AGORA USAMOS currentQty AO INVÉS DE data.quantity */}
            <span className="block text-4xl font-bold text-slate-800 tracking-tighter">
              {currentQty}
            </span>
            <span className="text-xs text-slate-400 uppercase font-bold">
              Atual
            </span>
          </div>

          <button
            onClick={() => handleQuantityAdjust(1)}
            disabled={isLoading}
            className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors disabled:opacity-50"
          >
            <Plus size={32} />
          </button>
        </div>

        <div className="border-t pt-4">
          <button
            onClick={handleDeleteAll}
            disabled={isLoading || currentQty <= 0}
            className="w-full py-3 rounded-xl border-2 border-red-100 text-red-600 font-bold hover:bg-red-50 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              "Processando..."
            ) : (
              <>
                <Trash2 size={18} /> Excluir Tudo (Lixeira)
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
            <AlertTriangle size={10} /> Verifica reservas automaticamente
          </p>
        </div>
      </div>
    </div>
  );
}
