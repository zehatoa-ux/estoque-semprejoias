import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ClipboardList,
  Barcode,
  Bookmark,
  Upload,
  BarChart2,
  Settings,
  LogOut,
  Search,
  X,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  Package,
  User,
  Calendar,
  ArrowUp,
  ArrowDown,
  Plus,
  Edit2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Factory,
  Truck,
} from "lucide-react";

// Config e Utils
import { auth, db } from "./config/firebase";
import {
  DEFAULT_XLSX_URL,
  STORAGE_KEY,
  APP_COLLECTION_ID,
} from "./config/constants";
import { normalizeText, formatMoney } from "./utils/formatters";

// Contexto de Autenticação
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Componentes
import LoginScreen from "./components/LoginScreen";
import EditModal from "./components/modals/EditModal";
import QuickResModal from "./components/modals/QuickResModal";
import ConflictModal from "./components/modals/ConflictModal";

// Abas
import ConferenceTab from "./tabs/ConferenceTab";
import ReservationsTab from "./tabs/ReservationsTab";
import ConfigTab from "./tabs/ConfigTab";
import SalesTab from "./tabs/SalesTab";
import ReportsTab from "./tabs/ReportsTab";
import ProductionTab from "./tabs/ProductionTab"; // <--- NOVA IMPORTAÇÃO
import OrdersTab from "./tabs/OrdersTab";
import { useCatalog } from "./hooks/useCatalog";
import StockTab from "./tabs/StockTab";
import { useInventory } from "./hooks/useInventory";
import { inventoryService } from "./services/inventoryService";
import Layout from "./components/layout/Layout";

// Componente Wrapper para injetar o AuthProvider
export default function AppWrapper() {
  return (
    <AuthProvider>
      <InventorySystem />
    </AuthProvider>
  );
}

