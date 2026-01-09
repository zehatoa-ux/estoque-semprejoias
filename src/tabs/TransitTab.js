import React, { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Truck } from "lucide-react"; // Removi Package/Clock se não usar
import { useProductionOrders } from "../hooks/useProductionData";
import { productionService } from "../services/productionService";
import { useAuth } from "../contexts/AuthContext";
import TransitToggle from "../components/production/TransitToggle";
import DaysBadge from "../components/production/DaysBadge";

export default function TransitTab({ findCatalogItem }) {
  const { orders, loading } = useProductionOrders();
  const { user } = useAuth();

  // --- CORREÇÃO 1: Filtra por 'subindo' e 'descendo' ---
  const transitItems = useMemo(() => {
    return orders.filter(
      (o) => o.transit_status === "subindo" || o.transit_status === "descendo"
    );
  }, [orders]);

  // Handler local para dar baixa nesta tela
  const handleToggle = async (order, direction) => {
    const newStatus = order.transit_status === direction ? null : direction;
    await productionService.toggleTransit(order.id, newStatus, user?.name);
  };

  // --- CORREÇÃO 2: Separa usando as strings em português ---
  const goingUp = transitItems.filter((i) => i.transit_status === "subindo"); // Indo pro Escritório
  const goingDown = transitItems.filter((i) => i.transit_status === "descendo"); // Indo pra Fábrica

  if (loading)
    return <div className="p-10 text-center">Carregando trânsito...</div>;

  const RenderList = ({ title, items, icon: Icon, colorClass }) => (
    <div
      className={`flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full`}
    >
      <div
        className={`p-4 border-b border-slate-100 flex justify-between items-center ${colorClass}`}
      >
        <h3 className="font-bold flex items-center gap-2 text-slate-700">
          <Icon size={20} /> {title}
        </h3>
        <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold text-slate-800">
          {items.length} itens
        </span>
      </div>

      <div className="overflow-y-auto p-2 space-y-2 flex-1 custom-scrollbar bg-slate-50/50">
        {items.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            Nenhum item neste fluxo.
          </div>
        )}
        {items.map((item) => {
          const catalog = findCatalogItem ? findCatalogItem(item.sku) : null;
          return (
            <div
              key={item.id}
              className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3 hover:shadow-md transition-all"
            >
              {/* Toggle funcionando aqui também */}
              <TransitToggle order={item} onToggle={handleToggle} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-600 text-sm">
                    {item.sku}
                  </span>
                  <DaysBadge date={item.customCreatedAt || item.createdAt} />
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {catalog?.name || "Produto sem nome"}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                  {item.order?.customer?.name || "Cliente Balcão"}
                  {item.order?.number && (
                    <span className="ml-1">#{item.order.number}</span>
                  )}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase border border-slate-200">
                  {item.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50 p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
          <Truck className="text-blue-500" /> Monitoramento de Trânsito
        </h2>
        <div className="text-sm text-slate-500">
          Total em movimento: <b>{transitItems.length}</b>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* DESCENDO (Fábrica) */}
        <RenderList
          title="Descendo para Fábrica"
          items={goingDown}
          icon={ArrowDown}
          colorClass="bg-orange-50 text-orange-800"
        />

        {/* SUBINDO (Escritório) */}
        <RenderList
          title="Subindo para Escritório"
          items={goingUp}
          icon={ArrowUp}
          colorClass="bg-emerald-50 text-emerald-800"
        />
      </div>
    </div>
  );
}
