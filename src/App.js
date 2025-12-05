import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Package,
  Barcode,
  Upload,
  ClipboardList,
  Search,
  AlertCircle,
  CheckCircle,
  Filter,
  X,
  RefreshCw,
  Lock,
  Download,
  LogOut,
  FileSpreadsheet,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Trash2,
  Edit2,
  RotateCcw,
  Plus,
  Minus,
  Calendar,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  BarChart2,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Bookmark,
  ShieldAlert,
  Settings,
  Save,
  List,
  XCircle,
  AlertOctagon,
  BookmarkPlus,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
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

// ==================================================================================
// --- ÁREA DE CONFIGURAÇÃO ---
// ==================================================================================

const DEFAULT_XLSX_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRseAVjs6VEwSUFJJOSnBgXS5ssRC9oT5Yl-TZ6vSILaG7JKQnFT9YG1yBryVBDGBzbnXATtn4ot0-F/pub?output=xlsx";

const MASTER_PIN = "1234";

const MANUAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAhk5a8MdWaqlveF5MM2lv2oAHyUIVMVxY",
  authDomain: "estoque-sempre-joias.firebaseapp.com",
  projectId: "estoque-sempre-joias",
  storageBucket: "estoque-sempre-joias.firebasestorage.app",
  messagingSenderId: "1015159286438",
  appId: "1:1015159286438:web:3d02de1106cf4d4e7fe267",
};

// ==================================================================================

const STORAGE_KEY = "estoque_catalog_cache";