function InventorySystem() {
  const { user, login, logout, hasAccess, loading: authLoading } = useAuth();
  const [loginError, setLoginError] = useState(null);
  // --- USANDO O NOVO HOOK ---
  // findItem substitui o findCatalogItem antigo
  // refreshCatalog substitui o fetchCatalogXLSX antigo
  const {
    catalog,
    loading: loadingCatalog,
    findItem: findCatalogItem, // Renomeamos aqui para não quebrar o resto do código
    refreshCatalog: fetchCatalogXLSX,
  } = useCatalog(user);

  // --- STATES ---
  const [activeTab, setActiveTab] = useState("stock");
  const { inventory, reservations } = useInventory(user);

  // Buffer System
  const [scannedBuffer, setScannedBuffer] = useState([]);
  const [bufferPage, setBufferPage] = useState(1);
  const [isCommitting, setIsCommitting] = useState(false);

  // Reports
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [currentReportPage, setCurrentReportPage] = useState(1);

  // UI States

  const itemsPerPage = 50;

  // Modais
  const [conflictData, setConflictData] = useState(null);

  // Seleção
  const [selectedReservations, setSelectedReservations] = useState(new Set());

  // Form Reserva
  const [resSku, setResSku] = useState("");
  const [resQty, setResQty] = useState("1");
  const [resNote, setResNote] = useState("");

  // Firebase App ID
  const [appId] = useState(APP_COLLECTION_ID);

  // Inputs & Search
  const [barcodeInput, setBarcodeInput] = useState("");
  const [salesInput, setSalesInput] = useState("");
  const [notification, setNotification] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const inputRef = useRef(null);
  // --- CORREÇÃO DE TELA BRANCA ---
  // Se o usuário logar e não tiver acesso à aba atual (ex: stock),
  // procura a primeira aba permitida e redireciona ele.
  useEffect(() => {
    if (user && !hasAccess(activeTab)) {
      // Lista todas as chaves de abas (stock, production, etc)
      const allTabs = Object.keys(TAB_LABELS);
      // Encontra a primeira que retorna true no hasAccess
      const firstAllowedTab = allTabs.find((tab) => hasAccess(tab));

      if (firstAllowedTab) {
        setActiveTab(firstAllowedTab);
      }
    }
  }, [user, activeTab, hasAccess]);
  //----Fim correcao tela branca

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    const styleScript = document.createElement("script");
    styleScript.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(styleScript);

    if (!window.XLSX) {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.async = true;
      document.body.appendChild(s);
    }
    if (!window.jspdf) {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.async = true;
      s.onload = () => {
        const a = document.createElement("script");
        a.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";
        a.async = true;
        document.body.appendChild(a);
      };
      document.body.appendChild(s);
    }
  }, []);

  // Listener do Firebase (Dados)

  const handleLoginAttempt = async (u, p) => {
    const result = await login(u, p);
    if (!result.success) setLoginError(result.message);
    else {
      setLoginError(null);
      // O hook useCatalog vai detectar a mudança de 'user' e carregar sozinho.
    }
  };

  const showNotification = (msg, type = "success") => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- LÓGICA PRINCIPAL ---

  const getAvailability = (sku) => {
    const physical = inventory.filter(
      (i) => i.sku === sku && i.status === "in_stock"
    ).length;
    const reserved = reservations
      .filter((r) => r.sku === sku)
      .reduce((acc, r) => acc + r.quantity, 0);
    return { physical, reserved, available: physical - reserved };
  };

  const reservationsWithStatus = useMemo(() => {
    const skus = {};
    reservations.forEach((r) => {
      if (!skus[r.sku]) skus[r.sku] = [];
      skus[r.sku].push(r);
    });
    const processed = [];
    Object.keys(skus).forEach((sku) => {
      let physicalStock = inventory.filter(
        (i) => i.sku === sku && i.status === "in_stock"
      ).length;
      const sorted = skus[sku].sort(
        (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      );
      sorted.forEach((res) => {
        let status = "ok",
          missing = 0;
        if (physicalStock >= res.quantity) {
          physicalStock -= res.quantity;
        } else if (physicalStock > 0) {
          status = "partial";
          missing = res.quantity - physicalStock;
          physicalStock = 0;
        } else {
          status = "missing";
          missing = res.quantity;
        }
        processed.push({ ...res, status, missing });
      });
    });
    return processed.sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );
  }, [reservations, inventory]);

  // --- REPORT LOGIC ---
  const reportData = useMemo(() => {
    const events = [];
    const start = new Date(reportStartDate + "T00:00:00");
    const end = new Date(reportEndDate + "T23:59:59");
    inventory.forEach((item) => {
      const details = findCatalogItem(item.sku);
      const processEvent = (date, type, user) => {
        const d = date?.toDate ? date.toDate() : new Date(0);
        if (d >= start && d <= end)
          events.push({
            id: item.id + "_" + type,
            date: d,
            type,
            sku: item.sku,
            name: details?.name || "N/I",
            user: user || "-",
            details,
          });
      };
      if (item.status === "in_stock")
        processEvent(item.timestamp, "entrada", item.addedBy);
      if (item.status === "sold")
        processEvent(item.soldTimestamp, "saida", item.soldBy);
      if (item.status === "adjusted_out")
        processEvent(item.outTimestamp, "ajuste", item.removedBy);
    });
    reservations.forEach((res) => {
      const details = findCatalogItem(res.sku);
      const resDate = res.createdAt?.toDate
        ? res.createdAt.toDate()
        : new Date(0);
      if (resDate >= start && resDate <= end)
        events.push({
          id: res.id + "_res_created",
          date: resDate,
          type: "reserva_criada",
          sku: res.sku,
          name: details?.name || "N/I",
          user: res.createdBy || "-",
          details,
        });
    });
    return events.sort((a, b) => b.date - a.date);
  }, [inventory, reservations, reportStartDate, reportEndDate, catalog]);

  const reportStats = useMemo(() => {
    return {
      entries: reportData.filter((e) => e.type === "entrada").length,
      sales: reportData.filter((e) => e.type === "saida").length,
      adjustments: reportData.filter((e) => e.type === "ajuste").length,
    };
  }, [reportData]);

  const paginatedReportData = useMemo(() => {
    const startIndex = (currentReportPage - 1) * itemsPerPage;
    return reportData.slice(startIndex, startIndex + itemsPerPage);
  }, [reportData, currentReportPage, itemsPerPage]);
  const totalReportPages = Math.ceil(reportData.length / itemsPerPage);
  const setReportRange = (days) => {
    const end = new Date();
    const start = new Date();
    if (days === "month") {
      start.setDate(1);
    } else {
      start.setDate(end.getDate() - days);
    }
    setReportStartDate(start.toISOString().split("T")[0]);
    setReportEndDate(end.toISOString().split("T")[0]);
    setCurrentReportPage(1);
  };

  // --- ACTIONS ---
  // --- APAGUE TUDO ISSO ---
  const reduceReservationsIfNecessary = (batch, sku, qtySold) => {
    const { physical, reserved } = getAvailability(sku);
    const free = Math.max(0, physical - reserved);
    const shortage = Math.max(0, qtySold - free);
    if (shortage > 0) {
      // ... lógica que deletava a reserva ...
      // ...
      return true;
    }
    return false;
  };
  // ------------------------

  // --- TRAVA DE ESTOQUE REMOVIDA PARA RESERVAS ---
  const handleCreateReservation = async (e) => {
    if (e) e.preventDefault();
    if (!db || !user) return;
    const skuClean = resSku.toUpperCase().trim();
    const quantity = parseInt(resQty);
    if (!skuClean || quantity < 1) {
      showNotification("Dados inválidos.", "warning");
      return;
    }

    // Sem verificação de saldo (available < quantity)
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "reservations"),
        {
          sku: skuClean,
          quantity,
          note: resNote.slice(0, 90),
          createdBy: user.name,
          createdAt: serverTimestamp(),
          dateStr: new Date().toLocaleString("pt-BR"),
          source: "manual",
        }
      );
      showNotification("Reserva criada!", "success");
      setResSku("");
      setResQty("1");
      setResNote("");
    } catch (err) {
      showNotification("Erro ao criar reserva.", "error");
    }
  };

  const handleQuickReservation = async () => {
    if (!db || !user || !quickResModal) return;
    const skuClean = quickResModal.sku;
    const quantity = parseInt(qrQty);
    if (quantity < 1) return showNotification("Qtd inválida.", "warning");

    // Sem verificação de saldo
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "reservations"),
        {
          sku: skuClean,
          quantity,
          note: qrNote.slice(0, 90),
          createdBy: user.name,
          createdAt: serverTimestamp(),
          dateStr: new Date().toLocaleString("pt-BR"),
          source: "manual_quick",
        }
      );
      showNotification("Reserva criada!", "success");
      setQuickResModal(null);
      setQrQty("1");
      setQrNote("");
    } catch (err) {
      showNotification("Erro.", "error");
    }
  };

  const handleCancelReservation = async (id) => {
    if (!window.confirm("Cancelar reserva?")) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "reservations", id)
      );
      showNotification("Cancelada.", "success");
    } catch (err) {}
  };
  const handleBulkCancelReservations = async () => {
    if (selectedReservations.size === 0) return;
    if (!window.confirm(`Cancelar ${selectedReservations.size} reservas?`))
      return;
    const batch = writeBatch(db);
    selectedReservations.forEach((id) =>
      batch.delete(
        doc(db, "artifacts", appId, "public", "data", "reservations", id)
      )
    );
    try {
      await batch.commit();
      showNotification("Canceladas.", "success");
      setSelectedReservations(new Set());
    } catch (err) {}
  };

  const handleScanToBuffer = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const sku = barcodeInput.trim().toUpperCase();
      if (!sku) return;
      const catalogInfo = findCatalogItem(sku);
      const newItem = {
        tempId: Date.now(),
        sku,
        baseSku: catalogInfo?.baseSku,
        name: catalogInfo?.name || "N/I",
        status: "in_stock",
        addedBy: user.name,
        dateIn: new Date().toLocaleString("pt-BR"),
      };
      setScannedBuffer((prev) => [newItem, ...prev]);
      setBarcodeInput("");
    }
  };

  const handleCommitBuffer = async () => {
    if (scannedBuffer.length === 0) return;

    if (
      !window.confirm(
        `Confirmar envio de ${scannedBuffer.length} itens para o estoque?`
      )
    )
      return;

    setIsCommitting(true);

    try {
      // Usa o serviço novo! Sem precisar de appId ou writeBatch aqui.
      await inventoryService.importItems(
        scannedBuffer,
        user?.name || "Conferência"
      );

      showNotification(
        `${scannedBuffer.length} itens adicionados com sucesso!`,
        "success"
      );

      // Limpa a tela
      setScannedBuffer([]);
      setBufferPage(1);
    } catch (err) {
      console.error(err);
      showNotification("Erro ao salvar itens: " + err.message, "error");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleResetStock = async () => {
    if (!window.confirm("PERIGO: APAGAR TUDO?")) return;
    const code = Math.floor(1000 + Math.random() * 9000);
    if (window.prompt(`Digite: ${code}`) !== String(code)) return;
    try {
      const q = query(
        collection(db, "artifacts", appId, "public", "data", "inventory_items"),
        where("status", "==", "in_stock")
      );
      const snap = await getDocs(q);
      const chunkSize = 400;
      const chunks = [];
      for (let i = 0; i < snap.docs.length; i += chunkSize)
        chunks.push(snap.docs.slice(i, i + chunkSize));
      for (const chunk of chunks) {
        const b = writeBatch(db);
        chunk.forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      showNotification("Estoque Zerado.", "success");
    } catch (e) {
      showNotification("Erro.", "error");
    }
  };

  const processSales = async () => {
    const lines = salesInput
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    if (lines.length === 0) return;
    if (!db) return;
    const tempCounts = {};
    lines.forEach((line) => {
      const s = line.trim().toUpperCase();
      tempCounts[s] = (tempCounts[s] || 0) + 1;
    });
    const conflictedSkus = [],
      safeSkus = [];
    Object.keys(tempCounts).forEach((sku) => {
      const { physical, reserved } = getAvailability(sku);
      const reqQty = tempCounts[sku];
      const available = physical - reserved;
      if (reqQty > available)
        conflictedSkus.push({ sku, req: reqQty, avail: available, reserved });
      else safeSkus.push({ sku, qty: reqQty });
    });
    if (conflictedSkus.length > 0) {
      setConflictData({ conflicts: conflictedSkus, safe: safeSkus, lines });
      return;
    }
    executeBatchSales(lines);
  };
  const executeBatchSales = async (skuList) => {
    try {
      // Usa o serviço para processar a venda no banco
      await inventoryService.sellItems(skuList, user?.name || "Venda");

      // Feedback Visual
      showNotification(`${skuList.length} itens baixados!`, "success");
      setSalesInput("");
      setConflictData(null);
    } catch (error) {
      console.error(error);
      showNotification("Erro ao processar baixa: " + error.message, "error");
    }
  };

  const requestSort = (key) =>
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  const SortIcon = ({ colKey }) =>
    sortConfig.key !== colKey ? (
      <div className="w-4 h-4" />
    ) : sortConfig.direction === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  const toggleSelectAll = () => {
    if (selectedSkus.size === paginatedData.length) setSelectedSkus(new Set());
    else setSelectedSkus(new Set(paginatedData.map((g) => g.sku)));
  };
  const toggleSelectOne = (sku) => {
    const newSet = new Set(selectedSkus);
    if (newSet.has(sku)) newSet.delete(sku);
    else newSet.add(sku);
    setSelectedSkus(newSet);
  };

  // --- RENDER ---
  // ... (Login Check) ...
  if (!user)
    return (
      <LoginScreen
        onLoginAttempt={handleLoginAttempt}
        error={loginError}
        loading={authLoading}
      />
    );

  // --- NOVO RETURN COM LAYOUT ---
  return (
    <Layout
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      hasAccess={hasAccess}
      logout={logout}
    >
      {/* MODAIS GLOBAIS (Ficam aqui dentro para o Contexto funcionar se precisar, ou fora do Layout se forem absolutos) */}
      <ConflictModal
        data={conflictData}
        onCancel={() => setConflictData(null)}
        onConfirmForce={(lines) => executeBatchSales(lines)}
        onConfirmSafe={(safeList) => executeBatchSales(safeList)}
      />

      {notification && (
        <div
          className={`fixed top-4 right-4 z-[60] p-4 rounded-lg shadow-xl text-white animate-slide-in flex items-center gap-3 ${
            notification.type === "error" ? "bg-red-500" : "bg-emerald-600"
          }`}
        >
          {notification.type === "error" ? (
            <AlertCircle size={24} />
          ) : (
            <CheckCircle size={24} />
          )}
          <span className="font-medium text-sm">{notification.message}</span>
        </div>
      )}

      {/* CONTEÚDO DAS ABAS */}
      {/* Note que removemos a max-w-6xl para ocupar 100% como você pediu */}

      <div className="space-y-4">
        {" "}
        {/* Container genérico para espaçamento */}
        {activeTab === "stock" && hasAccess("stock") && (
          <StockTab
            inventory={inventory}
            reservations={reservations}
            findCatalogItem={findCatalogItem}
            user={user}
            loadingCatalog={loadingCatalog}
            onRefreshCatalog={fetchCatalogXLSX}
          />
        )}
        {activeTab === "conference" && hasAccess("conference") && (
          <ConferenceTab
            barcodeInput={barcodeInput}
            setBarcodeInput={setBarcodeInput}
            inputRef={inputRef}
            handleScanToBuffer={handleScanToBuffer}
            scannedBuffer={scannedBuffer}
            setScannedBuffer={setScannedBuffer}
            isCommitting={isCommitting}
            handleCommitBuffer={handleCommitBuffer}
            handleClearBuffer={() => setScannedBuffer([])}
            removeItemFromBuffer={(id) =>
              setScannedBuffer((p) => p.filter((i) => i.tempId !== id))
            }
            bufferPage={bufferPage}
            setBufferPage={setBufferPage}
            paginatedBuffer={scannedBuffer}
            totalBufferPages={1}
            db={db}
          />
        )}
        {activeTab === "reservations" && hasAccess("reservations") && (
          <ReservationsTab
            resSku={resSku}
            setResSku={setResSku}
            resQty={resQty}
            setResQty={setResQty}
            resNote={resNote}
            setResNote={setResNote}
            reservations={reservations}
            reservationsWithStatus={reservationsWithStatus}
            selectedReservations={selectedReservations}
            setSelectedReservations={setSelectedReservations}
            handleCreateReservation={handleCreateReservation}
            handleCancelReservation={handleCancelReservation}
            handleBulkCancelReservations={handleBulkCancelReservations}
            toggleSelectReservation={(id) => {
              const s = new Set(selectedReservations);
              if (s.has(id)) s.delete(id);
              else s.add(id);
              setSelectedReservations(s);
            }}
            findCatalogItem={findCatalogItem}
            inventory={inventory}
          />
        )}
        {activeTab === "production" && hasAccess("production") && (
          <ProductionTab user={user} findCatalogItem={findCatalogItem} />
        )}
        {activeTab === "sales" && hasAccess("sales") && (
          <SalesTab
            salesInput={salesInput}
            setSalesInput={setSalesInput}
            processSales={processSales}
          />
        )}
        {activeTab === "reports" && hasAccess("reports") && (
          <ReportsTab
            reportStartDate={reportStartDate}
            setReportStartDate={setReportStartDate}
            reportEndDate={reportEndDate}
            setReportEndDate={setReportEndDate}
            setReportRange={setReportRange}
            reportStats={reportStats}
            paginatedReportData={paginatedReportData}
            reportData={reportData}
            currentReportPage={currentReportPage}
            setCurrentReportPage={setCurrentReportPage}
            totalReportPages={totalReportPages}
          />
        )}
        {activeTab === "orders" && hasAccess("production") && (
          <OrdersTab findCatalogItem={findCatalogItem} />
        )}
        {activeTab === "config" && hasAccess("config") && (
          <ConfigTab handleResetStock={handleResetStock} />
        )}
      </div>
    </Layout>
  );
}
