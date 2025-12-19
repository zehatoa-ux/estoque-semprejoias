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
} from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp,
  writeBatch,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

// Config e Utils
import { auth, db } from "./config/firebase";
import {
  DEFAULT_XLSX_URL,
  STORAGE_KEY,
  APP_COLLECTION_ID,
} from "./config/constants";
import { normalizeText, formatMoney } from "./utils/formatters";

// Contexto de Autenticação (NOVO)
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

const TAB_LABELS = {
  stock: "ESTOQUE",
  conference: "CONFERÊNCIA",
  reservations: "RESERVAS",
  sales: "BAIXA",
  reports: "RELATÓRIOS",
  config: "CONFIG",
  // production: "PRODUÇÃO" // Futuro
};

// Componente Wrapper para injetar o AuthProvider
export default function AppWrapper() {
  return (
    <AuthProvider>
      <InventorySystem />
    </AuthProvider>
  );
}

function InventorySystem() {
  const { user, login, logout, hasAccess, loading: authLoading } = useAuth(); // Hook do Auth
  const [loginError, setLoginError] = useState(null);

  // --- STATES ---
  const [activeTab, setActiveTab] = useState("stock");
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSource, setCatalogSource] = useState("none");

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
  const [sortConfig, setSortConfig] = useState({
    key: "lastModified",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [zoomedImage, setZoomedImage] = useState(null);

  // Modais
  const [editModal, setEditModal] = useState(null);
  const [quickResModal, setQuickResModal] = useState(null);
  const [qrQty, setQrQty] = useState("1");
  const [qrNote, setQrNote] = useState("");
  const [conflictData, setConflictData] = useState(null);

  // Seleção
  const [selectedSkus, setSelectedSkus] = useState(new Set());
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
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterModel, setFilterModel] = useState("all");

  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
  useEffect(() => {
    if (!user || !db) return;
    const unsub1 = onSnapshot(
      query(
        collection(db, "artifacts", appId, "public", "data", "inventory_items"),
        orderBy("timestamp", "desc")
      ),
      (s) => setInventory(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub2 = onSnapshot(
      query(
        collection(db, "artifacts", appId, "public", "data", "reservations"),
        orderBy("createdAt", "desc")
      ),
      (s) => setReservations(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [user, db, appId]);

  // --- PROCESSAMENTO DO CATÁLOGO (Mantido igual) ---
  const processCatalogData = (rows) => {
    if (!rows || rows.length === 0) return [];
    const headers = rows[0].map((h) => String(h).trim().toLowerCase());
    let skuIdx = headers.indexOf("sku");
    if (skuIdx === -1) skuIdx = 3;
    let nameIdx = headers.indexOf("name");
    if (nameIdx === -1) nameIdx = 4;
    let modelIdx = headers.indexOf("model");
    if (modelIdx === -1) modelIdx = 5;
    let imageIdx = headers.indexOf("images");
    if (imageIdx === -1) imageIdx = 15;
    let priceIdx = headers.indexOf("price");
    if (priceIdx === -1) priceIdx = 16;
    const products = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= skuIdx) continue;
      const sku = String(row[skuIdx]).trim().toUpperCase();
      if (sku.length < 2) continue;
      let finalImage = null;
      const rawImage = row[imageIdx];
      if (rawImage) {
        const imgStr = String(rawImage).trim();
        if (imgStr.startsWith("[")) {
          try {
            const parsed = JSON.parse(imgStr.replace(/\\'/g, "'"));
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url)
              finalImage = parsed[0].url.replace(/\\\//g, "/");
          } catch (e) {
            const urlMatch = imgStr.match(/https?:[^" ]+\.(?:jpg|png|jpeg)/i);
            if (urlMatch) finalImage = urlMatch[0].replace(/\\\//g, "/");
          }
        } else if (imgStr.startsWith("http")) finalImage = imgStr;
      }
      let finalPrice = 0;
      const rawPrice = row[priceIdx];
      if (rawPrice !== undefined && rawPrice !== null) {
        if (typeof rawPrice === "number") finalPrice = rawPrice;
        else {
          let pStr = String(rawPrice).replace(/[R$\s]/g, "");
          if (pStr.includes(",") && !pStr.includes("."))
            pStr = pStr.replace(",", ".");
          else if (pStr.includes(".") && pStr.includes(","))
            pStr = pStr.replace(/\./g, "").replace(",", ".");
          finalPrice = parseFloat(pStr) || 0;
        }
      }
      products.push({
        sku,
        name: row[nameIdx] || "Sem Nome",
        model: row[modelIdx] || "-",
        price: finalPrice,
        image: finalImage,
      });
    }
    return products;
  };

  const saveToCache = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  };
  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        setCatalog(JSON.parse(cached));
        setCatalogSource("cache");
        return true;
      }
    } catch (e) {}
    return false;
  };
  const parseWorkbook = (data) => {
    if (!window.XLSX) throw new Error("Biblioteca XLSX não carregada.");
    const workbook = window.XLSX.read(data, { type: "array" });
    let targetSheetName = workbook.SheetNames[0];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const headers = window.XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 0,
        limit: 1,
      })[0];
      if (
        headers &&
        headers.some((h) => String(h).toLowerCase().includes("sku"))
      ) {
        targetSheetName = sheetName;
        break;
      }
    }
    const worksheet = workbook.Sheets[targetSheetName];
    return processCatalogData(
      window.XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    );
  };

  const fetchCatalogXLSX = async () => {
    setLoadingCatalog(true);
    try {
      const response = await fetch(DEFAULT_XLSX_URL);
      if (!response.ok) throw new Error("Erro ao baixar XLSX");
      const arrayBuffer = await response.arrayBuffer();
      const processed = parseWorkbook(arrayBuffer);
      setCatalog(processed);
      setCatalogSource("web");
      saveToCache(processed);
      if (user)
        showNotification(
          `Catálogo atualizado: ${processed.length} itens.`,
          "success"
        );
    } catch (error) {
      if (loadFromCache() && user)
        showNotification("Usando catálogo offline.", "warning");
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    const i = setInterval(() => {
      if (window.XLSX && user && catalog.length === 0) {
        fetchCatalogXLSX();
        clearInterval(i);
      }
    }, 500);
    return () => clearInterval(i);
  }, [user, catalog.length]);

  const catalogMap = useMemo(() => {
    const map = new Map();
    catalog.forEach((item) => {
      map.set(item.sku, item);
    });
    return map;
  }, [catalog]);
  const findCatalogItem = (sku) => {
    if (!sku) return null;
    const s = sku.toUpperCase().trim();
    if (catalogMap.has(s)) return { ...catalogMap.get(s), baseSku: s };
    const parts = s.split("-");
    if (parts.length > 1) {
      for (let i = parts.length - 1; i >= 1; i--) {
        const potentialParentSku = parts.slice(0, i).join("-");
        if (catalogMap.has(potentialParentSku))
          return {
            ...catalogMap.get(potentialParentSku),
            baseSku: potentialParentSku,
          };
      }
    }
    return {
      sku: s,
      name: "Item não catalogado",
      price: 0,
      model: "-",
      image: null,
    };
  };

  const handleLoginAttempt = async (u, p) => {
    const result = await login(u, p);
    if (!result.success) setLoginError(result.message);
    else {
      setLoginError(null);
      if (catalog.length === 0 && window.XLSX) fetchCatalogXLSX();
    }
  };

  const showNotification = (msg, type = "success") => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- LÓGICA PRINCIPAL ---
  const groupedInventory = useMemo(() => {
    const groups = {};
    const reservationsMap = {};
    reservations.forEach((r) => {
      if (!reservationsMap[r.sku]) reservationsMap[r.sku] = 0;
      reservationsMap[r.sku] += r.quantity;
    });
    inventory.forEach((i) => {
      if (i.status !== "in_stock") return;
      if (!groups[i.sku]) {
        const d = findCatalogItem(i.sku);
        groups[i.sku] = {
          sku: i.sku,
          name: d?.name || "N/I",
          model: d?.model || "-",
          price: d?.price || 0,
          image: d?.image,
          quantity: 0,
          reservedQuantity: reservationsMap[i.sku] || 0,
          entries: [],
          lastModified: i.timestamp?.seconds || 0,
          lastModifiedStr: i.dateIn,
          lastModifiedUser: i.addedBy,
        };
      }
      groups[i.sku].quantity++;
      groups[i.sku].entries.push(i);
      if (i.timestamp?.seconds > groups[i.sku].lastModified) {
        groups[i.sku].lastModified = i.timestamp.seconds;
        groups[i.sku].lastModifiedStr = i.dateIn;
        groups[i.sku].lastModifiedUser = i.addedBy;
      }
    });
    Object.values(groups).forEach(
      (g) => (g.displayQuantity = g.quantity - g.reservedQuantity)
    );
    return Object.values(groups);
  }, [inventory, catalog, reservations]);

  const totalItems = inventory.filter((i) => i.status === "in_stock").length;
  const totalValue = groupedInventory.reduce(
    (acc, group) => acc + group.price * group.quantity,
    0
  );

  const filteredAndSortedGroups = useMemo(() => {
    let result = groupedInventory.filter((group) => {
      const searchLower = normalizeText(debouncedSearch);
      const skuStr = normalizeText(group.sku);
      const nameStr = normalizeText(group.name);
      const modelStr = normalizeText(group.model);
      return (
        (skuStr.includes(searchLower) ||
          nameStr.includes(searchLower) ||
          modelStr.includes(searchLower)) &&
        (filterModel === "all" || group.model === filterModel)
      );
    });
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        return (
          (valA < valB ? -1 : 1) * (sortConfig.direction === "asc" ? 1 : -1)
        );
      });
    }
    return result;
  }, [groupedInventory, debouncedSearch, filterModel, sortConfig]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedGroups, currentPage, itemsPerPage]);
  const totalPages = Math.ceil(filteredAndSortedGroups.length / itemsPerPage);

  const modelsAvailableInSearch = useMemo(() => {
    const searchLower = normalizeText(debouncedSearch);
    const matchingItems = groupedInventory.filter((group) => {
      if (!searchLower) return true;
      const skuStr = normalizeText(group.sku);
      const nameStr = normalizeText(group.name);
      const modelStr = normalizeText(group.model);
      return (
        skuStr.includes(searchLower) ||
        nameStr.includes(searchLower) ||
        modelStr.includes(searchLower)
      );
    });
    const models = new Set();
    matchingItems.forEach((item) => {
      if (item.model && item.model !== "-") models.add(item.model);
    });
    return Array.from(models).sort();
  }, [groupedInventory, debouncedSearch]);

  useEffect(() => {
    if (filterModel !== "all" && !modelsAvailableInSearch.includes(filterModel))
      setFilterModel("all");
  }, [debouncedSearch, modelsAvailableInSearch, filterModel]);

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
  const reduceReservationsIfNecessary = (batch, sku, qtySold) => {
    const { physical, reserved } = getAvailability(sku);
    const free = Math.max(0, physical - reserved);
    const shortage = Math.max(0, qtySold - free);
    if (shortage > 0) {
      let remaining = shortage;
      const skuRes = reservations
        .filter((r) => r.sku === sku)
        .sort(
          (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );
      for (const res of skuRes) {
        if (remaining <= 0) break;
        const ref = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "reservations",
          res.id
        );
        if (res.quantity <= remaining) {
          batch.delete(ref);
          remaining -= res.quantity;
        } else {
          batch.update(ref, { quantity: res.quantity - remaining });
          remaining = 0;
        }
      }
      return true;
    }
    return false;
  };

  // --- AÇÃO: CRIAR RESERVA (Manual via Aba Reservas) ---
  const handleCreateReservation = async (e) => {
    if (e) e.preventDefault();
    if (!db || !user) return;

    const skuClean = resSku.toUpperCase().trim();
    const quantity = parseInt(resQty);

    if (!skuClean || quantity < 1) {
      showNotification("Dados inválidos.", "warning");
      return;
    }

    // --- REMOVIDA A TRAVA DE ESTOQUE ---
    // Apenas calculamos para saber se vai ficar negativo, mas não bloqueamos.
    // const { available } = getAvailability(skuClean);
    // if (available < quantity) ... (CÓDIGO REMOVIDO)

    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "reservations"),
        {
          sku: skuClean,
          quantity: quantity,
          note: resNote.slice(0, 90),
          createdBy: user.name,
          createdAt: serverTimestamp(),
          dateStr: new Date().toLocaleString("pt-BR"),
          source: "manual", // Identifica que foi feito na mão
          orderId: "", // Manual geralmente não tem pedido atrelado ainda
        }
      );
      showNotification("Reserva criada com sucesso!", "success");
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

    // --- TRAVA REMOVIDA AQUI TAMBÉM ---

    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "reservations"),
        {
          sku: skuClean,
          quantity: quantity,
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
    if (!window.confirm(`Confirmar envio de ${scannedBuffer.length} itens?`))
      return;
    if (!db) return;
    setIsCommitting(true);
    const chunkSize = 450;
    const chunks = [];
    for (let i = 0; i < scannedBuffer.length; i += chunkSize)
      chunks.push(scannedBuffer.slice(i, i + chunkSize));
    try {
      let total = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((i) => {
          const docRef = doc(
            collection(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "inventory_items"
            )
          );
          batch.set(docRef, {
            sku: i.sku,
            baseSku: i.baseSku,
            status: "in_stock",
            addedBy: i.addedBy,
            timestamp: serverTimestamp(),
            dateIn: i.dateIn,
            dateOut: null,
          });
        });
        await batch.commit();
        total += chunk.length;
      }
      showNotification(`${total} itens adicionados.`, "success");
      setScannedBuffer([]);
      setBufferPage(1);
    } catch (err) {
      showNotification("Erro no envio.", "error");
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

  const adjustStock = async (group, delta) => {
    const batch = writeBatch(db);
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        const ref = doc(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "inventory_items"
          )
        );
        batch.set(ref, {
          sku: group.sku,
          baseSku: group.baseSku || group.sku,
          status: "in_stock",
          addedBy: user.name,
          timestamp: serverTimestamp(),
          dateIn: new Date().toLocaleString("pt-BR"),
          manualAdjustment: true,
        });
      }
      await batch.commit();
      showNotification(`+${delta} ${group.sku}`, "success");
    } else {
      const qty = Math.abs(delta);
      const { available } = getAvailability(group.sku);
      if (qty > available && !window.confirm("Reservas afetadas. Continuar?"))
        return;
      reduceReservationsIfNecessary(batch, group.sku, qty);
      const items = group.entries
        .sort(
          (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
        )
        .slice(0, qty);
      items.forEach((i) =>
        batch.update(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "inventory_items",
            i.id
          ),
          {
            status: "adjusted_out",
            removedBy: user.name,
            outTimestamp: serverTimestamp(),
          }
        )
      );
      await batch.commit();
      showNotification(`-${qty} ${group.sku}`, "success");
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
    if (!db) return;
    const batch = writeBatch(db);
    let batchCount = 0;
    const tempInventory = [...inventory];
    const skuCounts = {};
    skuList.forEach((s) => (skuCounts[s] = (skuCounts[s] || 0) + 1));
    Object.keys(skuCounts).forEach((sku) => {
      reduceReservationsIfNecessary(batch, sku, skuCounts[sku]);
    });
    for (const sku of skuList) {
      const skuToSell = sku.trim().toUpperCase();
      const itemIndex = tempInventory.findIndex(
        (i) => i.sku === skuToSell && i.status === "in_stock"
      );
      if (itemIndex !== -1) {
        const item = tempInventory[itemIndex];
        const itemRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "inventory_items",
          item.id
        );
        batch.update(itemRef, {
          status: "sold",
          dateOut: new Date().toLocaleString("pt-BR"),
          soldTimestamp: serverTimestamp(),
          soldBy: user.name,
        });
        tempInventory.splice(itemIndex, 1);
        batchCount++;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
      showNotification(`${batchCount} baixados!`, "success");
      setSalesInput("");
      setConflictData(null);
    } else showNotification("Nenhum disponível.", "warning");
  };

  const handleExportXLSX = () => {
    if (!window.XLSX) return;
    const ws = window.XLSX.utils.json_to_sheet(
      filteredAndSortedGroups.map((g) => ({
        SKU: g.sku,
        Nome: g.name,
        Qtd: g.displayQuantity,
        Preco: g.price,
      }))
    );
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    window.XLSX.writeFile(wb, "estoque.xlsx");
  };
  const handleExportPDF = () => {
    if (!window.jspdf) return;
    const doc = new window.jspdf.jsPDF();
    doc.text("Relatório de Estoque", 14, 22);
    doc.text(`Total Peças: ${totalItems}`, 14, 30);
    doc.autoTable({
      head: [["SKU", "Nome", "Qtd", "Preço"]],
      body: filteredAndSortedGroups.map((g) => [
        g.sku,
        g.name,
        g.displayQuantity,
        formatMoney(g.price),
      ]),
    });
    doc.save("estoque.pdf");
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
  const handleBulkDelete = async () => {
    if (!db) return;
    let totalItemsToRemove = 0,
      itemsToDelete = [],
      skusToAdjust = new Set();
    inventory.forEach((item) => {
      if (item.status === "in_stock" && selectedSkus.has(item.sku)) {
        itemsToDelete.push(item);
        totalItemsToRemove++;
        skusToAdjust.add(item.sku);
      }
    });
    if (totalItemsToRemove === 0) {
      showNotification("Nada selecionado.", "warning");
      return;
    }
    let hasConflict = false;
    skusToAdjust.forEach((sku) => {
      const { reserved } = getAvailability(sku);
      if (reserved > 0) hasConflict = true;
    });
    if (hasConflict && !window.confirm("Reservas serão afetadas. Continuar?"))
      return;
    else if (!hasConflict && !window.confirm("Remover itens?")) return;
    const chunkSize = 400;
    for (let i = 0; i < itemsToDelete.length; i += chunkSize) {
      const chunk = itemsToDelete.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const chunkCounts = {};
      chunk.forEach(
        (item) => (chunkCounts[item.sku] = (chunkCounts[item.sku] || 0) + 1)
      );
      Object.keys(chunkCounts).forEach((sku) => {
        reduceReservationsIfNecessary(batch, sku, chunkCounts[sku]);
      });
      chunk.forEach((item) => {
        const itemRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "inventory_items",
          item.id
        );
        batch.update(itemRef, {
          status: "adjusted_out",
          outTimestamp: serverTimestamp(),
          dateOut: new Date().toLocaleString("pt-BR"),
          removedBy: user.name,
          bulkAction: true,
        });
      });
      await batch.commit();
    }
    showNotification(`${totalItemsToRemove} removidos.`, "success");
    setSelectedSkus(new Set());
  };

  // --- RENDER ---
  if (!user)
    return (
      <LoginScreen
        onLoginAttempt={handleLoginAttempt}
        error={loginError}
        loading={authLoading}
      />
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative">
      <EditModal
        isOpen={!!editModal}
        data={editModal}
        onClose={() => setEditModal(null)}
        onAdjust={adjustStock}
      />
      <QuickResModal
        isOpen={!!quickResModal}
        data={quickResModal}
        qty={qrQty}
        setQty={setQrQty}
        note={qrNote}
        setNote={setQrNote}
        onClose={() => setQuickResModal(null)}
        onConfirm={handleQuickReservation}
      />
      <ConflictModal
        data={conflictData}
        onCancel={() => setConflictData(null)}
        onConfirmForce={(lines) => executeBatchSales(lines)}
        onConfirmSafe={(safeList) => executeBatchSales(safeList)}
      />
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              className="absolute -top-12 right-0 text-white p-2"
              onClick={() => setZoomedImage(null)}
            >
              <X size={32} />
            </button>
            <img
              src={zoomedImage}
              alt="Zoom"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src="https://cdn.iset.io/assets/34692/imagens/mkt.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Estoque Sempre Joias v0.93</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>
                  Olá, <strong className="text-white">{user.name}</strong>
                </span>
                {user.role === "master" && (
                  <span className="bg-yellow-500 text-black px-1 rounded text-[10px] font-bold">
                    MASTER
                  </span>
                )}
              </div>
            </div>
            <button onClick={logout} className="md:hidden text-slate-400">
              <LogOut size={20} />
            </button>
          </div>
          <div className="flex gap-4 text-sm w-full md:w-auto items-center justify-end">
            <div className="bg-slate-800 px-4 py-2 rounded-lg text-center">
              <span className="block text-xs text-slate-400 uppercase">
                Peças
              </span>
              <span className="text-lg font-bold text-green-400">
                {totalItems}
              </span>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-lg text-center hidden sm:block">
              <span className="block text-xs text-slate-400 uppercase">
                Valor Total
              </span>
              <span className="text-lg font-bold text-blue-400">
                {formatMoney(totalValue)}
              </span>
            </div>
            <button
              onClick={logout}
              className="hidden md:block text-slate-400 hover:text-white ml-2"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b sticky top-[76px] z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {Object.keys(TAB_LABELS).map((tab) => {
            // CONDICIONAL DE ACESSO: Só mostra a aba se tem permissão
            if (!hasAccess(tab)) return null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-w-[100px] py-4 text-sm font-medium border-b-2 flex justify-center gap-2 uppercase ${
                  activeTab === tab
                    ? tab === "config"
                      ? "border-red-500 text-red-600"
                      : "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500"
                }`}
              >
                {tab === "stock" && <ClipboardList size={18} />}
                {tab === "conference" && <Barcode size={18} />}
                {tab === "reservations" && <Bookmark size={18} />}
                {tab === "sales" && <Upload size={18} />}
                {tab === "reports" && <BarChart2 size={18} />}
                {tab === "config" && <Settings size={18} />}
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-6 pb-20">
        {notification && (
          <div
            className={`fixed top-28 right-4 z-50 p-4 rounded-lg shadow-xl text-white animate-slide-in flex items-center gap-3 ${
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

        {/* ABA ESTOQUE (Mantida no App.js por enquanto) */}
        {activeTab === "stock" && hasAccess("stock") && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b flex justify-between gap-4 flex-col md:flex-row items-center">
              <div className="relative flex-1 w-full">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={fetchCatalogXLSX}
                  disabled={loadingCatalog}
                  className="p-2.5 border rounded-lg hover:bg-slate-50"
                >
                  <RefreshCw
                    size={20}
                    className={loadingCatalog ? "animate-spin" : ""}
                  />
                </button>
                <div className="flex border rounded-lg overflow-hidden">
                  <button
                    onClick={handleExportXLSX}
                    className="px-3 py-2 bg-white hover:bg-green-50 text-green-600 border-r text-xs font-medium"
                  >
                    <FileSpreadsheet size={16} /> XLSX
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 text-xs font-medium"
                  >
                    <FileText size={16} /> PDF
                  </button>
                </div>
                <div className="relative w-48">
                  <Filter
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <select
                    className="w-full pl-9 pr-8 py-2.5 border rounded-lg outline-none bg-white text-sm"
                    value={filterModel}
                    onChange={(e) => {
                      setFilterModel(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">Todos Modelos</option>
                    {modelsAvailableInSearch.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedSkus.size > 0 &&
                          selectedSkus.size === paginatedData.length
                        }
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 w-16">Foto</th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                      onClick={() => requestSort("sku")}
                    >
                      SKU <SortIcon colKey="sku" />
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                      onClick={() => requestSort("name")}
                    >
                      Nome <SortIcon colKey="name" />
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                      onClick={() => requestSort("lastModified")}
                    >
                      Última Mod. <SortIcon colKey="lastModified" />
                    </th>
                    <th className="px-4 py-3">Quem Modificou</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100"
                      onClick={() => requestSort("quantity")}
                    >
                      Qtd <SortIcon colKey="quantity" />
                    </th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((group, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-blue-50/30 ${
                        selectedSkus.has(group.sku) ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedSkus.has(group.sku)}
                          onChange={() => toggleSelectOne(group.sku)}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                          onClick={() =>
                            group.image && setZoomedImage(group.image)
                          }
                        >
                          {group.image ? (
                            <img
                              src={group.image}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={16} className="text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-blue-600 font-bold text-xs">
                          {group.sku}
                        </span>
                        {group.reservedQuantity > 0 && (
                          <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                            R {group.reservedQuantity}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 text-xs font-medium line-clamp-1">
                          {group.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                            {formatMoney(group.price)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {group.baseSku} • {group.model}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {group.lastModifiedStr || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded w-fit">
                          <User size={10} />
                          {group.lastModifiedUser || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold ${
                            group.displayQuantity < 0
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {group.displayQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center flex justify-center gap-1">
                        <button
                          onClick={() => {
                            setQuickResModal(group);
                            setQrQty("1");
                          }}
                          className="p-1.5 text-yellow-500 bg-yellow-50 rounded hover:bg-yellow-500 hover:text-white transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => setEditModal(group)}
                          className="p-1.5 text-slate-400 bg-slate-100 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-6 py-8 text-center text-slate-400"
                      >
                        Nenhum item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex justify-between items-center bg-slate-50 text-xs text-slate-500">
              <span>
                {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(
                  currentPage * itemsPerPage,
                  filteredAndSortedGroups.length
                )}{" "}
                de {filteredAndSortedGroups.length}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
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
          />
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

        {activeTab === "config" && hasAccess("config") && (
          <ConfigTab handleResetStock={handleResetStock} />
        )}
      </main>
    </div>
  );
}
