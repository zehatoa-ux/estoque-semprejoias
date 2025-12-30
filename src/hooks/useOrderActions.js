// src/hooks/useOrderActions.js
import { ordersService } from "../services/ordersService";

export function useOrderActions() {
  // --- 1. MUDAR STATUS LOGÍSTICO (LOTE) ---
  const updateLogisticsStatus = async (group, newStatus) => {
    if (!window.confirm(`Mudar pedido ${group.orderNumber} para ${newStatus}?`))
      return;

    try {
      await ordersService.updateLogisticsStatusBatch(
        group.referenceIds,
        newStatus
      );
      // Opcional: Feedback visual ou toast aqui
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // --- 2. MUDAR STATUS DE ITEM INDIVIDUAL ---
  const updateItemStatus = async (itemId, newStatus) => {
    if (!window.confirm("Confirmar alteração de status de produção?")) return;

    try {
      await ordersService.updateItemStatus(itemId, newStatus);
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // --- 3. EXCLUIR PEDIDO (LOTE) ---
  const deleteOrder = async (group) => {
    if (
      !window.confirm(
        `ATENÇÃO: Isso apagará DEFINITIVAMENTE o pedido #${group.orderNumber} e seus ${group.items.length} itens.\n\nTem certeza?`
      )
    )
      return;

    try {
      await ordersService.deleteOrderBatch(group.referenceIds);
      alert("Pedido excluído permanentemente.");
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // --- 4. ARQUIVAR PEDIDO (LOTE) ---
  const archiveOrder = async (group) => {
    if (
      !window.confirm(
        `Arquivar o pedido #${group.orderNumber}? Ele sairá desta tela.`
      )
    )
      return;

    try {
      await ordersService.archiveOrderBatch(group.referenceIds);
      // Não precisa de alert, some da tela automaticamente
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // --- 5. ATUALIZAR DADOS GERAIS (O Editzão) ---
  // Retorna true se deu certo, para a UI saber se fecha o modal ou não
  const saveOrderDetails = async (items, newData) => {
    if (!window.confirm(`Atualizar dados de ${items.length} itens?`))
      return false;

    try {
      await ordersService.updateOrderDetailsBatch(items, newData);
      alert("Dados do pedido atualizados com sucesso!");
      return true;
    } catch (e) {
      alert("Erro: " + e.message);
      return false;
    }
  };

  // --- 6. SALVAR SPECS DO ITEM ---
  const saveItemSpecs = async (item, updatedData) => {
    try {
      await ordersService.updateItemSpecs(item.id, updatedData.specs);
      alert("Item atualizado! Status alterado para PEDIDO MODIFICADO.");
      return true;
    } catch (error) {
      alert("Erro: " + error.message);
      return false;
    }
  };

  // --- 7. MOVER ITEM ---
  const moveItem = async (itemId, targetOrderData) => {
    try {
      await ordersService.moveItemToOrder(itemId, targetOrderData);
      return true;
    } catch (e) {
      alert("Erro: " + e.message);
      return false;
    }
  };

  // --- 8. MARCAR IMPRESSOS ---
  const markAsPrinted = async (itemsToPrint) => {
    try {
      await ordersService.markCertificatesPrinted(itemsToPrint);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return {
    updateLogisticsStatus,
    updateItemStatus,
    deleteOrder,
    archiveOrder,
    saveOrderDetails,
    saveItemSpecs,
    moveItem,
    markAsPrinted,
  };
}
