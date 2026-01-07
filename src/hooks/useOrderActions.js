// src/hooks/useOrderActions.js
import { ordersService } from "../services/ordersService";
import { logAction, MODULES, getSafeUser } from "../services/logService"; //


export function useOrderActions(user) {
  // --- 1. MUDAR STATUS LOGÍSTICO (LOTE) ---
  const updateLogisticsStatus = async (group, newStatus) => {
    if (!window.confirm(`Mudar pedido ${group.orderNumber} para ${newStatus}?`))
      return;

    try {
      await ordersService.updateLogisticsStatusBatch(
        group.referenceIds,
        newStatus
      );

      // LOG DE MUDANÇA DE STATUS
      logAction(
        getSafeUser(user),
        MODULES.PEDIDOS,
        "MUDANCA_STATUS_LOGISTICA",
        `Moveu pedido #${group.orderNumber} para ${newStatus}`,
        {
          orderNumber: group.orderNumber,
          newStatus: newStatus,
          count: group.referenceIds.length,
        }
      );
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // --- 2. MUDAR STATUS DE ITEM INDIVIDUAL ---
  const updateItemStatus = async (itemId, newStatus) => {
    if (!window.confirm("Confirmar alteração de status de produção?")) return;

    try {
      await ordersService.updateItemStatus(itemId, newStatus);

      // LOG DE ITEM INDIVIDUAL
      logAction(
        getSafeUser(user),
        MODULES.PRODUCAO,
        "MUDANCA_STATUS_ITEM",
        `Atualizou item para ${newStatus}`,
        { itemId, newStatus }
      );
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

      // LOG DE EXCLUSÃO FATAL
      logAction(
        getSafeUser(user),
        MODULES.PEDIDOS,
        "EXCLUSAO_FATAL",
        `Excluiu definitivamente o pedido #${group.orderNumber}`,
        { orderNumber: group.orderNumber, itemCount: group.items.length }
      );

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

      // LOG DE ARQUIVAMENTO
      logAction(
        getSafeUser(user),
        MODULES.PEDIDOS,
        "ARQUIVAR",
        `Arquivou pedido #${group.orderNumber}`,
        { orderNumber: group.orderNumber }
      );
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // --- 5. ATUALIZAR DADOS GERAIS (O Editzão) ---
  const saveOrderDetails = async (items, newData) => {
    if (!window.confirm(`Atualizar dados de ${items.length} itens?`))
      return false;

    try {
      await ordersService.updateOrderDetailsBatch(items, newData);

      // LOG DE EDIÇÃO
      logAction(
        getSafeUser(user),
        MODULES.PEDIDOS,
        "EDICAO_DADOS",
        `Editou dados do pedido #${newData.orderNumber}`,
        {
          orderNumber: newData.orderNumber,
          changedFields: Object.keys(newData),
        }
      );

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

      // LOG DE SPECS
      logAction(
        getSafeUser(user),
        MODULES.PRODUCAO,
        "EDICAO_TECNICA",
        `Alterou especificações do item ${item.sku}`,
        { itemId: item.id, sku: item.sku, newSpecs: updatedData.specs }
      );

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

      // LOG DE MOVIMENTAÇÃO
      logAction(
        getSafeUser(user),
        MODULES.PEDIDOS,
        "MOVER_ITEM",
        `Moveu item para pedido #${targetOrderData.orderNumber}`,
        { itemId, targetOrder: targetOrderData.orderNumber }
      );

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

      // LOG DE IMPRESSÃO
      logAction(
        getSafeUser(user),
        MODULES.PEDIDOS,
        "IMPRESSAO_CERTIFICADO",
        `Imprimiu ${itemsToPrint.length} certificados`,
        { count: itemsToPrint.length, itemIds: itemsToPrint.map((i) => i.id) }
      );

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