export default function InventorySystem() {
  // --- AUTH STATES ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [loginError, setLoginError] = useState(false);

  // --- APP STATES ---
  // MUDANÇA: Aba padrão agora é 'stock'
  const [activeTab, setActiveTab] = useState("stock");
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSource, setCatalogSource] = useState("none");

  // --- BUFFER SYSTEM ---
  const [scannedBuffer, setScannedBuffer] = useState([]);
  const [bufferPage, setBufferPage] = useState(1);
  const [isCommitting, setIsCommitting] = useState(false);

  // --- REPORT STATES ---
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [currentReportPage, setCurrentReportPage] = useState(1);

  // --- MODALS & UI ---
  const [sortConfig, setSortConfig] = useState({
    key: "lastModified",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [editModal, setEditModal] = useState(null);

  // --- NOVO: MODAL DE RESERVA RÁPIDA ---
  const [quickResModal, setQuickResModal] = useState(null); // Guarda o item sendo reservado
  const [qrQty, setQrQty] = useState("1");
  const [qrNote, setQrNote] = useState("");

  // --- CONFLICT MODAL ---
  const [conflictData, setConflictData] = useState(null);

  // --- SELEÇÃO EM MASSA ---
  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [selectedReservations, setSelectedReservations] = useState(new Set());

  // --- FORM RESERVA (ABA RESERVAS) ---
  const [resSku, setResSku] = useState("");
  const [resQty, setResQty] = useState("1");
  const [resNote, setResNote] = useState("");

  // Firebase
  const [user, setUser] = useState(null);
  const [appId, setAppId] = useState("default-app-id");
  const [db, setDb] = useState(null);

  // Inputs
  const [barcodeInput, setBarcodeInput] = useState("");
  const [salesInput, setSalesInput] = useState("");
  const [notification, setNotification] = useState(null);

  // --- DEBOUNCE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [filterModel, setFilterModel] = useState("all");

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- HELPER: NORMALIZAÇÃO DE TEXTO ---
  const normalizeText = (text) => {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- 0. CARREGAR DEPENDÊNCIAS ---
  useEffect(() => {
    const styleScript = document.createElement("script");
    styleScript.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(styleScript);

    if (!window.XLSX) {
      const xlsxScript = document.createElement("script");
      xlsxScript.src =
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      xlsxScript.async = true;
      document.body.appendChild(xlsxScript);
    }

    if (!window.jspdf) {
      const pdfScript = document.createElement("script");
      pdfScript.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      pdfScript.async = true;
      pdfScript.onload = () => {
        const autoTableScript = document.createElement("script");
        autoTableScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";
        autoTableScript.async = true;
        document.body.appendChild(autoTableScript);
      };
      document.body.appendChild(pdfScript);
    }
  }, []);

  // --- 1. FIREBASE INIT ---
  useEffect(() => {
    const configToUse =
      MANUAL_FIREBASE_CONFIG ||
      (typeof __firebase_config !== "undefined"
        ? JSON.parse(__firebase_config)
        : null);
    if (!configToUse || !configToUse.apiKey) return;

    try {
      const app = initializeApp(configToUse);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setDb(dbInstance);
      setAppId(typeof __app_id !== "undefined" ? __app_id : "estoque-oficial");

      const initAuth = async () => {
        await signInAnonymously(authInstance);
      };
      initAuth();
      const unsubscribe = onAuthStateChanged(authInstance, (u) => setUser(u));
      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase Init Error:", err);
    }
  }, []);

  // --- 2. CATALOG & FETCHERS ---
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
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url) {
              finalImage = parsed[0].url.replace(/\\\//g, "/");
            }
          } catch (e) {
            const urlMatch = imgStr.match(/https?:[^" ]+\.(?:jpg|png|jpeg)/i);
            if (urlMatch) finalImage = urlMatch[0].replace(/\\\//g, "/");
          }
        } else if (imgStr.startsWith("http")) {
          finalImage = imgStr;
        }
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
      if (isAuthenticated)
        showNotification(
          `Catálogo atualizado: ${processed.length} itens.`,
          "success"
        );
    } catch (error) {
      if (loadFromCache() && isAuthenticated)
        showNotification("Usando catálogo offline.", "warning");
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    const isCsv = file.name.endsWith(".csv");
    reader.onload = (evt) => {
      try {
        if (window.XLSX) {
          const workbook = window.XLSX.read(evt.target.result, {
            type: isCsv ? "string" : "array",
          });
          const processed = processCatalogData(
            window.XLSX.utils.sheet_to_json(
              workbook.Sheets[workbook.SheetNames[0]],
              { header: 1 }
            )
          );
          setCatalog(processed);
          setCatalogSource("file");
          saveToCache(processed);
          showNotification(`Importado: ${processed.length} itens.`, "success");
        }
      } catch (err) {
        showNotification("Erro ao ler arquivo.", "error");
      }
    };
    isCsv ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    const checkXLSX = setInterval(() => {
      if (window.XLSX && isAuthenticated) {
        fetchCatalogXLSX();
        clearInterval(checkXLSX);
      }
    }, 500);
    return () => clearInterval(checkXLSX);
  }, [isAuthenticated]);

  // Listeners
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "inventory_items"),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInventory(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "reservations"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReservations(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    });
    return () => unsubscribe();
  }, [user, db, appId]);

  const catalogMap = useMemo(() => {
    const map = new Map();
    catalog.forEach((item) => {
      map.set(item.sku, item);
    });
    return map;
  }, [catalog]);

  const findCatalogItem = (scannedSku) => {
    if (!scannedSku) return null;
    const cleanSku = scannedSku.toUpperCase().trim();
    if (catalogMap.has(cleanSku)) {
      return { ...catalogMap.get(cleanSku), baseSku: cleanSku };
    }
    const parts = cleanSku.split("-");
    if (parts.length > 1) {
      for (let i = parts.length - 1; i >= 1; i--) {
        const potentialParentSku = parts.slice(0, i).join("-");
        if (catalogMap.has(potentialParentSku)) {
          return {
            ...catalogMap.get(potentialParentSku),
            baseSku: potentialParentSku,
          };
        }
      }
    }
    return null;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === MASTER_PIN && operatorName.trim().length > 0) {
      setIsAuthenticated(true);
      setLoginError(false);
      if (catalog.length === 0 && window.XLSX) fetchCatalogXLSX();
    } else {
      setLoginError(true);
      if (operatorName.trim().length === 0)
        showNotification("Digite seu nome.", "warning");
      else setPinInput("");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPinInput("");
  };
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- BUFFER SYSTEM ---
  const handleScanToBuffer = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const sku = barcodeInput.trim().toUpperCase();
      if (!sku) return;
      const catalogInfo = findCatalogItem(sku);
      const newItem = {
        tempId: Date.now() + Math.random(),
        sku,
        baseSku: catalogInfo ? catalogInfo.sku : null,
        name: catalogInfo ? catalogInfo.name : "Item não identificado",
        image: catalogInfo ? catalogInfo.image : null,
        status: "in_stock",
        addedBy: operatorName,
        timestamp: new Date(),
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
    if (!db || !user) {
      showNotification("Sem conexão com banco de dados.", "error");
      return;
    }
    setIsCommitting(true);
    const chunkSize = 450;
    const chunks = [];
    for (let i = 0; i < scannedBuffer.length; i += chunkSize) {
      chunks.push(scannedBuffer.slice(i, i + chunkSize));
    }
    try {
      let totalAdded = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((item) => {
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
            sku: item.sku,
            baseSku: item.baseSku,
            status: "in_stock",
            addedBy: item.addedBy,
            timestamp: serverTimestamp(),
            dateIn: item.dateIn,
            dateOut: null,
          });
        });
        await batch.commit();
        totalAdded += chunk.length;
      }
      showNotification(
        `Sucesso! ${totalAdded} itens adicionados ao estoque.`,
        "success"
      );
      setScannedBuffer([]);
      setBufferPage(1);
    } catch (err) {
      console.error(err);
      showNotification(
        "Erro ao enviar alguns itens. Tente novamente.",
        "error"
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const handleClearBuffer = () => {
    if (scannedBuffer.length === 0) return;
    if (
      window.confirm(
        "Tem certeza? Isso vai apagar a leitura atual (NÃO afeta o estoque salvo)."
      )
    ) {
      setScannedBuffer([]);
      setBufferPage(1);
      showNotification("Leitura descartada.", "warning");
    }
  };

  const removeItemFromBuffer = (tempId) => {
    setScannedBuffer((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const bufferItemsPerPage = 10;
  const paginatedBuffer = useMemo(() => {
    const start = (bufferPage - 1) * bufferItemsPerPage;
    return scannedBuffer.slice(start, start + bufferItemsPerPage);
  }, [scannedBuffer, bufferPage]);
  const totalBufferPages = Math.ceil(scannedBuffer.length / bufferItemsPerPage);

  const getAvailability = (sku) => {
    const physical = inventory.filter(
      (i) => i.sku === sku && i.status === "in_stock"
    ).length;
    const reserved = reservations
      .filter((r) => r.sku === sku)
      .reduce((acc, r) => acc + r.quantity, 0);
    return { physical, reserved, available: physical - reserved };
  };

  // --- NOVA LÓGICA DE RESERVAS (FIFO) ---
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
        let status = "ok";
        let missing = 0;

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

  const reduceReservationsIfNecessary = (batch, sku, qtySold) => {
    const { physical, reserved } = getAvailability(sku);
    const free = Math.max(0, physical - reserved);
    const shortage = Math.max(0, qtySold - free);

    if (shortage > 0) {
      let remainingToReduce = shortage;
      const skuRes = reservations
        .filter((r) => r.sku === sku)
        .sort(
          (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );

      for (const res of skuRes) {
        if (remainingToReduce <= 0) break;
        const resRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "reservations",
          res.id
        );
        if (res.quantity <= remainingToReduce) {
          batch.delete(resRef);
          remainingToReduce -= res.quantity;
        } else {
          batch.update(resRef, { quantity: res.quantity - remainingToReduce });
          remainingToReduce = 0;
        }
      }
      return true;
    }
    return false;
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    const skuClean = resSku.toUpperCase().trim();
    const quantity = parseInt(resQty);
    if (!skuClean || quantity < 1) {
      showNotification("Dados inválidos.", "warning");
      return;
    }
    const { available } = getAvailability(skuClean);
    if (available < quantity) {
      showNotification(
        `Erro: Estoque insuficiente. Disponível: ${available}, Solicitado: ${quantity}`,
        "error"
      );
      return;
    }
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "reservations"),
        {
          sku: skuClean,
          quantity: quantity,
          note: resNote.slice(0, 90),
          createdBy: operatorName,
          createdAt: serverTimestamp(),
          dateStr: new Date().toLocaleString("pt-BR"),
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

  // --- NOVA FUNÇÃO: RESERVA RÁPIDA (MODAL) ---
  const handleQuickReservation = async () => {
    if (!db || !user || !quickResModal) return;
    const skuClean = quickResModal.sku;
    const quantity = parseInt(qrQty);

    if (quantity < 1)
      return showNotification("Quantidade inválida.", "warning");

    const { available } = getAvailability(skuClean);
    if (available < quantity) {
      showNotification(`Estoque insuficiente. Disp: ${available}`, "error");
      return;
    }

    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "reservations"),
        {
          sku: skuClean,
          quantity: quantity,
          note: qrNote.slice(0, 90),
          createdBy: operatorName,
          createdAt: serverTimestamp(),
          dateStr: new Date().toLocaleString("pt-BR"),
        }
      );
      showNotification("Reserva criada!", "success");
      setQuickResModal(null);
      setQrQty("1");
      setQrNote("");
    } catch (err) {
      showNotification("Erro ao reservar.", "error");
    }
  };

  const handleCancelReservation = async (id) => {
    if (!db || !user) return;
    if (
      !window.confirm(
        "Cancelar esta reserva? O item voltará a ficar disponível."
      )
    )
      return;
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "reservations", id)
      );
      showNotification("Reserva cancelada.", "success");
    } catch (err) {
      showNotification("Erro ao cancelar.", "error");
    }
  };

  const handleBulkCancelReservations = async () => {
    if (!db || !user) return;
    if (selectedReservations.size === 0) return;
    if (
      !window.confirm(
        `Cancelar ${selectedReservations.size} reservas selecionadas?`
      )
    )
      return;
    const batch = writeBatch(db);
    selectedReservations.forEach((id) => {
      batch.delete(
        doc(db, "artifacts", appId, "public", "data", "reservations", id)
      );
    });
    try {
      await batch.commit();
      showNotification("Reservas canceladas em massa.", "success");
      setSelectedReservations(new Set());
    } catch (err) {
      showNotification("Erro ao processar cancelamento.", "error");
    }
  };

  const toggleSelectReservation = (id) => {
    const newSet = new Set(selectedReservations);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedReservations(newSet);
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

    const conflictedSkus = [];
    const safeSkus = [];

    Object.keys(tempCounts).forEach((sku) => {
      const { physical, reserved } = getAvailability(sku);
      const reqQty = tempCounts[sku];
      const available = physical - reserved;

      if (reqQty > available) {
        conflictedSkus.push({ sku, req: reqQty, avail: available, reserved });
      } else {
        safeSkus.push({ sku, qty: reqQty });
      }
    });

    if (conflictedSkus.length > 0) {
      setConflictData({
        conflicts: conflictedSkus,
        safe: safeSkus,
        lines,
      });
      return;
    }
    executeBatchSales(lines);
  };

  const executeBatchSales = async (skuList) => {
    if (!db) return;
    const batch = writeBatch(db);
    let batchCount = 0;
    let reservationAdjusted = false;
    let tempInventory = [...inventory];

    const skuCounts = {};
    skuList.forEach((s) => (skuCounts[s] = (skuCounts[s] || 0) + 1));

    Object.keys(skuCounts).forEach((sku) => {
      const reduced = reduceReservationsIfNecessary(batch, sku, skuCounts[sku]);
      if (reduced) reservationAdjusted = true;
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
          soldBy: operatorName,
        });
        tempInventory.splice(itemIndex, 1);
        batchCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      let msg = `${batchCount} baixados com sucesso!`;
      if (reservationAdjusted) msg += " (Reservas ajustadas automaticamente)";
      showNotification(msg, "success");
      setSalesInput("");
      setConflictData(null);
    } else {
      showNotification(
        "Nenhum item disponível para baixa na lista.",
        "warning"
      );
    }
  };

  const handleResetStock = async () => {
    if (
      !window.confirm(
        "PERIGO: Isso apagará TODOS os itens do estoque FÍSICO atual do sistema.\n\nIsso é usado apenas para começar um inventário do zero.\n\nTem certeza absoluta?"
      )
    )
      return;

    const confirmCode = Math.floor(1000 + Math.random() * 9000);
    const userInput = window.prompt(
      `Para confirmar, digite o código: ${confirmCode}`
    );

    if (userInput !== String(confirmCode)) {
      showNotification("Código incorreto. Cancelado.", "error");
      return;
    }

    if (!db) return;

    try {
      const q = query(
        collection(db, "artifacts", appId, "public", "data", "inventory_items"),
        where("status", "==", "in_stock")
      );
      const snapshot = await getDocs(q);

      const chunkSize = 400;
      const chunks = [];
      for (let i = 0; i < snapshot.docs.length; i += chunkSize) {
        chunks.push(snapshot.docs.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      showNotification("Estoque ZERADO com sucesso.", "success");
    } catch (e) {
      showNotification("Erro ao zerar estoque.", "error");
    }
  };

  const adjustStock = async (group, delta) => {
    if (!db) return;

    if (delta < 0) {
      const removeQty = Math.abs(delta);
      const { available } = getAvailability(group.sku);

      if (removeQty > available) {
        if (
          !window.confirm(
            `ALERTA DE RESERVA:\nEste item tem reservas ativas.\nDisponível livre: ${available}\nVocê está removendo: ${removeQty}\n\nIsso vai consumir reservas. Continuar?`
          )
        ) {
          return;
        }
      }
    }

    let reservationAdjusted = false;

    if (delta > 0) {
      const batch = writeBatch(db);
      for (let i = 0; i < delta; i++) {
        const newRef = doc(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "inventory_items"
          )
        );
        batch.set(newRef, {
          sku: group.sku,
          baseSku: group.baseSku,
          status: "in_stock",
          addedBy: operatorName,
          manualAdjustment: true,
          timestamp: serverTimestamp(),
          dateIn: new Date().toLocaleString("pt-BR"),
          dateOut: null,
        });
      }
      await batch.commit();
      showNotification(`Adicionado ${delta} itens de ${group.sku}`, "success");
    } else {
      const batch = writeBatch(db);
      const qtyToRemove = Math.abs(delta);

      const reduced = reduceReservationsIfNecessary(
        batch,
        group.sku,
        qtyToRemove
      );
      if (reduced) reservationAdjusted = true;

      const itemsToRemove = group.entries
        .sort(
          (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
        )
        .slice(0, qtyToRemove);
      if (itemsToRemove.length === 0) return;

      itemsToRemove.forEach((item) => {
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
          removedBy: operatorName,
        });
      });

      await batch.commit();
      let msg = `Removido ${itemsToRemove.length} itens de ${group.sku}`;
      if (reservationAdjusted) msg += " (Reserva ajustada)";
      showNotification(msg, "success");
    }
  };

  const toggleSelectAll = () => {
    if (selectedSkus.size === paginatedData.length) {
      setSelectedSkus(new Set());
    } else {
      setSelectedSkus(new Set(paginatedData.map((g) => g.sku)));
    }
  };
  const toggleSelectOne = (sku) => {
    const newSet = new Set(selectedSkus);
    if (newSet.has(sku)) {
      newSet.delete(sku);
    } else {
      newSet.add(sku);
    }
    setSelectedSkus(newSet);
  };

  const handleBulkDelete = async () => {
    if (!db) return;

    let totalItemsToRemove = 0;
    const itemsToDelete = [];
    const skusToAdjust = new Set();

    inventory.forEach((item) => {
      if (item.status === "in_stock" && selectedSkus.has(item.sku)) {
        itemsToDelete.push(item);
        totalItemsToRemove++;
        skusToAdjust.add(item.sku);
      }
    });

    if (totalItemsToRemove === 0) {
      showNotification(
        "Nenhum item em estoque para os produtos selecionados.",
        "warning"
      );
      return;
    }

    let hasConflict = false;
    skusToAdjust.forEach((sku) => {
      const { reserved } = getAvailability(sku);
      if (reserved > 0) hasConflict = true;
    });

    if (hasConflict) {
      if (
        !window.confirm(
          "ALERTA: Alguns dos itens selecionados possuem RESERVAS ATIVAS.\nA exclusão consumirá essas reservas.\n\nDeseja prosseguir?"
        )
      )
        return;
    } else {
      if (!window.confirm(`Remover itens selecionados do estoque físico?`))
        return;
    }

    const chunkSize = 400;
    let reservationAdjusted = false;

    for (let i = 0; i < itemsToDelete.length; i += chunkSize) {
      const chunk = itemsToDelete.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      const chunkCounts = {};
      chunk.forEach(
        (item) => (chunkCounts[item.sku] = (chunkCounts[item.sku] || 0) + 1)
      );

      Object.keys(chunkCounts).forEach((sku) => {
        if (reduceReservationsIfNecessary(batch, sku, chunkCounts[sku]))
          reservationAdjusted = true;
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
          removedBy: operatorName,
          bulkAction: true,
        });
      });
      await batch.commit();
    }

    let msg = `${totalItemsToRemove} itens removidos.`;
    if (reservationAdjusted) msg += " (Reservas ajustadas)";
    showNotification(msg, "success");
    setSelectedSkus(new Set());
  };

  const handleExportXLSX = () => {
    if (!window.XLSX) {
      showNotification("Carregando bibliotecas...", "warning");
      return;
    }
    if (filteredAndSortedGroups.length === 0) {
      showNotification("Nada para exportar.", "warning");
      return;
    }

    const exportData = filteredAndSortedGroups.map((group) => ({
      SKU: group.sku,
      Produto: group.name,
      Modelo: group.model,
      Quantidade: group.displayQuantity,
      Reservado: group.reservedQuantity,
      Preço: group.price,
      Total: group.price * group.displayQuantity,
      Ultima_Modificacao: group.lastModifiedStr || "-",
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Estoque Atual");
    window.XLSX.writeFile(
      wb,
      `estoque_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const handleExportPDF = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showNotification(
        "Carregando bibliotecas... Tente novamente em instantes.",
        "warning"
      );
      return;
    }
    if (filteredAndSortedGroups.length === 0) {
      showNotification("Nada para exportar.", "warning");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório de Estoque", 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(
      `Total de Itens (Líquido): ${
        totalItems - reservations.reduce((acc, r) => acc + r.quantity, 0)
      }`,
      14,
      36
    );

    const tableColumn = ["SKU", "Produto", "Modelo", "Disp.", "Res.", "Preço"];
    const tableRows = [];

    filteredAndSortedGroups.forEach((group) => {
      const productData = [
        group.sku,
        group.name,
        group.model,
        group.displayQuantity,
        group.reservedQuantity > 0 ? group.reservedQuantity : "-",
        `R$ ${group.price.toFixed(2)}`,
      ];
      tableRows.push(productData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 160, 133] },
    });

    doc.save(`relatorio_estoque_${new Date().toISOString().split("T")[0]}.pdf`);
  };

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

  const reportData = useMemo(() => {
    if (activeTab !== "reports") return [];
    const events = [];
    const start = new Date(reportStartDate + "T00:00:00");
    const end = new Date(reportEndDate + "T23:59:59");

    inventory.forEach((item) => {
      const details = findCatalogItem(item.sku);
      const processEvent = (date, type, user) => {
        const d = date?.toDate ? date.toDate() : new Date(0);
        if (d >= start && d <= end) {
          events.push({
            id: item.id + "_" + type,
            date: d,
            type,
            sku: item.sku,
            name: details?.name || "N/I",
            user: user || "-",
            details,
          });
        }
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
      if (resDate >= start && resDate <= end) {
        events.push({
          id: res.id + "_res_created",
          date: resDate,
          type: "reserva_criada",
          sku: res.sku,
          name: details?.name || "N/I",
          user: res.createdBy || "-",
          details,
        });
      }
    });

    return events.sort((a, b) => b.date - a.date);
  }, [
    inventory,
    reservations,
    reportStartDate,
    reportEndDate,
    activeTab,
    catalog,
    catalogMap,
  ]);

  const paginatedReportData = useMemo(() => {
    const startIndex = (currentReportPage - 1) * itemsPerPage;
    return reportData.slice(startIndex, startIndex + itemsPerPage);
  }, [reportData, currentReportPage, itemsPerPage]);

  const totalReportPages = Math.ceil(reportData.length / itemsPerPage);
  const reportStats = useMemo(() => {
    return {
      entries: reportData.filter((e) => e.type === "entrada").length,
      sales: reportData.filter((e) => e.type === "saida").length,
      adjustments: reportData.filter((e) => e.type === "ajuste").length,
    };
  }, [reportData]);

  // --- AGRUPAMENTO (INVENTORY LOGIC COM RESERVAS) ---
  const groupedInventory = useMemo(() => {
    const groups = {};
    const lastModifiedMap = {};

    const reservationsMap = {};
    reservations.forEach((res) => {
      if (!reservationsMap[res.sku])
        reservationsMap[res.sku] = { qty: 0, notes: [] };
      reservationsMap[res.sku].qty += res.quantity;
      reservationsMap[res.sku].notes.push(res.note);
    });

    inventory.forEach((item) => {
      const sku = item.sku;
      let itemTime = 0;
      let itemDateStr = "";
      let actionType = "";
      let actionUser = "";

      if (item.status === "in_stock") {
        itemTime = item.timestamp?.seconds || 0;
        itemDateStr = item.dateIn;
        actionType = "add";
        actionUser = item.addedBy;
      } else if (item.status === "sold") {
        itemTime = item.soldTimestamp?.seconds || 0;
        itemDateStr = item.dateOut;
        actionType = "remove";
        actionUser = item.soldBy;
      } else if (item.status === "adjusted_out") {
        itemTime = item.outTimestamp?.seconds || 0;
        itemDateStr = item.dateOut;
        actionType = "remove";
        actionUser = item.removedBy;
      }

      if (!lastModifiedMap[sku] || itemTime > lastModifiedMap[sku].time) {
        lastModifiedMap[sku] = {
          time: itemTime,
          str: itemDateStr,
          type: actionType,
          user: actionUser,
        };
      }
    });

    inventory.forEach((item) => {
      if (item.status !== "in_stock") return;
      const sku = item.sku;
      if (!groups[sku]) {
        const details = findCatalogItem(sku);
        groups[sku] = {
          sku: sku,
          baseSku: details ? details.sku : "-",
          name: details ? details.name : "Produto Não Identificado",
          model: details ? details.model : "-",
          image: details ? details.image : null,
          price: details ? details.price : 0,
          quantity: 0,
          reservedQuantity: reservationsMap[sku]?.qty || 0,
          reservationNotes: reservationsMap[sku]?.notes || [],
          entries: [],
          lastModified: null,
          lastModifiedStr: null,
          lastActionType: null,
          lastModifiedUser: null,
        };
      }
      groups[sku].quantity += 1;
      groups[sku].entries.push(item);

      if (lastModifiedMap[sku]) {
        groups[sku].lastModified = lastModifiedMap[sku].time;
        groups[sku].lastModifiedStr = lastModifiedMap[sku].str;
        groups[sku].lastActionType = lastModifiedMap[sku].type;
        groups[sku].lastModifiedUser = lastModifiedMap[sku].user;
      }
    });

    Object.values(groups).forEach((g) => {
      g.displayQuantity = g.quantity - g.reservedQuantity;
    });

    return Object.values(groups);
  }, [inventory, catalog, reservations, catalogMap]);

  // --- FILTRAGEM SEGURA E NORMALIZADA ---
  const filteredAndSortedGroups = useMemo(() => {
    let result = groupedInventory.filter((group) => {
      // 1. Normaliza a busca
      const searchLower = normalizeText(debouncedSearch);

      // 2. Normaliza os campos do produto
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

  // --- OTIMIZAÇÃO: FILTRO DE MODELOS DINÂMICO (CORREÇÃO PEDIDA) ---
  const modelsAvailableInSearch = useMemo(() => {
    // 1. Filtra primeiro pela pesquisa (debouncedSearch)
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

    // 2. Extrai os modelos únicos APENAS desses itens filtrados
    const models = new Set();
    matchingItems.forEach((item) => {
      if (item.model && item.model !== "-") models.add(item.model);
    });
    return Array.from(models).sort();
  }, [groupedInventory, debouncedSearch]); // Recalcula sempre que a pesquisa muda

  const totalItems = inventory.filter((i) => i.status === "in_stock").length;
  const totalValue = groupedInventory.reduce(
    (acc, group) => acc + group.price * group.quantity,
    0
  );

  const requestSort = (key) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  };
  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <div className="w-4 h-4" />;
    return sortConfig.direction === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  // --- RENDER ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-6">
            Acesso Restrito
          </h1>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Seu Nome
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN"
                className="w-full text-center text-3xl tracking-[0.5em] font-mono p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500"
                maxLength={4}
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-sm text-center font-bold">
                Dados incorretos.
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors"
            >
              ENTRAR
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative">
      {/* CONFLICT MODAL */}
      {conflictData && (
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
              {conflictData.conflicts.map((c, i) => (
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
                onClick={() => {
                  const allSkus = conflictData.lines;
                  executeBatchSales(allSkus);
                }}
                className="w-full py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
              >
                SIM PARA TODOS (Baixar inclusive reservados)
              </button>
              <button
                onClick={() => {
                  const safeOnly = conflictData.safe.map((s) => s.sku);
                  const safeList = [];
                  conflictData.safe.forEach((s) => {
                    for (let k = 0; k < s.qty; k++) safeList.push(s.sku);
                  });
                  if (safeList.length === 0) {
                    showNotification(
                      "Nenhum item restante para baixar.",
                      "warning"
                    );
                    setConflictData(null);
                  } else {
                    executeBatchSales(safeList);
                  }
                }}
                className="w-full py-3 rounded-lg bg-slate-200 text-slate-700 font-bold hover:bg-slate-300"
              >
                NÃO (Pular itens conflitantes)
              </button>
              <button
                onClick={() => setConflictData(null)}
                className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm font-medium"
              >
                Cancelar Operação
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSkus.size > 0 && activeTab === "stock" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-slide-up">
          <div className="flex flex-col">
            <span className="font-bold text-sm">
              {selectedSkus.size} produtos selecionados
            </span>
            <span className="text-[10px] text-slate-400">Ação em massa</span>
          </div>
          <div className="h-8 w-px bg-slate-600"></div>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-full font-bold text-sm transition-colors"
          >
            <Trash2 size={16} /> Excluir Selecionados
          </button>
          <button
            onClick={() => setSelectedSkus(new Set())}
            className="text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {selectedReservations.size > 0 && activeTab === "reservations" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-slide-up">
          <div className="flex flex-col">
            <span className="font-bold text-sm">
              {selectedReservations.size} reservas selecionadas
            </span>
          </div>
          <div className="h-8 w-px bg-slate-600"></div>
          <button
            onClick={handleBulkCancelReservations}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-full font-bold text-sm transition-colors"
          >
            <X size={16} /> Cancelar Selecionadas
          </button>
          <button
            onClick={() => setSelectedReservations(new Set())}
            className="text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              className="absolute -top-12 right-0 text-white p-2 hover:bg-white/20 rounded-full"
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

      {/* --- MODAL DE RESERVA RÁPIDA (POPUP) --- */}
      {quickResModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BookmarkPlus size={20} className="text-yellow-500" />
                  Reservar Item
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {quickResModal.sku}
                </p>
                <p className="text-sm text-slate-700 font-medium line-clamp-1">
                  {quickResModal.name}
                </p>
              </div>
              <button
                onClick={() => setQuickResModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Quantidade
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setQrQty(String(Math.max(1, parseInt(qrQty) - 1)))
                    }
                    className="p-2 bg-slate-100 rounded hover:bg-slate-200"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={qrQty}
                    onChange={(e) => setQrQty(e.target.value)}
                    className="flex-1 text-center p-2 border rounded-lg font-bold"
                  />
                  <button
                    onClick={() => setQrQty(String(parseInt(qrQty) + 1))}
                    className="p-2 bg-slate-100 rounded hover:bg-slate-200"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Observação
                </label>
                <input
                  type="text"
                  value={qrNote}
                  onChange={(e) => setQrNote(e.target.value)}
                  className="w-full p-3 border rounded-lg text-sm"
                  placeholder="Ex: Cliente Maria (Retira Amanhã)"
                  autoFocus
                />
              </div>
              <button
                onClick={handleQuickReservation}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg mt-2"
              >
                CONFIRMAR RESERVA
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Ajustar Estoque
                </h3>
                <p className="text-sm text-slate-500">{editModal.sku}</p>
              </div>
              <button
                onClick={() => setEditModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-6 mb-8">
              <button
                onClick={() => {
                  adjustStock(editModal, -1);
                  setEditModal(null);
                }}
                className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors"
              >
                <Minus size={32} />
              </button>
              <div className="text-center">
                <span className="block text-3xl font-bold text-slate-800">
                  {editModal.quantity}
                </span>
                <span className="text-xs text-slate-400 uppercase">Atual</span>
              </div>
              <button
                onClick={() => {
                  adjustStock(editModal, 1);
                  setEditModal(null);
                }}
                className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors"
              >
                <Plus size={32} />
              </button>
            </div>
            <div className="border-t pt-4">
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Tem certeza que deseja excluir TODOS os ${editModal.quantity} itens deste produto?`
                    )
                  ) {
                    adjustStock(editModal, -editModal.quantity);
                    setEditModal(null);
                  }
                }}
                className="w-full py-3 rounded-xl border-2 border-red-100 text-red-600 font-bold hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Excluir Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src="https://www.semprejoias.com.br/favicon/34692/sjoiasfav.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Estoque Sempre Joias v0.8</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>
                  Operador:{" "}
                  <strong className="text-white">{operatorName}</strong>
                </span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span>{catalog.length} produtos</span>
              </div>
            </div>
            <button onClick={handleLogout} className="md:hidden text-slate-400">
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
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(totalValue)}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="hidden md:block text-slate-400 hover:text-white ml-2"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b sticky top-[76px] z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {/* MUDANÇA DE ORDEM: ESTOQUE PRIMEIRO */}
          <button
            onClick={() => setActiveTab("stock")}
            className={`flex-1 min-w-[100px] py-4 text-sm font-medium border-b-2 flex justify-center gap-2 ${
              activeTab === "stock"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500"
            }`}
          >
            <ClipboardList size={18} /> ESTOQUE
          </button>
          <button
            onClick={() => setActiveTab("conference")}
            className={`flex-1 min-w-[100px] py-4 text-sm font-medium border-b-2 flex justify-center gap-2 ${
              activeTab === "conference"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500"
            }`}
          >
            <Barcode size={18} /> CONFERÊNCIA
          </button>
          <button
            onClick={() => setActiveTab("reservations")}
            className={`flex-1 min-w-[100px] py-4 text-sm font-medium border-b-2 flex justify-center gap-2 ${
              activeTab === "reservations"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500"
            }`}
          >
            <Bookmark size={18} /> RESERVAS
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`flex-1 min-w-[100px] py-4 text-sm font-medium border-b-2 flex justify-center gap-2 ${
              activeTab === "sales"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500"
            }`}
          >
            <Upload size={18} /> BAIXA
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 min-w-[100px] py-4 text-sm font-medium border-b-2 flex justify-center gap-2 ${
              activeTab === "reports"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500"
            }`}
          >
            <BarChart2 size={18} /> RELATÓRIOS
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`flex-1 min-w-[100px] py-4 text-sm font-medium border-b-2 flex justify-center gap-2 ${
              activeTab === "config"
                ? "border-red-500 text-red-600"
                : "border-transparent text-slate-500"
            }`}
          >
            <Settings size={18} /> CONFIG
          </button>
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

        {/* --- NOVA ABA CONFERENCIA COM BUFFER --- */}
        {activeTab === "conference" && (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-full max-w-lg bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 text-center relative overflow-hidden mb-8">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500"></div>
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                  <Barcode size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Leitor Ativo
                </h2>
                <p className="text-slate-500 mt-2 text-sm">
                  Bipe para a lista temporária (Buffer)
                </p>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleScanToBuffer}
                disabled={!db || isCommitting}
                className="w-full h-16 px-6 text-3xl font-mono text-center border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all uppercase placeholder:text-slate-300 disabled:bg-slate-100"
                placeholder={isCommitting ? "ENVIANDO..." : "BIPAR..."}
              />
            </div>

            {/* ÁREA DO BUFFER */}
            <div className="w-full max-w-3xl">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <List size={20} className="text-blue-600" />
                    <h3 className="font-bold text-slate-700">
                      Itens Lidos na Sessão: {scannedBuffer.length}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearBuffer}
                      disabled={scannedBuffer.length === 0 || isCommitting}
                      className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors disabled:opacity-50"
                    >
                      DESCARTAR
                    </button>
                    <button
                      onClick={handleCommitBuffer}
                      disabled={scannedBuffer.length === 0 || isCommitting}
                      className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCommitting ? (
                        <RefreshCw className="animate-spin" size={14} />
                      ) : (
                        <Save size={14} />
                      )}
                      {isCommitting ? "ENVIANDO..." : "ENVIAR PRO ESTOQUE"}
                    </button>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-bold sticky top-0">
                      <tr>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Produto</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedBuffer.map((item) => (
                        <tr key={item.tempId} className="hover:bg-blue-50/50">
                          <td className="px-4 py-2 font-mono font-bold text-blue-600 text-xs">
                            {item.sku}
                          </td>
                          <td className="px-4 py-2">
                            <span className="block text-xs font-medium text-slate-700 truncate max-w-[200px]">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.baseSku}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => removeItemFromBuffer(item.tempId)}
                              className="text-slate-300 hover:text-red-500 p-1"
                              title="Remover da lista"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {scannedBuffer.length === 0 && (
                        <tr>
                          <td
                            colSpan="3"
                            className="px-6 py-12 text-center text-slate-400"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <Barcode size={32} className="opacity-20" />
                              <p>Lista vazia. Comece a bipar!</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Paginação Simples do Buffer */}
                {totalBufferPages > 1 && (
                  <div className="bg-slate-50 px-4 py-2 border-t flex justify-between items-center text-xs text-slate-500">
                    <span>
                      Página {bufferPage} de {totalBufferPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setBufferPage((p) => Math.max(1, p - 1))}
                        disabled={bufferPage === 1}
                        className="p-1 rounded bg-white border hover:bg-slate-100 disabled:opacity-50"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setBufferPage((p) =>
                            Math.min(totalBufferPages, p + 1)
                          )
                        }
                        disabled={bufferPage === totalBufferPages}
                        className="p-1 rounded bg-white border hover:bg-slate-100 disabled:opacity-50"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- NOVA ABA CONFIGURAÇÕES (DANGER ZONE) --- */}
        {activeTab === "config" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-full max-w-2xl">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center shadow-lg">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert size={48} />
                </div>
                <h2 className="text-2xl font-bold text-red-800 mb-2">
                  Zona de Perigo
                </h2>
                <p className="text-red-600 mb-8 max-w-md mx-auto">
                  Ações nesta área são irreversíveis e afetam todo o banco de
                  dados. Use apenas se souber exatamente o que está fazendo.
                </p>

                <button
                  onClick={handleResetStock}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 mx-auto"
                >
                  <Trash2 size={24} />
                  APAGAR TODO O ESTOQUE
                </button>
                <p className="mt-4 text-xs text-red-400 font-bold uppercase tracking-widest">
                  Requer confirmação dupla + código de segurança
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "stock" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
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
              <div className="flex gap-2">
                <button
                  onClick={fetchCatalogXLSX}
                  disabled={loadingCatalog}
                  className="p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <RefreshCw
                    size={20}
                    className={loadingCatalog ? "animate-spin" : ""}
                  />
                </button>

                {/* BOTÕES DE EXPORTAÇÃO */}
                <div className="flex border border-slate-300 rounded-lg overflow-hidden">
                  <button
                    onClick={handleExportXLSX}
                    className="px-3 py-2 bg-white hover:bg-green-50 text-green-600 border-r border-slate-200 flex items-center gap-1 text-xs font-medium transition-colors"
                    title="Exportar Excel"
                  >
                    <FileSpreadsheet size={16} /> XLSX
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 flex items-center gap-1 text-xs font-medium transition-colors"
                    title="Exportar PDF"
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
                    className="w-full pl-9 pr-8 py-2.5 border border-slate-300 rounded-lg outline-none bg-white text-sm appearance-none"
                    value={filterModel}
                    onChange={(e) => {
                      setFilterModel(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">Todos Modelos</option>
                    {/* USO DA LISTA FILTRADA DINAMICAMENTE */}
                    {modelsAvailableInSearch.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 font-bold tracking-wider">
                      <th className="px-4 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={
                            selectedSkus.size > 0 &&
                            selectedSkus.size === paginatedData.length
                          }
                          onChange={toggleSelectAll}
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
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedSkus.has(group.sku)}
                            onChange={() => toggleSelectOne(group.sku)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer group relative"
                            onClick={() =>
                              group.image && setZoomedImage(group.image)
                            }
                          >
                            {group.image ? (
                              <img
                                src={group.image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package size={16} className="text-slate-300" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-600 text-xs">
                            {group.sku}
                          </span>
                          {group.reservedQuantity > 0 && (
                            <div
                              className="mt-1 group relative inline-block"
                              title={`${group.reservedQuantity} un. reservadas`}
                            >
                              <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                R {group.reservedQuantity}
                              </span>
                              {/* Tooltip Customizado */}
                              <div className="hidden group-hover:block absolute left-0 top-6 bg-black/90 text-white text-xs p-2 rounded w-48 z-10 shadow-xl">
                                <div className="font-bold mb-1 border-b border-gray-700 pb-1">
                                  Reservas Ativas:
                                </div>
                                <ul className="list-disc list-inside text-[10px] text-gray-300">
                                  {group.reservationNotes.map((note, i) => (
                                    <li key={i}>{note || "Sem observação"}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-700 text-xs md:text-sm font-medium line-clamp-1">
                            {group.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {group.baseSku} • {group.model}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar size={12} />
                            {group.lastModifiedStr || "-"}
                            {group.lastActionType === "add" && (
                              <ArrowUp size={12} className="text-green-500" />
                            )}
                            {group.lastActionType === "remove" && (
                              <ArrowDown size={12} className="text-red-500" />
                            )}
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
                          {group.reservedQuantity > 0 && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              Físico: {group.quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setQuickResModal(group);
                                setQrQty("1");
                                setQrNote("");
                              }}
                              className="p-1.5 text-yellow-500 hover:text-white bg-yellow-50 hover:bg-yellow-500 rounded transition-colors"
                              title="Reserva Rápida"
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              onClick={() => setEditModal(group)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded transition-colors"
                              title="Ajustar Estoque"
                            >
                              <Edit2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAndSortedGroups.length === 0 && (
                      <tr>
                        <td
                          colSpan="8"
                          className="px-6 py-8 text-center text-slate-400"
                        >
                          Nenhum item encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
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
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- ABA RESERVAS --- */}
        {activeTab === "reservations" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulário */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Bookmark size={18} className="text-yellow-500" /> Nova
                  Reserva
                </h3>
                <form onSubmit={handleCreateReservation} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      SKU do Produto
                    </label>
                    <input
                      type="text"
                      value={resSku}
                      onChange={(e) => setResSku(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg uppercase font-mono"
                      placeholder="Ex: DIR-NAV-Z-16"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={resQty}
                      onChange={(e) => setResQty(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Observação (Cliente/Evento)
                    </label>
                    <input
                      type="text"
                      maxLength={90}
                      value={resNote}
                      onChange={(e) => setResNote(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg"
                      placeholder="Ex: Cliente Maria"
                    />
                    <div className="text-right text-[10px] text-slate-400 mt-1">
                      {resNote.length}/90
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg transition-colors shadow-sm"
                  >
                    CRIAR RESERVA
                  </button>
                </form>
              </div>

              {/* Lista */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 text-sm">
                    Reservas Ativas ({reservations.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b">
                      <tr>
                        <th className="px-4 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300"
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedReservations(
                                  new Set(reservations.map((r) => r.id))
                                );
                              else setSelectedReservations(new Set());
                            }}
                            checked={
                              reservations.length > 0 &&
                              selectedReservations.size === reservations.length
                            }
                          />
                        </th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Obs</th>
                        <th className="px-4 py-3 text-right">Qtd</th>
                        <th className="px-4 py-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reservationsWithStatus.map((res) => (
                        <tr key={res.id} className="hover:bg-yellow-50/30">
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300"
                              checked={selectedReservations.has(res.id)}
                              onChange={() => toggleSelectReservation(res.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {res.status === "ok" && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                                <CheckCircle size={10} /> OK
                              </span>
                            )}
                            {res.status === "partial" && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded"
                                title={`Faltam ${res.missing} peças`}
                              >
                                <AlertOctagon size={10} /> Parcial
                              </span>
                            )}
                            {res.status === "missing" && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-red-100 text-red-700 px-2 py-1 rounded">
                                <XCircle size={10} /> Sem Estoque
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {res.dateStr?.split(" ")[0] || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700">
                            {res.sku}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                            {res.note}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {res.quantity}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleCancelReservation(res.id)}
                              className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {reservations.length === 0 && (
                        <tr>
                          <td
                            colSpan="7"
                            className="px-6 py-12 text-center text-slate-400"
                          >
                            Nenhuma reserva ativa.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Filter size={18} /> Filtros do Relatório
              </h3>
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Data Início
                    </label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="border p-2 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Data Fim
                    </label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="border p-2 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setReportRange(0)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Clock size={12} /> Hoje
                  </button>
                  <button
                    onClick={() => setReportRange(7)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Clock size={12} /> 7 Dias
                  </button>
                  <button
                    onClick={() => setReportRange(30)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Clock size={12} /> 30 Dias
                  </button>
                  <button
                    onClick={() => setReportRange("month")}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Clock size={12} /> Este Mês
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border-l-4 border-green-500 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">
                      Total Entradas
                    </p>
                    <h4 className="text-2xl font-bold text-slate-800">
                      {reportStats.entries}
                    </h4>
                  </div>
                  <div className="bg-green-100 p-2 rounded-lg text-green-600">
                    <TrendingUp size={20} />
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">
                      Total Vendas
                    </p>
                    <h4 className="text-2xl font-bold text-slate-800">
                      {reportStats.sales}
                    </h4>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <Package size={20} />
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border-l-4 border-red-500 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">
                      Ajustes / Perdas
                    </p>
                    <h4 className="text-2xl font-bold text-slate-800">
                      {reportStats.adjustments}
                    </h4>
                  </div>
                  <div className="bg-red-100 p-2 rounded-lg text-red-600">
                    <TrendingDown size={20} />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b">
                    <tr>
                      <th className="px-6 py-4">Data / Hora</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">SKU</th>
                      <th className="px-6 py-4">Produto</th>
                      <th className="px-6 py-4">Operador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedReportData.map((event) => (
                      <tr key={event.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono text-xs text-slate-600">
                          {event.date.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase ${
                              event.type === "entrada"
                                ? "bg-green-100 text-green-700"
                                : event.type === "saida"
                                ? "bg-blue-100 text-blue-700"
                                : event.type === "reserva_criada"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {event.type === "entrada" && (
                              <TrendingUp size={12} />
                            )}
                            {event.type === "saida" && (
                              <CheckCircle size={12} />
                            )}
                            {event.type === "ajuste" && (
                              <AlertTriangle size={12} />
                            )}
                            {event.type === "reserva_criada" && (
                              <Bookmark size={12} />
                            )}
                            {event.type}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-bold text-slate-700">
                          {event.sku}
                        </td>
                        <td
                          className="px-6 py-3 text-slate-600 max-w-xs truncate"
                          title={event.name}
                        >
                          {event.name}
                        </td>
                        <td className="px-6 py-3 text-slate-500 flex items-center gap-1">
                          <User size={12} /> {event.user}
                        </td>
                      </tr>
                    ))}
                    {paginatedReportData.length === 0 && (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-8 text-center text-slate-400"
                        >
                          Nenhum evento encontrado neste período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalReportPages > 1 && (
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {(currentReportPage - 1) * itemsPerPage + 1}-
                    {Math.min(
                      currentReportPage * itemsPerPage,
                      reportData.length
                    )}{" "}
                    de {reportData.length} eventos
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setCurrentReportPage((p) => Math.max(1, p - 1))
                      }
                      disabled={currentReportPage === 1}
                      className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="flex items-center px-2 font-medium bg-white border border-slate-300 rounded">
                      Página {currentReportPage} de {totalReportPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentReportPage((p) =>
                          Math.min(totalReportPages, p + 1)
                        )
                      }
                      disabled={currentReportPage === totalReportPages}
                      className="p-1.5 rounded bg-white border hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "sales" && (
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
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold"
            >
              BAIXAR ITENS
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
