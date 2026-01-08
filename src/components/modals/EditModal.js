import React, { useState, useEffect } from "react";
import { Minus, Plus, Trash2, X, Loader2, AlertTriangle } from "lucide-react";
import { inventoryService } from "../../services/inventoryService";
import { reservationsService } from "../../services/reservationsService";

// Adicionei onDelete nas props
export default function EditModal({ isOpen, data, onClose, onDelete }) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentQty, setCurrentQty] = useState(0);

  useEffect(() => {
    if (data) {
      // Usa qtyReal se existir (para estoque físico), senão quantity total
      setCurrentQty(
        data.qtyReal !== undefined ? data.qtyReal : data.quantity || 0
      );
    }
  }, [data]);

  if (!isOpen || !data) return null;

  // --- 1. AJUSTAR QUANTIDADE ---
  const handleQuantityAdjust = async (delta) => {
    try {
      setIsLoading(true);

      // Chama o serviço passando o SKU
      await inventoryService.adjustQuantity(data.sku, delta, "Admin/Manual");

      // Atualiza visualmente
      setCurrentQty((prev) => prev + delta);
    } catch (error) {
      console.error(error);
      alert("Erro ao ajustar estoque: " + error.message);
      // Se deu erro (ex: estoque insuficiente), reverta o visual ou feche
      // Opcional: onClose();
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. EXCLUIR TUDO (LIXEIRA) ---
  const handleDeleteAll = async () => {
    try {
      setIsLoading(true);

      // A. Verificação de Reserva (Regra de Negócio)
      const hasReservation = await reservationsService.hasPendingReservations(
        data.sku
      );

      if (hasReservation) {
        alert(
          "OPERAÇÃO BLOQUEADA!\n\n" +
            "Existem reservas ativas para este SKU.\n" +
            "Vá na aba 'Reservas' e resolva as pendências antes de excluir."
        );
        return;
      }

      // B. Deleção
      // Se a prop onDelete foi passada (pela StockTab), usamos ela!
      // A StockTab sabe os IDs exatos dos itens para deletar.
      if (onDelete && data.entries && data.entries.length > 0) {
        // Deleta o primeiro item da lista (LIFO ou FIFO depende do sort da tab)
        // Ou podemos implementar uma lógica de "Deletar em lote" aqui se quiser zerar tudo.
        // Por enquanto, vamos deletar UM item como exemplo, ou loopar para deletar todos.

        // PERGUNTA DE UX: O botão diz "Excluir Tudo".
        // Se for para zerar o estoque, usamos o adjustQuantity com delta negativo total.
        // Se for para remover o cadastro visual, precisamos deletar todos os itens.

        // VAMOS ASSUMIR QUE É "ZERAR ESTOQUE" (Mais seguro)
        await inventoryService.adjustQuantity(
          data.sku,
          -currentQty,
          "Admin/Lixeira"
        );
        setCurrentQty(0);
        alert("Estoque zerado com sucesso.");
        onClose();
      } else {
        // Fallback se não tiver onDelete (código legado)
        alert("Erro de configuração: Função de deletar não encontrada.");
      }
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
            <Trash2 size={18} /> Zerar Estoque (Lixeira)
          </button>
          <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
            <AlertTriangle size={10} /> Verifica reservas automaticamente
          </p>
        </div>
      </div>
    </div>
  );
}
